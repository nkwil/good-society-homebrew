/**
 * PublicInfoDashboard — communal surface showing every Major character at a glance.
 *
 * Per docs/design/07-public-info-dashboard.md.
 *
 * Implementation notes:
 *   - Framed ApplicationV2 (window.frame defaults to true). Full Foundry chrome.
 *   - Singleton — only one instance exists; actor update hooks call render() on it.
 *   - Full re-render on updateActor/createActor/deleteActor (incremental row update
 *     is a v1 optimization — full render is fast enough for ≤20 rows).
 *   - Footer "last updated Ns ago" counter runs via setInterval on the live DOM;
 *     does NOT trigger a full re-render.
 *   - GM bulk actions use window.confirm() for v0 (reliable, no DialogV2 API guessing).
 *   - All bulk actions post a system ChatMessage so non-GM players see changes.
 */

import { buildDashboardContext } from '../helpers/dashboard-context.js';
import { advanceCyclePhase } from '../helpers/cycle-advance.js';
import { openRevealControl } from './reveal-control.js';
import { openBulkPermissionsPanel } from './bulk-permissions-panel.js';
import { openEventTimeline } from './event-timeline.js';
import { openRumourBoard } from './rumour-board.js';
import { postSystemCard } from '../helpers/chat-cards.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;
const NS = 'good-society-homebrew';

export class PublicInfoDashboard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-public-info-dashboard',
    classes: ['good-society', 'gs-public-info-dashboard'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.dashboard.windowTitle',
    },
    position: { width: 720, height: 'auto' },
    actions: {
      'refresh-resolve':  PublicInfoDashboard.#refreshResolve,
      'clear-monologues': PublicInfoDashboard.#clearMonologues,
      'reveal-desires':   PublicInfoDashboard.#revealDesires,
      'advance-phase':    PublicInfoDashboard.#advancePhase,
      'open-rumour':      PublicInfoDashboard.#openRumour,
      'open-permissions': PublicInfoDashboard.#openPermissions,
      'open-calendar':    PublicInfoDashboard.#openCalendar,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/apps/dashboard.hbs',
      templates: [
        'systems/good-society-homebrew/templates/components/dashboard-major-row.hbs',
      ],
    },
  };

  /** @override */
  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    Object.assign(ctx, buildDashboardContext());
    return ctx;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender?.(context, options);
    this._wireRowClicks();
    this._startFooterTimer();
  }

  /** @override */
  async _onClose(options) {
    await super._onClose?.(options);
    this._stopFooterTimer();
    _instance = null;
  }

  // ── Row interaction ─────────────────────────────────────────────────────────

  /** Click a row → open the Major's sheet. Click the desire cell → Reveal Control (GM only). */
  _wireRowClicks() {
    const root = this.element;
    if (!root || root._gsDashRowBound) return;
    root._gsDashRowBound = true;

    root.addEventListener('click', (ev) => {
      const desireEl = ev.target.closest('.gs-dashboard__row-desire');
      if (desireEl) {
        if (game.user?.isGM) {
          const row = desireEl.closest('[data-actor-id]');
          const actor = row ? game.actors?.get(row.dataset.actorId) : null;
          if (actor) openRevealControl(actor, 'desire', desireEl);
        }
        return;
      }
      const row = ev.target.closest('[data-actor-id]');
      if (!row) return;
      const actor = game.actors?.get(row.dataset.actorId);
      if (actor) actor.sheet?.render(true);
    });
  }

  // ── Footer timer ─────────────────────────────────────────────────────────────

  _lastUpdated = Date.now();
  _timerInterval = null;

  _startFooterTimer() {
    this._lastUpdated = Date.now();
    this._stopFooterTimer();
    this._timerInterval = setInterval(() => this._tickFooterTimer(), 1000);
  }

  _stopFooterTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
  }

  _tickFooterTimer() {
    const el = this.element?.querySelector('.gs-dashboard__footer-time');
    if (!el) return;
    const secs = Math.round((Date.now() - this._lastUpdated) / 1000);
    el.textContent = game.i18n.format('GOODSOCIETY.dashboard.lastUpdated', { n: secs });
  }

  /** Called by the actor update/create/delete hooks to reset the freshness counter. */
  refreshAndReset() {
    this._lastUpdated = Date.now();
    this.render({ force: true });
  }

  // ── GM bulk actions ──────────────────────────────────────────────────────────

  static async #refreshResolve(ev, target) {
    const defaultStart = (() => {
      try { return game.settings.get(NS, 'defaultStartingResolve'); }
      catch { return 3; }
    })();
    const confirmed = window.confirm(
      game.i18n.format('GOODSOCIETY.dashboard.bulk.refreshResolveConfirm', { n: defaultStart })
    );
    if (!confirmed) return;

    const majors = game.actors.filter(a => a.type === 'major-character');
    for (const actor of majors) {
      await actor.update({ 'system.tokens.resolve.current': defaultStart });
    }
    _postSystemCard(game.i18n.format(
      'GOODSOCIETY.dashboard.bulk.refreshResolvePosted',
      { n: defaultStart, count: majors.length }
    ));
    _instance?.refreshAndReset?.();
  }

  static async #clearMonologues(ev, target) {
    const confirmed = window.confirm(
      game.i18n.localize('GOODSOCIETY.dashboard.bulk.clearMonologuesConfirm')
    );
    if (!confirmed) return;

    const majors = game.actors.filter(a => a.type === 'major-character');
    for (const actor of majors) {
      await actor.update({ 'system.tokens.monologuedThisCycle': false });
    }
    _postSystemCard(game.i18n.format(
      'GOODSOCIETY.dashboard.bulk.clearMonologuesPosted',
      { count: majors.length }
    ));
    _instance?.refreshAndReset?.();
  }

  static async #revealDesires(ev, target) {
    const majors = game.actors.filter(a => a.type === 'major-character');
    const allPublic = majors.every(a => a.system.visibility?.desire === 'public');
    const newVis = allPublic ? 'secret' : 'public';
    const confirmKey = allPublic
      ? 'GOODSOCIETY.dashboard.bulk.hideDesireConfirm'
      : 'GOODSOCIETY.dashboard.bulk.revealDesireConfirm';
    const confirmed = window.confirm(game.i18n.localize(confirmKey));
    if (!confirmed) return;

    for (const actor of majors) {
      await actor.update({ 'system.visibility.desire': newVis });
    }
    const postedKey = allPublic
      ? 'GOODSOCIETY.dashboard.bulk.hideDesirePosted'
      : 'GOODSOCIETY.dashboard.bulk.revealDesirePosted';
    _postSystemCard(game.i18n.localize(postedKey));
    _instance?.refreshAndReset?.();
  }

  static async #advancePhase(ev, target) {
    // Delegates to the shared cycle-advance helper so position math, final-
    // cycle skips, end-of-game state, and chat card emission all live in one
    // place. The helper handles its own confirm dialog.
    await advanceCyclePhase();
    _instance?.refreshAndReset?.();
  }

  static #openRumour(ev, target) {
    openRumourBoard();
  }

  static #openPermissions() {
    openBulkPermissionsPanel();
  }

  static #openCalendar() {
    openEventTimeline();
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Post a system-styled chat card for GM bulk action feedback.
 *  Routes through postSystemCard so the cardType flag is set — without it,
 *  the speaking-as preCreateChatMessage hook would clobber the speaker. */
async function _postSystemCard(content) {
  await postSystemCard({ content, context: 'dashboard' });
}

// ── Singleton ───────────────────────────────────────────────────────────────

let _instance = null;

export function getDashboard() {
  if (!_instance) _instance = new PublicInfoDashboard();
  return _instance;
}

export function openDashboard() {
  getDashboard().render({ force: true });
}
