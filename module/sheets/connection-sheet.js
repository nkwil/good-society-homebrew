/**
 * @typedef {import('@league-of-foundry-developers/foundry-vtt-types').Actor} Actor
 */

import { switchPersona } from '../helpers/persona-swap.js';
import { openPersonaEditor } from '../apps/persona-editor.js';
import { openPersonaSwitcherPopover } from '../apps/persona-switcher-popover.js';
import { profilePic } from '../helpers/profile-pic.js';
import { CONNECTION_FULL_THEME_REGISTRY } from '../constants.js';
import { fitDossierNames } from '../helpers/responsive-name.js';
import { pronounsFor } from '../helpers/pronouns.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class ConnectionSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'sheet', 'actor', 'connection'],
    // Single-page dossier — one paper card on the dark desk, 220×220 cameo
    // top-left. Width sized to comfortably hold the impression cards two
    // columns wide if needed but defaults to one. Height auto.
    position: { width: 760, height: 'auto' },
    window: { contentClasses: ['gs-connection-sheet'] },
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
      openMajor: ConnectionSheet.#openMajor,
      // Opens a DialogV2 picker to assign / change / clear the linkedMajorId.
      // The pencil button next to the linked-major pill triggers this.
      editLinkedMajor: ConnectionSheet.#editLinkedMajor,
      addImpression: ConnectionSheet.#addImpression,
      editImpression: ConnectionSheet.#editImpression,
      removeImpression: ConnectionSheet.#removeImpression,
      addPublicTag: ConnectionSheet.#addPublicTag,
      toggleResolvePip: ConnectionSheet.#toggleResolvePip,
      pickToken: ConnectionSheet.#pickToken,
      addPersona: ConnectionSheet.#addPersona,
      switchPersona: ConnectionSheet.#switchPersona,
      // Same edit-button-next-to-eyebrow pattern as the Major dossier — the
      // description is rendered read-only with enriched HTML, and a ✎ edit
      // button opens a DialogV2 textarea for editing.
      editDescription: ConnectionSheet.#editDescription,
      // Persona switcher popover — same UX as the Major dossier. Click the
      // pill in the cameo controls to open a popover listing personas with
      // an "+ add" button. The popover plumbing lives in
      // module/apps/persona-switcher-popover.js (delegated listener).
      openPersonaSwitcher: ConnectionSheet.#openPersonaSwitcher,
      // Theme picker — opens a DialogV2 with all 12 themes (5 connection
      // variants + 7 Major themes including secret). Only shown when no
      // persona is active; persona themes are edited via the persona editor.
      editTrueIdentityTheme: ConnectionSheet.#editTrueIdentityTheme,
    },
  };

  static PARTS = {
    book: { template: 'systems/good-society-homebrew/templates/actors/connection/book.hbs' },
  };

  #resolveListenerAttached = false;

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const system = this.actor.system;

    // Portrait: active persona > bio.portraitUrl > actor.img
    const activePersona = system.activePersona;
    const portraitUrl = profilePic(this.actor);  // §8.5 token-based
    // Initial follows the displayed name (active persona name preferred over
    // actor.name) so it stays consistent when a persona is in play.
    const displayName = activePersona?.name || this.actor.name;
    const portraitInitial = (displayName?.[0] ?? '?').toUpperCase();

    // Linked Major
    const linkedMajor = system.linkedMajorId ? game.actors?.get(system.linkedMajorId) : null;

    // Resolve pips
    const resolveMax = system.resolve?.max ?? 5;
    const resolveCurrent = system.resolve?.current ?? 1;
    const resolvePips = Array.from({ length: resolveMax }, (_, i) => ({
      index: i,
      filled: i < resolveCurrent,
      label: `${i + 1} of ${resolveMax} resolve`,
    }));

    // Impressions — each gets the resolved Major actor for cross-theme rendering
    const impressions = (system.impressions ?? []).map((imp, index) => {
      const majorActor = game.actors?.get(imp.majorId);
      return {
        index,
        majorId: imp.majorId,
        text: imp.text ?? '',
        majorActor,
        majorName: majorActor?.name ?? '(unknown)',
        majorTheme: majorActor?.system?.theme ?? 'clayton',
        majorPortraitUrl: majorActor?.system?.bio?.portraitUrl || majorActor?.img || '',
        majorInitial: (majorActor?.name?.[0] ?? '?').toUpperCase(),
      };
    });

    // Enrich the description for read-only rendering on the dossier card.
    // Editing happens in a DialogV2 textarea via the editDescription action,
    // which writes plain text with real \n line breaks. enrichHTML alone
    // would collapse those newlines, so we normalize plain text into <p>
    // blocks first (same approach we use for backstory pagination). When the
    // source already contains block tags, leave it alone.
    const TextEditor =
      foundry.applications.ux?.TextEditor?.implementation
      ?? globalThis.TextEditor;
    let descriptionSource = system.bio?.description ?? '';
    if (descriptionSource && !/<(p|div|h\d|ul|ol|hr|br|blockquote)\b/i.test(descriptionSource)) {
      descriptionSource = descriptionSource
        .split(/\n\s*\n/)                                  // double newline → paragraph
        .map(para => para.trim())
        .filter(para => para.length > 0)
        .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`) // single newline → <br>
        .join('');
    }
    const enrichedDescription = descriptionSource
      ? await TextEditor.enrichHTML(descriptionSource, { async: true, secrets: this.actor.isOwner })
      : '';

    // Display name follows persona override (matches Major dossier behavior).
    const hasActivePersona = !!activePersona;
    // Distinguishes "no explicit selection" (true identity, show fallback)
    // from "persona chosen". The persona-switcher partial uses this to pick
    // its label between the persona's name and "true identity".
    const activePersonaExplicit = !!system.activePersonaId;

    return {
      ...ctx,
      actor: this.actor,
      system,
      portraitUrl,
      portraitInitial,
      displayName,
      hasActivePersona,
      activePersonaExplicit,
      // Parsed pronoun set (full subject/object/possessive/etc. + capitalized
      // variants). Templates can use {{pronouns.Possessive}} for dynamic
      // gendered copy. Always populated; falls back to they/them when empty.
      pronouns: pronounsFor(this.actor),
      enrichedDescription,
      linkedMajor,
      linkedMajorTheme: linkedMajor?.system?.theme ?? 'clayton',
      linkedMajorInitial: (linkedMajor?.name?.[0] ?? '?').toUpperCase(),
      resolvePips,
      resolveMax,
      resolveCurrent,
      impressions,
      personas: system.personas ?? [],
      activePersonaId: system.activePersonaId ?? '',
      publicTags: system.sceneInfo?.publicTags ?? [],
      hoverSummary: system.sceneInfo?.hoverSummary ?? '',
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    // Set theme scope on outer element so all CSS variables cascade to
    // descendants. We add BOTH `gs-connection` AND `gs-actor` so the
    // theme cascade works whether the user picks a connection-* variant
    // (matched by `.gs-connection[data-theme="connection-blue"]`) or a
    // Major theme like rose / dixon / secret (matched by
    // `.gs-actor[data-theme="rose"]`). Without `gs-actor` the Major
    // themes silently no-op when applied to a Connection.
    this.element.classList.add('gs-connection');
    this.element.classList.add('gs-actor');
    this.element.dataset.theme = this.actor.system.theme ?? 'connection-green';

    // Responsive cameo name sizing. Reuse a per-instance AbortController so
    // re-renders never leak input listeners. (Pattern matches Major sheet.)
    if (this._nameFitAbort) this._nameFitAbort.abort();
    this._nameFitAbort = new AbortController();
    fitDossierNames(this.element, { signal: this._nameFitAbort.signal });

    // Cameo name input sync — the visible "slice" input (everything after
    // the ornament initial) and the hidden full-name input must stay in
    // sync, otherwise form-submit serializes the stale full value and
    // typing has no effect on actor.name. Same pattern as the Major sheet.
    const sliceInput = this.element.querySelector('.dossier-cameo__name-input');
    const hiddenFull = this.element.querySelector('input[data-name-full]');
    if (sliceInput && hiddenFull) {
      sliceInput.addEventListener('input', () => {
        const initial = sliceInput.dataset.nameInitial ?? '';
        hiddenFull.value = initial + sliceInput.value;
      }, { signal: this._nameFitAbort.signal });
    }

    if (!this.#resolveListenerAttached) {
      this.#resolveListenerAttached = true;
      this.element.addEventListener('contextmenu', async (ev) => {
        if (!ev.target.matches('.gs-resolve-pip')) return;
        ev.preventDefault();
        // Connection default starting resolve is 1.
        await this.actor.update({ 'system.resolve.current': 1 });
      });
    }
  }

  // ── Action handlers ────────────────────────────────────────────────────────

  static async #openMajor(event, target) {
    const actor = game.actors?.get(target.dataset.actorId);
    actor?.sheet?.render(true);
  }

  static async #toggleResolvePip(event, target) {
    const pipIndex = Number(target.dataset.pip);
    const current = this.actor.system.resolve.current;
    const newValue = current === pipIndex + 1 ? pipIndex : pipIndex + 1;
    await this.actor.update({ 'system.resolve.current': newValue });
  }

  static async #removeImpression(event, target) {
    const impressions = foundry.utils.deepClone(this.actor.system.impressions ?? []);
    impressions.splice(Number(target.dataset.index), 1);
    await this.actor.update({ 'system.impressions': impressions });
  }

  static async #switchPersona(event, target) {
    await switchPersona(this.actor, target.dataset.personaId ?? '');
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

  /**
   * Linked Major picker — opens a DialogV2 with a select of all Majors plus
   * a "(no Major)" option for clearing the link. The pencil button next to
   * the linked-major pill on the dossier opens this. Same pattern as the
   * existing #addImpression but writes to system.linkedMajorId instead of
   * appending to system.impressions.
   */
  static async #editLinkedMajor() {
    const majors  = game.actors?.filter(a => a.type === 'major-character') ?? [];
    const current = this.actor.system.linkedMajorId ?? '';
    const noneLabel = game.i18n.localize('GOODSOCIETY.connection.noMajor');

    // Build options: "(no Major)" first, then alpha-sorted Majors. The
    // currently-linked Major is preselected.
    const options = [
      `<option value=""${current ? '' : ' selected'}>— ${foundry.utils.escapeHTML(noneLabel)} —</option>`,
      ...majors
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .map(a => {
          const sel = a.id === current ? ' selected' : '';
          return `<option value="${a.id}"${sel}>${foundry.utils.escapeHTML(a.name)}</option>`;
        }),
    ].join('');

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('GOODSOCIETY.connection.editLinkedMajorTitle') },
      content: `<label style="display:block;margin-bottom:6px">${game.i18n.localize('GOODSOCIETY.connection.editLinkedMajorPrompt')}<select name="majorId" style="width:100%;margin-top:4px">${options}</select></label>`,
      ok: {
        label: game.i18n.localize('GOODSOCIETY.connection.editLinkedMajorConfirm'),
        callback: (_ev, button) => button.form.elements.majorId.value,
      },
      rejectClose: false,
    });
    // result === undefined when user closes via X; '' is a deliberate "clear".
    if (result === undefined || result === null) return;
    await this.actor.update({ 'system.linkedMajorId': result });
  }

  static async #addImpression() {
    const majors = game.actors?.filter(a => a.type === 'major-character') ?? [];
    if (!majors.length) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.connection.noMajorsForImpression'));
      return;
    }
    const options = majors
      .map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`)
      .join('');
    const majorId = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('GOODSOCIETY.connection.addImpressionTitle') },
      content: `<label style="display:block;margin-bottom:6px">${game.i18n.localize('GOODSOCIETY.connection.addImpressionMajor')}<select name="majorId" style="width:100%;margin-top:4px">${options}</select></label>`,
      ok: {
        label: game.i18n.localize('GOODSOCIETY.connection.addImpressionConfirm'),
        callback: (_ev, button) => button.form.elements.majorId.value,
      },
    });
    if (!majorId) return;
    const impressions = foundry.utils.deepClone(this.actor.system.impressions ?? []);
    impressions.push({ majorId, text: '' });
    await this.actor.update({ 'system.impressions': impressions });
  }

  static async #editImpression(event, target) {
    const index = Number(target.dataset.index);
    const impressions = foundry.utils.deepClone(this.actor.system.impressions ?? []);
    const imp = impressions[index];
    if (!imp) return;

    const escaped = foundry.utils.escapeHTML(imp.text ?? '');
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('GOODSOCIETY.connection.editImpressionTitle') },
      content: `<label style="display:block;margin-bottom:6px">${game.i18n.localize('GOODSOCIETY.connection.editImpressionText')}<textarea name="text" rows="5" style="width:100%;margin-top:4px">${escaped}</textarea></label>`,
      ok: {
        label: game.i18n.localize('GOODSOCIETY.connection.editImpressionConfirm'),
        callback: (_ev, button) => button.form.elements.text.value,
      },
    });
    if (result === null || result === undefined) return;
    impressions[index] = { ...imp, text: result };
    await this.actor.update({ 'system.impressions': impressions });
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

  /** Open the persona-switcher popover anchored to the pill button.
   *  Same plumbing as the Major dossier — persona-switcher-popover.js owns
   *  the popover lifecycle; we just route the click through. The third arg
   *  is the "+ add persona" callback that fires when the user picks "add"
   *  from inside the popover. */
  static #openPersonaSwitcher(event, target) {
    openPersonaSwitcherPopover(
      this.actor,
      target,
      () => openPersonaEditor(this.actor),
    );
  }

  /** Open a DialogV2 with the full theme registry (12 entries — 5 connection
   *  variants + 7 Major themes including secret) and write the chosen value
   *  to system.theme. Same UX as the Major sheet's editTrueIdentityTheme. */
  static async #editTrueIdentityTheme() {
    const current = this.actor.system?.theme || 'connection-green';
    const options = CONNECTION_FULL_THEME_REGISTRY.map((t) => ({
      id: t.id,
      label: game.i18n.localize(t.label) || t.id,
    }));
    const optionsHtml = options
      .map(o => `<option value="${o.id}"${o.id === current ? ' selected' : ''}>${foundry.utils.escapeHTML(o.label)}</option>`)
      .join('');

    const DialogV2 = foundry.applications.api.DialogV2;
    const newTheme = await DialogV2.prompt({
      window: { title: 'Edit theme' },
      position: { width: 360 },
      content: `
        <p style="margin: 0 0 10px 0; font-size: 12px; opacity: 0.75;">
          <em>Sets the visual theme used when no persona is active.</em>
        </p>
        <select name="theme"
                style="width: 100%; padding: 6px 10px; font-family: var(--gs-body, serif); font-size: 14px;">
          ${optionsHtml}
        </select>
      `,
      ok: {
        label: 'Save',
        callback: (event, button) => button.form.elements.theme.value,
      },
      rejectClose: false,
    });
    if (!newTheme || newTheme === current) return;
    await this.actor.update({ 'system.theme': newTheme });
  }

  /** Edit the description in a DialogV2 textarea — same pattern as the Major
   *  dossier's editField. The card on the sheet renders enriched HTML
   *  read-only; this opens an editing modal. */
  static async #editDescription() {
    const current = this.actor.system.bio?.description ?? '';
    const escaped = foundry.utils.escapeHTML(current);
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('GOODSOCIETY.connection.editDescription') },
      position: { width: 560 },
      content: `<label style="display:block;margin-bottom:6px">${game.i18n.localize('GOODSOCIETY.connection.description')}
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
}
