/**
 * ReputationPhaseWizard — GM-driven shared modal for the Reputation phase.
 * Per docs/design/29-reputation-batch.md §2.
 *
 * Four steps: roster → createTags → manageConditions → complete.
 * Single instance (id: 'gs-reputation-phase-wizard'). Width 720.
 * Steps 2–3: left-rail round-robin + right-pane step content.
 * Steps 1 and 4: full-width, no rail.
 *
 * Public API: openReputationPhaseWizard().
 */

import { ConditionPicker } from './condition-picker.js';
import { postSystemCard } from '../helpers/chat-cards.js';
import { profileName } from '../helpers/profile-pic.js';
import { openPhaseSummaryModal } from './phase-summary-modal.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 }              = foundry.applications.api;

const STEP_IDS = ['roster', 'createTags', 'manageConditions', 'complete'];

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
    this._watchers         = null;
  }

  // ── Real-time sync (actor item watchers) ────────────────────────────────────

  /** @override */
  _onRender(context, options) {
    super._onRender?.(context, options);
    this._attachActorWatchers();
  }

  /** @override */
  async _onClose(options) {
    this._detachActorWatchers();
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
    if (!this._activeCharacters) return false;
    return this._activeCharacters.has(actor.id);
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

    // Steps 2–3 rail + pane
    let railEntries = [];
    let focusedActor = null;
    let allRailDone = true;
    const showRail = step >= 2 && step <= 3;

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
      // Manage Conditions — every active Major is selectable so the GM can
      // freely add or clear conditions on anyone (no qualifying filter).
      if (!this._focusedActorId && activeMajors.length > 0) {
        this._focusedActorId = activeMajors[0].id;
      }
      railEntries = activeMajors.map(a => ({
        id:   a.id,
        name: profileName(a),
        status: a.id === this._focusedActorId ? 'active' : 'pending',
      }));
      allRailDone = false; // free-form step — no per-character done state
      const fa = this._focusedActorId ? game.actors?.get(this._focusedActorId) : null;
      if (fa) focusedActor = this._buildManageConditionsData(fa);
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
      name:  profileName(actor),
      theme: actor.system?.theme ?? 'npc',
      familyCriterion,
      posTags,
      negTags,
      hasTags:      posTags.length > 0 || negTags.length > 0,
      isDone:       this._step2Done.has(actor.id),
      nextCharName: next ? profileName(next) : null,
    };
  }

  /** Manage Conditions step — list of the actor's active conditions (each
   *  clearable) plus tag counts for context. Add is handled by the picker. */
  _buildManageConditionsData(actor) {
    const conditions = actor.items.filter(
      i => i.type === 'reputation-condition' && i.system?.active,
    ).map(c => ({
      id:         c.id,
      name:       c.name,
      polarity:   c.system?.polarity ?? 'positive',
      isPositive: (c.system?.polarity ?? 'positive') === 'positive',
    }));

    const posCount = actor.items.filter(
      i => i.type === 'reputation-tag' && i.system?.polarity === 'positive',
    ).length;
    const negCount = actor.items.filter(
      i => i.type === 'reputation-tag' && i.system?.polarity === 'negative',
    ).length;

    return {
      id:            actor.id,
      name:          profileName(actor),
      theme:         actor.system?.theme ?? 'npc',
      conditions,
      hasConditions: conditions.length > 0,
      posCount,
      negCount,
    };
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  static async #wizNext() {
    if (this._step === STEP_IDS.length) { await this._completePhase(); return; }
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

  // ── Step 3: Manage Conditions ───────────────────────────────────────────────

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
          'GOODSOCIETY.reputationPhaseWizard.step3.conditionClearedCard',
          {
            name: profileName(actor),
            condition: condition.name,
          },
        ),
        context: 'reputation',
      });
    } catch (err) { console.warn('GS | rep wizard clearCondition failed:', err); }

    this.render();
  }

  // ── Completion ──────────────────────────────────────────────────────────────

  async _completePhase() {
    // Build a public per-character summary visible to the whole table. The
    // brief one-line completion card is preserved for the running session
    // log; the richer card below is what the players see.
    try {
      await _postReputationPhaseSummary({
        tagsCreated: this._tagsCreated,
        conditionsCleared: this._conditionsCleared,
      });
    } catch (err) { console.warn('GS | rep phase summary failed:', err); }

    await this.close();
  }
}

/**
 * Build + show the GM preview modal for the end-of-Reputation-Phase summary.
 * The GM can edit text inline before clicking "Post and continue", at which
 * point the (possibly-edited) HTML is posted publicly + appended to the
 * session log. Cancel suppresses both.
 */
async function _postReputationPhaseSummary({ tagsCreated, conditionsCleared }) {
  const majors = (game.actors?.filter(a => a.type === 'major-character') ?? []);
  // Per-character lines.
  const lines = majors.map(a => {
    const items = a.items ?? new Map();
    const positiveTags = [...items].filter(i => i.type === 'reputation-tag' && i.system?.polarity === 'positive');
    const negativeTags = [...items].filter(i => i.type === 'reputation-tag' && i.system?.polarity === 'negative');
    const conditions = [...items].filter(i => i.type === 'reputation-condition' && i.system?.active);
    const condText = conditions.length
      ? conditions.map(c =>
          `<em>${foundry.utils.escapeHTML(c.name)}</em> ${c.system?.polarity === 'positive' ? '▲' : '▼'}`,
        ).join(', ')
      : `<span style="opacity: 0.6;">${foundry.utils.escapeHTML(game.i18n.localize('GOODSOCIETY.reputationPhaseWizard.summary.noConditions'))}</span>`;
    return `<li><strong>${foundry.utils.escapeHTML(profileName(a))}</strong>: ▲${positiveTags.length} · ▼${negativeTags.length} — ${condText}</li>`;
  }).join('');

  const heading = game.i18n.localize('GOODSOCIETY.reputationPhaseWizard.summary.heading');
  const totals = game.i18n.format('GOODSOCIETY.reputationPhaseWizard.summary.totals', {
    tagsCreated,
    conditionsCleared,
  });

  const content = `
    <div class="gs-phase-summary gs-phase-summary--reputation">
      <p style="margin: 0 0 8px;"><strong>${foundry.utils.escapeHTML(heading)}</strong></p>
      <ul style="margin: 0 0 10px; padding-left: 18px; list-style: '— ';">
        ${lines}
      </ul>
      <p style="margin: 0; font-style: italic; opacity: 0.75; font-size: 12px;">${foundry.utils.escapeHTML(totals)}</p>
    </div>
  `;

  // The session-event entry logs the phase boundary regardless of whether
  // the GM publishes the public recap — the log captures "this happened,"
  // not "this was announced." Fire it first so it's never lost to a
  // cancelled preview.
  try {
    const { appendSessionEvent } = await import('../hooks/session-events.js');
    await appendSessionEvent({
      type: 'reputationPhaseComplete',
      details: { tagsCreated, conditionsCleared, characterCount: majors.length },
    });
  } catch (err) { console.warn('GS | rep phase session-event append failed:', err); }

  openPhaseSummaryModal({
    title: game.i18n.localize('GOODSOCIETY.phaseSummary.reputationTitle'),
    summaryHtml: content,
    onPost: async (finalHtml) => {
      await postSystemCard({ content: finalHtml, context: 'reputation' });
    },
    onCancel: () => {
      // No public post — the phase still completed silently; GM just
      // declined to publish the recap.
      ui.notifications?.info(game.i18n.localize('GOODSOCIETY.phaseSummary.skippedNotice'));
    },
  });
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
