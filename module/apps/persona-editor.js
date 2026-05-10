/**
 * PersonaEditor — modal ApplicationV2 for creating and editing personas.
 *
 * Per docs/design/13-persona-switcher.md §"Persona editor modal spec".
 * Framed ApplicationV2 (has lifecycle needs: draft state, explicit save,
 * delete-with-confirm). Unlike transient overlays (picker popover, reveal
 * control), this warrants ApplicationV2.
 *
 * Does NOT use submitOnChange — all values are collected from the DOM on
 * save to keep the form explicit (cancel = discard, save = persist).
 *
 * Modes:
 *   Create — persona is null; save appends a new persona.
 *   Edit   — persona is an existing object; save replaces in the array.
 */

import { THEME_REGISTRY } from '../constants.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 }              = foundry.applications.api;

const VIS_CYCLE = ['inherit', 'secret', 'public', 'redacted'];

export class PersonaEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'gs-persona-editor-app'],
    window: { frame: true, positioned: true, title: 'GOODSOCIETY.personaEditor.windowTitle' },
    position: { width: 480, height: 'auto' },
    actions: {
      togglePrimary:    PersonaEditor.#togglePrimary,
      browseImage:      PersonaEditor.#browseImage,
      cycleVisibility:  PersonaEditor.#cycleVisibility,
      savePersona:      PersonaEditor.#savePersona,
      deletePersona:    PersonaEditor.#deletePersona,
      cancelEditor:     PersonaEditor.#cancelEditor,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/apps/persona-editor.hbs',
    },
  };

  /**
   * @param {Actor}       actor   The owning actor.
   * @param {object|null} persona null → create mode; existing persona → edit mode.
   */
  constructor(actor, persona = null) {
    super({ id: `gs-persona-editor-${actor.id}` });
    this._actor    = actor;
    this._isCreate = !persona;
    // _draft is a plain-object working copy. It is updated in-place by action
    // handlers (togglePrimary, cycleVisibility) and collected from the DOM on save.
    // Use .toObject() (when persona is a DataModel instance) rather than
    // deepClone — deepClone of a DataModel can miss fields that live on the
    // schema proxy rather than as own enumerable properties.
    this._draft = persona
      ? (typeof persona.toObject === 'function' ? persona.toObject() : foundry.utils.deepClone(persona))
      : {
          id:           foundry.utils.randomID(),
          name:         '',
          isPrimary:    false,
          portraitUrl:  '',
          tokenImageUrl: '',
          tokenName:    '',
          hoverSummary: '',
          chatColor:    '',
          theme:        '',
          visibility:   { desire: 'inherit', backstory: 'inherit', magic: 'inherit' },
        };
    // Original chatColor used on save to detect "user never touched the color picker"
    // vs. "user explicitly set the theme default". See #savePersona for rationale.
    this._originalChatColor = persona?.chatColor ?? '';
  }

  /** @override */
  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const actor = this._actor;
    const eyebrowBase = actor.name.toUpperCase();

    // Theme registry rows for the per-persona theme picker. Empty value
    // = "inherit true identity theme". The picker is a select; on save
    // we read the chosen value back into _draft.theme.
    const themeOptions = [
      { id: '', label: game.i18n.localize('GOODSOCIETY.personaEditor.themeInherit'), isSelected: !this._draft.theme },
      ...THEME_REGISTRY.map(t => ({
        id: t.id,
        label: game.i18n.localize(t.label) || t.id,
        swatchColor: t.swatchColor,
        isSelected: this._draft.theme === t.id,
      })),
    ];

    return {
      ...ctx,
      themeId:  actor.system?.theme ?? 'npc',
      eyebrow:  this._isCreate
        ? `${game.i18n.localize('GOODSOCIETY.personaEditor.eyebrowCreate')} · ${eyebrowBase}`
        : `${game.i18n.localize('GOODSOCIETY.personaEditor.eyebrowEdit')} · ${eyebrowBase}`,
      isCreate: this._isCreate,
      persona:  this._draft,
      themeOptions,
    };
  }

  // ── Action handlers ──────────────────────────────────────────────────────────

  static #togglePrimary(ev, target) {
    this._draft.isPrimary = !this._draft.isPrimary;
    target.dataset.value  = String(this._draft.isPrimary);
    target.classList.toggle('gs-persona-editor__primary-toggle--on', this._draft.isPrimary);
  }

  static #browseImage(ev, target) {
    const fieldName  = target.dataset.target;
    const input      = this.element.querySelector(`[data-persona-field="${fieldName}"]`);
    const current    = input?.value ?? '';
    new foundry.applications.apps.FilePicker({
      type: 'image',
      current,
      callback: (path) => {
        if (input) input.value = path;
        // Update the small preview thumbnail.
        const preview = this.element.querySelector(`.gs-persona-editor__preview[data-for="${fieldName}"]`);
        if (preview) {
          if (preview.tagName === 'IMG') {
            preview.src = path;
          } else {
            // Replace the empty-state span with an img
            const img = document.createElement('img');
            img.className = 'gs-persona-editor__preview';
            img.dataset.for = fieldName;
            img.src = path;
            preview.replaceWith(img);
          }
        }
      },
    }).render(true);
  }

  static #cycleVisibility(ev, target) {
    const field   = target.dataset.visibilityField;
    const current = target.dataset.value ?? 'inherit';
    const next    = VIS_CYCLE[(VIS_CYCLE.indexOf(current) + 1) % VIS_CYCLE.length];
    this._draft.visibility[field] = next;
    target.dataset.value = next;
    // Update label text and CSS class in-place — no re-render needed.
    const fieldLabel = game.i18n.localize(`GOODSOCIETY.personaEditor.vis${field.charAt(0).toUpperCase() + field.slice(1)}`);
    target.textContent = `${fieldLabel}: ${next}`;
    target.className = `gs-persona-editor__vis-btn gs-persona-editor__vis-btn--${next}`;
  }

  static async #savePersona(ev, target) {
    // Collect text-input values from the DOM into the draft.
    // The draft's isPrimary and visibility are already up-to-date via the
    // in-place action handlers above; only text fields need a DOM read here.
    const fields = ['name', 'portraitUrl', 'tokenImageUrl', 'tokenName', 'hoverSummary', 'chatColor', 'theme'];
    for (const f of fields) {
      const el = this.element.querySelector(`[data-persona-field="${f}"]`);
      if (el) this._draft[f] = el.value.trim();
    }

    // chatColor: treat the stub default (#2A3A2D when persona.chatColor was '')
    // as "no override" so we don't accidentally store a color the user didn't pick.
    if (this._draft.chatColor === '#2A3A2D' && !this._originalChatColor) {
      this._draft.chatColor = '';
    }

    const actor    = this._actor;
    const existing = actor.system?.personas ?? [];
    // Normalize every existing persona to a plain object so the array sent
    // to actor.update is uniformly serializable. Mixing DataModel
    // instances and plain objects in the same array can cause Foundry's
    // update layer to silently drop newly-added fields (like our `theme`)
    // on entries that weren't migrated to plain. Force-toObject every
    // entry, then swap in our modified draft.
    const toPlain = (p) => (p && typeof p.toObject === 'function') ? p.toObject() : { ...p };

    let updated;
    if (this._isCreate) {
      // First persona on an actor becomes primary automatically.
      if (existing.length === 0) this._draft.isPrimary = true;
      updated = [...existing.map(toPlain), this._draft];
    } else {
      updated = existing.map(p => p.id === this._draft.id ? this._draft : toPlain(p));
    }

    // Enforce single primary: if this persona is being set as primary,
    // clear isPrimary on all others.
    if (this._draft.isPrimary) {
      updated = updated.map(p => p.id === this._draft.id ? p : { ...p, isPrimary: false });
    }

    await actor.update({ 'system.personas': updated });
    // Force re-render the actor's sheet so dataset.theme picks up the new
    // persona theme immediately (the Foundry hook chain SHOULD do this on
    // its own, but defensive — if anything blocked the chain we still get
    // the correct visual state on save).
    if (actor.sheet?.rendered) actor.sheet.render({ force: false });
    await this.close();
  }

  static async #deletePersona(ev, target) {
    if (this._draft.isPrimary) return; // disabled in UI; guard anyway

    const confirmed = window.confirm(
      game.i18n.format('GOODSOCIETY.personaEditor.deleteConfirm', {
        name: this._draft.name || '?',
      })
    );
    if (!confirmed) return;

    const actor   = this._actor;
    const updates = {
      'system.personas': (actor.system?.personas ?? []).filter(p => p.id !== this._draft.id),
    };
    // Clear activePersonaId if the deleted persona was active.
    if (actor.system?.activePersonaId === this._draft.id) {
      updates['system.activePersonaId'] = '';
    }
    await actor.update(updates);
    await this.close();
  }

  static async #cancelEditor(ev, target) {
    await this.close();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Open the persona editor for an actor, optionally pre-populated with an
 * existing persona (edit mode) or blank (create mode).
 *
 * @param {Actor}       actor   The owning actor.
 * @param {object|null} persona Existing persona for edit mode; null for create.
 */
export function openPersonaEditor(actor, persona = null) {
  new PersonaEditor(actor, persona).render({ force: true });
}
