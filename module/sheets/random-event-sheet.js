import { ARCHETYPE_CHOICES } from '../data-models/major-character.js';
import { openFieldEditor } from '../helpers/edit-field-dialog.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Sheet for the random-event Item type. Lets the GM author the event's
 * archetype filter, description, and the candidate positive/negative tag
 * shortlists shown to the player on resolution.
 */
export class RandomEventSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'sheet', 'item', 'random-event'],
    position: { width: 480, height: 'auto' },
    window: { contentClasses: ['gs-item-sheet', 'gs-item-sheet--random-event'] },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      addPositiveTag:    RandomEventSheet.#addPositiveTag,
      removePositiveTag: RandomEventSheet.#removePositiveTag,
      addNegativeTag:    RandomEventSheet.#addNegativeTag,
      removeNegativeTag: RandomEventSheet.#removeNegativeTag,
      editDescription:   RandomEventSheet.#editDescription,
      done:              RandomEventSheet.#done,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/items/random-event.hbs',
    },
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const sys = this.document.system;
    ctx.system = sys;
    ctx.document = this.document;
    ctx.archetypeChoices = ARCHETYPE_CHOICES.map(id => ({
      id,
      label: game.i18n.localize(`GOODSOCIETY.major.archetype.${id}`),
      selected: id === sys.archetype,
    }));
    ctx.positiveTagOptions = sys.positiveTagOptions ?? [];
    ctx.negativeTagOptions = sys.negativeTagOptions ?? [];
    // Description rendered read-only (enriched) + ✎ button — v13's
    // {{editor}} helper doesn't open in ApplicationV2.
    const TextEditor =
      foundry.applications.ux?.TextEditor?.implementation
      ?? globalThis.TextEditor;
    ctx.enrichedDescription = sys?.description
      ? await TextEditor.enrichHTML(sys.description, { async: true })
      : '';
    return ctx;
  }

  static async #editDescription() {
    await openFieldEditor({
      document: this.document,
      field: 'description',
      label: game.i18n.localize('GOODSOCIETY.item.randomEvent.descriptionLabel'),
    });
  }

  // ── Tag-shortlist editors ─────────────────────────────────────────────────

  static async #addPositiveTag(_ev, _target) {
    const next = [...(this.document.system.positiveTagOptions ?? []), ''];
    await this.document.update({ 'system.positiveTagOptions': next });
  }

  static async #removePositiveTag(_ev, target) {
    const idx = Number(target.dataset.index);
    if (Number.isNaN(idx)) return;
    const next = [...(this.document.system.positiveTagOptions ?? [])];
    next.splice(idx, 1);
    await this.document.update({ 'system.positiveTagOptions': next });
  }

  static async #addNegativeTag(_ev, _target) {
    const next = [...(this.document.system.negativeTagOptions ?? []), ''];
    await this.document.update({ 'system.negativeTagOptions': next });
  }

  static async #removeNegativeTag(_ev, target) {
    const idx = Number(target.dataset.index);
    if (Number.isNaN(idx)) return;
    const next = [...(this.document.system.negativeTagOptions ?? [])];
    next.splice(idx, 1);
    await this.document.update({ 'system.negativeTagOptions': next });
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
