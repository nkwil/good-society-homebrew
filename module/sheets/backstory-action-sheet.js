const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class BackstoryActionSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'sheet', 'item', 'backstory-action'],
    position: { width: 400, height: 'auto' },
    window: { contentClasses: ['gs-item-sheet', 'gs-item-sheet--backstory-action'] },
    actions: {
      toggleUsed: BackstoryActionSheet.#toggleUsed,
      toggleExpanded: BackstoryActionSheet.#toggleExpanded,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/items/backstory-action.hbs',
    },
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    ctx.system = this.document.system;
    ctx.document = this.document;
    return ctx;
  }

  static async #toggleUsed() {
    await this.document.update({ 'system.used': !this.document.system.used });
  }

  static async #toggleExpanded() {
    await this.document.update({ 'system.expanded': !this.document.system.expanded });
  }
}
