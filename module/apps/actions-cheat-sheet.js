/**
 * ActionsCheatSheet — rulebook-reference modal for token spend rules and
 * tag-trade rules. Per docs/design/29-reputation-batch.md §4.
 *
 * House-styled singleton. Width 540. Two-column layout: left TOC + right
 * scrollable sections.
 *
 * Public API: openActionsCheatSheet().
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 }              = foundry.applications.api;

export class ActionsCheatSheet extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-actions-cheat-sheet',
    classes: ['good-society', 'gs-actions-cheat-sheet-app'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.actionsCheatSheet.windowTitle',
    },
    position: { width: 540, height: 'auto' },
    actions: {},
  };

  static PARTS = {
    main: { template: 'systems/good-society-homebrew/templates/apps/actions-cheat-sheet.hbs' },
  };

  /** @override */
  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    return { ...ctx };
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Open the cheat sheet; if already open, bring to front. */
export function openActionsCheatSheet() {
  const existing = foundry.applications.instances?.get('gs-actions-cheat-sheet');
  if (existing?.rendered) {
    existing.bringToFront?.();
    return;
  }
  new ActionsCheatSheet().render({ force: true });
}
