/**
 * Sidebar tab filter — narrows Foundry's right-edge sidebar to the tabs
 * players actually use during a Good Society session.
 *
 * Player allowlist: chat, actors, items, macros, playlists.
 * Hidden for players: combat, scenes, journal, tables, cards, compendium,
 * settings.
 *
 * Journal is intentionally on the hide list because the Novel Reader
 * (post-MVP §13.3) is now the player-facing archive surface for letters,
 * monologues, session logs, and cycle reflections. The Foundry journal
 * directory remains available to GMs (who do scene prep there) and to
 * players if they disable the `playerSidebarFilter` setting.
 *
 * Implementation: pure body-class toggle. CSS in
 * `styles/components/_sidebar-filter.css` does all the hiding. Body class
 * `gs-sidebar-filtered` is added on `ready` for non-GM users when the
 * setting is on; toggled at runtime via the setting's onChange.
 *
 * Per post-MVP §17 body class registry.
 */

const SCOPE = 'good-society-homebrew';
const SETTING_KEY = 'playerSidebarFilter';
const BODY_CLASS = 'gs-sidebar-filtered';

/**
 * Read the current setting and toggle the body class to match. GM users
 * never carry the class regardless of the setting — they always see the
 * full sidebar.
 */
export function applySidebarFilter() {
  if (game.user?.isGM) {
    document.body.classList.remove(BODY_CLASS);
    return;
  }
  let on = true;
  try { on = game.settings.get(SCOPE, SETTING_KEY); } catch { /* not yet registered */ }
  document.body.classList.toggle(BODY_CLASS, !!on);
}

/**
 * Register on ready. Called from `module/good-society.js` alongside the
 * other hook registrations. Idempotent — re-calling just re-applies the
 * current setting state.
 */
export function register() {
  Hooks.once('ready', () => {
    applySidebarFilter();
  });
}
