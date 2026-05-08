/**
 * @typedef {import('@league-of-foundry-developers/foundry-vtt-types').Actor} Actor
 */

import { switchPersona } from '../helpers/persona-swap.js';
import { openPersonaEditor } from '../apps/persona-editor.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class ConnectionSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'sheet', 'actor', 'connection'],
    position: { width: 600, height: 'auto' },
    window: { contentClasses: ['gs-connection-sheet'] },
    actions: {
      openMajor: ConnectionSheet.#openMajor,
      addImpression: ConnectionSheet.#addImpression,
      editImpression: ConnectionSheet.#editImpression,
      removeImpression: ConnectionSheet.#removeImpression,
      addPublicTag: ConnectionSheet.#addPublicTag,
      toggleResolvePip: ConnectionSheet.#toggleResolvePip,
      addPersona: ConnectionSheet.#addPersona,
      switchPersona: ConnectionSheet.#switchPersona,
    },
  };

  static PARTS = {
    header:      { template: 'systems/good-society-homebrew/templates/actors/connection/header.hbs' },
    description: { template: 'systems/good-society-homebrew/templates/actors/connection/description.hbs' },
    impressions: { template: 'systems/good-society-homebrew/templates/actors/connection/impressions.hbs' },
    scene:       { template: 'systems/good-society-homebrew/templates/actors/connection/scene.hbs' },
    state:       { template: 'systems/good-society-homebrew/templates/actors/connection/state.hbs' },
  };

  #resolveListenerAttached = false;

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const system = this.actor.system;

    // Portrait: active persona > bio.portraitUrl > actor.img
    const activePersona = system.activePersona;
    const portraitUrl = activePersona?.portraitUrl || system.bio?.portraitUrl || this.actor.img || '';
    const portraitInitial = (this.actor.name?.[0] ?? '?').toUpperCase();

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

    return {
      ...ctx,
      actor: this.actor,
      system,
      portraitUrl,
      portraitInitial,
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
    // Set theme scope on outer element so all CSS variables cascade to descendants.
    this.element.classList.add('gs-connection');
    this.element.dataset.theme = this.actor.system.theme ?? 'connection-green';

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
}
