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
import { postSystemCard, postCompletionCard } from '../helpers/chat-cards.js';
import { clearPendingChanges } from '../helpers/pending-changes.js';
import { profileName } from '../helpers/profile-pic.js';
import { isConflictComplete } from '../helpers/reputation-rules.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 }              = foundry.applications.api;

// Step ids drive the ribbon, the step-of label, and the numeric step
// checks in wizNext (via their index + 1). "conflicts" inserted between
// "desire" and "reputation" because it's the last INTERNAL reflection
// (desire = what I want, conflicts = internal tensions) before the
// wizard turns outward to reputation (what the world did to me).
const STEP_IDS = ['welcome', 'tokens', 'notes', 'desire', 'conflicts', 'reputation', 'complete'];

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
      // Step 5 (conflicts) — click-toggle a single box on an active
      // inner-conflict. Auto-completes + posts a ceremony card when the
      // threshold rule fires (6 total OR 5 on one side). Same behavior
      // as the Major sheet's #toggleBox so the two surfaces stay in
      // lockstep on what "filling that last box" does.
      toggleConflictBox: UpkeepWizard.#toggleConflictBox,
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

    // Next button label varies by step. Indices bumped when the
    // "conflicts" step was inserted at position 5 (2026-05-20) — old 5+6
    // are now 6+7. Keep the map keyed by numeric step so future inserts
    // are a one-place change.
    const nextLabelKey = {
      1: 'begin', 2: 'next', 3: 'next', 4: 'keep',
      5: 'next',           // conflicts step: always allow forward
      6: 'acknowledge',    // was step 5 (reputation)
      7: 'completeUpkeep', // was step 6 (complete)
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
        displayValue = game.i18n.localize('GOODSOCIETY.upkeepWizard.step6.unnamedTag');
      }
      return { ...entry, value: displayValue };
    });

    // Active inner conflicts — enriched for the step 5 grid.
    // Each entry carries the labels + a per-box render list so the
    // template can iterate without pulling boolean-array logic into
    // Handlebars. `atThreshold` flags conflicts already at the
    // completion rule (6 total OR 5 on one side) — the box toggle
    // handler auto-completes on the NEXT click, but the flag lets the
    // template highlight the conflict so the GM sees "just one more."
    const conflictItems = actor.items?.filter(i => i.type === 'inner-conflict' && !i.system?.completed) ?? [];
    const conflictCards = conflictItems.map(item => {
      const leftBoxes  = item.system?.leftBoxes  ?? [false, false, false, false, false];
      const rightBoxes = item.system?.rightBoxes ?? [false, false, false, false, false];
      const leftCount  = leftBoxes.filter(Boolean).length;
      const rightCount = rightBoxes.filter(Boolean).length;
      const total      = leftCount + rightCount;
      return {
        id: item.id,
        leftLabel:  (item.system?.leftLabel  ?? '').trim() || game.i18n.localize('GOODSOCIETY.upkeepWizard.step5.emptyLeftLabel'),
        rightLabel: (item.system?.rightLabel ?? '').trim() || game.i18n.localize('GOODSOCIETY.upkeepWizard.step5.emptyRightLabel'),
        // Each box carries its own {filled, index, side} so the
        // template loops render one <button> per box without indexing
        // boolean arrays in Handlebars.
        leftPips:  leftBoxes.map((filled, index)  => ({ filled, index, side: 'left'  })),
        rightPips: rightBoxes.map((filled, index) => ({ filled, index, side: 'right' })),
        leftCount, rightCount, total,
        // The completion rule (from reputation-rules.js): 6 total OR
        // 5 on either side. `atThreshold` is used purely for visual
        // affordance — the toggle handler still runs the authoritative
        // check post-mutation and auto-completes when it fires.
        atThreshold: total >= 6 || leftCount >= 5 || rightCount >= 5,
      };
    });
    const filledBoxes = conflictCards.reduce((s, c) => s + c.total, 0);
    const totalBoxes  = conflictCards.length * 10;

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
      hasConflict:      conflictCards.length > 0,
      conflictBoxes:    { filled: filledBoxes, total: totalBoxes },
    };

    return {
      ...ctx,
      themeId:   system.theme ?? 'npc',
      actorName: profileName(actor),
      eyebrow:   game.i18n.format('GOODSOCIETY.upkeepWizard.eyebrow', { n: cycleNum }),
      stepOf:    game.i18n.format('GOODSOCIETY.upkeepWizard.stepOf', { step: this._step }),
      currentStep: this._step,
      steps,
      nextLabel,
      showSkip:    this._step > 1 && this._step < 7,
      backDisabled: this._step === 1,
      nextDisabled: step2Blocked || step4Blocked,
      // Step 1 summary card
      resolveAtStart: { current: currentResolve, max: maxResolve },
      pendingChangesCount: pendingChanges.length,
      hasConflict: conflictCards.length > 0,
      conflictBoxes: { filled: filledBoxes, total: totalBoxes },
      // Step 5 — inner conflict maintenance (new; per user request).
      // Iterated in the template as click-toggle box grids.
      conflictCards,
      hasConflicts: conflictCards.length > 0,
      // Step 2
      defaultResolve,
      currentResolve,
      maxResolve,
      resolveState,
      monologueState,
      monologueName: profileName(actor),
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
    // Step 4 "keep" path — note desire action before advancing.
    if (this._step === 4 && !this._desireAction) this._desireAction = 'keep';
    // Step 6 acknowledge — mark rep changes acknowledged before advancing.
    // (was step 5 before "conflicts" was inserted at position 5.)
    if (this._step === 6) this._reputationAcknowledged = true;
    // Step 7 — complete upkeep. (was step 6.)
    if (this._step === 7) { await this._completeUpkeep(); return; }
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

  // ── Step 5 sub-actions ─────────────────────────────────────────────────────

  /**
   * Toggle a single box on an active inner conflict. Mirrors the
   * Major sheet's #toggleBox exactly (same import chain, same
   * completion rule) so the two surfaces can't drift apart on what
   * "filling that box" does. When the toggle pushes the conflict past
   * the threshold (6 total OR 5 on one side), the item is marked
   * completed, its id moves from `innerConflictsActiveIds` →
   * `innerConflictsCompletedIds`, and the ceremony chat card fires
   * once. Guarded against re-entry — the item's own `completed` flag
   * makes clicks on an already-resolved conflict a no-op.
   */
  static async #toggleConflictBox(_event, target) {
    const itemId = target?.dataset?.itemId;
    const side   = target?.dataset?.side;
    const index  = parseInt(target?.dataset?.index, 10);
    if (!itemId || !side || !Number.isFinite(index)) return;

    const item = this._actor.items?.get(itemId);
    if (!item || item.system?.completed) return;

    const sys = item.system;
    const leftBoxes  = [...(sys.leftBoxes  ?? [false, false, false, false, false])];
    const rightBoxes = [...(sys.rightBoxes ?? [false, false, false, false, false])];

    if (side === 'left')  leftBoxes[index]  = !leftBoxes[index];
    else                  rightBoxes[index] = !rightBoxes[index];

    const leftCount   = leftBoxes.filter(Boolean).length;
    const rightCount  = rightBoxes.filter(Boolean).length;
    const nowComplete = isConflictComplete(leftBoxes, rightBoxes);

    const update = { 'system.leftBoxes': leftBoxes, 'system.rightBoxes': rightBoxes };
    if (nowComplete) {
      update['system.completed']     = true;
      update['system.completedSide'] = leftCount >= 5 ? 'left' : rightCount >= 5 ? 'right' : null;
    }
    await item.update(update);

    if (nowComplete) {
      // Move id from active → completed on the actor. Same array
      // pattern the Major sheet uses; keeps the sheet's Active
      // / Completed sections in sync when the wizard closes.
      const activeIds    = (this._actor.system?.innerConflictsActiveIds    ?? []).filter(id => id !== itemId);
      const completedIds = [...(this._actor.system?.innerConflictsCompletedIds ?? []), itemId];
      await this._actor.update({
        'system.innerConflictsActiveIds':    activeIds,
        'system.innerConflictsCompletedIds': completedIds,
      });
      await postCompletionCard({
        actor:        this._actor,
        conflict:     item,
        resolvedSide: update['system.completedSide'],
      });
    }

    // Always re-render the wizard so the box grid + threshold flag
    // update in-place. The Foundry updateItem hook would eventually
    // trigger a render too, but an explicit render keeps the click →
    // visible feedback loop tight.
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
    if (!text) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.upkeepWizard.step4.desireEmptyWarning'));
      return;
    }

    const oldDesire = _stripHtml(this._actor.system.desire ?? '');
    // Capture the text up-front so a failed actor.update doesn't lose the
    // user's input — we re-render with the captured value so they can retry.
    this._newDesire = text;

    try {
      await this._actor.update({ 'system.desire': `<p>${text}</p>` });
    } catch (err) {
      // Most likely cause: the local user doesn't own the actor. Surface
      // a clear notification rather than failing silently — without this,
      // the wizard appeared to do nothing on Save.
      console.error('GS | desire save failed:', err);
      ui.notifications?.error(game.i18n.format('GOODSOCIETY.upkeepWizard.step4.desireSaveFailed', {
        error: err?.message || String(err),
      }));
      return;
    }
    this._desireAction    = 'change';
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
          name: profileName(this._actor),
          oldDesire,
          newDesire: text,
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
        content: game.i18n.format('GOODSOCIETY.upkeepWizard.step7.completionCard', {
          name: profileName(actor),
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
