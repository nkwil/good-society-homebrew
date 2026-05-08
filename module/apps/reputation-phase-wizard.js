/**
 * ReputationPhaseWizard — GM-driven shared modal for the Reputation phase.
 * Per docs/design/29-reputation-batch.md §2.
 *
 * Five steps: roster → createTags → triggerConditions → clearConditions → complete.
 * Single instance (id: 'gs-reputation-phase-wizard'). Width 720.
 * Steps 2–4: left-rail round-robin + right-pane step content.
 * Steps 1 and 5: full-width, no rail.
 *
 * Public API: openReputationPhaseWizard().
 */

import { ConditionPicker } from './condition-picker.js';
import { postSystemCard } from '../helpers/chat-cards.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 }              = foundry.applications.api;

const STEP_IDS = ['roster', 'createTags', 'triggerConditions', 'clearConditions', 'complete'];

export class ReputationPhaseWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'gs-rep-wizard-app'],
    window: { frame: true, positioned: true, title: 'GOODSOCIETY.reputationPhaseWizard.windowTitle' },
    position: { width: 720, height: 'auto' },
    actions: {
      wizNext:          ReputationPhaseWizard.#wizNext,
      wizBack:          ReputationPhaseWizard.#wizBack,
      toggleCharacter:  ReputationPhaseWizard.#toggleCharacter,
      focusCharacter:   ReputationPhaseWizard.#focusCharacter,
      markDone:         ReputationPhaseWizard.#markDone,
      addTag:           ReputationPhaseWizard.#addTag,
      removeTag:        ReputationPhaseWizard.#removeTag,
      triggerCondition: ReputationPhaseWizard.#triggerCondition,
      clearCondition:   ReputationPhaseWizard.#clearCondition,
    },
  };

  static PARTS = {
    main: { template: 'systems/good-society-homebrew/templates/apps/reputation-phase-wizard.hbs' },
  };

  constructor() {
    super({ id: 'gs-reputation-phase-wizard' });
    this._step             = 1;
    this._activeCharacters = null; // Set<actorId>, null until first _prepareContext
    this._focusedActorId   = null;
    this._step2Done        = new Set();
    this._tagsCreated      = 0;
    this._conditionsCleared = 0;
  }

  // ── Context preparation ─────────────────────────────────────────────────────

  /** @override */
  async _prepareContext(options) {
    const ctx  = await super._prepareContext(options);
    const step = this._step;

    const allMajors = game.actors?.filter(a => a.type === 'major-character') ?? [];

    // Initialize active set once (all Majors active by default)
    if (this._activeCharacters === null) {
      this._activeCharacters = new Set(allMajors.map(a => a.id));
    }

    const activeMajors = allMajors.filter(a => this._activeCharacters.has(a.id));

    const cycleNum = _getSetting('cycleNumber', 1);
    const eyebrow  = game.i18n.format('GOODSOCIETY.reputationPhaseWizard.eyebrow', { n: cycleNum });
    const stepOf   = game.i18n.format('GOODSOCIETY.reputationPhaseWizard.stepOf',
      { step, total: STEP_IDS.length });

    const steps = STEP_IDS.map((id, i) => ({
      id,
      label: game.i18n.localize(`GOODSOCIETY.reputationPhaseWizard.steps.${id}`),
      state: i + 1 < step ? 'done' : i + 1 === step ? 'current' : 'future',
    }));

    // Step 1 roster
    const rosterRows = step === 1 ? allMajors.map(a => ({
      id:     a.id,
      name:   a.name,
      active: this._activeCharacters.has(a.id),
    })) : [];

    // Steps 2–4 rail + pane
    let railEntries = [];
    let focusedActor = null;
    let allRailDone = true;
    const showRail = step >= 2 && step <= 4;

    if (step === 2) {
      if (!this._focusedActorId && activeMajors.length > 0) {
        this._focusedActorId = activeMajors[0].id;
      }
      railEntries = activeMajors.map(a => ({
        id:     a.id,
        name:   a.name,
        status: this._step2Done.has(a.id) ? 'done'
              : a.id === this._focusedActorId ? 'active' : 'pending',
      }));
      allRailDone = activeMajors.every(a => this._step2Done.has(a.id));
      const fa = this._focusedActorId ? game.actors?.get(this._focusedActorId) : null;
      if (fa) focusedActor = this._buildStep2Data(fa);
    }

    if (step === 3) {
      const qualifying = _getStep3Actors(activeMajors);
      if (!this._focusedActorId && qualifying.length > 0) {
        this._focusedActorId = qualifying[0].actor.id;
      }
      railEntries = qualifying.map(({ actor, polarities }) => ({
        id:   actor.id,
        name: actor.name,
        status: _step3ActorDone(actor, polarities) ? 'done'
              : actor.id === this._focusedActorId ? 'active' : 'pending',
      }));
      allRailDone = qualifying.length === 0 || qualifying.every(
        ({ actor, polarities }) => _step3ActorDone(actor, polarities),
      );
      const fa = this._focusedActorId ? game.actors?.get(this._focusedActorId) : null;
      if (fa) {
        const entry = qualifying.find(q => q.actor.id === fa.id);
        if (entry) focusedActor = this._buildStep3Data(fa, entry.polarities);
      }
    }

    if (step === 4) {
      const qualifying = _getStep4Actors(activeMajors);
      if (!this._focusedActorId && qualifying.length > 0) {
        this._focusedActorId = qualifying[0].actor.id;
      }
      railEntries = qualifying.map(a => ({
        id:   a.id,
        name: a.name,
        status: !_needsStep4(a) ? 'done'
              : a.id === this._focusedActorId ? 'active' : 'pending',
      }));
      allRailDone = qualifying.length === 0 || qualifying.every(a => !_needsStep4(a));
      const fa = this._focusedActorId ? game.actors?.get(this._focusedActorId) : null;
      if (fa) focusedActor = this._buildStep4Data(fa);
    }

    return {
      ...ctx,
      eyebrow,
      stepOf,
      step,
      steps,
      showRail,
      noMajors: allMajors.length === 0,
      rosterRows,
      railEntries,
      focusedActor,
      allRailDone,
      summary: {
        tagsCreated:      this._tagsCreated,
        conditionsCleared: this._conditionsCleared,
        activeCount:      activeMajors.length,
      },
    };
  }

  // ── Step data builders ──────────────────────────────────────────────────────

  _buildStep2Data(actor) {
    const family = actor.system?.familyId
      ? game.actors?.get(actor.system.familyId) : null;
    const familyCriterion = _stripHtml(family?.system?.uniqueNegativeRepCriteria ?? '');

    const posTags = actor.items.filter(
      i => i.type === 'reputation-tag' && i.system?.polarity === 'positive'
    ).map(t => ({ id: t.id, name: t.name }));

    const negTags = actor.items.filter(
      i => i.type === 'reputation-tag' && i.system?.polarity === 'negative'
    ).map(t => ({ id: t.id, name: t.name }));

    const active = this._activeCharacters.has(actor.id)
      ? this._activeCharacters : new Set();
    const activeMajors = (game.actors?.filter(a => a.type === 'major-character') ?? [])
      .filter(a => active.has(a.id));
    const currentIdx = activeMajors.findIndex(a => a.id === actor.id);
    const next = activeMajors.find((a, i) => i > currentIdx && !this._step2Done.has(a.id));

    return {
      id:    actor.id,
      name:  actor.name,
      theme: actor.system?.theme ?? 'npc',
      familyCriterion,
      posTags,
      negTags,
      hasTags:      posTags.length > 0 || negTags.length > 0,
      isDone:       this._step2Done.has(actor.id),
      nextCharName: next?.name ?? null,
    };
  }

  _buildStep3Data(actor, polarities) {
    return {
      id:   actor.id,
      name: actor.name,
      theme: actor.system?.theme ?? 'npc',
      polarities: polarities.map(p => {
        const tags = actor.items.filter(
          i => i.type === 'reputation-tag' && i.system?.polarity === p
        ).map(t => t.name);
        const hasCondition = actor.items.some(
          i => i.type === 'reputation-condition' && i.system?.polarity === p && i.system?.active,
        );
        const pickerResolved = !!actor.getFlag('good-society-homebrew', `pickerResolved.${p}`);
        return {
          polarity:   p,
          isPositive: p === 'positive',
          tags,
          resolved:   hasCondition || pickerResolved,
        };
      }),
    };
  }

  _buildStep4Data(actor) {
    const conditions = actor.items.filter(
      i => i.type === 'reputation-condition' && i.system?.active,
    ).filter(c => {
      const tagCount = actor.items.filter(
        i => i.type === 'reputation-tag' && i.system?.polarity === c.system?.polarity,
      ).length;
      return tagCount < 3;
    }).map(c => ({
      id:         c.id,
      name:       c.name,
      polarity:   c.system?.polarity ?? 'positive',
      isPositive: c.system?.polarity === 'positive',
      tagCount:   actor.items.filter(
        i => i.type === 'reputation-tag' && i.system?.polarity === c.system?.polarity,
      ).length,
    }));

    return {
      id:         actor.id,
      name:       actor.name,
      theme:      actor.system?.theme ?? 'npc',
      conditions,
      allCleared: conditions.length === 0,
    };
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  static async #wizNext() {
    if (this._step === 5) { await this._completePhase(); return; }
    this._focusedActorId = null; // reset for the new step
    this._step++;
    this.render();
  }

  static async #wizBack() {
    if (this._step > 1) {
      this._focusedActorId = null;
      this._step--;
      this.render();
    }
  }

  // ── Step 1 ──────────────────────────────────────────────────────────────────

  static async #toggleCharacter(ev, target) {
    const actorId = target.dataset.actorId;
    if (!actorId) return;
    if (this._activeCharacters.has(actorId)) {
      this._activeCharacters.delete(actorId);
    } else {
      this._activeCharacters.add(actorId);
    }
    this.render();
  }

  // ── Steps 2–4 rail ─────────────────────────────────────────────────────────

  static async #focusCharacter(ev, target) {
    const actorId = target.dataset.actorId;
    if (actorId && actorId !== this._focusedActorId) {
      this._focusedActorId = actorId;
      this.render();
    }
  }

  // ── Step 2 ──────────────────────────────────────────────────────────────────

  static async #markDone(ev, target) {
    const actorId = target.dataset.actorId ?? this._focusedActorId;
    if (!actorId) return;
    this._step2Done.add(actorId);

    const activeMajors = (game.actors?.filter(a => a.type === 'major-character') ?? [])
      .filter(a => this._activeCharacters.has(a.id));
    const next = activeMajors.find(a => !this._step2Done.has(a.id));
    this._focusedActorId = next?.id ?? null;
    this.render();
  }

  static async #addTag(ev, target) {
    const actor = this._focusedActorId ? game.actors?.get(this._focusedActorId) : null;
    if (!actor) return;

    const nameInput     = this.element.querySelector('[data-rpw-field="tagName"]');
    const polarityInput = this.element.querySelector('[data-rpw-field="tagPolarity"]:checked')
      ?? this.element.querySelector('[data-rpw-field="tagPolarity"]');

    const tagName = nameInput?.value?.trim() ?? '';
    const polarity = polarityInput?.value ?? 'positive';
    if (!tagName) return;

    try {
      const created = await actor.createEmbeddedDocuments('Item', [{
        type: 'reputation-tag', name: tagName, system: { polarity },
      }]);
      const item = created[0];
      if (item) {
        const field   = polarity === 'negative' ? 'system.reputation.negativeTags' : 'system.reputation.positiveTags';
        const current = polarity === 'negative'
          ? (actor.system.reputation?.negativeTags ?? [])
          : (actor.system.reputation?.positiveTags ?? []);
        await actor.update({ [field]: [...current, item.id] });
        this._tagsCreated++;
      }
    } catch (err) { console.warn('GS | rep wizard addTag failed:', err); }

    this.render();
  }

  static async #removeTag(ev, target) {
    const actor = this._focusedActorId ? game.actors?.get(this._focusedActorId) : null;
    const tagId = target.dataset.tagId;
    if (!actor || !tagId) return;

    const item = actor.items?.get(tagId);
    if (!item) return;
    const polarity = item.system?.polarity ?? 'positive';

    try {
      const field   = polarity === 'negative' ? 'system.reputation.negativeTags' : 'system.reputation.positiveTags';
      const current = polarity === 'negative'
        ? (actor.system.reputation?.negativeTags ?? [])
        : (actor.system.reputation?.positiveTags ?? []);
      await actor.update({ [field]: current.filter(id => id !== tagId) });
      await actor.deleteEmbeddedDocuments('Item', [tagId]);
    } catch (err) { console.warn('GS | rep wizard removeTag failed:', err); }

    this.render();
  }

  // ── Step 3 ──────────────────────────────────────────────────────────────────

  static async #triggerCondition(ev, target) {
    const actorId = target.dataset.actorId ?? this._focusedActorId;
    const polarity = target.dataset.polarity;
    if (!actorId || !polarity) return;

    const actor = game.actors?.get(actorId);
    if (!actor) return;

    const sourceTags = actor.items.filter(
      i => i.type === 'reputation-tag' && i.system?.polarity === polarity,
    );

    const pickerId = `gs-condition-picker-${actorId}-${polarity}`;
    new ConditionPicker(actor, polarity, sourceTags).render({ force: true });

    // Re-render wizard when picker closes so status badges update
    const wizard = this;
    const listenerId = Hooks.on('closeApplication', (app) => {
      if (app.id === pickerId) {
        Hooks.off('closeApplication', listenerId);
        wizard.render();
      }
    });
  }

  // ── Step 4 ──────────────────────────────────────────────────────────────────

  static async #clearCondition(ev, target) {
    const actorId     = target.dataset.actorId ?? this._focusedActorId;
    const conditionId = target.dataset.conditionId;
    if (!actorId || !conditionId) return;

    const actor = game.actors?.get(actorId);
    if (!actor) return;

    const condition = actor.items?.get(conditionId);
    if (!condition) return;
    const polarity = condition.system?.polarity ?? 'positive';

    try {
      await actor.deleteEmbeddedDocuments('Item', [conditionId]);
      // Clear resolved flag so the inline picker can re-fire if count rises again
      await actor.unsetFlag('good-society-homebrew', `pickerResolved.${polarity}`);
      this._conditionsCleared++;

      await postSystemCard({
        content: game.i18n.format(
          'GOODSOCIETY.reputationPhaseWizard.step4.conditionClearedCard',
          { name: actor.name, condition: condition.name },
        ),
        context: 'reputation',
      });
    } catch (err) { console.warn('GS | rep wizard clearCondition failed:', err); }

    this.render();
  }

  // ── Completion ──────────────────────────────────────────────────────────────

  async _completePhase() {
    try {
      await postSystemCard({
        content: game.i18n.format(
          'GOODSOCIETY.reputationPhaseWizard.step5.completionCard',
          {
            tagsCreated:      this._tagsCreated,
            conditionsCleared: this._conditionsCleared,
          },
        ),
        context: 'reputation',
      });
    } catch (err) { console.warn('GS | rep phase completion card failed:', err); }

    await this.close();
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export function openReputationPhaseWizard() {
  new ReputationPhaseWizard().render({ force: true });
}

// ── Private helpers ────────────────────────────────────────────────────────

function _getSetting(key, fallback) {
  try { return game.settings.get('good-society-homebrew', key); }
  catch { return fallback; }
}

function _stripHtml(html) {
  return html ? html.replace(/<[^>]*>/g, '').trim() : '';
}

/** Characters qualifying for step 3: tagCount >= 3 for some polarity, no condition, not resolved. */
function _getStep3Actors(activeMajors) {
  return activeMajors.map(actor => {
    const polarities = ['positive', 'negative'].filter(p => {
      const tagCount = actor.items.filter(
        i => i.type === 'reputation-tag' && i.system?.polarity === p,
      ).length;
      if (tagCount < 3) return false;
      if (actor.items.some(
        i => i.type === 'reputation-condition' && i.system?.polarity === p && i.system?.active,
      )) return false;
      if (actor.getFlag('good-society-homebrew', `pickerResolved.${p}`)) return false;
      return true;
    });
    return { actor, polarities };
  }).filter(({ polarities }) => polarities.length > 0);
}

/** True when all qualifying polarities for a step-3 actor are resolved. */
function _step3ActorDone(actor, polarities) {
  return polarities.every(p =>
    actor.getFlag('good-society-homebrew', `pickerResolved.${p}`) ||
    actor.items.some(
      i => i.type === 'reputation-condition' && i.system?.polarity === p && i.system?.active,
    ),
  );
}

/** Characters qualifying for step 4: have active condition AND tagCount < 3 for it. */
function _getStep4Actors(activeMajors) {
  return activeMajors.filter(_needsStep4);
}

function _needsStep4(actor) {
  return actor.items.some(condition => {
    if (condition.type !== 'reputation-condition' || !condition.system?.active) return false;
    const tagCount = actor.items.filter(
      i => i.type === 'reputation-tag' && i.system?.polarity === condition.system?.polarity,
    ).length;
    return tagCount < 3;
  });
}
