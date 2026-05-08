/**
 * UpkeepWizard — six-step per-Major modal for the Upkeep phase.
 * Per docs/design/11-upkeep-wizard.md.
 *
 * Framed ApplicationV2 (lifecycle needs: step state, draft saves, explicit
 * completion commit). One instance per actor; instance ID uses actor.id.
 *
 * Steps: welcome → tokens → notes → desire → reputation → complete.
 * Navigation via wizNext / wizBack / wizSkip actions; step-body sub-actions
 * handle resolve refresh, monologue, and desire change.
 *
 * Public API: openUpkeepWizard(actor) → Promise (resolves on close).
 */

import { MonologueEditor } from './monologue-editor.js';
import { postSystemCard } from '../helpers/chat-cards.js';
import { clearPendingChanges } from '../helpers/pending-changes.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 }              = foundry.applications.api;

const STEP_IDS = ['welcome', 'tokens', 'notes', 'desire', 'reputation', 'complete'];

// Tracks actor IDs with currently open wizards — read by UpkeepRoster.
export const openWizardActorIds = new Set();

export class UpkeepWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'gs-upkeep-wizard-app'],
    window: { frame: true, positioned: true, title: 'GOODSOCIETY.upkeepWizard.windowTitle' },
    position: { width: 580, height: 'auto' },
    actions: {
      wizNext:       UpkeepWizard.#wizNext,
      wizBack:       UpkeepWizard.#wizBack,
      wizSkip:       UpkeepWizard.#wizSkip,
      refreshResolve: UpkeepWizard.#refreshResolve,
      takeMonologue: UpkeepWizard.#takeMonologue,
      letExpire:     UpkeepWizard.#letExpire,
      changeDesire:  UpkeepWizard.#changeDesire,
      confirmDesire: UpkeepWizard.#confirmDesire,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/apps/upkeep-wizard.hbs',
    },
  };

  /**
   * @param {Actor}    actor
   * @param {Function} [onClose]  Called when the wizard closes (used by openUpkeepWizard Promise).
   */
  constructor(actor, onClose = null) {
    super({ id: `gs-upkeep-wizard-${actor.id}` });
    this._actor          = actor;
    this._onCloseCallback = onClose;
    this._step           = 1;
    this._notesInitialized = false;
    this._resolveState   = null; // null | 'refreshed' | 'at_default'
    this._monologueState = null; // null | 'posted' | 'expired' | 'already_done'
    this._notesText      = '';
    this._notesUpdated   = false;
    this._desireAction   = null; // null | 'keep' | 'change'
    this._desireExpanding = false;
    this._newDesire      = '';
    this._reputationAcknowledged = false;
  }

  /** @override */
  async _prepareContext(options) {
    const ctx    = await super._prepareContext(options);
    const actor  = this._actor;
    const system = actor.system;

    const cycleNum = _getSetting('cycleNumber', 1);
    const defaultResolve = _getSetting('defaultStartingResolve', 3);

    const currentResolve = system.tokens?.resolve?.current ?? 0;
    const maxResolve     = system.tokens?.resolve?.max ?? 5;

    // Auto-detect resolve already at/above default
    if (this._resolveState === null && currentResolve >= defaultResolve) {
      this._resolveState = 'at_default';
    }
    // Auto-detect monologue already done
    if (this._monologueState === null && system.tokens?.monologuedThisCycle) {
      this._monologueState = 'already_done';
    }
    // Initialize notes text from actor once
    if (!this._notesInitialized) {
      this._notesText = _stripHtml(system.notesObjectives ?? '');
      this._notesInitialized = true;
    }

    const resolveState   = this._resolveState;
    const monologueState = this._monologueState;

    // Step indicator ribbon
    const steps = STEP_IDS.map((id, i) => ({
      id,
      label: game.i18n.localize(`GOODSOCIETY.upkeepWizard.steps.${id}`),
      state: i + 1 < this._step ? 'done' : i + 1 === this._step ? 'current' : 'future',
    }));

    // Next button label varies by step
    const nextLabelKey = {
      1: 'begin', 2: 'next', 3: 'next', 4: 'keep', 5: 'acknowledge', 6: 'completeUpkeep',
    }[this._step];
    const nextLabel = game.i18n.localize(`GOODSOCIETY.upkeepWizard.btn.${nextLabelKey}`);

    // Step 2: next disabled until both sub-cards resolved
    const step2Blocked = this._step === 2 && (
      resolveState === null || monologueState === null
    );
    // Step 4: next disabled if textarea is expanding (use in-step save instead)
    const step4Blocked = this._step === 4 && this._desireExpanding;

    // Pending reputation changes — resolve display name at render time.
    // Each entry stores `value` (the tag name at append time) plus optionally
    // `tagId` (the source item's id). Rules:
    //   1. If the entry has a tagId AND the item still exists on the actor,
    //      prefer the live current name. Catches the common case where the
    //      tag was created with the placeholder name and renamed afterward.
    //   2. Otherwise, fall back to the snapshot value.
    //   3. If the snapshot is the literal placeholder "New reputation-tag"
    //      (entries from before the tagId/sync work shipped, or removals of
    //      tags that were never renamed), substitute "(unnamed)" so the
    //      wizard reads as something useful instead of the developer string.
    const PLACEHOLDER_TAG_NAME = 'New reputation-tag';
    const pendingChanges = (system.reputation?.pendingChanges ?? []).map(entry => {
      let displayValue = entry.value;
      if (entry.tagId) {
        const item = actor.items?.get(entry.tagId);
        if (item?.name) displayValue = item.name;
      }
      if (displayValue === PLACEHOLDER_TAG_NAME) {
        displayValue = game.i18n.localize('GOODSOCIETY.upkeepWizard.step5.unnamedTag');
      }
      return { ...entry, value: displayValue };
    });

    // Active inner conflicts
    const conflicts = actor.items?.filter(i => i.type === 'inner-conflict' && !i.system?.completed) ?? [];
    const filledBoxes = conflicts.reduce((s, c) =>
      s + (c.system?.leftBoxes?.filter(Boolean).length ?? 0)
        + (c.system?.rightBoxes?.filter(Boolean).length ?? 0), 0);
    const totalBoxes = conflicts.length * 10;

    // Summary for step 6
    const summary = {
      resolveRefreshed: resolveState === 'refreshed',
      resolveAtDefault: resolveState === 'at_default',
      resolveValues: { current: defaultResolve, max: maxResolve },
      monologuePosted:  monologueState === 'posted',
      monologueExpired: monologueState === 'expired',
      monologueAlready: monologueState === 'already_done',
      notesUpdated:     this._notesUpdated,
      desireChanged:    this._desireAction === 'change',
      desireKept:       this._desireAction === 'keep',
      desireText: this._desireAction === 'change'
        ? this._newDesire
        : _stripHtml(system.desire ?? ''),
      reputationAcknowledged: this._reputationAcknowledged,
      pendingCount:     pendingChanges.length,
      hasConflict:      conflicts.length > 0,
      conflictBoxes:    { filled: filledBoxes, total: totalBoxes },
    };

    return {
      ...ctx,
      themeId:   system.theme ?? 'npc',
      actorName: actor.name,
      eyebrow:   game.i18n.format('GOODSOCIETY.upkeepWizard.eyebrow', { n: cycleNum }),
      stepOf:    game.i18n.format('GOODSOCIETY.upkeepWizard.stepOf', { step: this._step }),
      currentStep: this._step,
      steps,
      nextLabel,
      showSkip:    this._step > 1 && this._step < 6,
      backDisabled: this._step === 1,
      nextDisabled: step2Blocked || step4Blocked,
      // Step 1 summary card
      resolveAtStart: { current: currentResolve, max: maxResolve },
      pendingChangesCount: pendingChanges.length,
      hasConflict: conflicts.length > 0,
      conflictBoxes: { filled: filledBoxes, total: totalBoxes },
      // Step 2
      defaultResolve,
      currentResolve,
      maxResolve,
      resolveState,
      monologueState,
      monologueName: actor.name,
      // Step 3
      notesText: this._notesText,
      // Step 4
      desire: _stripHtml(system.desire ?? ''),
      desireAction:    this._desireAction,
      desireExpanding: this._desireExpanding,
      newDesire:       this._newDesire,
      // Step 5
      pendingChanges,
      reputationAcknowledged: this._reputationAcknowledged,
      // Step 6
      summary,
    };
  }

  // ── Step navigation ────────────────────────────────────────────────────────

  static async #wizNext() {
    // Step 4 "keep" path — note desire action before advancing
    if (this._step === 4 && !this._desireAction) this._desireAction = 'keep';
    // Step 5 acknowledge — mark rep changes acknowledged before advancing
    if (this._step === 5) this._reputationAcknowledged = true;
    // Step 6 — complete upkeep
    if (this._step === 6) { await this._completeUpkeep(); return; }
    // Collect any dirty DOM values before leaving the step
    this._collectDomValues();
    this._step++;
    this.render();
  }

  static async #wizBack() {
    this._collectDomValues();
    if (this._step > 1) { this._step--; this.render(); }
  }

  static async #wizSkip() {
    if (this._step === 2) {
      const ok = window.confirm(
        game.i18n.localize('GOODSOCIETY.upkeepWizard.step2.skipConfirm'),
      );
      if (!ok) return;
    }
    this._step++;
    this.render();
  }

  // ── Step 2 sub-actions ─────────────────────────────────────────────────────

  static async #refreshResolve() {
    const defaultResolve = _getSetting('defaultStartingResolve', 3);
    await this._actor.update({ 'system.tokens.resolve.current': defaultResolve });
    this._resolveState = 'refreshed';
    this.render();
  }

  static async #takeMonologue() {
    // Open the monologue editor. Mark as posted (player's expressed intent).
    this._monologueState = 'posted';
    new MonologueEditor(this._actor).render({ force: true });
    this.render();
  }

  static async #letExpire() {
    // Mark monologue token as spent without posting.
    await this._actor.update({ 'system.tokens.monologuedThisCycle': true });
    this._monologueState = 'expired';
    this.render();
  }

  // ── Step 4 sub-actions ─────────────────────────────────────────────────────

  static async #changeDesire() {
    this._desireExpanding = true;
    this.render();
  }

  static async #confirmDesire() {
    const ta = this.element.querySelector('[data-upkeep-field="newDesire"]');
    const text = ta?.value?.trim() ?? '';
    if (!text) return;

    const oldDesire = _stripHtml(this._actor.system.desire ?? '');
    await this._actor.update({ 'system.desire': `<p>${text}</p>` });
    this._newDesire      = text;
    this._desireAction   = 'change';
    this._desireExpanding = false;

    // Archive chat card — when oldDesire is empty, use a "first set" framing
    // instead of "set aside their desire \"\" and now seeks ..." which reads
    // weirdly with the empty quotes.
    try {
      const cardKey = oldDesire.trim()
        ? 'GOODSOCIETY.upkeepWizard.step4.desireArchiveCard'
        : 'GOODSOCIETY.upkeepWizard.step4.desireFirstSetCard';
      await postSystemCard({
        content: game.i18n.format(cardKey, {
          name: this._actor.name, oldDesire, newDesire: text,
        }),
        context: game.i18n.format('GOODSOCIETY.upkeepWizard.eyebrow', {
          n: _getSetting('cycleNumber', 1),
        }),
      });
    } catch (err) { console.warn('GS | desire archive card failed:', err); }

    this._step++;
    this.render();
  }

  // ── Completion ─────────────────────────────────────────────────────────────

  async _completeUpkeep() {
    const actor = this._actor;

    // Save notes if updated
    if (this._notesUpdated && this._notesText.trim()) {
      try {
        await actor.update({ 'system.notesObjectives': `<p>${this._notesText}</p>` });
      } catch (err) { console.warn('GS | notes save failed:', err); }
    }

    // Clear acknowledged reputation changes
    if (this._reputationAcknowledged) {
      try {
        await clearPendingChanges(actor);
      } catch (err) { console.warn('GS | pending changes clear failed:', err); }
    }

    // Reset monologue token for next cycle
    try {
      await actor.update({ 'system.tokens.monologuedThisCycle': false });
    } catch (err) { console.warn('GS | monologue reset failed:', err); }

    // Mark completion
    try {
      await actor.setFlag('good-society-homebrew', 'upkeepCompletedAt', Date.now());
    } catch (err) { console.warn('GS | upkeep flag set failed:', err); }

    // Completion system card
    try {
      await postSystemCard({
        content: game.i18n.format('GOODSOCIETY.upkeepWizard.step6.completionCard', {
          name: actor.name,
        }),
        context: 'upkeep',
      });
    } catch (err) { console.warn('GS | upkeep completion card failed:', err); }

    await this.close();
  }

  // ── DOM helpers ────────────────────────────────────────────────────────────

  _collectDomValues() {
    if (this._step === 3) {
      const ta = this.element?.querySelector('[data-upkeep-field="notes"]');
      if (ta) { this._notesText = ta.value; this._notesUpdated = true; }
    }
    if (this._step === 4 && this._desireExpanding) {
      const ta = this.element?.querySelector('[data-upkeep-field="newDesire"]');
      if (ta && ta.value.trim()) this._newDesire = ta.value;
    }
  }

  /** @override */
  async _onClose(options) {
    openWizardActorIds.delete(this._actor.id);
    this._onCloseCallback?.();
    return super._onClose(options);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Open the Upkeep Wizard for a Major actor.
 * Returns a Promise that resolves when the wizard closes.
 *
 * @param {Actor} actor
 * @returns {Promise<void>}
 */
export function openUpkeepWizard(actor) {
  return new Promise(resolve => {
    const wizard = new UpkeepWizard(actor, resolve);
    openWizardActorIds.add(actor.id);
    wizard.render({ force: true });
  });
}

// ── Private helpers ────────────────────────────────────────────────────────

function _getSetting(key, fallback) {
  try { return game.settings.get('good-society-homebrew', key); }
  catch { return fallback; }
}

function _stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').trim();
}
