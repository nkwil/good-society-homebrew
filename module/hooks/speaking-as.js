/**
 * Speaking-As switcher — injected above Foundry's chat input.
 * Lets a player select which Major Character actor they are speaking as,
 * and (optionally) which persona. Stored as client settings so each player
 * maintains their own independent selection.
 *
 * Per docs/design/10-chat-cards.md §"Speaking-As switcher".
 */

const TEMPLATE = 'systems/good-society-homebrew/templates/components/speaking-as.hbs';

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

  // All Major Character actors the current user owns (or is GM of).
  const myMajors = game.actors?.filter(a =>
    a.type === 'major-character' &&
    (game.user?.isGM || a.testUserPermission(game.user, 'OWNER'))
  ) ?? [];

  const activeMajor = myMajors.find(a => a.id === activeSpeakerActorId) ?? null;
  const personas = activeMajor?.system?.personas ?? [];
  const activePersonaId = activeSpeakerPersonaId;
  const activePersona = personas.find(p => p.id === activePersonaId) ?? null;
  const speakerLabel = activePersona?.name ?? activeMajor?.name ?? null;

  return { myMajors, activeSpeakerActorId, personas, activePersonaId, speakerLabel };
}

/** (Re)render the Speaking-As bar inside the given chat log element. */
async function _inject(html) {
  const ctx = _buildContext();
  const rendered = await foundry.applications.handlebars.renderTemplate(TEMPLATE, ctx);
  const bar = html instanceof HTMLElement ? html : html[0];

  // Remove any previous instance before re-injecting.
  bar.querySelector('.gs-speaking-as')?.remove();

  const chatForm = bar.querySelector('#chat-form') ?? bar.querySelector('.chat-form');
  if (!chatForm) return;
  chatForm.insertAdjacentHTML('beforebegin', rendered);

  // Wire change handlers on the freshly injected selects.
  const wrapper = bar.querySelector('.gs-speaking-as');
  if (!wrapper) return;

  wrapper.querySelector('.gs-speaking-as__actor-select')?.addEventListener('change', async (ev) => {
    const newId = ev.currentTarget.value;
    await game.settings.set('good-society-homebrew', 'activeSpeakerActorId', newId);
    await game.settings.set('good-society-homebrew', 'activeSpeakerPersonaId', '');
    await _inject(bar);
  });

  wrapper.querySelector('.gs-speaking-as__persona-select')?.addEventListener('change', async (ev) => {
    const newId = ev.currentTarget.value;
    await game.settings.set('good-society-homebrew', 'activeSpeakerPersonaId', newId);
    // No full re-inject needed — the label update is cosmetic only.
  });
}

export function register() {
  Hooks.on('renderChatLog', (_app, html) => {
    _inject(html);
  });

  // Re-inject when the user's owned actors change (e.g. GM assigns ownership mid-session).
  Hooks.on('updateActor', () => {
    const chatLog = document.querySelector('#chat-log')?.closest('.chat-sidebar, #sidebar');
    if (chatLog) _inject(chatLog);
  });
}
