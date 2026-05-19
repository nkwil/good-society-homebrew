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
  const themeId = effectiveThemeOf(actor) || 'npc';
  const persona = actor?.system?.activePersonaId
    ? actor.system.personas?.find(p => p.id === actor.system.activePersonaId)
    : null;
  const overrideColor = persona?.chatColor;
  const styleAttr = overrideColor ? ` style="--gs-brand: ${overrideColor};"` : '';
  const classList = ['gs-themed', ...extraClasses].join(' ');
  return `<div class="${classList}" data-theme="${themeId}"${styleAttr}>${content}</div>`;
}

/**
 * Resolve the *effective* theme id for an actor, honoring the active
 * persona's per-persona theme override when present.
 *
 *   activePersona.theme  →  preferred (only when an explicit persona is
 *                           selected and that persona has a non-empty theme)
 *   actor.system.theme   →  fallback ("true identity" theme)
 *
 * Use this anywhere a surface paints the actor's themed cascade — chat
 * cards, dock rows, dashboard rows, hover cards — so a Mags-active Rose
 * actor renders in the Secret theme everywhere, not just on the dossier.
 *
 * Returns the actor's bare `system.theme` when no persona is selected, or
 * undefined if the actor has neither. Callers should fall back to a
 * sensible default ('clayton', 'connection-grey', 'npc') for their surface.
 *
 * @param {Actor|null} actor
 * @returns {string|undefined}
 */
export function effectiveThemeOf(actor) {
  if (!actor) return undefined;
  const sys = actor.system;
  if (sys?.activePersonaId) {
    const persona = sys.personas?.find(p => p.id === sys.activePersonaId);
    if (persona?.theme) return persona.theme;
  }
  return sys?.theme;
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
  // Explicit persona selection only — never fall back through the data-model
  // getter's primary/first persona chain. Same anti-pattern fix as
  // profileName in module/helpers/profile-pic.js; see post-MVP-style note
  // about Rose-with-only-Mags showing wrong on every surface.
  const activeId = actor.system?.activePersonaId;
  if (activeId) {
    const persona = (actor.system?.personas ?? []).find((p) => p.id === activeId);
    if (persona?.name) return persona.name;
  }
  return actor.name || '';
}
