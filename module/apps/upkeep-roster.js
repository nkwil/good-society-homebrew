/**
 * UpkeepRoster — GM view showing all Majors' Upkeep progress.
 * Per docs/design/11-upkeep-wizard.md §"GM Roster View".
 *
 * Opens automatically for the GM when cyclePhase becomes 'upkeep'.
 * Shows done / in-progress / waiting / offline status per Major.
 * "Advance to next cycle" button sets cyclePhase → pre-cycle and
 * increments cycleNumber.
 *
 * Public API: openUpkeepRoster() / getUpkeepRoster().
 */

import { openWizardActorIds, openUpkeepWizard } from './upkeep-wizard.js';
import { postSystemCard } from '../helpers/chat-cards.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 }              = foundry.applications.api;

const OWNER = () => CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;

/** Singleton roster instance. */
let _rosterInstance = null;

export function getUpkeepRoster() { return _rosterInstance; }

export class UpkeepRoster extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-upkeep-roster',
    classes: ['good-society', 'gs-upkeep-roster-app'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.upkeepRoster.windowTitle',
    },
    position: { width: 600, height: 'auto' },
    actions: {
      openWizard:    UpkeepRoster.#openWizard,
      advanceCycle:  UpkeepRoster.#advanceCycle,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/apps/upkeep-roster.hbs',
    },
  };

  /** @override */
  async _prepareContext(options) {
    const ctx     = await super._prepareContext(options);
    const cycleNum = _getSetting('cycleNumber', 1);
    const ownerLevel = OWNER();

    const majors = game.actors?.filter(a => a.type === 'major-character') ?? [];

    const rows = majors.map(actor => {
      // Find a non-GM user with OWNER permission on this actor
      const ownerEntry = Object.entries(actor.ownership ?? {}).find(([id, lvl]) => {
        if (id === 'default') return false;
        if (Number(lvl) < ownerLevel) return false;
        const u = game.users?.get(id);
        return u && !u.isGM;
      });
      const ownerUser = ownerEntry ? game.users.get(ownerEntry[0]) : null;

      const completedAt = actor.getFlag('good-society-homebrew', 'upkeepCompletedAt');
      const isInProgress = openWizardActorIds.has(actor.id);

      let status;
      if (completedAt)      status = 'done';
      else if (isInProgress) status = 'in-progress';
      else if (!ownerUser?.active) status = 'offline';
      else                  status = 'waiting';

      const completedTime = completedAt
        ? new Date(completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : null;

      return {
        actorId:      actor.id,
        name:         actor.system?.activePersona?.name || actor.name,
        themeId:      actor.system?.theme ?? 'npc',
        portraitUrl:  actor.system?.bio?.portraitUrl ?? actor.img ?? '',
        initial:      (actor.name?.[0] ?? '?').toUpperCase(),
        status,
        ownerName:    ownerUser?.name ?? '—',
        completedAt:  completedTime,
      };
    });

    const doneCount    = rows.filter(r => r.status === 'done').length;
    const pendingCount = rows.length - doneCount;

    return {
      ...ctx,
      eyebrow:      game.i18n.format('GOODSOCIETY.upkeepRoster.eyebrow', { n: cycleNum }),
      rows,
      doneCount,
      pendingCount,
      totalCount:   rows.length,
      canAdvance:   pendingCount === 0,
    };
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  static async #openWizard(ev, target) {
    const actorId = target.closest('[data-actor-id]')?.dataset.actorId;
    if (!actorId) return;
    const actor = game.actors.get(actorId);
    if (!actor) return;

    const confirmed = window.confirm(
      game.i18n.format('GOODSOCIETY.upkeepRoster.openWizardConfirm', { name: actor.name }),
    );
    if (!confirmed) return;

    // Open wizard for GM; re-render roster when it closes
    openUpkeepWizard(actor).then(() => { if (this.rendered) this.render(); });
  }

  static async #advanceCycle(ev, target) {
    const ctx = await this._prepareContext({});
    if (ctx.pendingCount > 0) {
      const confirmed = window.confirm(
        game.i18n.format('GOODSOCIETY.upkeepRoster.advanceConfirm', {
          pending: ctx.pendingCount,
        }),
      );
      if (!confirmed) return;
    }

    const cycleNum = _getSetting('cycleNumber', 1);
    const nextNum  = cycleNum + 1;

    try {
      // Clear upkeepCompletedAt flags so they're fresh for the next cycle
      const majors = game.actors?.filter(a => a.type === 'major-character') ?? [];
      for (const actor of majors) {
        await actor.unsetFlag('good-society-homebrew', 'upkeepCompletedAt');
      }

      await game.settings.set('good-society-homebrew', 'cycleNumber', nextNum);
      await game.settings.set('good-society-homebrew', 'cyclePhase', 'pre-cycle');

      await postSystemCard({
        content: game.i18n.format('GOODSOCIETY.upkeepRoster.cycleAdvanceCard', {
          n: cycleNum, next: nextNum,
        }),
        context: `cycle ${cycleNum}`,
      });
    } catch (err) {
      console.error('GS | cycle advance failed:', err);
      ui.notifications?.error('Cycle advance failed — see console.');
    }

    await this.close();
  }

  /** @override */
  async _onClose(options) {
    _rosterInstance = null;
    return super._onClose(options);
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Open (or focus) the GM Upkeep Roster. */
export function openUpkeepRoster() {
  if (_rosterInstance?.rendered) {
    _rosterInstance.bringToTop?.();
    return _rosterInstance;
  }
  _rosterInstance = new UpkeepRoster();
  _rosterInstance.render({ force: true });
  return _rosterInstance;
}

// ── Private helpers ────────────────────────────────────────────────────────

function _getSetting(key, fallback) {
  try { return game.settings.get('good-society-homebrew', key); }
  catch { return fallback; }
}
