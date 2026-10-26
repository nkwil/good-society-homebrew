/**
 * Session mechanism — "a session" is a single sitting of play, which may
 * span part of a novel chapter / phase. Multiple sessions can roll into
 * one cycle; this is a lighter-weight unit than cycle advancement.
 *
 * GM-only lifecycle:
 *   startSession()  → bumps the session counter, flips state to active,
 *                     broadcasts a socket message that force-opens the
 *                     Session Greeting on every client, and posts a
 *                     "session N begins" chat card.
 *   endSession()    → flips state to between, broadcasts a socket
 *                     message that opens the player debrief modal on
 *                     every player's client (not the GM), and posts a
 *                     "session N ends" chat card.
 *
 * Session state lives in world settings:
 *   sessionNumber   — monotonically increasing integer
 *   sessionState    — 'between' | 'active'
 *   sessionStartedAt / sessionLastEndedAt — timestamps
 *
 * Player debrief notes live on each user's own flags
 * (`user.flags[NS].sessionDebriefNotes[sessionNumber] = {text, ts}`),
 * so each client writes its own data without socket coordination. The
 * GM-side viewer walks every connected user's flags to aggregate.
 */

const NS = 'good-society-homebrew';
const SOCKET = `system.${NS}`;

export const SESSION_STATES = { BETWEEN: 'between', ACTIVE: 'active' };

// ──────────────────────────────────────────────────────────────────────────────
// Public getters
// ──────────────────────────────────────────────────────────────────────────────

export function currentSessionNumber() {
  try { return Number(game.settings.get(NS, 'sessionNumber')) || 0; }
  catch { return 0; }
}

export function currentSessionState() {
  try { return game.settings.get(NS, 'sessionState') || SESSION_STATES.BETWEEN; }
  catch { return SESSION_STATES.BETWEEN; }
}

export function isSessionActive() {
  return currentSessionState() === SESSION_STATES.ACTIVE;
}

// ──────────────────────────────────────────────────────────────────────────────
// GM actions
// ──────────────────────────────────────────────────────────────────────────────

export async function startSession() {
  if (!game.user?.isGM) {
    ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.session.gmOnly'));
    return;
  }
  const current = currentSessionNumber();
  const next = current + 1;

  await game.settings.set(NS, 'sessionNumber', next);
  await game.settings.set(NS, 'sessionState', SESSION_STATES.ACTIVE);
  await game.settings.set(NS, 'sessionStartedAt', Date.now());

  const payload = { type: 'sessionStarted', sessionNumber: next };
  if (game.socket) game.socket.emit(SOCKET, payload);
  // Fire locally so the GM also gets the greeting pop.
  await _handleSessionStarted(payload);

  try { await _postSessionCard('start', next); } catch (err) {
    console.warn('GS | session-start card failed:', err);
  }

  ui.notifications?.info(
    game.i18n.format('GOODSOCIETY.session.startedToast', { n: next }),
  );
}

export async function endSession() {
  if (!game.user?.isGM) {
    ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.session.gmOnly'));
    return;
  }
  const sessionNumber = currentSessionNumber();
  if (!sessionNumber || !isSessionActive()) {
    ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.session.noActiveSession'));
    return;
  }

  await game.settings.set(NS, 'sessionState', SESSION_STATES.BETWEEN);
  await game.settings.set(NS, 'sessionLastEndedAt', Date.now());

  // Prime a recap entry (title + summary blank) so the Recaps viewer
  // has something to scroll to when it auto-opens below. GM-only call —
  // non-GM endSession paths are short-circuited above.
  try { await ensureRecapStub(sessionNumber); }
  catch (err) { console.warn('GS | ensureRecapStub failed:', err); }

  const payload = { type: 'sessionEnded', sessionNumber };
  if (game.socket) game.socket.emit(SOCKET, payload);
  await _handleSessionEnded(payload);

  try { await _postSessionCard('end', sessionNumber); } catch (err) {
    console.warn('GS | session-end card failed:', err);
  }

  // Open the Recaps viewer for the GM focused on the just-ended session
  // so they can write the summary while it's fresh.
  try {
    const { openSessionRecaps } = await import('../apps/session-recaps.js');
    openSessionRecaps({ focusSessionNumber: sessionNumber });
  } catch (err) {
    console.warn('GS | auto-open recaps failed:', err);
  }

  ui.notifications?.info(
    game.i18n.format('GOODSOCIETY.session.endedToast', { n: sessionNumber }),
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Socket + local handlers
// ──────────────────────────────────────────────────────────────────────────────

async function _handleSessionStarted(_payload) {
  // Every client, GM included — reopen the greeting so the recap is on
  // screen for everyone at session start.
  try {
    const { openSessionGreeting } = await import('../apps/session-greeting.js');
    openSessionGreeting({ force: true });
  } catch (err) {
    console.warn('GS | force-open greeting failed:', err);
  }
}

async function _handleSessionEnded({ sessionNumber }) {
  // Non-GM players get the debrief modal. The GM is the one who clicked
  // "End Session"; prompting them to also write a note would be noise.
  if (game.user?.isGM) return;
  try {
    const { openSessionDebrief } = await import('../apps/session-debrief.js');
    openSessionDebrief({ sessionNumber });
  } catch (err) {
    console.warn('GS | open session debrief failed:', err);
  }
}

/** Register the socket listener. Call once at ready. */
export function registerSessionMechanismSocket() {
  if (!game.socket) return;
  game.socket.on(SOCKET, (payload) => {
    if (!payload || typeof payload !== 'object') return;
    if (payload.type === 'sessionStarted') _handleSessionStarted(payload);
    else if (payload.type === 'sessionEnded') _handleSessionEnded(payload);
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Player debrief notes — stored per user on user flags
// ──────────────────────────────────────────────────────────────────────────────

/** Write (or overwrite) the current user's debrief note for a session. */
export async function saveMyDebriefNote({ sessionNumber, text }) {
  const existing = game.user.getFlag(NS, 'sessionDebriefNotes') ?? {};
  const next = {
    ...existing,
    [String(sessionNumber)]: {
      text: (text ?? '').trim(),
      ts: Date.now(),
    },
  };
  await game.user.setFlag(NS, 'sessionDebriefNotes', next);
}

/** Read a user's own saved note for a given session (self only; use the
 *  GM viewer to aggregate across users). */
export function getMyDebriefNote(sessionNumber) {
  const flags = game.user.getFlag(NS, 'sessionDebriefNotes') ?? {};
  return flags[String(sessionNumber)] ?? null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Session Recaps — the GM's per-session summary, keyed by sessionNumber.
// One world setting (sessionRecaps). GM edits; everyone reads.
// ──────────────────────────────────────────────────────────────────────────────

/** Resolve the recaps map, defaulting to {}. */
export function getAllRecaps() {
  try {
    return game.settings.get(NS, 'sessionRecaps') ?? {};
  } catch { return {}; }
}

/** Resolve one session's recap (title + summary + timestamps), or null. */
export function getRecap(sessionNumber) {
  const all = getAllRecaps();
  return all[String(sessionNumber)] ?? null;
}

/** GM-only: write or overwrite one session's recap. Partial — merges
 *  over the previous entry. `title` + `summary` are the writable fields.
 *  createdAt is preserved if the entry already existed. */
export async function saveRecap({ sessionNumber, title, summary }) {
  if (!game.user?.isGM) return;
  if (!sessionNumber) return;
  const all = { ...getAllRecaps() };
  const existing = all[String(sessionNumber)] ?? {};
  const now = Date.now();
  all[String(sessionNumber)] = {
    sessionNumber: Number(sessionNumber),
    createdAt: existing.createdAt ?? now,
    updatedAt: now,
    title: title !== undefined ? title : (existing.title ?? ''),
    summary: summary !== undefined ? summary : (existing.summary ?? ''),
  };
  await game.settings.set(NS, 'sessionRecaps', all);
}

/** GM-only: ensure a (possibly empty) recap row exists for the given
 *  session so the Session Recaps viewer has something to render as a
 *  stub for the GM to fill in. Called on End Session. */
export async function ensureRecapStub(sessionNumber) {
  if (!game.user?.isGM) return;
  if (!sessionNumber) return;
  const existing = getRecap(sessionNumber);
  if (existing) return;
  await saveRecap({ sessionNumber, title: '', summary: '' });
}

/** GM-only: delete one session's recap. Rarely used — exposed for a
 *  "clear this recap" affordance in the viewer. */
export async function deleteRecap(sessionNumber) {
  if (!game.user?.isGM) return;
  const all = { ...getAllRecaps() };
  if (!(String(sessionNumber) in all)) return;
  delete all[String(sessionNumber)];
  await game.settings.set(NS, 'sessionRecaps', all);
}

/** GM-only: walk every user's flags and gather their debrief notes grouped
 *  by session. Returns `{ [sessionNumber]: [{ userId, userName, text, ts }] }`. */
export function gatherAllDebriefs() {
  const groups = {};
  for (const user of game.users ?? []) {
    const flags = user.getFlag?.(NS, 'sessionDebriefNotes') ?? {};
    for (const [sNum, note] of Object.entries(flags)) {
      if (!note?.text) continue;
      groups[sNum] ??= [];
      groups[sNum].push({
        userId: user.id,
        userName: user.name,
        text: note.text,
        ts: note.ts,
      });
    }
  }
  return groups;
}

// ──────────────────────────────────────────────────────────────────────────────
// Chat announcements
// ──────────────────────────────────────────────────────────────────────────────

async function _postSessionCard(kind, sessionNumber) {
  const key = kind === 'start'
    ? 'GOODSOCIETY.session.startCard'
    : 'GOODSOCIETY.session.endCard';
  const content = `
    <div class="gs-chat-card gs-session-card">
      <h3 class="gs-session-card__title">${game.i18n.format(key, { n: sessionNumber })}</h3>
    </div>
  `;
  return ChatMessage.create({
    speaker: { alias: game.i18n.localize('GOODSOCIETY.session.chatSpeaker') },
    content,
    flags: {
      [NS]: {
        cardType: kind === 'start' ? 'session-start' : 'session-end',
        sessionNumber,
      },
    },
  });
}
