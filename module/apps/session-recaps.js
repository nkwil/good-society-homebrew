/**
 * Session Recaps — the unified "look back" surface. One singleton app
 * that:
 *   • Lists every session's recap (newest first)
 *   • Shows each session's GM summary + every player's debrief note
 *   • Lets the GM edit title + summary inline via a DialogV2 textarea
 *   • Replaces three overlapping surfaces (Session Notes hub, Session
 *     Debrief Viewer, and most of what the Session Greeting composer
 *     was tangled up with) with one place.
 *
 * Reads from:
 *   - `sessionRecaps` world setting (GM-authored summaries per session)
 *   - every user's own `flags[NS].sessionDebriefNotes` (player debriefs)
 *   - `sessionNumber` world setting (to tag the current session)
 *
 * Writes to:
 *   - `sessionRecaps` world setting (via `saveRecap`), GM-only.
 */

import {
  getAllRecaps,
  getRecap,
  saveRecap,
  deleteRecap,
  gatherAllDebriefs,
  currentSessionNumber,
} from '../helpers/session-mechanism.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const TEMPLATE = 'systems/good-society-homebrew/templates/apps/session-recaps.hbs';

let _instance = null;

/** Open the Session Recaps viewer. GM gets edit affordances; players
 *  get a read-only view of the same data. */
export function openSessionRecaps({ focusSessionNumber } = {}) {
  if (!_instance) _instance = new SessionRecapsApp();
  _instance._focusSessionNumber = focusSessionNumber ?? null;
  _instance.render({ force: true });
  return _instance;
}

/** Public helper for integrations (e.g. the hook that auto-opens for
 *  the GM at End Session). */
export function refreshSessionRecaps() {
  if (_instance?.rendered) _instance.render();
}

export class SessionRecapsApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-session-recaps',
    classes: ['good-society', 'gs-session-recaps-app'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.sessionRecaps.windowTitle',
    },
    position: { width: 680, height: 'auto' },
    actions: {
      editTitle:    SessionRecapsApp.#editTitle,
      editSummary:  SessionRecapsApp.#editSummary,
      deleteRecap:  SessionRecapsApp.#deleteRecap,
      createRecap:  SessionRecapsApp.#createRecap,
    },
  };

  static PARTS = { main: { template: TEMPLATE } };

  _focusSessionNumber = null;

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const isGM = !!game.user?.isGM;
    const current = currentSessionNumber();
    const recaps = getAllRecaps();
    const debriefs = gatherAllDebriefs();

    // Build a merged set of session numbers from both sources so a
    // session without a recap but with player debriefs still appears
    // (and vice versa).
    const allNumbers = new Set([
      ...Object.keys(recaps).map(Number),
      ...Object.keys(debriefs).map(Number),
    ]);
    if (current) allNumbers.add(current);
    const sortedNumbers = [...allNumbers]
      .filter(n => Number.isFinite(n) && n > 0)
      .sort((a, b) => b - a);

    const TextEditor =
      foundry.applications.ux?.TextEditor?.implementation
      ?? globalThis.TextEditor;

    ctx.isGM = isGM;
    ctx.hasAny = sortedNumbers.length > 0;
    ctx.currentSession = current;
    ctx.sessions = await Promise.all(sortedNumbers.map(async n => {
      const r = recaps[String(n)] ?? null;
      const notes = (debriefs[String(n)] ?? []).slice().sort((a, b) => b.ts - a.ts);
      const title = (r?.title ?? '').trim();
      const rawSummary = (r?.summary ?? '').trim();
      let summaryHtml = '';
      if (rawSummary) {
        try { summaryHtml = await TextEditor.enrichHTML(rawSummary, { async: true }); }
        catch { summaryHtml = rawSummary; }
      }
      return {
        number: n,
        title,
        hasTitle: !!title,
        summaryHtml,
        hasSummary: !!summaryHtml,
        isCurrent: n === current,
        updatedLabel: r?.updatedAt ? new Date(r.updatedAt).toLocaleString() : '',
        notes: notes.map(note => ({
          userId: note.userId,
          userName: note.userName,
          text: note.text,
          dateLabel: new Date(note.ts).toLocaleString(),
        })),
        noteCount: notes.length,
        isFocused: this._focusSessionNumber && n === this._focusSessionNumber,
      };
    }));
    return ctx;
  }

  async _onRender(context, options) {
    super._onRender(context, options);
    // Scroll to the focused session (if any) after render so a GM
    // opening the viewer right after End Session lands on the stub.
    if (this._focusSessionNumber) {
      const target = this.element?.querySelector(
        `[data-session-number="${this._focusSessionNumber}"]`,
      );
      target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      this._focusSessionNumber = null;
    }
  }

  // ── GM actions ────────────────────────────────────────────────────────────

  static async #editTitle(_ev, target) {
    if (!game.user?.isGM) return;
    const n = Number(target?.dataset?.sessionNumber);
    if (!n) return;
    const current = getRecap(n)?.title ?? '';
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.format(
        'GOODSOCIETY.sessionRecaps.editTitleWindow', { n },
      )},
      content: `
        <div class="gs-form-row">
          <label>${game.i18n.localize('GOODSOCIETY.sessionRecaps.titleLabel')}</label>
          <input type="text" name="title" value="${foundry.utils.escapeHTML(current)}" maxlength="120" />
        </div>
      `,
      ok: {
        label: game.i18n.localize('GOODSOCIETY.sessionRecaps.save'),
        callback: (_event, button, dialog) => {
          const form = dialog.element?.querySelector('form, .window-content') ?? dialog.element;
          return form?.querySelector('input[name="title"]')?.value ?? '';
        },
      },
      rejectClose: false,
    });
    if (result === null || result === undefined) return;
    await saveRecap({ sessionNumber: n, title: result.trim() });
    this.render();
  }

  static async #editSummary(_ev, target) {
    if (!game.user?.isGM) return;
    const n = Number(target?.dataset?.sessionNumber);
    if (!n) return;
    const current = getRecap(n)?.summary ?? '';
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.format(
        'GOODSOCIETY.sessionRecaps.editSummaryWindow', { n },
      )},
      content: `
        <div class="gs-form-row gs-form-row--stacked">
          <label>${game.i18n.localize('GOODSOCIETY.sessionRecaps.summaryLabel')}</label>
          <textarea name="summary" rows="12"
                    placeholder="${game.i18n.localize('GOODSOCIETY.sessionRecaps.summaryPlaceholder')}"
          >${foundry.utils.escapeHTML(current)}</textarea>
        </div>
      `,
      ok: {
        label: game.i18n.localize('GOODSOCIETY.sessionRecaps.save'),
        callback: (_event, button, dialog) => {
          const form = dialog.element?.querySelector('form, .window-content') ?? dialog.element;
          return form?.querySelector('textarea[name="summary"]')?.value ?? '';
        },
      },
      rejectClose: false,
    });
    if (result === null || result === undefined) return;
    await saveRecap({ sessionNumber: n, summary: result });
    this.render();
  }

  static async #deleteRecap(_ev, target) {
    if (!game.user?.isGM) return;
    const n = Number(target?.dataset?.sessionNumber);
    if (!n) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.format(
        'GOODSOCIETY.sessionRecaps.deleteWindow', { n },
      )},
      content: `<p>${game.i18n.format('GOODSOCIETY.sessionRecaps.deleteConfirm', { n })}</p>`,
      rejectClose: false,
    });
    if (!confirmed) return;
    await deleteRecap(n);
    this.render();
  }

  static async #createRecap() {
    if (!game.user?.isGM) return;
    const current = currentSessionNumber();
    if (!current) {
      ui.notifications?.warn(
        game.i18n.localize('GOODSOCIETY.sessionRecaps.noCurrentSession'),
      );
      return;
    }
    await saveRecap({ sessionNumber: current, title: '', summary: '' });
    this._focusSessionNumber = current;
    this.render();
  }
}

/** Register the hook that keeps an open Recaps viewer in sync with
 *  player debrief saves and recap setting changes. */
export function registerSessionRecapsHooks() {
  Hooks.on('updateUser', (user, diff) => {
    if (!_instance?.rendered) return;
    if (foundry.utils.hasProperty(diff, 'flags.good-society-homebrew.sessionDebriefNotes')) {
      _instance.render();
    }
  });
}
