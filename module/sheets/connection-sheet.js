/**
 * @typedef {import('@league-of-foundry-developers/foundry-vtt-types').Actor} Actor
 */

import { switchPersona } from '../helpers/persona-swap.js';
import { openPersonaEditor } from '../apps/persona-editor.js';
import { openPersonaSwitcherPopover } from '../apps/persona-switcher-popover.js';
import { profilePic, profileName } from '../helpers/profile-pic.js';
import { CONNECTION_FULL_THEME_REGISTRY } from '../constants.js';
import { fitDossierNames } from '../helpers/responsive-name.js';
import { bindAutogrowTextareas } from '../helpers/textarea-autogrow.js';
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
      // editLinkedMajor removed 2026-05-20 — see comment on the deleted
      // handler body further down. Connection ↔ Major linking lives on the
      // Major dossier now; the Connection sheet is read-only for that
      // relationship.
      addImpression: ConnectionSheet.#addImpression,
      editImpression: ConnectionSheet.#editImpression,
      removeImpression: ConnectionSheet.#removeImpression,
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

    // Portrait + display name follow the post-MVP §8.5 rules: explicit
    // persona selection only, never the data-model getter's primary/first
    // fallback. profileName/profilePic encapsulate that contract.
    const portraitUrl = profilePic(this.actor);
    const displayName = profileName(this.actor);
    const portraitInitial = (displayName?.[0] ?? '?').toUpperCase();

    // Linked Majors — source of truth is now `Major.system.connections`
    // (an array of Connection ids on each Major's dossier). Connections
    // surface every Major that currently lists them, so one Connection
    // can serve multiple Majors (Clayton's tutor who's also Roger's
    // dance partner). The Major's dossier is the single place to add /
    // remove the link; the Connection sheet just reflects it read-only.
    //
    // Legacy `system.linkedMajorId` (single id, written from the
    // Connection's own pencil-edit dialog) is preserved in the data
    // model for back-compat and as a tiebreaker when the dock sorts
    // Connections, but the chip list below uses the scan-based source
    // exclusively. If a Connection's legacy linkedMajorId points at a
    // Major that DOESN'T list it back, that link is ignored here —
    // forces the GM to make the link bidirectional via the Major's
    // dossier going forward.
    const linkedMajors = (game.actors?.contents ?? [])
      .filter(a => a.type === 'major-character'
        && Array.isArray(a.system?.connections)
        && a.system.connections.includes(this.actor.id))
      .map(major => ({
        id:          major.id,
        name:        major.name,
        theme:       major.system?.theme ?? 'clayton',
        initial:     (major.name?.[0] ?? '?').toUpperCase(),
        portraitUrl: profilePic(major),
      }));

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
        // profilePic() respects the active persona's tokenImageUrl and
        // falls back to prototypeToken.texture.src — the modern resolution
        // chain. Reading `system.bio.portraitUrl || actor.img` directly
        // (the old pattern here) misses persona overrides AND the
        // prototypeToken portrait that modern actors actually populate.
        majorPortraitUrl: majorActor ? profilePic(majorActor) : '',
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
    // `hasActivePersona` is true ONLY when an explicit persona is selected
    // (activePersonaId resolves to a real persona) — not the data-model
    // getter's primary/first fallback. Gates the cameo name input's
    // readonly state, same as the Major sheet.
    const explicitPersona = system.activePersonaId
      ? (system.personas ?? []).find(p => p.id === system.activePersonaId)
      : null;
    const hasActivePersona = !!explicitPersona;
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
      // Linked Majors — list of `{id, name, theme, initial, portraitUrl}`,
      // one per Major that lists this Connection in its `system.connections`.
      // Templates iterate this with `{{#each linkedMajors}}` and render
      // one themed chip per Major. Empty when no Major has linked.
      linkedMajors,
      hasLinkedMajors: linkedMajors.length > 0,
      resolvePips,
      resolveMax,
      resolveCurrent,
      impressions,
      personas: system.personas ?? [],
      activePersonaId: system.activePersonaId ?? '',
      hoverSummary: system.sceneInfo?.hoverSummary ?? '',
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // Auto-grow wrapping textareas (bio-line role, etc.) — belt-and-
    // suspenders alongside CSS `field-sizing: content` for older Chromium.
    bindAutogrowTextareas(this.element);

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

    // Cameo name input is a plain `name="name"` text field — Foundry's
    // form serializer handles persistence directly. (Previously this was
    // a sliced visible input + hidden mirror that the JS handler stitched
    // back together; the freeze-the-first-letter bug from that pattern is
    // documented in connection/book.hbs.)

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
   * `#editLinkedMajor` removed 2026-05-20 — Connection ↔ Major linking is
   * now managed exclusively from the Major's dossier (`Major.system.
   * connections`), so a Connection can be referenced by multiple Majors at
   * once. The pencil-edit button + DialogV2 picker that lived here used to
   * write `system.linkedMajorId`, but that single-link field is now legacy
   * (back-compat read only). To link a Connection to a Major, drag the
   * Connection actor onto the Major dossier's connections section; to
   * unlink, use the Major dossier's remove control.
   */

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
