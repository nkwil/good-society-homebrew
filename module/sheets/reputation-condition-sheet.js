const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class ReputationConditionSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'sheet', 'item', 'reputation-condition'],
    position: { width: 380, height: 'auto' },
    window: { contentClasses: ['gs-item-sheet', 'gs-item-sheet--reputation-condition'] },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      setPolarity: ReputationConditionSheet.#setPolarity,
      toggleActive: ReputationConditionSheet.#toggleActive,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/items/reputation-condition.hbs',
    },
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    ctx.system = this.document.system;
    ctx.document = this.document;
    return ctx;
  }

  static async #setPolarity(event, target) {
    await this.document.update({ 'system.polarity': target.dataset.polarity });
  }

  static async #toggleActive() {
    await this.document.update({ 'system.active': !this.document.system.active });
  }
}
