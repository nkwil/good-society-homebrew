/**
 * @typedef {import('@league-of-foundry-developers/foundry-vtt-types').Actor} Actor
 */

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
    // Full promotion pipeline (type change + theme picker + field init) in Session B-5.
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('GOODSOCIETY.npc.promoteTitle') },
      content: `<p>${game.i18n.format('GOODSOCIETY.npc.promoteConfirm', { name: this.actor.name })}</p>`,
    });
    if (!confirmed) return;
    ui.notifications?.info('Full promotion pipeline coming in Session B-5.');
  }

  static async #grantToPlayer() {
    // Opens Foundry's built-in actor ownership dialog.
    new DocumentOwnershipConfig(this.actor, {}).render(true);
  }

  static async #addPublicTag() {
    ui.notifications?.info('Public tag editor coming in a future session.');
  }

  static async #addPersona() {
    ui.notifications?.info('Persona editor coming in Session B-5.');
  }

  static async #switchPersona(event, target) {
    await this.actor.update({ 'system.activePersonaId': target.dataset.personaId });
  }
}
