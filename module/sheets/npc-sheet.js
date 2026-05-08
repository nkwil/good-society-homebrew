/**
 * @typedef {import('@league-of-foundry-developers/foundry-vtt-types').Actor} Actor
 */

import { switchPersona } from '../helpers/persona-swap.js';
import { openPersonaEditor } from '../apps/persona-editor.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class NpcSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'sheet', 'actor', 'npc'],
    position: { width: 540, height: 'auto' },
    window: { contentClasses: ['gs-npc-sheet'] },
    actions: {
      promoteToConnection: NpcSheet.#promoteToConnection,
      grantToPlayer:       NpcSheet.#grantToPlayer,
      addPublicTag:        NpcSheet.#addPublicTag,
      addPersona:          NpcSheet.#addPersona,
      switchPersona:       NpcSheet.#switchPersona,
    },
  };

  static PARTS = {
    header:      { template: 'systems/good-society-homebrew/templates/actors/npc/header.hbs' },
    description: { template: 'systems/good-society-homebrew/templates/actors/npc/description.hbs' },
    scene:       { template: 'systems/good-society-homebrew/templates/actors/npc/scene.hbs' },
    personas:    { template: 'systems/good-society-homebrew/templates/actors/npc/personas.hbs' },
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const system = this.actor.system;

    const activePersona = system.activePersona;
    const portraitUrl = activePersona?.portraitUrl || system.bio?.portraitUrl || this.actor.img || '';
    const portraitInitial = (this.actor.name?.[0] ?? '?').toUpperCase();

    return {
      ...ctx,
      actor: this.actor,
      system,
      portraitUrl,
      portraitInitial,
      publicTags: system.sceneInfo?.publicTags ?? [],
      hoverSummary: system.sceneInfo?.hoverSummary ?? '',
      personas: system.personas ?? [],
      activePersonaId: system.activePersonaId ?? '',
    };
  }

  // House-styled — no _onRender theme override needed.

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
}
