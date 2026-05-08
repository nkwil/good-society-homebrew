/**
 * RumourWizard — player-driven Rumour & Scandal phase wizard.
 * Per docs/design/32-rumour-wizard.md (B-12).
 *
 * Singleton ApplicationV2 opened on every client when phase advances to
 * 'rumour-scandal'. Mode depends on phase state + current user:
 *
 *   GM, phase=idle           → setup view (turn-order picker + Begin button)
 *   Anyone, phase=active,
 *     it's your turn         → active turn (create or spread, then submit)
 *     it's not your turn     → spectator (read-only "waiting on …")
 *   GM, phase=fadeout        → fadeout review (run fadeout + complete)
 *
 * Player actions go through requestCreateRumour / requestSpreadRumour, which
 * emit over the system socket if non-GM. The GM client handles the write.
 */

import {
  getRumours,
  groupRumours,
  getPhaseState,
  isCurrentTurnUser,
  currentTurnUser,
  requestCreateRumour,
  requestSpreadRumour,
  startPhase,
  advanceTurnGM,
  finishPhase,
} from '../helpers/rumours.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 }              = foundry.applications.api;

const NS = 'good-society-homebrew';

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance = null;

export function openRumourWizard() {
  if (!_instance) _instance = new RumourWizard();
  _instance.render({ force: true });
  return _instance;
}

export function refreshRumourWizard() {
  if (_instance?.rendered) _instance.render();
}

export class RumourWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-rumour-wizard',
    classes: ['good-society', 'gs-rumour-wizard-app'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.rumourWizard.windowTitle',
    },
    position: { width: 620, height: 'auto' },
    actions: {
      toggleTurnUser:  RumourWizard.#toggleTurnUser,
      moveUserUp:      RumourWizard.#moveUserUp,
      moveUserDown:    RumourWizard.#moveUserDown,
      beginPhase:      RumourWizard.#beginPhase,
      submitCreate:    RumourWizard.#submitCreate,
      submitSpread:    RumourWizard.#submitSpread,
      gmAdvance:       RumourWizard.#gmAdvance,
      runFadeout:      RumourWizard.#runFadeout,
    },
  };

  static PARTS = {
    main: { template: 'systems/good-society-homebrew/templates/apps/rumour-wizard.hbs' },
  };

  constructor(options = {}) {
    super(options);
    // Setup-step turn-order draft: GM toggles users on/off and reorders them
    // before clicking Begin. Initialized lazily in _prepareContext from
    // active non-GM users, but the GM may have GM-as-player too.
    this._setupOrder = null;          // [userId, ...] | null until first render
    this._setupExcluded = new Set();  // userIds the GM has unchecked
  }

  /** @override */
  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const isGM = game.user?.isGM ?? false;
    const ps = getPhaseState();
    const { active, archived } = groupRumours();

    // Build candidate user list for the setup step (round=0 / phase=idle).
    // Includes all active users by default; the GM can de-select via the
    // setup checkboxes. GMs may include themselves if they own a Major.
    const allUsers = (game.users?.contents ?? []).filter(u => u.active);
    if (this._setupOrder == null) {
      this._setupOrder = allUsers.map(u => u.id);
    }
    // Drop users who are no longer active (logged out)
    this._setupOrder = this._setupOrder.filter(id => allUsers.find(u => u.id === id));
    // Add new connections at the end
    for (const u of allUsers) {
      if (!this._setupOrder.includes(u.id)) this._setupOrder.push(u.id);
    }

    const setupRows = this._setupOrder.map((id, idx) => {
      const u = game.users?.get(id);
      return {
        id,
        name: u?.name ?? '?',
        isGM: !!u?.isGM,
        included: !this._setupExcluded.has(id),
        canMoveUp:   idx > 0,
        canMoveDown: idx < this._setupOrder.length - 1,
      };
    });

    const turnUserId = ps.turnOrder?.[ps.currentIdx] ?? '';
    const turnUserName = game.users?.get(turnUserId)?.name ?? '';
    const myTurn = ps.phase === 'active' && turnUserId === game.user?.id;

    // Spreadable rumours = unspread or fading (rulebook: fading rumours can be
    // spread again to save them).
    const spreadable = active.filter(r => r.state === 'unspread' || r.state === 'fading');

    return {
      ...ctx,
      isGM,
      phase: ps.phase,
      round: ps.round,
      // setup
      isSetup:    ps.phase === 'idle',
      setupRows,
      canBegin:   isGM && setupRows.filter(r => r.included).length > 0,
      // active
      isActive:   ps.phase === 'active',
      myTurn,
      turnUserName,
      turnUserId,
      roundLabel: ps.round === 1
        ? game.i18n.localize('GOODSOCIETY.rumourWizard.round1')
        : ps.round === 2
          ? game.i18n.localize('GOODSOCIETY.rumourWizard.round2')
          : '',
      // fadeout
      isFadeout:  ps.phase === 'fadeout',
      // shared
      activeRumours: active.map(_decorate),
      archivedCount: archived.length,
      spreadable:    spreadable.map(_decorate),
      hasSpreadable: spreadable.length > 0,
    };
  }

  // ── Hook attach for cross-client re-render on phase state changes ──────

  /** @override */
  _onRender(context, options) {
    super._onRender?.(context, options);
    this._attachWatchers();
  }

  /** @override */
  async _onClose(options) {
    this._detachWatchers();
    _instance = null;
    return super._onClose?.(options);
  }

  _attachWatchers() {
    if (this._watchers) return;
    // The setting onChange callbacks already trigger refreshRumourWizard().
    // We additionally listen for goodSociety.cyclePhaseChanged in case the GM
    // advances out of rumour-scandal — close cleanly then.
    const phaseHook = Hooks.on('goodSociety.cyclePhaseChanged', ({ newPhase }) => {
      if (newPhase !== 'rumour-scandal') this.close();
    });
    this._watchers = [phaseHook];
  }

  _detachWatchers() {
    if (!this._watchers) return;
    Hooks.off('goodSociety.cyclePhaseChanged', this._watchers[0]);
    this._watchers = null;
  }

  // ── Setup step ─────────────────────────────────────────────────────────

  static async #toggleTurnUser(ev, target) {
    if (!game.user?.isGM) return;
    const id = target.dataset.userId;
    if (!id) return;
    if (this._setupExcluded.has(id)) this._setupExcluded.delete(id);
    else this._setupExcluded.add(id);
    this.render();
  }

  static async #moveUserUp(ev, target) {
    if (!game.user?.isGM) return;
    const id = target.dataset.userId;
    const idx = this._setupOrder.indexOf(id);
    if (idx <= 0) return;
    [this._setupOrder[idx - 1], this._setupOrder[idx]] = [this._setupOrder[idx], this._setupOrder[idx - 1]];
    this.render();
  }

  static async #moveUserDown(ev, target) {
    if (!game.user?.isGM) return;
    const id = target.dataset.userId;
    const idx = this._setupOrder.indexOf(id);
    if (idx === -1 || idx >= this._setupOrder.length - 1) return;
    [this._setupOrder[idx], this._setupOrder[idx + 1]] = [this._setupOrder[idx + 1], this._setupOrder[idx]];
    this.render();
  }

  static async #beginPhase() {
    if (!game.user?.isGM) return;
    const order = this._setupOrder.filter(id => !this._setupExcluded.has(id));
    if (order.length === 0) return;
    await startPhase(order);
  }

  // ── Active step (the user with the current turn) ──────────────────────

  static async #submitCreate() {
    if (!isCurrentTurnUser()) return;
    const ta = this.element?.querySelector('[data-rw-field="newRumour"]');
    const text = (ta?.value ?? '').trim();
    if (!text) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.rumourWizard.errorEmptyText'));
      return;
    }
    await requestCreateRumour({ text, advanceTurn: true });
    if (ta) ta.value = '';
  }

  static async #submitSpread(ev, target) {
    if (!isCurrentTurnUser()) return;
    const rumourId = target.dataset.rumourId;
    if (!rumourId) return;
    await requestSpreadRumour({ rumourId, advanceTurn: true });
  }

  // ── GM admin during active phase (skip a turn, advance forcibly) ──────

  static async #gmAdvance() {
    if (!game.user?.isGM) return;
    const ok = window.confirm(game.i18n.localize('GOODSOCIETY.rumourWizard.skipTurnConfirm'));
    if (!ok) return;
    await advanceTurnGM();
  }

  // ── Fadeout step (GM-only) ────────────────────────────────────────────

  static async #runFadeout() {
    if (!game.user?.isGM) return;
    await finishPhase();
    await this.close();
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _decorate(r) {
  const stateKey = ({
    'unspread': 'unspread',
    'spread':   'spread',
    'fading':   'fading',
    'faded':    'faded',
    'used':     'used',
  })[r.state] ?? 'unspread';
  return {
    ...r,
    stateLabel: game.i18n.localize(`GOODSOCIETY.rumourWizard.state.${stateKey}`),
  };
}
