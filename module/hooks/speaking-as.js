/**
 * Speaking-As switcher — injected above Foundry's chat input.
 * Lets a player select which Major Character actor (and persona) they are
 * speaking as. Stored as client settings so each player keeps their own.
 *
 * Per docs/design/10-chat-cards.md §"Speaking-As switcher".
 *
 * Implementation notes:
 *   - Uses a button + popover (no native <select>). Native selects rendered
 *     as zero-size in Foundry v13's chat-sidebar context for reasons that
 *     weren't worth chasing. The popover also matches the design doc, which
 *     calls for a click-to-open speaker pill, not a dropdown.
 *   - All event handling is delegated on `document` in capture phase so the
 *     bar can be torn down and recreated freely without losing wiring.
 *   - Inject is serialized via a single promise chain; popout chat-inputs
 *     are ignored — only the canonical chat input inside `#chat` gets a bar.
 */

const TEMPLATE = 'systems/good-society-homebrew/templates/components/speaking-as.hbs';
const LOG_PREFIX = '[good-society Speaking-As]';

console.log(`${LOG_PREFIX} module loaded — version 2026-05-06-d (popover)`);

let _injectInFlight = Promise.resolve();
let _delegationAttached = false;
let _observerAttached = false;

/** Build context for the Speaking-As component. */
function _buildContext() {
  const activeSpeakerActorId = (() => {
    try { return game.settings.get('good-society-homebrew', 'activeSpeakerActorId') || ''; }
    catch { return ''; }
  })();
  const activeSpeakerPersonaId = (() => {
    try { return game.settings.get('good-society-homebrew', 'activeSpeakerPersonaId') || ''; }
    catch { return ''; }
  })();

  const myMajors = game.actors?.filter(a =>
    a.type === 'major-character' &&
    (game.user?.isGM || a.testUserPermission(game.user, 'OWNER'))
  ) ?? [];

  const activeMajor = myMajors.find(a => a.id === activeSpeakerActorId) ?? null;
  const activePersona = activeMajor?.system?.personas?.find(p => p.id === activeSpeakerPersonaId) ?? null;
  const speakerLabel = activePersona?.name ?? activeMajor?.name ?? null;

  return { myMajors, activeSpeakerActorId, activeSpeakerPersonaId, speakerLabel };
}

/** Find the canonical chat input element (main sidebar, not popout). */
function _findChatInput() {
  const inMainChat =
    document.querySelector('#chat chat-input') ??
    document.querySelector('#chat #chat-form') ??
    document.querySelector('#chat .chat-form') ??
    null;
  if (inMainChat) return inMainChat;
  return (
    document.querySelector('chat-input') ??
    document.querySelector('#chat-message')?.closest('form') ??
    document.querySelector('#chat-form') ??
    document.querySelector('.chat-form') ??
    null
  );
}

/** Inject (or re-inject) the bar. Serialized to avoid races. */
function _refresh(reason = 'unknown') {
  _injectInFlight = _injectInFlight.then(() => _doInject(reason)).catch((e) => {
    console.error(`${LOG_PREFIX} inject failed (${reason}):`, e);
  });
  return _injectInFlight;
}

async function _doInject(reason) {
  const target = _findChatInput();
  if (!target) {
    console.log(`${LOG_PREFIX} _doInject skipped (${reason}) — no canonical chat input`);
    return;
  }

  const ctx = _buildContext();
  const rendered = await foundry.applications.handlebars.renderTemplate(TEMPLATE, ctx);

  // Strip every existing chat-input variant bar; the dock's mirror
  // (data-variant="dock") is owned by MyCharactersDock and we leave it alone.
  document
    .querySelectorAll('.gs-speaking-as:not([data-variant="dock"])')
    .forEach((el) => el.remove());

  target.insertAdjacentHTML('beforebegin', rendered);
  // Tag the chat-input bar so the dock's MutationObserver / strip logic can
  // distinguish it from the dock-footer copy.
  target.previousElementSibling?.setAttribute('data-variant', 'chat-input');
  console.log(`${LOG_PREFIX} injected (${reason}) before`, target);
}

/** Document-level event delegation — survives any re-render of the bar. */
function _attachDelegatedListeners() {
  if (_delegationAttached) return;
  _delegationAttached = true;

  document.addEventListener('click', async (ev) => {
    const t = ev.target;
    if (!(t instanceof HTMLElement)) return;

    // Click on the speaker pill — toggle the popover.
    const pill = t.closest('.gs-speaking-as__pill');
    if (pill) {
      ev.preventDefault();
      ev.stopPropagation();
      const bar = pill.closest('.gs-speaking-as');
      const popover = bar?.querySelector('.gs-speaking-as__popover');
      if (!popover) return;
      const isOpen = !popover.hasAttribute('hidden');
      if (isOpen) {
        popover.setAttribute('hidden', '');
        pill.setAttribute('aria-expanded', 'false');
      } else {
        popover.removeAttribute('hidden');
        pill.setAttribute('aria-expanded', 'true');
      }
      console.log(`${LOG_PREFIX} pill toggled →`, isOpen ? 'closed' : 'open');
      return;
    }

    // Click on a popover option — select that speaker.
    const option = t.closest('.gs-speaking-as__option');
    if (option) {
      ev.preventDefault();
      ev.stopPropagation();
      const actorId = option.dataset.actorId || '';
      const personaId = option.dataset.personaId || '';
      console.log(`${LOG_PREFIX} option chosen → actor=${actorId} persona=${personaId}`);
      await game.settings.set('good-society-homebrew', 'activeSpeakerActorId', actorId);
      await game.settings.set('good-society-homebrew', 'activeSpeakerPersonaId', personaId);
      _refresh('option click');
      // Fire a custom hook so other surfaces (e.g. My Characters Dock) that
      // mirror the speaker selection can re-render. Per docs/design/09 §"Synced
      // with My Characters Dock".
      Hooks.callAll('goodSociety.activeSpeakerChanged', { actorId, personaId });
      return;
    }

    // Click outside any open popover — close it.
    const openBar = document.querySelector('.gs-speaking-as');
    const openPop = openBar?.querySelector('.gs-speaking-as__popover:not([hidden])');
    if (openPop && !t.closest('.gs-speaking-as')) {
      openPop.setAttribute('hidden', '');
      openBar.querySelector('.gs-speaking-as__pill')?.setAttribute('aria-expanded', 'false');
    }
  }, true);

  console.log(`${LOG_PREFIX} delegated listeners attached`);
}

/** Watch for chat-input mounts/re-mounts and ensure the bar is present. */
function _attachMutationObserver() {
  if (_observerAttached) return;
  _observerAttached = true;

  const observer = new MutationObserver(() => {
    const target = _findChatInput();
    if (!target) return;
    const prev = target.previousElementSibling;
    // The dock-footer copy uses data-variant="dock" — count only chat-input
    // copies when deciding whether to re-inject.
    const chatInputCopies = document
      .querySelectorAll('.gs-speaking-as:not([data-variant="dock"])').length;
    if (prev?.classList?.contains('gs-speaking-as') && chatInputCopies === 1) {
      return;
    }
    _refresh('mutation-observer');
  });
  observer.observe(document.body, { childList: true, subtree: true });
  console.log(`${LOG_PREFIX} mutation observer attached`);
}

/**
 * Rewrite outgoing chat messages so they post AS the active Speaking-As
 * actor. Without this, Foundry uses the user's default speaker (e.g. the
 * Gamemaster) regardless of what the switcher shows.
 *
 * The Speaking-As selection takes precedence over Foundry's chat-mode
 * toggle (globe/IC/etc). If you've selected an actor in the switcher,
 * the message posts as that actor — whether you typed the message in
 * Foundry's "OOC" mode or "IC" mode. The only messages we leave alone
 * are whispers (they have recipients in `data.whisper`) and dice rolls.
 *
 * Persona note: the persona only affects the displayed name (alias). The
 * underlying actor stays the same so chat-card flags can still resolve
 * theme/portrait/etc. Per `docs/design/10-chat-cards.md` §"Persona-aware".
 */
function _onPreCreateChatMessage(message, data) {
  const actorId = (() => {
    try { return game.settings.get('good-society-homebrew', 'activeSpeakerActorId') || ''; }
    catch { return ''; }
  })();
  if (!actorId) {
    console.log(`${LOG_PREFIX} preCreateChatMessage — no active speaker, leaving as-is`);
    return;
  }

  const actor = game.actors?.get(actorId);
  if (!actor) {
    console.log(`${LOG_PREFIX} preCreateChatMessage — actor ${actorId} not found`);
    return;
  }

  // Skip whispers and rolls — those flow through their own pipelines.
  if ((data.whisper?.length ?? 0) > 0) return;
  if (data.rolls?.length || data.roll) return;

  const personaId = (() => {
    try { return game.settings.get('good-society-homebrew', 'activeSpeakerPersonaId') || ''; }
    catch { return ''; }
  })();
  const persona = actor.system?.personas?.find(p => p.id === personaId) ?? null;
  const alias = persona?.name ?? actor.name;

  // In v13 the IC style is the only one Foundry will display the speaker
  // alias on; OOC suppresses the speaker line entirely. Force IC so the
  // alias shows.
  const IC = CONST.CHAT_MESSAGE_STYLES?.IC ?? 2;

  message.updateSource({
    style: IC,
    speaker: {
      scene: data.speaker?.scene ?? canvas.scene?.id ?? null,
      actor: actor.id,
      token: data.speaker?.token ?? null,
      alias,
    },
  });
  console.log(`${LOG_PREFIX} rewrote speaker → ${alias} (actor ${actor.id})`);
}

export function register() {
  Hooks.on('renderChatInput', () => _refresh('renderChatInput hook'));
  Hooks.on('renderChatLog', () => _refresh('renderChatLog hook'));
  Hooks.on('updateActor', () => _refresh('updateActor hook'));
  Hooks.on('createActor', () => _refresh('createActor hook'));
  Hooks.on('deleteActor', () => _refresh('deleteActor hook'));

  Hooks.on('preCreateChatMessage', _onPreCreateChatMessage);

  Hooks.once('ready', () => {
    console.log(`${LOG_PREFIX} ready — wiring delegated listeners + observer`);
    _attachDelegatedListeners();
    _attachMutationObserver();
    _refresh('ready hook');
  });
}
