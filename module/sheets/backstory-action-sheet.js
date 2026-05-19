import { openFieldEditor } from '../helpers/edit-field-dialog.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class BackstoryActionSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'sheet', 'item', 'backstory-action'],
    position: { width: 400, height: 'auto' },
    window: { contentClasses: ['gs-item-sheet', 'gs-item-sheet--backstory-action'] },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      toggleUsed: BackstoryActionSheet.#toggleUsed,
      toggleExpanded: BackstoryActionSheet.#toggleExpanded,
      editDescription: BackstoryActionSheet.#editDescription,
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
    // Description rendered read-only (enriched) + ✎ button — v13's
    // {{editor}} helper doesn't open in ApplicationV2.
    const TextEditor =
      foundry.applications.ux?.TextEditor?.implementation
      ?? globalThis.TextEditor;
    ctx.enrichedDescription = this.document.system?.description
      ? await TextEditor.enrichHTML(this.document.system.description, { async: true })
      : '';
    return ctx;
  }

  static async #toggleUsed() {
    await this.document.update({ 'system.used': !this.document.system.used });
  }

  static async #toggleExpanded() {
    await this.document.update({ 'system.expanded': !this.document.system.expanded });
  }

  static async #editDescription() {
    await openFieldEditor({
      document: this.document,
      field: 'description',
      label: game.i18n.localize('GOODSOCIETY.item.backstoryAction.description'),
    });
  }
}
