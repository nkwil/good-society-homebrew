/**
 * PlayerReputationPhaseWizard — per-Major framed modal for the Reputation phase.
 * Per docs/design/30-player-reputation-phase-wizard.md.
 *
 * Five steps: welcome → criteria → tags → conditions → complete.
 * One instance per actor (id: 'gs-player-rep-wizard-{actor.id}').
 * Mirrors UpkeepWizard's class shape and Promise-based queue pattern.
 *
 * Real-time sync: attaches createItem / updateItem / deleteItem hooks in
 * _onRender and detaches in _onClose. Both this wizard and the GM wizard
 * re-render when the other mutates the actor's reputation items.
 *
 * Public API: openPlayerReputationPhaseWizard(actor) → Promise<void>
 */

import { ConditionPicker } from './condition-picker.js';
import { postSystemCard } from '../helpers/chat-cards.js';
import { profileName } from '../helpers/profile-pic.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 }              = foundry.applications.api;

const STEP_IDS = ['welcome', 'criteria', 'tags', 'conditions', 'complete'];

export class PlayerReputationPhaseWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'gs-player-rep-wizard-app'],
    window: { frame: true, positioned: true, title: 'GOODSOCIETY.playerReputationPhaseWizard.windowTitle' },
    position: { width: 540, height: 'auto' },
    actions: {
      wizNext:          PlayerReputationPhaseWizard.#wizNext,
      wizBack:          PlayerReputationPhaseWizard.#wizBack,
      addTag:           PlayerReputationPhaseWizard.#addTag,
      removeTag:        PlayerReputationPhaseWizard.#removeTag,
      triggerCondition: PlayerReputationPhaseWizard.#triggerCondition,
      clearCondition:   PlayerReputationPhaseWizard.#clearCondition,
    },
  };

  static PARTS = {
    main: { template: 'systems/good-society-homebrew/templates/apps/player-reputation-phase-wizard.hbs' },
  };

  /**
   * @param {Actor}    actor
   * @param {Function} [onClose]  Called when the wizard closes (Promise resolution via openPlayerReputationPhaseWizard).
   */
  constructor(actor, onClose = null) {
    super({ id: `gs-player-rep-wizard-${actor.id}` });
    this._actor           = actor;
    this._onCloseCallback = onClose;
    this._step            = 1;
    this._tagsAdded       = 0;
    this._conditionsTriggered = 0;
    this._conditionsCleared   = 0;
    this._watchers        = null;
  }

  // ── Context ────────────────────────────────────────────────────────────────

  /** @override */
  async _prepareContext(options) {
    const ctx    = await super._prepareContext(options);
    const actor  = this._actor;
    const system = actor.system;

    const cycleNum   = _getSetting('cycleNumber', 1);
    const themeId    = system.theme ?? 'npc';
    const actorName  = profileName(actor);

    const eyebrow = game.i18n.format(
      'GOODSOCIETY.playerReputationPhaseWizard.eyebrow',
      { n: cycleNum, name: actorName },
    );
    const stepOf = game.i18n.format(
      'GOODSOCIETY.playerReputationPhaseWizard.stepOf',
      { step: this._step, total: STEP_IDS.length },
    );

    const steps = STEP_IDS.map((id, i) => ({
      id,
      label: game.i18n.localize(`GOODSOCIETY.playerReputationPhaseWizard.steps.${id}`),
      state: i + 1 < this._step ? 'done' : i + 1 === this._step ? 'current' : 'future',
    }));

    return {
      ...ctx,
      themeId,
      actorName,
      eyebrow,
      stepOf,
      step: this._step,
      steps,
      isLastStep: this._step === STEP_IDS.length,
      // Step data (computed on every render; no stale state)
      welcome:    this._step === 1 ? this._buildStep1Data()  : null,
      criteria:   this._step === 2 ? this._buildStep2Data()  : null,
      tags:       this._step === 3 ? this._buildStep3Data()  : null,
      conditions: this._step === 4 ? this._buildStep4Data()  : null,
      summary:    this._step === 5 ? this._buildStep5Data()  : null,
    };
  }

  // ── Step data builders ─────────────────────────────────────────────────────

  _buildStep1Data() {
    const actor = this._actor;
    const posTags = actor.items.filter(
      i => i.type === 'reputation-tag' && i.system?.polarity === 'positive',
    );
    const negTags = actor.items.filter(
      i => i.type === 'reputation-tag' && i.system?.polarity === 'negative',
    );
    const activeConditions = actor.items.filter(
      i => i.type === 'reputation-condition' && i.system?.active,
    );
    return {
      tagCount:      { positive: posTags.length, negative: negTags.length },
      conditions:    activeConditions.map(c => ({ name: c.name, polarity: c.system?.polarity ?? 'positive' })),
      hasConditions: activeConditions.length > 0,
    };
  }

  _buildStep2Data() {
    const actor  = this._actor;
    const family = actor.system?.familyId ? game.actors?.get(actor.system.familyId) : null;
    return {
      familyCriterion: _stripHtml(family?.system?.uniqueNegativeRepCriteria ?? ''),
      familyName:      family?.name ?? '',
      hasFamily:       !!family,
    };
  }

  _buildStep3Data() {
    const actor   = this._actor;
    const posTags = actor.items.filter(
      i => i.type === 'reputation-tag' && i.system?.polarity === 'positive',
    ).map(t => ({ id: t.id, name: t.name }));
    const negTags = actor.items.filter(
      i => i.type === 'reputation-tag' && i.system?.polarity === 'negative',
    ).map(t => ({ id: t.id, name: t.name }));
    return { posTags, negTags, hasTags: posTags.length > 0 || negTags.length > 0 };
  }

  _buildStep4Data() {
    const actor = this._actor;

    // Polarities where count >= 3, no active condition, not resolved via picker flag
    const triggerItems = ['positive', 'negative'].flatMap(p => {
      const tags = actor.items.filter(
        i => i.type === 'reputation-tag' && i.system?.polarity === p,
      );
      if (tags.length < 3) return [];
      if (actor.items.some(
        i => i.type === 'reputation-condition' && i.system?.polarity === p && i.system?.active,
      )) return [];
      if (actor.getFlag('good-society-homebrew', `pickerResolved.${p}`)) return [];
      return [{ polarity: p, isPositive: p === 'positive', tags: tags.map(t => ({ id: t.id, name: t.name })), tagCount: tags.length }];
    });

    // Active conditions whose polarity tag count has dropped below 3
    const clearItems = actor.items.filter(c => {
      if (c.type !== 'reputation-condition' || !c.system?.active) return false;
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
      triggerItems,
      clearItems,
      nothingToDo: triggerItems.length === 0 && clearItems.length === 0,
    };
  }

  _buildStep5Data() {
    return {
      tagsAdded:            this._tagsAdded,
      conditionsTriggered:  this._conditionsTriggered,
      conditionsCleared:    this._conditionsCleared,
    };
  }

  // ── Render hooks (watcher attach / detach) ─────────────────────────────────

  /** @override */
  _onRender(context, options) {
    super._onRender?.(context, options);
    this._attachActorWatchers();
  }

  /** @override */
  async _onClose(options) {
    this._detachActorWatchers();
    this._onCloseCallback?.();
    return super._onClose(options);
  }

  _attachActorWatchers() {
    if (this._watchers) return;
    const onChange = (item) => {
      if (item.parent?.type !== 'major-character') return;
      if (!this._isInScope(item.parent)) return;
      if (item.type !== 'reputation-tag' && item.type !== 'reputation-condition') return;
      this.render({ force: false });
    };
    this._watchers = [
      Hooks.on('createItem', onChange),
      Hooks.on('updateItem', onChange),
      Hooks.on('deleteItem', onChange),
    ];
  }

  _detachActorWatchers() {
    if (!this._watchers) return;
    Hooks.off('createItem', this._watchers[0]);
    Hooks.off('updateItem', this._watchers[1]);
    Hooks.off('deleteItem', this._watchers[2]);
    this._watchers = null;
  }

  _isInScope(actor) {
    return actor.id === this._actor.id;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  static async #wizNext() {
    if (this._step === STEP_IDS.length) { await this._completePhase(); return; }
    this._step++;
    this.render();
  }

  static async #wizBack() {
    if (this._step > 1) { this._step--; this.render(); }
  }

  // ── Step 3: Tags ───────────────────────────────────────────────────────────

  static async #addTag(ev, target) {
    const actor = this._actor;
    const nameInput     = this.element.querySelector('[data-prpw-field="tagName"]');
    const polarityInput = this.element.querySelector('[data-prpw-field="tagPolarity"]:checked')
      ?? this.element.querySelector('[data-prpw-field="tagPolarity"]');

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
        this._tagsAdded++;
      }
    } catch (err) { console.warn('GS | player rep wizard addTag failed:', err); }

    this.render();
  }

  static async #removeTag(ev, target) {
    const actor = this._actor;
    const tagId = target.dataset.tagId;
    if (!tagId) return;

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
    } catch (err) { console.warn('GS | player rep wizard removeTag failed:', err); }

    this.render();
  }

  // ── Step 4: Conditions ─────────────────────────────────────────────────────

  static async #triggerCondition(ev, target) {
    const polarity = target.dataset.polarity;
    if (!polarity) return;
    const actor = this._actor;

    const sourceTags = actor.items.filter(
      i => i.type === 'reputation-tag' && i.system?.polarity === polarity,
    );

    const pickerId = `gs-condition-picker-${actor.id}-${polarity}`;
    new ConditionPicker(actor, polarity, sourceTags).render({ force: true });

    const wizard = this;
    const listenerId = Hooks.on('closeApplication', (app) => {
      if (app.id === pickerId) {
        Hooks.off('closeApplication', listenerId);
        wizard._conditionsTriggered++;
        wizard.render();
      }
    });
  }

  static async #clearCondition(ev, target) {
    const conditionId = target.dataset.conditionId;
    if (!conditionId) return;
    const actor = this._actor;

    const condition = actor.items?.get(conditionId);
    if (!condition) return;
    const polarity = condition.system?.polarity ?? 'positive';

    try {
      await actor.deleteEmbeddedDocuments('Item', [conditionId]);
      await actor.unsetFlag('good-society-homebrew', `pickerResolved.${polarity}`);
      this._conditionsCleared++;

      await postSystemCard({
        content: game.i18n.format(
          'GOODSOCIETY.playerReputationPhaseWizard.step4.conditionClearedCard',
          {
            name: profileName(actor),
            condition: condition.name,
          },
        ),
        context: 'reputation',
      });
    } catch (err) { console.warn('GS | player rep wizard clearCondition failed:', err); }

    this.render();
  }

  // ── Completion ─────────────────────────────────────────────────────────────

  async _completePhase() {
    const actor = this._actor;
    try {
      await actor.setFlag('good-society-homebrew', 'reputationPhaseCompletedAt', Date.now());
    } catch (err) { console.warn('GS | player rep wizard flag set failed:', err); }

    try {
      await postSystemCard({
        content: game.i18n.format(
          'GOODSOCIETY.playerReputationPhaseWizard.step5.completionCard',
          {
            name:                 profileName(actor),
            tagsAdded:            this._tagsAdded,
            conditionsTriggered:  this._conditionsTriggered,
            conditionsCleared:    this._conditionsCleared,
          },
        ),
        context: 'reputation',
      });
    } catch (err) { console.warn('GS | player rep completion card failed:', err); }

    await this.close();
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Open the player Reputation Phase Wizard for a Major actor.
 * Returns a Promise that resolves when the wizard closes.
 * Mirrors openUpkeepWizard() from upkeep-wizard.js.
 *
 * @param {Actor} actor
 * @returns {Promise<void>}
 */
export function openPlayerReputationPhaseWizard(actor) {
  return new Promise(resolve => {
    const wizard = new PlayerReputationPhaseWizard(actor, resolve);
    wizard.render({ force: true });
  });
}

// ── Private helpers ────────────────────────────────────────────────────────

function _getSetting(key, fallback) {
  try { return game.settings.get('good-society-homebrew', key); }
  catch { return fallback; }
}

function _stripHtml(html) {
  return html ? html.replace(/<[^>]*>/g, '').trim() : '';
}
