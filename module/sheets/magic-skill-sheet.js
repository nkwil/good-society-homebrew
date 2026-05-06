const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class MagicSkillSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'sheet', 'item', 'magic-skill'],
    position: { width: 460, height: 'auto' },
    window: { contentClasses: ['gs-item-sheet', 'gs-item-sheet--magic-skill'] },
    actions: {
      toggleHidden: MagicSkillSheet.#toggleHidden,
      cast: MagicSkillSheet.#cast,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/items/magic-skill.hbs',
    },
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    ctx.system = this.document.system;
    ctx.document = this.document;
    ctx.triggersSwap = !!this.document.system.triggersPersonaSwap?.targetPersonaId;
    return ctx;
  }

  static async #toggleHidden() {
    await this.document.update({ 'system.hidden': !this.document.system.hidden });
  }

  // Stub — Sequencer VFX implementation deferred to Phase 8.
  static async #cast() {
    console.log('[Good Society] Cast stub:', this.document.name, this.document.system);
  }
}
