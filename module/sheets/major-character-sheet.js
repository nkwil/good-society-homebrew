/**
 * @typedef {import('@league-of-foundry-developers/foundry-vtt-types').Actor} Actor
 */

import { MonologueEditor } from '../apps/monologue-editor.js';
import { openRevealControl } from '../apps/reveal-control.js';
import { openPersonaSwitcherPopover } from '../apps/persona-switcher-popover.js';
import { openActionsCheatSheet } from '../apps/actions-cheat-sheet.js';
import { openPersonaEditor } from '../apps/persona-editor.js';
import { switchPersona } from '../helpers/persona-swap.js';
import { isConflictComplete, checkThresholdAndPrompt } from '../helpers/reputation-rules.js';
import { postCompletionCard } from '../helpers/chat-cards.js';
import { castMagicSkill } from '../helpers/cast-magic.js';

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
    // ApplicationV2 sheets do NOT auto-submit form inputs by default.
    // Without `form.submitOnChange`, every native input/select on the sheet
    // (persona <select>, bio chips, name field, etc.) is visual-only — the
    // user's change never persists to actor.system. Standard ActorSheetV2
    // pattern is to opt in here.
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
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
      deleteItem: MajorCharacterSheet.#deleteItem,
      castSkill: MajorCharacterSheet.#castSkill,
      openPersonaSwitcher:      MajorCharacterSheet.#openPersonaSwitcher,
      openActionsCheatSheet:    MajorCharacterSheet.#openActionsCheatSheet,
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
    // Display name = active persona's name when one is active, else actor's
    // canonical name. The editable input below is still bound to actor.name
    // (so renaming via the input changes the actor's true name); the display
    // here is the at-a-glance identity that follows the active persona.
    const displayName = activePersona?.name || this.actor.name;
    const portraitUrl = activePersona?.portraitUrl || system.bio?.portraitUrl || this.actor.img || '';
    const portraitInitial = (displayName?.[0] ?? '?').toUpperCase();

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
      displayName,
      roleTitle,
      peerageLabel,
      personas: system.personas ?? [],
      activePersonaId: system.activePersonaId ?? '',
      // True when ANY persona is currently driving the displayed identity
      // (whether explicitly selected via activePersonaId or resolved by the
      // primary-persona fallback in the data model getter). Used by the
      // header template to lock the name input against silent actor-rename.
      hasActivePersona: !!activePersona,
      // True only when a persona is EXPLICITLY selected (activePersonaId is set
      // to a real persona ID). The picker trigger uses this to distinguish
      // "no persona explicitly chosen" (show "true identity") from "persona
      // selected" (show the persona name). Differs from hasActivePersona, which
      // is also true when only the primary-persona fallback is in play.
      activePersonaExplicit: !!(system.activePersonaId),
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

  // ── Drop handler ──────────────────────────────────────────────────────────

  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    if (!data) return super._onDrop(event);

    if (data.type === 'Item') {
      const item = data.uuid ? await fromUuid(data.uuid) : null;
      if (item?.type === 'reputation-tag') {
        // Skip if this tag is already embedded on this actor.
        if (item.parent?.id === this.actor.id) return;
        const polarity = item.system?.polarity ?? 'positive';
        const [newItem] = await this.actor.createEmbeddedDocuments('Item', [{
          type: 'reputation-tag',
          name: item.name,
          system: foundry.utils.deepClone(item.system),
        }]);
        if (!newItem) return;
        const field = polarity === 'negative'
          ? 'system.reputation.negativeTags'
          : 'system.reputation.positiveTags';
        const current = polarity === 'negative'
          ? (this.actor.system.reputation?.negativeTags ?? [])
          : (this.actor.system.reputation?.positiveTags ?? []);
        await this.actor.update({ [field]: [...current, newItem.id] });
        await checkThresholdAndPrompt(this.actor, polarity);
        return;
      }
      return super._onDrop(event);
    }

    if (data.type === 'Actor') {
      const dropped = data.uuid ? await fromUuid(data.uuid) : null;
      if (dropped?.type === 'connection') {
        const current = this.actor.system.connections ?? [];
        if (!current.includes(dropped.id)) {
          await this.actor.update({ 'system.connections': [...current, dropped.id] });
        }
        return;
      }
    }

    return super._onDrop(event);
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

  static async #takeMonologue(event, target) {
    if (this.actor.system.tokens.monologuedThisCycle) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.monologueEditor.alreadySpent'));
      return;
    }
    new MonologueEditor(this.actor).render(true);
  }

  static async #toggleBox(event, target) {
    const itemId = target.dataset.itemId;
    const side = target.dataset.side;
    const index = parseInt(target.dataset.index, 10);

    const item = this.actor.items.get(itemId);
    if (!item || item.system.completed) return;

    const sys = item.system;
    const leftBoxes = [...(sys.leftBoxes ?? [false, false, false, false, false])];
    const rightBoxes = [...(sys.rightBoxes ?? [false, false, false, false, false])];

    if (side === 'left') leftBoxes[index] = !leftBoxes[index];
    else rightBoxes[index] = !rightBoxes[index];

    const leftCount = leftBoxes.filter(Boolean).length;
    const rightCount = rightBoxes.filter(Boolean).length;
    const nowComplete = isConflictComplete(leftBoxes, rightBoxes);

    const update = { 'system.leftBoxes': leftBoxes, 'system.rightBoxes': rightBoxes };
    if (nowComplete) {
      update['system.completed'] = true;
      update['system.completedSide'] = leftCount >= 5 ? 'left' : rightCount >= 5 ? 'right' : null;
    }

    await item.update(update);

    if (nowComplete) {
      const activeIds = (this.actor.system.innerConflictsActiveIds ?? []).filter(id => id !== itemId);
      const completedIds = [...(this.actor.system.innerConflictsCompletedIds ?? []), itemId];
      await this.actor.update({
        'system.innerConflictsActiveIds': activeIds,
        'system.innerConflictsCompletedIds': completedIds,
      });
      await postCompletionCard({ actor: this.actor, conflict: item, resolvedSide: update['system.completedSide'] });
    }
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

  static async #toggleVisibility(event, target) {
    if (!game.user?.isGM) return;
    openRevealControl(this.actor, target.dataset.field, target);
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
    const systemDefaults = {};
    if (target.dataset.itemPolarity) systemDefaults.polarity = target.dataset.itemPolarity;
    const created = await this.actor.createEmbeddedDocuments('Item', [{ type, name: `New ${type}`, system: systemDefaults }]);
    const item = created[0];
    if (!item) return;

    // Reputation tags must be registered in positiveTags / negativeTags or they
    // won't appear in the reputation grid (the sheet only renders IDs in those arrays).
    if (type === 'reputation-tag') {
      const polarity = target.dataset.itemPolarity ?? 'positive';
      const field = polarity === 'negative' ? 'system.reputation.negativeTags' : 'system.reputation.positiveTags';
      const current = polarity === 'negative'
        ? (this.actor.system.reputation?.negativeTags ?? [])
        : (this.actor.system.reputation?.positiveTags ?? []);
      await this.actor.update({ [field]: [...current, item.id] });
    }

    item.sheet?.render(true);
  }

  static async #deleteItem(event, target) {
    const id = target.dataset.itemId;
    if (!id) return;
    const item = this.actor.items.get(id);
    if (!item) return;

    // Remove from positiveTags / negativeTags index before deleting the item.
    if (item.type === 'reputation-tag') {
      const rep = this.actor.system.reputation ?? {};
      await this.actor.update({
        'system.reputation.positiveTags': (rep.positiveTags ?? []).filter(i => i !== id),
        'system.reputation.negativeTags': (rep.negativeTags ?? []).filter(i => i !== id),
      });
    }

    await this.actor.deleteEmbeddedDocuments('Item', [id]);
  }

  static async #castSkill(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;
    await castMagicSkill(item, this.actor);
  }

  static #openPersonaSwitcher(event, target) {
    openPersonaSwitcherPopover(
      this.actor,
      target,
      () => openPersonaEditor(this.actor),
    );
  }

  static #openActionsCheatSheet() {
    openActionsCheatSheet();
  }
}
