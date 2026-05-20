/**
 * Desire Reminder — a small, low-opacity panel pinned to the top-right of the
 * viewport. Lists the desires of every Major the current user owns, so the
 * table can keep what their characters want in peripheral vision.
 *
 * - Transparent at rest, opaque on hover (so it doesn't compete with the
 *   canvas / scene chrome until the player looks at it).
 * - Toggleable from the Cabinet (drawer entry → flips a body class).
 * - Re-renders on Major updates so a freshly-edited desire surfaces here too.
 *
 * Same frameless ApplicationV2 pattern as the My Characters dock + Cycle HUD.
 */

import { profileName } from '../helpers/profile-pic.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const NS = 'good-society-homebrew';
const TEMPLATE = 'systems/good-society-homebrew/templates/apps/desire-reminder.hbs';

let _instance = null;

export class DesireReminderApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-desire-reminder',
    classes: ['good-society', 'gs-desire-reminder'],
    window: { frame: false, positioned: false, title: '' },
    position: { width: 'auto', height: 'auto' },
    actions: {
      openSheet:      DesireReminderApp.#openSheet,
      toggleMinimize: DesireReminderApp.#toggleMinimize,
    },
  };

  static PARTS = {
    main: { template: TEMPLATE },
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);

    // Mirror the My Characters dock's filter: every Major the current user
    // has OWNER permission on. GMs see everything via testUserPermission's
    // implicit elevation; if that's noisy for a solo-GM, they can toggle the
    // panel off in the Cabinet.
    const ownedMajors = (game.actors?.filter(
      (a) => a.type === 'major-character' && a.testUserPermission(game.user, 'OWNER'),
    ) ?? []);

    const TextEditor =
      foundry.applications.ux?.TextEditor?.implementation
      ?? globalThis.TextEditor;

    const entries = [];
    for (const actor of ownedMajors) {
      const raw = actor.system?.desire ?? '';
      const desireHtml = raw
        ? await TextEditor.enrichHTML(raw, { async: true })
        : '';
      const name = profileName(actor) || actor.name;
      entries.push({
        actorId: actor.id,
        name,
        // Per-row header: "{Name}'s Desire" so each entry is self-labelled.
        heading: game.i18n.format('GOODSOCIETY.desireReminder.entryHeading', { name }),
        theme: actor.system?.theme ?? 'clayton',
        desireHtml,
        hasDesire: !!raw?.trim?.() || !!desireHtml,
      });
    }

    ctx.entries = entries;
    ctx.hasAny = entries.length > 0;
    // Collapsed state — read from the client setting so the panel
    // remembers across reloads. Mirrors the dock's `dockMinimized` pattern.
    try { ctx.minimized = !!game.settings.get(NS, 'desiresMinimized'); }
    catch { ctx.minimized = false; }
    return ctx;
  }

  static async #openSheet(_ev, target) {
    const id = target?.dataset?.actorId;
    if (!id) return;
    const actor = game.actors?.get(id);
    actor?.sheet?.render(true);
  }

  /**
   * Collapse/expand the panel. Mirrors `MyCharactersDock#_wireMinimize`:
   * flips `is-minimized` on the live root for instant feedback, then
   * persists to the `desiresMinimized` client setting (which re-renders
   * via its onChange). The DOM-level toggle is what makes the click feel
   * snappy — without it the user waits for the round-trip through the
   * setting + re-render before the body collapses.
   */
  static async #toggleMinimize(ev) {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    const root = this.element?.querySelector('.gs-desire-reminder');
    if (!root) return;
    const willMinimize = !root.classList.contains('is-minimized');
    root.classList.toggle('is-minimized', willMinimize);
    try { await game.settings.set(NS, 'desiresMinimized', willMinimize); }
    catch (err) { console.warn('GS | desire-reminder minimize toggle failed:', err); }
  }
}

/** Render or refresh the singleton, gated by the cabinet enable + body class. */
export async function renderDesireReminder() {
  // Cabinet visibility uses a body class — the Cabinet writes
  // `gs-hide-desires` on body to suppress. The panel itself always renders
  // (so toggling it back on doesn't need a reload); CSS hides via the body
  // class.
  if (!_instance) _instance = new DesireReminderApp();
  if (!_instance.rendered) await _instance.render({ force: true });
  else _instance.render({ parts: ['main'] });
  return _instance;
}

export function getDesireReminder() {
  return _instance;
}
