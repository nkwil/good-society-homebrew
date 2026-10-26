import { ARCHETYPE_CHOICES } from '../data-models/major-character.js';
import { openFieldEditor } from '../helpers/edit-field-dialog.js';
import { bindImageUploadOn } from '../helpers/upload-image.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Sheet for the random-event Item type. Lets the GM author the event's
 * archetype filter, description, optional flavor image, and the candidate
 * positive/negative tag SUGGESTIONS shown as click-to-prefill chips on the
 * player's resolution popover.
 *
 * **Why no `submitOnChange`:** the earlier implementation used
 * `form.submitOnChange: true`, which races with action-triggered
 * `document.update` calls (add/remove tag rows). Each race rendered the
 * sheet with stale DOM — the user's typing in `name=` fields was being
 * stomped by whatever the previous render had carried. Dropped per the
 * CLAUDE.md §16 anti-pattern "submitOnChange racing with action updates".
 * All saves now go through explicit `change` listeners wired in
 * `_onRender`, matching the theme-select-no-name recipe.
 */
export class RandomEventSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'sheet', 'item', 'random-event'],
    position: { width: 480, height: 'auto' },
    window: { contentClasses: ['gs-item-sheet', 'gs-item-sheet--random-event'] },
    // NOTE: no form.submitOnChange. Writes are manual (see _onRender).
    actions: {
      addPositiveTag:    RandomEventSheet.#addPositiveTag,
      removePositiveTag: RandomEventSheet.#removePositiveTag,
      addNegativeTag:    RandomEventSheet.#addNegativeTag,
      removeNegativeTag: RandomEventSheet.#removeNegativeTag,
      editDescription:   RandomEventSheet.#editDescription,
      pickImage:         RandomEventSheet.#pickImage,
      clearImage:        RandomEventSheet.#clearImage,
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
    ctx.imageUrl = sys.imageUrl ?? '';
    ctx.hasImage = !!ctx.imageUrl;
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

  /**
   * Wire explicit listeners for every editable field. We ran AbortController
   * through `_onRender` so re-renders don't accumulate duplicate handlers.
   */
  async _onRender(context, options) {
    super._onRender(context, options);
    // Fresh controller per render; the DOM is new.
    this._listenerAbort?.abort();
    this._listenerAbort = new AbortController();
    const signal = this._listenerAbort.signal;
    const root = this.element;
    if (!root) return;

    // Name — direct write to Item.name.
    const nameInput = root.querySelector('input[data-gs-field="name"]');
    nameInput?.addEventListener('change', async (ev) => {
      const value = (ev.target.value ?? '').trim() || this.document.name;
      if (value === this.document.name) return;
      await this.document.update({ name: value });
    }, { signal });

    // Archetype — direct write.
    const archetypeSelect = root.querySelector('select[data-gs-field="archetype"]');
    archetypeSelect?.addEventListener('change', async (ev) => {
      const value = ev.target.value;
      if (value === this.document.system?.archetype) return;
      await this.document.update({ 'system.archetype': value });
    }, { signal });

    // Suggestion inputs — one listener per polarity list, event-delegated by
    // data-side + data-index. Writing swaps the full array (same as the
    // add/remove actions) rather than relying on form serialization.
    const bindList = (side, selector, field) => {
      root.querySelectorAll(selector).forEach((input) => {
        input.addEventListener('change', async (ev) => {
          const idx = Number(ev.target.dataset.index);
          if (!Number.isInteger(idx)) return;
          const next = [...(this.document.system?.[field] ?? [])];
          next[idx] = ev.target.value;
          await this.document.update({ [`system.${field}`]: next });
        }, { signal });
      });
    };
    bindList('positive', 'input[data-gs-side="positive"]', 'positiveTagOptions');

    // Drag-and-drop + paste image upload on the flavor image box.
    this._imageUploadCleanup?.();
    const imageBox = root.querySelector('[data-action="pickImage"]');
    if (imageBox) {
      this._imageUploadCleanup = bindImageUploadOn({
        element: imageBox,
        destSubdir: 'event-flavor',
        onUploaded: async (path) => {
          await this.document.update({ 'system.imageUrl': path });
        },
      });
    }
    bindList('negative', 'input[data-gs-side="negative"]', 'negativeTagOptions');
  }

  async _onClose(options) {
    this._listenerAbort?.abort();
    this._listenerAbort = null;
    return super._onClose?.(options);
  }

  // ── Action handlers ───────────────────────────────────────────────────────

  static async #editDescription() {
    await openFieldEditor({
      document: this.document,
      field: 'description',
      label: game.i18n.localize('GOODSOCIETY.item.randomEvent.descriptionLabel'),
    });
  }

  /** Open the FilePicker scoped to images; write the chosen path to
   *  `system.imageUrl`. */
  static async #pickImage() {
    const FP = foundry.applications.apps.FilePicker?.implementation ?? globalThis.FilePicker;
    if (!FP) {
      ui.notifications?.error('FilePicker is unavailable in this Foundry build.');
      return;
    }
    const current = this.document.system?.imageUrl || `worlds/${game.world?.id ?? ''}/`;
    new FP({
      type: 'image',
      current,
      callback: async (path) => {
        await this.document.update({ 'system.imageUrl': path });
      },
    }).render(true);
  }

  static async #clearImage() {
    await this.document.update({ 'system.imageUrl': '' });
  }

  // ── Tag-suggestion editors ───────────────────────────────────────────────

  static async #addPositiveTag() {
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

  static async #addNegativeTag() {
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

  /** "Done" — just close. All fields autosave via change listeners. */
  static async #done() {
    this.close();
  }
}
