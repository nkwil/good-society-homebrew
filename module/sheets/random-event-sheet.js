import { ARCHETYPE_CHOICES } from '../data-models/major-character.js';

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
    return ctx;
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
