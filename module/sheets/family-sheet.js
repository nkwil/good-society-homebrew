/**
 * @typedef {import('@league-of-foundry-developers/foundry-vtt-types').Actor} Actor
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/** Heir status values that represent a named heir (dot → positive/verdant). */
const HEIR_POSITIVE = new Set(['named-son', 'named-daughter', 'named-foster']);

export class FamilySheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'sheet', 'actor', 'family'],
    position: { width: 580, height: 'auto' },
    window: { contentClasses: ['gs-family-sheet'] },
    actions: {
      openMajor:       FamilySheet.#openMajor,
      linkMajor:       FamilySheet.#linkMajor,
      toggleVisibility: FamilySheet.#toggleVisibility,
    },
  };

  static PARTS = {
    header:     { template: 'systems/good-society-homebrew/templates/actors/family/header.hbs' },
    crest:      { template: 'systems/good-society-homebrew/templates/actors/family/crest.hbs' },
    origin:     { template: 'systems/good-society-homebrew/templates/actors/family/origin.hbs' },
    reputation: { template: 'systems/good-society-homebrew/templates/actors/family/reputation.hbs' },
    notes:      { template: 'systems/good-society-homebrew/templates/actors/family/notes.hbs' },
    members:    { template: 'systems/good-society-homebrew/templates/actors/family/members.hbs' },
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const system = this.actor.system;

    const familyName = system.familyName || this.actor.name || '';
    const familyInitial = (familyName[0] ?? 'F').toUpperCase();

    const memberActors = (system.memberMajorIds ?? [])
      .map(id => game.actors?.get(id))
      .filter(Boolean);

    const memberCount = memberActors.length;
    const heirStatusPositive = HEIR_POSITIVE.has(system.heirStatus);

    return {
      ...ctx,
      actor: this.actor,
      system,
      familyInitial,
      memberCount,
      heirStatusPositive,
      memberActors: memberActors.map(a => ({
        id: a.id,
        name: a.name,
        theme: a.system?.theme ?? 'npc',
        initial: (a.name?.[0] ?? '?').toUpperCase(),
        portraitUrl: a.system?.bio?.portraitUrl || a.img || '',
        peerage: a.system?.bio?.peerage ?? '',
      })),
    };
  }

  // House-styled — no _onRender theme override needed.

  static async #openMajor(event, target) {
    const actor = game.actors?.get(target.dataset.actorId);
    actor?.sheet?.render(true);
  }

  static async #linkMajor() {
    const alreadyLinked = new Set(this.actor.system.memberMajorIds ?? []);
    const majors = (game.actors?.filter(a => a.type === 'major-character') ?? [])
      .filter(a => !alreadyLinked.has(a.id));

    if (!majors.length) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.family.noMajorsToLink'));
      return;
    }

    const options = majors
      .map(a => `<option value="${a.id}">${foundry.utils.escapeHTML(a.name)}</option>`)
      .join('');
    const majorId = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('GOODSOCIETY.family.linkMajorTitle') },
      content: `<label style="display:block;margin-bottom:6px">${game.i18n.localize('GOODSOCIETY.family.linkMajorSelect')}<select name="majorId" style="width:100%;margin-top:4px">${options}</select></label>`,
      ok: {
        label: game.i18n.localize('GOODSOCIETY.family.linkMajorConfirm'),
        callback: (_ev, button) => button.form.elements.majorId.value,
      },
    });
    if (!majorId) return;

    const major = game.actors?.get(majorId);
    if (!major) return;

    // Two-way link: add to family memberMajorIds + set familyId on the Major.
    await this.actor.update({
      'system.memberMajorIds': [...(this.actor.system.memberMajorIds ?? []), majorId],
    });
    await major.update({ 'system.familyId': this.actor.id });
  }

  static async #toggleVisibility(event, target) {
    const field = target.dataset.field;
    const cycle = { secret: 'public', public: 'redacted', redacted: 'secret' };
    const current = this.actor.system.visibility[field] ?? 'secret';
    await this.actor.update({ [`system.visibility.${field}`]: cycle[current] });
  }
}
