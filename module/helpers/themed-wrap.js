/**
 * Wrap content in a .gs-themed div using the given actor's theme.
 * If the actor's active persona has a chatColor override, applies it
 * as an inline --gs-brand override (persona color shifts brand only,
 * not the full palette — per docs/design/05-epistolary-ui.md §"Sender is a Persona override").
 *
 * Used by: chat-cards.js, letter-cards.js, public-info-dashboard.js, my-characters-dock.js.
 * Centralizing here means class-name changes propagate everywhere in one edit.
 *
 * @param {Actor|null} actor - the speaker/sender/originator
 * @param {string} content - HTML string to wrap
 * @param {string[]} [extraClasses=[]] - optional additional classes on the wrapper
 * @returns {string} HTML string with .gs-themed wrapper applied
 */
export function themedWrap(actor, content, extraClasses = []) {
  const themeId = actor?.system?.theme || 'npc';
  const persona = actor?.system?.activePersonaId
    ? actor.system.personas?.find(p => p.id === actor.system.activePersonaId)
    : null;
  const overrideColor = persona?.chatColor;
  const styleAttr = overrideColor ? ` style="--gs-brand: ${overrideColor};"` : '';
  const classList = ['gs-themed', ...extraClasses].join(' ');
  return `<div class="${classList}" data-theme="${themeId}"${styleAttr}>${content}</div>`;
}

/**
 * Resolve the display name for an actor, preferring the active persona's
 * name when one is set. Use this anywhere a user-facing surface refers to
 * the actor by name — chat cards, journal entries, dock rows, hover cards
 * — to keep persona-swapped characters consistent.
 *
 * Per CLAUDE.md §16: "Don't use actor.name directly in display surfaces…
 * when the actor has personas."
 *
 * @param {Actor|null} actor
 * @returns {string} display name or empty string when actor is missing
 */
export function displayNameOf(actor) {
  if (!actor) return '';
  return actor.system?.activePersona?.name || actor.name || '';
}
