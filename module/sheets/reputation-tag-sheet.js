const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class ReputationTagSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'sheet', 'item', 'reputation-tag'],
    position: { width: 360, height: 'auto' },
    window: { contentClasses: ['gs-item-sheet', 'gs-item-sheet--reputation-tag'] },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      setPolarity: ReputationTagSheet.#setPolarity,
      done:        ReputationTagSheet.#done,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/items/reputation-tag.hbs',
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

  static async #done() {
    if (this.isEditable) {
      const form = this.element?.querySelector('form');
      if (form) {
        const fd = new FormDataExtended(form);
        await this.document.update(foundry.utils.expandObject(fd.object));
      }
    }
    this.close();
  }
}
