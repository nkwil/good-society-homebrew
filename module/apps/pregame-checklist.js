/**
 * Pre-Game Checklist popup — single-screen informational modal that walks
 * the player through their character sheet's six key mechanical concepts.
 * Auto-opens on first login per user; dismissable; flagged on user.flags
 * so it doesn't re-pop. Re-openable anytime from the Cabinet.
 *
 * Not a wizard — no steps, no inputs, no locking. The flag is purely a
 * "this user has seen the intro" signal.
 *
 * Per the post-playtest design conversation (2026-05-11).
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 }              = foundry.applications.api;

const NS = 'good-society-homebrew';
/* Flag key is versioned so a content rewrite re-pops the checklist for
 * users who already dismissed the previous edition. Bump the version
 * (v2 → v3 → …) whenever the copy changes substantially enough that a
 * player should re-read it. v2 corresponds to the May-2026 rebuild
 * (UI tour + reputation/resolve/inner-conflict/inner-monologue mechanics).
 *
 * Old `preGameChecklistDismissed` flags from v1 are harmless leftovers —
 * they sit on the user document forever but never get read again. Not
 * worth a migration. */
const FLAG_KEY = 'preGameChecklistDismissedV2';

let _instance = null;

/** Open or focus the singleton popup. */
export function openPregameChecklist() {
  if (!_instance) _instance = new PregameChecklist();
  _instance.render({ force: true });
  return _instance;
}

/** Auto-open the popup on first login. Idempotent — if the user has
 *  already dismissed it once, this is a no-op. GMs see it too on first
 *  login since the same mechanical concepts apply to NPC/Major management. */
export function maybeAutoOpenPregameChecklist() {
  try {
    const dismissed = game.user?.getFlag?.(NS, FLAG_KEY);
    if (dismissed) return;
  } catch { return; }
  openPregameChecklist();
}

export class PregameChecklist extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-pregame-checklist',
    classes: ['good-society', 'gs-pregame-checklist'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.pregame.windowTitle',
    },
    position: { width: 680, height: 820 },
    actions: {
      dismiss: PregameChecklist.#dismiss,
    },
  };

  static PARTS = {
    main: { template: 'systems/good-society-homebrew/templates/apps/pregame-checklist.hbs' },
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    ctx.heading = game.i18n.localize('GOODSOCIETY.pregame.heading');
    ctx.intro = game.i18n.localize('GOODSOCIETY.pregame.intro');
    // Seven sections — order follows the new player onboarding flow: orient
    // to the UI first, then walk through desire → connections → mechanics
    // (reputation, resolve tokens, inner conflict, inner monologue).
    const KEYS = ['ui', 'desire', 'connections', 'reputation', 'resolveTokens', 'innerConflict', 'innerMonologue'];
    ctx.sections = KEYS.map(key => ({
      title: game.i18n.localize(`GOODSOCIETY.pregame.sections.${key}.title`),
      body:  game.i18n.localize(`GOODSOCIETY.pregame.sections.${key}.body`),
    }));
    return ctx;
  }

  /** Persist the dismissed flag so this user never auto-sees it again.
   *  They can still reopen from the Cabinet. */
  static async #dismiss() {
    try { await game.user?.setFlag(NS, FLAG_KEY, true); }
    catch (err) { console.warn('GS | pregame dismiss flag set failed:', err); }
    this.close();
  }
}
