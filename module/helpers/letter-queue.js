/**
 * letter-queue.js — phase-gated outbox for letters drafted outside the
 * Epistolary phase. A player can compose and click "Send" any time; if it's
 * not currently the Epistolary phase, the letter is parked in the queue.
 * When the Epistolary phase begins, every player gets a one-shot prompt
 * for each of their own queued letters: Send Now / Edit / Discard.
 *
 * Storage: world setting `letterQueue`, an array of entries. World scope
 * means only the GM can write directly; players queue via the `letter-queue-request`
 * socket message which the GM client processes (same single-writer pattern as
 * pending-changes / rumour board).
 *
 * Entry shape:
 *   {
 *     id:           string,    // uuid for this queue entry
 *     userId:       string,    // who queued it
 *     fromActorId:  string,
 *     toActorId:    string,
 *     letter:       object,    // the full _buildLetterPayload() result
 *     cycleQueued:  number,    // cycle number when queued (informational)
 *     ts:           number,    // epoch ms
 *   }
 */

const SYS = 'good-society-homebrew';
const SETTING = 'letterQueue';
const SOCKET_NAME = 'system.good-society-homebrew';

/** Returns the current queue array (empty if uninitialised). */
export function readQueue() {
  try {
    const v = game.settings.get(SYS, SETTING);
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

/** All queued letters for a given user (filtering happens on every client). */
export function queuedLettersForUser(userId) {
  return readQueue().filter(e => e.userId === userId);
}

/** Total count of queued letters in the world (for badges). */
export function totalQueuedLetters() {
  return readQueue().length;
}

/**
 * Queue a letter. Players who aren't GM emit a socket; the GM client writes
 * the setting. Resolves once the letter is in the queue.
 *
 * @param {object} entry  partial entry — `id`, `ts`, `userId` are filled in.
 */
export async function queueLetter(entry) {
  const full = {
    id: foundry.utils.randomID(),
    userId: game.user?.id,
    ts: Date.now(),
    ...entry,
  };
  if (game.user?.isGM) {
    const next = [...readQueue(), full];
    await game.settings.set(SYS, SETTING, next);
    return full.id;
  }
  // Player path — emit a socket request to the GM client.
  game.socket?.emit(SOCKET_NAME, {
    action: 'letterQueueAdd',
    payload: full,
  });
  return full.id;
}

/** Remove one queued letter by id (GM-side write). */
export async function dequeueLetter(entryId) {
  if (game.user?.isGM) {
    const next = readQueue().filter(e => e.id !== entryId);
    await game.settings.set(SYS, SETTING, next);
    return;
  }
  game.socket?.emit(SOCKET_NAME, {
    action: 'letterQueueRemove',
    payload: { entryId },
  });
}

/** GM-side socket handler — processes player-emitted queue requests. */
export function registerLetterQueueSocket() {
  game.socket?.on(SOCKET_NAME, async (msg) => {
    if (!game.user?.isGM) return; // only the GM writes the setting
    if (!msg || typeof msg !== 'object') return;
    if (msg.action === 'letterQueueAdd') {
      const next = [...readQueue(), msg.payload];
      await game.settings.set(SYS, SETTING, next);
    } else if (msg.action === 'letterQueueRemove') {
      const next = readQueue().filter(e => e.id !== msg.payload?.entryId);
      await game.settings.set(SYS, SETTING, next);
    }
  });
}
