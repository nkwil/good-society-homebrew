/**
 * letter-reveal.js — "Reveal to all" control on whispered letter chat cards.
 *
 * Letters are sent as whispered ChatMessages (sender + recipient owners + GM)
 * and archived to a restricted-ownership JournalEntry (the novel). This hook
 * injects a per-client "Reveal to all" button onto a private letter card. When
 * clicked it makes the letter public on BOTH surfaces:
 *   - the chat card: whisper list cleared so every player sees it;
 *   - the novel entry: default ownership raised to OBSERVER.
 *
 * Both writes are GM-only (you can't edit another user's message or a journal
 * entry you don't own). Non-GM clients relay over the system socket; the GM
 * client runs `revealLetterDocuments` via letter-socket.js's dispatcher. The
 * two documents are paired by a shared `letterId` flag stamped at send time.
 *
 * Button injection follows the same per-render pattern as chat-portraits.js —
 * the hook fires on every render, so we clear+re-add the control each time and
 * key visibility off the message's current whisper state.
 */

const NS = 'good-society-homebrew';
const SOCKET_NAME = `system.${NS}`;
const BTN_CLASS = 'gs-letter-reveal-btn';

/**
 * GM-side write: make a letter public on chat + novel. No-op on non-GM clients
 * (they reach this only via the socket relay, which runs on the GM client).
 *
 * @param {string} messageId  The whispered letter ChatMessage id.
 * @param {string} letterId   Shared correlation id for the journal-archive entry.
 */
export async function revealLetterDocuments(messageId, letterId) {
  if (!game.user?.isGM) return;

  // 1. Un-whisper the chat card so all players see it. Stamp a flag so the
  //    render hook shows a "made public" note instead of the button afterward.
  const message = game.messages?.get(messageId);
  if (message) {
    try {
      await message.update({
        whisper: [],
        [`flags.${NS}.letterRevealed`]: true,
      });
    } catch (err) {
      console.warn('[GS] Letter reveal — chat card update failed:', err);
    }
  }

  // 2. Open the novel entry to everyone (default OBSERVER). Best-effort: a
  //    queued/legacy letter may have no archive entry — that's fine, the chat
  //    reveal still stands.
  if (letterId) {
    const entry = game.journal?.find(j => j.getFlag(NS, 'letterId') === letterId);
    if (entry) {
      try {
        await entry.update({
          'ownership.default': CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER,
        });
      } catch (err) {
        console.warn('[GS] Letter reveal — journal ownership update failed:', err);
      }
    }
  }
}

/** GM runs the write directly; players relay to the first GM over the socket. */
function _requestReveal(messageId, letterId) {
  if (game.user?.isGM) return revealLetterDocuments(messageId, letterId);
  if (game.socket) {
    game.socket.emit(SOCKET_NAME, {
      type: 'letter.revealRequest',
      messageId,
      letterId,
      requestedBy: game.user.id,
    });
  }
  return Promise.resolve();
}

/** Inject the reveal control (or a "public" note) into a letter card's DOM. */
function _injectReveal(message, root) {
  if (!root) return;
  const flags = message?.flags?.[NS];
  if (!flags || flags.cardType !== 'letter') return;

  const card = root.querySelector('.gs-letter-card');
  if (!card) return;

  // Idempotent: drop any prior control before re-adding for this render.
  card.querySelector('.gs-letter-reveal')?.remove();

  const isPrivate = Array.isArray(message.whisper) && message.whisper.length > 0;
  const wrap = document.createElement('div');
  wrap.classList.add('gs-letter-reveal');

  // Already public (flag set, or no longer whispered) → quiet status note.
  if (flags.letterRevealed || !isPrivate) {
    const note = document.createElement('span');
    note.classList.add('gs-letter-reveal__public');
    note.textContent = game.i18n.localize('GOODSOCIETY.chatCard.letter.revealedNote');
    wrap.append(note);
    card.append(wrap);
    return;
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.classList.add(BTN_CLASS);
  btn.textContent = game.i18n.localize('GOODSOCIETY.chatCard.letter.reveal');
  btn.title = game.i18n.localize('GOODSOCIETY.chatCard.letter.revealHint');
  btn.addEventListener('click', async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('GOODSOCIETY.chatCard.letter.revealConfirmTitle') },
      content: `<p>${game.i18n.localize('GOODSOCIETY.chatCard.letter.revealConfirmBody')}</p>`,
      modal: true,
      rejectClose: false,
    });
    if (!confirmed) return;
    btn.disabled = true;
    await _requestReveal(message.id, flags.letterId ?? '');
    ui.notifications?.info(game.i18n.localize('GOODSOCIETY.chatCard.letter.revealed'));
  });
  wrap.append(btn);
  card.append(wrap);
}

export function register() {
  // v13 (newer builds): root is an HTMLElement.
  Hooks.on('renderChatMessageHTML', (message, html) => {
    try { _injectReveal(message, html); }
    catch (err) { console.warn('GS | letter reveal inject (HTML) failed:', err); }
  });
  // v12 / older v13: html is a jQuery-like wrapper.
  Hooks.on('renderChatMessage', (message, html) => {
    try { _injectReveal(message, html?.[0] ?? html); }
    catch (err) { console.warn('GS | letter reveal inject failed:', err); }
  });
}
