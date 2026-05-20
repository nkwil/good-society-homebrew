import { castMagicSkill } from '../helpers/cast-magic.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class MagicSkillSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'sheet', 'item', 'magic-skill'],
    position: { width: 460, height: 'auto' },
    window: { contentClasses: ['gs-item-sheet', 'gs-item-sheet--magic-skill'] },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      toggleHidden: MagicSkillSheet.#toggleHidden,
      cast: MagicSkillSheet.#cast,
      editDescription: MagicSkillSheet.#editDescription,
      pickIcon: MagicSkillSheet.#pickIcon,
      clearIcon: MagicSkillSheet.#clearIcon,
      browseVfx: MagicSkillSheet.#browseVfx,
      previewVfx: MagicSkillSheet.#previewVfx,
      browseSound: MagicSkillSheet.#browseSound,
      previewSound: MagicSkillSheet.#previewSound,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/items/magic-skill.hbs',
    },
  };

  /**
   * Defensive form-save wiring. submitOnChange:true SHOULD save on every input
   * change, but it's been silently failing on this sheet (user reported "edits
   * don't save"). Wire each named input/select/textarea explicitly: on
   * change, route the value to document.update via the input's `name` attr.
   * Belt-and-suspenders — if submitOnChange resumes working later, this just
   * fires twice (idempotent — Foundry de-dupes identical updates).
   */
  _onRender(context, options) {
    super._onRender(context, options);
    if (this._formAbort) this._formAbort.abort();
    this._formAbort = new AbortController();
    const inputs = this.element.querySelectorAll('[name]');
    for (const input of inputs) {
      input.addEventListener('change', async () => {
        const name = input.getAttribute('name');
        if (!name) return;
        const value = input.type === 'checkbox' ? input.checked : input.value;
        try {
          await this.document.update({ [name]: value });
        } catch (err) {
          console.warn('[GS] magic-skill input save failed:', name, err);
        }
      }, { signal: this._formAbort.signal });
    }
  }

  _onClose(options) {
    if (this._formAbort) {
      this._formAbort.abort();
      this._formAbort = null;
    }
    return super._onClose(options);
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    ctx.system = this.document.system;
    ctx.document = this.document;
    ctx.triggersSwap = !!this.document.system.triggersPersonaSwap?.targetPersonaId;
    ctx.sequencerActive = !!game.modules.get('sequencer')?.active;

    // Enrich description HTML for read-only display. The {{editor}} helper
    // in v13 doesn't reliably open the editor inside ItemSheetV2 — same bug
    // as the Major sheet's desire/notes fields. We render enriched HTML in
    // the body and attach a custom edit button that opens a DialogV2.
    const TE = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
    try {
      ctx.enrichedDescription = await TE.enrichHTML(this.document.system.description ?? '', {
        secrets: this.document.isOwner,
        relativeTo: this.document,
        async: true,
      });
    } catch {
      ctx.enrichedDescription = this.document.system.description ?? '';
    }
    return ctx;
  }

  static async #toggleHidden() {
    await this.document.update({ 'system.hidden': !this.document.system.hidden });
  }

  static async #cast() {
    await castMagicSkill(this.document, this.document.parent ?? null);
  }

  /**
   * Opens a DialogV2 with a textarea pre-filled with the raw HTML for
   * `system.description`. On save, writes via document.update. Same pattern
   * as the Major sheet's #editField — we don't rely on Foundry's {{editor}}
   * helper because it doesn't reliably dispatch in v13 ItemSheetV2.
   */
  static async #editDescription() {
    const current = this.document.system.description ?? '';
    const DialogV2 = foundry.applications.api.DialogV2;
    const newValue = await DialogV2.prompt({
      window: { title: `Edit — ${this.document.name || 'Description'}` },
      position: { width: 560 },
      content: `
        <p style="margin: 0 0 8px 0; font-size: 12px; opacity: 0.75;">
          <em>HTML supported. Wrap in &lt;p&gt;…&lt;/p&gt; for paragraphs, &lt;em&gt;…&lt;/em&gt; for italic, etc.</em>
        </p>
        <textarea name="content"
                  rows="10"
                  style="width: 100%; min-height: 220px; font-family: var(--gs-body, serif); font-size: 14px; padding: 8px; box-sizing: border-box;">${foundry.utils.escapeHTML(current)}</textarea>
      `,
      ok: {
        label: 'Save',
        callback: (event, button) => button.form.elements.content.value,
      },
      rejectClose: false,
    });
    if (newValue === null || newValue === undefined) return;
    await this.document.update({ 'system.description': newValue });
  }

  /**
   * Click thumbnail → Foundry FilePicker → write the picked image path to
   * `system.iconUrl`. Used by the character sheet's Magic & Skills row to
   * show a custom icon for this skill (falls back to the generic ⊛ glyph
   * when iconUrl is empty).
   */
  static async #pickIcon() {
    const FP = foundry.applications.apps.FilePicker?.implementation ?? globalThis.FilePicker;
    if (!FP) {
      ui.notifications?.error('FilePicker is unavailable in this Foundry build.');
      return;
    }
    const current = this.document.system?.iconUrl || `worlds/${game.world?.id ?? ''}/`;
    new FP({
      type: 'image',
      current,
      callback: async (path) => {
        await this.document.update({ 'system.iconUrl': path });
      },
    }).render(true);
  }

  static async #clearIcon() {
    await this.document.update({ 'system.iconUrl': '' });
  }

  /**
   * Open Sequencer's Database Viewer so the user can browse the JB2A library
   * by category, preview each effect, and copy the key. Sequencer's viewer
   * doesn't return a value to a calling app — it copies to clipboard via its
   * own "Copy" button on each row — so the workflow is: click Browse → find
   * effect → click Copy in Sequencer's UI → come back here → paste into the
   * VFX key field. Hint included in the notification.
   */
  static async #browseVfx() {
    if (!game.modules.get('sequencer')?.active) {
      ui.notifications?.warn('Sequencer module is not enabled. Enable it in Game Settings → Manage Modules.');
      return;
    }
    const viewer = globalThis.Sequencer?.DatabaseViewer ?? globalThis.SequencerDatabaseViewer;
    if (!viewer?.show) {
      ui.notifications?.error("Couldn't find Sequencer's Database Viewer API. Sequencer may be a different version than expected.");
      return;
    }
    viewer.show();
    ui.notifications?.info('Find the effect you want, click its copy icon in Sequencer, then paste into VFX key here.');
  }

  /**
   * Play the current VFX key on the canvas as a sanity-check preview. Uses
   * the currently-controlled token as the location if one exists, otherwise
   * falls back to the centre of the visible canvas. Plays the configured
   * soundUrl alongside (Sequencer's .sound() handles audio).
   */
  static async #previewVfx() {
    const vfxKey   = (this.document.system.vfxKey   || '').trim();
    const soundUrl = (this.document.system.soundUrl || '').trim();
    if (!vfxKey && !soundUrl) {
      ui.notifications?.warn('Enter a VFX key or sound URL first, then click Preview.');
      return;
    }
    if (!game.modules.get('sequencer')?.active) {
      ui.notifications?.warn('Sequencer module is not enabled.');
      return;
    }
    const Sequence = globalThis.Sequence ?? globalThis.Sequencer?.Sequence;
    if (!Sequence) {
      ui.notifications?.error("Sequencer's Sequence API isn't available.");
      return;
    }

    // Pick a location to play at: controlled token > canvas center.
    const token = canvas.tokens?.controlled?.[0];
    const seq   = new Sequence();
    if (vfxKey) {
      const effect = seq.effect().file(vfxKey);
      if (token) effect.atLocation(token);
      else       effect.atLocation({ x: canvas.dimensions.width / 2, y: canvas.dimensions.height / 2 });
    }
    if (soundUrl) {
      seq.sound().file(soundUrl);
    }
    try {
      await seq.play();
    } catch (err) {
      console.warn('[GS] VFX preview failed:', err);
      ui.notifications?.error(`Couldn't play that VFX key. Check that "${vfxKey}" exists in JB2A.`);
    }
  }

  /**
   * Play just the audio file in `system.soundUrl` locally — no canvas VFX,
   * no chat card, no Sequencer dependency, no whispers. This is purely a
   * "does this sound right" preview for the user editing the sheet, played
   * via Foundry's built-in AudioHelper. Sound plays only on the local
   * client so the GM can audition without bothering other players.
   */
  static async #previewSound() {
    const src = (this.document.system.soundUrl || '').trim();
    if (!src) {
      ui.notifications?.warn('Set a Sound URL first, then click ▶ to preview.');
      return;
    }
    try {
      // v13 namespace: foundry.audio.AudioHelper.play
      const AH = foundry.audio?.AudioHelper ?? globalThis.AudioHelper;
      if (!AH?.play) {
        ui.notifications?.error('AudioHelper API unavailable in this Foundry build.');
        return;
      }
      // `false` for second arg = play locally only (don't broadcast to other
      // clients). Volume at 0.7 so it's clearly audible but not jarring.
      await AH.play({ src, volume: 0.7, autoplay: true, loop: false }, false);
      ui.notifications?.info(`Previewing: ${src.split('/').pop()}`);
    } catch (err) {
      console.warn('[GS] Sound preview failed:', err);
      ui.notifications?.error(`Couldn't play "${src}". Check the path exists.`);
    }
  }

  /**
   * Foundry FilePicker → write the picked audio path to `system.soundUrl`.
   * Mirrors #pickIcon for image picking.
   */
  static async #browseSound() {
    const FP = foundry.applications.apps.FilePicker?.implementation ?? globalThis.FilePicker;
    if (!FP) {
      ui.notifications?.error('FilePicker is unavailable in this Foundry build.');
      return;
    }
    const current = this.document.system?.soundUrl || `worlds/${game.world?.id ?? ''}/`;
    new FP({
      type: 'audio',
      current,
      callback: async (path) => {
        await this.document.update({ 'system.soundUrl': path });
      },
    }).render(true);
  }
}
