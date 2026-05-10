/**
 * @typedef {import('@league-of-foundry-developers/foundry-vtt-types').Actor} Actor
 */

import { switchPersona } from '../helpers/persona-swap.js';
import { openPersonaEditor } from '../apps/persona-editor.js';
import { openPersonaSwitcherPopover } from '../apps/persona-switcher-popover.js';
import { profilePic } from '../helpers/profile-pic.js';
import { fitDossierNames } from '../helpers/responsive-name.js';
import { pronounsFor } from '../helpers/pronouns.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class NpcSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'sheet', 'actor', 'npc'],
    // Single-page dossier — same paper card + 220×220 cameo as Major and
    // Connection sheets, but slimmer (NPCs have no resolve, no impressions,
    // no linked Major). Width 680 px, height auto.
    position: { width: 680, height: 'auto' },
    window: { contentClasses: ['gs-npc-sheet'] },
    // ApplicationV2 sheets do NOT auto-submit form inputs by default.
    // Without this, every named input/textarea on the sheet (name field,
    // sceneInfo.subtitle, sceneInfo.hoverSummary) is visual-only — the
    // user's change never persists to actor.system. Same pattern as the
    // Major sheet.
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    actions: {
      promoteToConnection: NpcSheet.#promoteToConnection,
      grantToPlayer:       NpcSheet.#grantToPlayer,
      addPublicTag:        NpcSheet.#addPublicTag,
      addPersona:          NpcSheet.#addPersona,
      switchPersona:       NpcSheet.#switchPersona,
      pickToken:           NpcSheet.#pickToken,
      // Same DialogV2 textarea pattern as Major's editField + Connection's
      // editDescription — read-only enriched HTML on the sheet, ✎ button
      // opens the editor.
      editDescription:     NpcSheet.#editDescription,
      // Persona switcher popover — same plumbing as Major + Connection.
      openPersonaSwitcher: NpcSheet.#openPersonaSwitcher,
    },
  };

  static PARTS = {
    book: { template: 'systems/good-society-homebrew/templates/actors/npc/book.hbs' },
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const system = this.actor.system;

    const activePersona = system.activePersona;
    const portraitUrl = profilePic(this.actor);  // §8.5 token-based
    // Initial follows displayed name (active persona name preferred over
    // actor.name) so it stays consistent when a persona is in play.
    const displayName = activePersona?.name || this.actor.name;
    const portraitInitial = (displayName?.[0] ?? '?').toUpperCase();
    const hasActivePersona = !!activePersona;
    const activePersonaExplicit = !!system.activePersonaId;

    // Enrich description for read-only render on the dossier card; editing
    // happens via DialogV2 textarea (#editDescription action handler).
    const TextEditor =
      foundry.applications.ux?.TextEditor?.implementation
      ?? globalThis.TextEditor;
    const enrichedDescription = system.bio?.description
      ? await TextEditor.enrichHTML(system.bio.description, { async: true, secrets: this.actor.isOwner })
      : '';

    return {
      ...ctx,
      actor: this.actor,
      system,
      portraitUrl,
      portraitInitial,
      displayName,
      hasActivePersona,
      activePersonaExplicit,
      // Parsed pronoun set — see Major / Connection sheet for usage.
      pronouns: pronounsFor(this.actor),
      enrichedDescription,
      publicTags: system.sceneInfo?.publicTags ?? [],
      hoverSummary: system.sceneInfo?.hoverSummary ?? '',
      personas: system.personas ?? [],
      activePersonaId: system.activePersonaId ?? '',
    };
  }

  /** Responsive cameo name sizing + slice/hidden name sync. Same patterns
   *  as Major + Connection sheets — the slice input ("everything after the
   *  ornament initial") must update the hidden `name="name"` field on every
   *  keystroke, or the form serializer writes the stale full name back on
   *  submit and typing has no visible effect. */
  _onRender(context, options) {
    super._onRender(context, options);
    if (this._nameFitAbort) this._nameFitAbort.abort();
    this._nameFitAbort = new AbortController();
    fitDossierNames(this.element, { signal: this._nameFitAbort.signal });

    const sliceInput = this.element.querySelector('.dossier-cameo__name-input');
    const hiddenFull = this.element.querySelector('input[data-name-full]');
    if (sliceInput && hiddenFull) {
      sliceInput.addEventListener('input', () => {
        const initial = sliceInput.dataset.nameInitial ?? '';
        hiddenFull.value = initial + sliceInput.value;
      }, { signal: this._nameFitAbort.signal });
    }
  }

  static async #promoteToConnection() {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('GOODSOCIETY.npc.promoteTitle') },
      content: `<p>${game.i18n.format('GOODSOCIETY.npc.promoteConfirm', { name: this.actor.name })}</p>`,
    });
    if (!confirmed) return;

    const sys = this.actor.system;
    const newActorData = {
      name: this.actor.name,
      type: 'connection',
      img: this.actor.img,
      ownership: foundry.utils.deepClone(this.actor.ownership ?? {}),
      system: {
        bio: {
          pronouns: sys.bio?.pronouns ?? '',
          relationshipLabel: '',
          description: sys.bio?.description ?? '',
          portraitUrl: sys.bio?.portraitUrl ?? '',
        },
        linkedMajorId: '',
        impressions: [],
        resolve: { current: 1, max: 5 },
        sceneInfo: {
          hoverSummary: sys.sceneInfo?.hoverSummary ?? '',
          publicTags: foundry.utils.deepClone(sys.sceneInfo?.publicTags ?? []),
        },
        theme: 'connection-green',
        personas: foundry.utils.deepClone(sys.personas ?? []),
        activePersonaId: sys.activePersonaId ?? '',
      },
    };

    const newActor = await Actor.create(newActorData);
    if (!newActor) {
      ui.notifications?.error(game.i18n.localize('GOODSOCIETY.npc.promoteFailed'));
      return;
    }

    await this.close();
    await this.actor.delete();
    newActor.sheet?.render(true);
    ui.notifications?.info(game.i18n.format('GOODSOCIETY.npc.promoteSuccess', { name: newActor.name }));
  }

  static async #grantToPlayer() {
    // Opens Foundry's built-in actor ownership dialog.
    new DocumentOwnershipConfig(this.actor, {}).render(true);
  }

  static async #addPublicTag() {
    const tag = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('GOODSOCIETY.sceneTag.addTitle') },
      content: `<label style="display:block;margin-bottom:6px">${game.i18n.localize('GOODSOCIETY.sceneTag.label')}<input type="text" name="tag" style="width:100%;margin-top:4px" /></label>`,
      ok: {
        label: game.i18n.localize('GOODSOCIETY.sceneTag.confirm'),
        callback: (_ev, button) => button.form.elements.tag.value.trim(),
      },
    });
    if (!tag) return;
    const current = this.actor.system.sceneInfo?.publicTags ?? [];
    await this.actor.update({ 'system.sceneInfo.publicTags': [...current, tag] });
  }

  static async #addPersona() {
    openPersonaEditor(this.actor);
  }

  static async #switchPersona(event, target) {
    await switchPersona(this.actor, target.dataset.personaId ?? '');
  }

  /** Open the persona-switcher popover anchored to the pill button. Same
   *  plumbing as Major + Connection — persona-switcher-popover.js owns the
   *  popover lifecycle. The third arg is the "+ add persona" callback. */
  static #openPersonaSwitcher(event, target) {
    openPersonaSwitcherPopover(
      this.actor,
      target,
      () => openPersonaEditor(this.actor),
    );
  }

  /** Edit the description in a DialogV2 textarea — same pattern as the
   *  Major dossier's #editField and the Connection sheet's #editDescription.
   *  The card on the sheet renders enriched HTML read-only; this opens the
   *  editing modal. */
  static async #editDescription() {
    const current = this.actor.system.bio?.description ?? '';
    const escaped = foundry.utils.escapeHTML(current);
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('GOODSOCIETY.npc.editDescription') },
      position: { width: 560 },
      content: `<label style="display:block;margin-bottom:6px">${game.i18n.localize('GOODSOCIETY.npc.description')}
                <textarea name="description" rows="12"
                  style="width: 100%; min-height: 220px; font-family: var(--gs-body, serif); font-size: 14px; padding: 8px; box-sizing: border-box;">${escaped}</textarea></label>`,
      ok: {
        label: 'Save',
        callback: (_ev, button) => button.form.elements.description.value,
      },
      rejectClose: false,
    });
    if (result === null || result === undefined) return;
    await this.actor.update({ 'system.bio.description': result });
  }

  /** Click portrait → FilePicker → write the picked image to the right
   *  place based on whether a persona is active (persona's tokenImageUrl)
   *  or true identity is active (actor.img + live token). See
   *  major-character-sheet.js#pickToken for the full rationale.
   *  Opens at a writable location (world folder, or current image's folder). */
  static async #pickToken() {
    const FP = foundry.applications.apps.FilePicker?.implementation ?? globalThis.FilePicker;
    if (!FP) {
      ui.notifications?.error('FilePicker is unavailable in this Foundry build.');
      return;
    }
    const stored = this.actor.prototypeToken?.texture?.src;
    const isCustomImage = stored && !stored.startsWith('icons/');
    const current = isCustomImage
      ? stored
      : `worlds/${game.world?.id ?? ''}/`;
    const sys = this.actor.system;
    const explicitPersona = sys?.activePersonaId
      ? (sys.personas ?? []).find(p => p.id === sys.activePersonaId)
      : null;
    const picker = new FP({
      type: 'image',
      current,
      callback: async (path) => {
        if (explicitPersona) {
          const toPlain = (p) => (p && typeof p.toObject === 'function') ? p.toObject() : { ...p };
          const updated = (sys.personas ?? []).map(p => {
            if (p.id !== explicitPersona.id) return toPlain(p);
            const plain = toPlain(p);
            plain.tokenImageUrl = path;
            return plain;
          });
          await this.actor.update({
            'system.personas': updated,
            'prototypeToken.texture.src': path,
          });
        } else {
          await this.actor.update({
            'img': path,
            'prototypeToken.texture.src': path,
          });
        }
      },
    });
    return picker.render(true);
  }
}
