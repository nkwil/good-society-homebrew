/**
 * @typedef {import('@league-of-foundry-developers/foundry-vtt-types').Actor} Actor
 */

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
    await this.actor.update({ 'system.activePersonaId': target.dataset.personaId });
  }

  // Stubs — full picker / editor UI in B-5.
  static async #addImpression() {
    ui.notifications?.info('Impression picker coming in a future session.');
  }

  static async #editImpression(event, target) {
    console.log('editImpression stub | index:', target.dataset.index);
  }

  static async #addPublicTag() {
    ui.notifications?.info('Public tag editor coming in a future session.');
  }

  static async #addPersona() {
    ui.notifications?.info('Persona editor coming in Session B-5.');
  }
}
