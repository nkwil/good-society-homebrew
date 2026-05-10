/**
 * Letter seal behaviors — post-MVP §11.2 / patch-epistolary-wizard §6–§7.
 *
 * Per the typed seal registry in `module/constants.js`, each seal can carry
 * a behavior. This module is the dispatcher.
 *
 * Two behaviors implemented (current registry mapping in parens — adjust
 * SEAL_TYPES if you want a different visual to carry the mechanic):
 *   - 'invitation' (red-gold seal) — fires `goodSociety.invitationSent`
 *     when the chat card lands, so session-events.js (and other listeners)
 *     can log "X invited Y" without reaching into letter internals.
 *   - 'burn'       (black seal)    — schedules a 30-second post-render
 *     destruction of the chat message: original content is preserved on
 *     `flags.burnedContent` for GM forensics; the rendered card is replaced
 *     with "(Burned. The letter is destroyed.)" and a 1.5s CSS keyframe
 *     animation runs the destruction visual.
 *
 * Burn timing per the master spec §15 open-question — defaults to 30s away
 * from the wizard. Without a wizard surface yet (deferred), we approximate
 * "away from the wizard" as 30s after the chat card renders for the
 * recipient client. GM client always preserves the original content.
 */

import { SEAL_TYPES } from '../constants.js';

const FLAG_SCOPE = 'good-society-homebrew';
const BURN_DELAY_MS = 30_000;

function _sealEntry(sealId) {
  return SEAL_TYPES.find(s => s.id === sealId) ?? null;
}

/**
 * Inspect a freshly-created chat message; if it carries a letter card with a
 * behavior-bearing seal, dispatch.
 */
function _onCreateChatMessage(msg) {
  const flags = msg.flags?.[FLAG_SCOPE];
  if (!flags) return;

  // Letter chat-card flags carry sealId per post-MVP §11.2 wiring.
  // (Pre-patch chat cards lacked this flag — those just fall through.)
  const sealId = flags.letterSealId ?? flags.sealId;
  if (!sealId) return;

  const seal = _sealEntry(sealId);
  if (!seal?.behavior) return;

  switch (seal.behavior) {
    case 'invitation':
      Hooks.callAll('goodSociety.invitationSent', {
        chatMessageId: msg.id,
        senderActorId: flags.speakerActorId ?? null,
        recipientName: flags.recipientName ?? '',
        sealId,
      });
      break;

    case 'burn':
      // Recipient + GM agree on burn; the GM is the canonical writer.
      _scheduleBurn(msg);
      break;
  }
}

/**
 * Schedule the destructive update. Only the GM client should write the
 * message update — players don't have permission to modify world chat
 * messages they didn't author. The originating client may be the GM (table
 * style); otherwise the recipient's GM-on-record fires.
 */
function _scheduleBurn(msg) {
  if (!game.user?.isGM) return; // single-writer pattern

  const original = msg.content;
  setTimeout(async () => {
    try {
      const burned = `<div class="gs-letter-burned">${game.i18n.localize('GOODSOCIETY.seal.burnedNotice')}</div>`;
      await msg.update({
        content: burned,
        [`flags.${FLAG_SCOPE}.burnedContent`]: original,
        [`flags.${FLAG_SCOPE}.burnedAt`]: Date.now(),
      });
      Hooks.callAll('goodSociety.letterBurned', {
        chatMessageId: msg.id,
        senderActorId: msg.flags?.[FLAG_SCOPE]?.speakerActorId ?? null,
      });
    } catch (err) {
      console.warn('GS | letter burn failed (non-fatal):', err);
    }
  }, BURN_DELAY_MS);
}

export function register() {
  Hooks.on('createChatMessage', _onCreateChatMessage);
}
