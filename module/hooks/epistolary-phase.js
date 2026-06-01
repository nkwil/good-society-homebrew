/**
 * Epistolary phase hook — post-MVP §11.
 *
 * Auto-opens the wizard for each Major-owner user when `cyclePhase` becomes
 * `epistolary`; auto-closes when the phase advances away. The GM additionally
 * gets the Roster.
 *
 * Mirrors the pattern in reputation-phase.js: ready-time check picks up the
 * world's current phase so a refresh during epistolary re-opens the wizard.
 * Phase change is detected via the `cyclePhase` setting's `onChange` (which
 * is set up by the cycle-advance helper); we also listen on the canonical
 * `goodSociety.cyclePhaseChanged` hook for completeness.
 */

import { openEpistolaryWizard, openEpistolaryRoster, closeEpistolaryWizard, closeEpistolaryRoster } from '../apps/epistolary-wizard.js';
import { queuedLettersForUser, dequeueLetter } from '../helpers/letter-queue.js';
import { openLetterComposer } from '../apps/letter-composer.js';
import { postLetterCard } from '../helpers/chat-cards.js';
import { archiveLetterToJournal } from '../helpers/letter-archive.js';
import { profileName, explicitPersona } from '../helpers/profile-pic.js';

const FLAG_SCOPE = 'good-society-homebrew';

let _lastPhase = null;

function _onPhaseChange(newPhase) {
  if (newPhase === 'epistolary') {
    onEpistolaryPhaseStart();
  } else if (_lastPhase === 'epistolary' && newPhase !== 'epistolary') {
    closeEpistolaryWizard();
    closeEpistolaryRoster();
  }
  _lastPhase = newPhase;
}

export function onEpistolaryPhaseStart() {
  const myMajors = (game.actors?.filter(
    (a) => a.type === 'major-character' && a.testUserPermission(game.user, 'OWNER'),
  ) ?? []);

  if (myMajors.length > 0) {
    openEpistolaryWizard(myMajors[0].id);
  }
  if (game.user?.isGM) {
    openEpistolaryRoster();
  }

  // Process this user's queued letters — for each one, prompt the sender:
  // Send Now / Edit / Discard. Sequential so they're not bombarded with
  // dialogs all at once.
  _promptQueuedLetters();
}

/** Walk THIS user's queued letters and ask them one at a time. */
async function _promptQueuedLetters() {
  const userId = game.user?.id;
  if (!userId) return;
  const myQueue = queuedLettersForUser(userId);
  if (!myQueue.length) return;

  // Sequential — one dialog at a time so the player isn't drowned.
  for (const entry of myQueue) {
    // eslint-disable-next-line no-await-in-loop
    await _promptOneQueuedLetter(entry);
  }
}

async function _promptOneQueuedLetter(entry) {
  const fromActor = game.actors?.get(entry.fromActorId);
  const toActor   = game.actors?.get(entry.toActorId);
  const fromName  = fromActor ? profileName(fromActor) : '?';
  const toName    = toActor   ? profileName(toActor)   : '?';
  const subject   = entry.letter?.subject || game.i18n.localize('GOODSOCIETY.letterQueue.noSubject');

  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('GOODSOCIETY.letterQueue.promptTitle') },
    content: `
      <p>${game.i18n.format('GOODSOCIETY.letterQueue.promptBody', {
        from: foundry.utils.escapeHTML(fromName),
        to:   foundry.utils.escapeHTML(toName),
      })}</p>
      <p><em>${foundry.utils.escapeHTML(subject)}</em></p>
    `,
    buttons: [
      { action: 'send',    label: game.i18n.localize('GOODSOCIETY.letterQueue.sendNow'),  default: true },
      { action: 'edit',    label: game.i18n.localize('GOODSOCIETY.letterQueue.edit') },
      { action: 'discard', label: game.i18n.localize('GOODSOCIETY.letterQueue.discard') },
    ],
    rejectClose: false,
  });

  if (result === 'send') {
    await _sendQueuedLetter(entry);
    await dequeueLetter(entry.id);
  } else if (result === 'edit') {
    // Reopen the composer pre-filled with this draft, and drop the queue
    // entry. The player can hit Send again — they're now in-phase, so it
    // will deliver immediately.
    await dequeueLetter(entry.id);
    openLetterComposer(entry.fromActorId, {
      prefill: {
        fromActorId: entry.fromActorId,
        toActorId:   entry.toActorId,
        subject:     entry.letter?.subject ?? '',
        body:        entry.letter?.body ?? '',
        greeting:    entry.letter?.greeting ?? '',
        closing:     entry.letter?.closing ?? '',
        scriptFont:  entry.letter?.scriptFont ?? '',
        seal:        entry.letter?.seal ?? '',
        signAs:      entry.letter?.signAs ?? 'self',
      },
    });
  } else if (result === 'discard') {
    await dequeueLetter(entry.id);
  }
}

/** Deliver one queued letter — chat card + journal archive, same as the
 *  in-phase Send path. */
async function _sendQueuedLetter(entry) {
  const actor = game.actors?.get(entry.fromActorId);
  const recipientActor = game.actors?.get(entry.toActorId) ?? null;
  if (!actor) return;
  const persona = explicitPersona(actor);
  const letter  = entry.letter;
  let cycleNumber = null;
  try { cycleNumber = game.settings.get('good-society-homebrew', 'cycleNumber'); } catch {}

  const whisperIds = recipientActor
    ? Object.entries(recipientActor.ownership ?? {})
        .filter(([uid, lvl]) => uid !== 'default' && lvl >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)
        .map(([uid]) => uid)
    : [];

  try {
    await postLetterCard({ actor, persona, letter, cycleNumber, whisper: true, whisperIds });
    await archiveLetterToJournal({ actor, persona, letter, cycleNumber, recipientActor });
    Hooks.callAll('goodSociety.epistolarySent', {
      actorId:          actor.id,
      actorName:        actor.name,
      speakerName:      letter?.signatureName || profileName(actor),
      recipientActorId: recipientActor?.id ?? null,
      letter,
      cycleNumber,
    });
  } catch (err) {
    console.error('GS | queued letter delivery failed:', err);
    ui.notifications?.error(game.i18n.localize('GOODSOCIETY.letterQueue.deliveryFailed'));
  }
}

/** Re-open the flow on demand from an HUD click etc. */
export function reopenEpistolaryFlow() {
  onEpistolaryPhaseStart();
}

export function register() {
  Hooks.once('ready', () => {
    const phase = (() => {
      try { return game.settings.get(FLAG_SCOPE, 'cyclePhase'); }
      catch { return null; }
    })();
    _lastPhase = phase;
    if (phase === 'epistolary') onEpistolaryPhaseStart();
  });

  // Listen for canonical phase-change hook (emitted by cycle-advance.js when
  // it lands the per-cycle helpers). Also fall back to a direct setting
  // onChange watcher.
  Hooks.on('goodSociety.cyclePhaseChanged', (phase) => _onPhaseChange(phase));
}
