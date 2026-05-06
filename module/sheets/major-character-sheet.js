/**
 * @typedef {import('@league-of-foundry-developers/foundry-vtt-types').Actor} Actor
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const PEERAGE_LABELS = {
  'heir': 'The Heir',
  'new-arrival': 'New Arrival',
  'foreign': 'Foreign',
};

const PHASE_LABELS = {
  'pre-cycle': 'Pre-Cycle',
  'novel': 'Novel Chapter',
  'reputation': 'Reputation Phase',
  'rumour-scandal': 'Rumour & Scandal',
  'epistolary': 'Epistolary Phase',
  'upkeep': 'Upkeep',
};

export class MajorCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'sheet', 'actor', 'major-character'],
    position: { width: 720, height: 'auto' },
    window: { contentClasses: ['gs-major-sheet'] },
    actions: {
      toggleResolvePip: MajorCharacterSheet.#toggleResolvePip,
      toggleMt: MajorCharacterSheet.#toggleMt,
      takeMonologue: MajorCharacterSheet.#takeMonologue,
      toggleBox: MajorCharacterSheet.#toggleBox,
      openItem: MajorCharacterSheet.#openItem,
      beginConflict: MajorCharacterSheet.#beginConflict,
      toggleVisibility: MajorCharacterSheet.#toggleVisibility,
      openActor: MajorCharacterSheet.#openActor,
      addConnection: MajorCharacterSheet.#addConnection,
      createItem: MajorCharacterSheet.#createItem,
      castSkill: MajorCharacterSheet.#castSkill,
    },
  };

  // No separate 'tabs' PART — nav lives inside header.hbs for layout integrity.
  static PARTS = {
    header: { template: 'systems/good-society-homebrew/templates/actors/major-character/header.hbs' },
    public: { template: 'systems/good-society-homebrew/templates/actors/major-character/tab-public.hbs' },
    private: { template: 'systems/good-society-homebrew/templates/actors/major-character/tab-private.hbs' },
    strip: { template: 'systems/good-society-homebrew/templates/actors/major-character/strip-tokens.hbs' },
  };

  tabGroups = { sheet: 'public' };

  // Used to attach the resolve pip contextmenu listener only once per window.
  #resolveListenerAttached = false;

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const system = this.actor.system;
    const items = this.actor.items;

    // ── Portrait + identity ──────────────────────────────────────────────────
    const activePersona = system.activePersona;
    const portraitUrl = activePersona?.portraitUrl || system.bio?.portraitUrl || this.actor.img || '';
    const portraitInitial = (this.actor.name?.[0] ?? '?').toUpperCase();

    const familyActor = system.familyId ? game.actors?.get(system.familyId) : null;
    const peerageLabel = PEERAGE_LABELS[system.bio?.peerage] ?? '';
    const familyName = familyActor?.name ?? '';
    const roleTitle = [peerageLabel, familyName ? `· ${familyName}` : ''].filter(Boolean).join(' ');

    // ── Strip — resolve pips ─────────────────────────────────────────────────
    const resolveMax = system.tokens?.resolve?.max ?? 5;
    const resolveCurrent = system.tokens?.resolve?.current ?? 3;
    const resolvePips = Array.from({ length: resolveMax }, (_, i) => ({
      index: i,
      filled: i < resolveCurrent,
      label: `${i + 1} of ${resolveMax} resolve`,
    }));

    let cycleNumber = 1;
    let cyclePhase = 'Pre-Cycle';
    try {
      const rawNumber = game.settings.get('good-society-homebrew', 'cycleNumber');
      const rawPhase = game.settings.get('good-society-homebrew', 'cyclePhase');
      cycleNumber = rawNumber ?? 1;
      cyclePhase = PHASE_LABELS[rawPhase] ?? rawPhase ?? 'Pre-Cycle';
    } catch {
      // Settings not yet registered on first load — use defaults.
    }

    // ── Public tab — Reputation Criteria ─────────────────────────────────────
    const criteriaVisibility = familyActor?.system?.visibility?.uniqueNegativeRepCriteria ?? 'public';

    // ── Public tab — Reputation Tags ─────────────────────────────────────────
    const positiveTags = (system.reputation?.positiveTags ?? [])
      .map(id => items.get(id)).filter(i => i?.type === 'reputation-tag');
    const negativeTags = (system.reputation?.negativeTags ?? [])
      .map(id => items.get(id)).filter(i => i?.type === 'reputation-tag');

    // 3-pip meter: filled up to min(count, 3); beyond 3 = full/condition fired
    const buildMeterPips = count => Array.from({ length: 3 }, (_, i) => ({ filled: i < count }));

    // ── Public tab — Active Conditions ───────────────────────────────────────
    const activeConditions = (system.reputation?.activeConditions ?? [])
      .map(id => items.get(id))
      .filter(i => i?.type === 'reputation-condition' && i.system?.active);

    // ── Public tab — Inner Conflicts (active) ────────────────────────────────
    const activeConflicts = (system.innerConflictsActiveIds ?? [])
      .map(id => items.get(id))
      .filter(i => i?.type === 'inner-conflict')
      .map(item => {
        const s = item.system;
        const leftCount = (s.leftBoxes ?? []).filter(Boolean).length;
        const rightCount = (s.rightBoxes ?? []).filter(Boolean).length;
        return {
          leftLabel: s.leftLabel || 'Left side',
          rightLabel: s.rightLabel || 'Right side',
          leftBoxes: s.leftBoxes ?? [false, false, false, false, false],
          rightBoxes: s.rightBoxes ?? [false, false, false, false, false],
          completed: s.completed ?? false,
          completedSide: s.completedSide ?? null,
          totalCount: leftCount + rightCount,
          leftCount,
          rightCount,
          itemId: item.id,
          labelEditable: false,
          showPerSideCount: true,
        };
      });

    // ── Public tab — Completed Conflicts ─────────────────────────────────────
    const completedConflicts = (system.innerConflictsCompletedIds ?? [])
      .map(id => items.get(id))
      .filter(i => i?.type === 'inner-conflict');

    // ── Private tab ───────────────────────────────────────────────────────────
    const connectionActors = (system.connections ?? [])
      .map(id => game.actors?.get(id))
      .filter(Boolean);

    const magicSkills = items.filter(i => i.type === 'magic-skill');

    return {
      ...ctx,
      actor: this.actor,
      system,
      tabGroups: this.tabGroups,
      // Identity
      portraitUrl,
      portraitInitial,
      roleTitle,
      peerageLabel,
      personas: system.personas ?? [],
      activePersonaId: system.activePersonaId ?? '',
      // Strip
      resolvePips,
      cycleNumber,
      cyclePhase,
      // Public tab
      familyActor,
      familyName,
      criteriaVisibility,
      reputationCriteria: familyActor?.system?.uniqueNegativeRepCriteria ?? '',
      positiveTags,
      negativeTags,
      positiveMeterPips: buildMeterPips(positiveTags.length),
      negativeMeterPips: buildMeterPips(negativeTags.length),
      activeConditions,
      activeConflicts,
      completedConflicts,
      // Private tab
      visibility: system.visibility ?? {},
      connectionActors,
      magicSkills,
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // Set theme scope on the outer window so CSS variables cascade to all children.
    this.element.classList.add('gs-actor');
    this.element.dataset.theme = this.actor.system.theme ?? 'clayton';

    // Right-click on any resolve pip resets to the world's starting-resolve setting.
    // Attached once per window via event delegation on the stable outer element.
    if (!this.#resolveListenerAttached) {
      this.#resolveListenerAttached = true;
      this.element.addEventListener('contextmenu', async (ev) => {
        if (!ev.target.matches('.gs-resolve-pip')) return;
        ev.preventDefault();
        const def = (() => {
          try { return game.settings.get('good-society-homebrew', 'defaultStartingResolve') ?? 3; }
          catch { return 3; }
        })();
        await this.actor.update({ 'system.tokens.resolve.current': def });
      });
    }
  }

  // ── Action handlers ────────────────────────────────────────────────────────

  // Toggle a single resolve pip. Click the highest-filled pip to lower by one;
  // click an empty pip to raise to that pip's position.
  static async #toggleResolvePip(event, target) {
    const pipIndex = Number(target.dataset.pip);
    const current = this.actor.system.tokens.resolve.current;
    const newValue = current === pipIndex + 1 ? pipIndex : pipIndex + 1;
    await this.actor.update({ 'system.tokens.resolve.current': newValue });
  }

  static async #toggleMt(event, target) {
    await this.actor.update({ 'system.tokens.major': !this.actor.system.tokens.major });
  }

  // Placeholder — Inner Monologue editor (inventory #28) is a future session.
  static async #takeMonologue(event, target) {
    ui.notifications?.info('Inner Monologue editor coming in a future session.');
  }

  // Stub — full toggle logic ships with B-1 automation (item update on embedded InnerConflict).
  static async #toggleBox(event, target) {
    console.log('toggleBox stub | item:', target.dataset.itemId,
      'side:', target.dataset.side, 'index:', target.dataset.index);
  }

  static async #openItem(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    item?.sheet?.render(true);
  }

  static async #beginConflict(event, target) {
    const item = await this.actor.createEmbeddedDocuments('Item', [{
      type: 'inner-conflict',
      name: 'New Inner Conflict',
    }]);
    item[0]?.sheet?.render(true);
  }

  // Stub — Reveal Control popover (inventory #20) ships in B-4. Logs for now.
  static async #toggleVisibility(event, target) {
    const field = target.dataset.field;
    const current = this.actor.system.visibility?.[field] ?? 'secret';
    const cycle = { secret: 'public', public: 'redacted', redacted: 'secret' };
    console.log(`toggleVisibility stub | field: ${field}, ${current} → ${cycle[current]}`);
    await this.actor.update({ [`system.visibility.${field}`]: cycle[current] });
  }

  static async #openActor(event, target) {
    const actor = game.actors?.get(target.dataset.actorId);
    actor?.sheet?.render(true);
  }

  // Stub — link picker (drag-onto-section) is the primary UX; this is a fallback.
  static async #addConnection(event, target) {
    ui.notifications?.info('Drag a Connection actor onto this section to link it.');
  }

  static async #createItem(event, target) {
    const type = target.dataset.itemType;
    const item = await this.actor.createEmbeddedDocuments('Item', [{ type, name: `New ${type}` }]);
    item[0]?.sheet?.render(true);
  }

  // Stub — cast pipeline (visibility-aware confirm + Sequencer) ships with item sheets.
  static async #castSkill(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    ui.notifications?.info(`Cast pipeline for "${item?.name ?? 'skill'}" coming in a future session.`);
  }
}
