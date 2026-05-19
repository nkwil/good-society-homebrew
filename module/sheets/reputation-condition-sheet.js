import { openFieldEditor } from '../helpers/edit-field-dialog.js';
import { ARCHETYPE_CHOICES } from '../data-models/major-character.js';

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
      toggleArchetype: ReputationConditionSheet.#toggleArchetype,
      editDescription: ReputationConditionSheet.#editDescription,
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
    // Description is rendered read-only (enriched) with a ✎ edit button —
    // Foundry v13's {{editor}} helper doesn't open reliably in ApplicationV2.
    const TextEditor =
      foundry.applications.ux?.TextEditor?.implementation
      ?? globalThis.TextEditor;
    ctx.enrichedDescription = this.document.system?.description
      ? await TextEditor.enrichHTML(this.document.system.description, { async: true })
      : '';
    // Archetype gating — chip toggles. An empty selection means the
    // condition is universal (available to every archetype).
    const selectedArchetypes = ctx.system?.archetypes ?? [];
    ctx.archetypeChoices = ARCHETYPE_CHOICES.map(id => ({
      id,
      label: game.i18n.localize(`GOODSOCIETY.major.archetype.${id}`),
      selected: selectedArchetypes.includes(id),
    }));
    ctx.isUniversal = selectedArchetypes.length === 0;
    return ctx;
  }

  static async #setPolarity(event, target) {
    await this.document.update({ 'system.polarity': target.dataset.polarity });
  }

  static async #toggleActive() {
    await this.document.update({ 'system.active': !this.document.system.active });
  }

  static async #toggleArchetype(event, target) {
    const id = target.dataset.archetype;
    if (!id) return;
    const current = this.document.system.archetypes ?? [];
    const next = current.includes(id)
      ? current.filter(a => a !== id)
      : [...current, id];
    await this.document.update({ 'system.archetypes': next });
  }

  static async #editDescription() {
    await openFieldEditor({
      document: this.document,
      field: 'description',
      label: game.i18n.localize('GOODSOCIETY.item.reputationCondition.description'),
    });
  }
}
