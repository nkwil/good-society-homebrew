/**
 * Session Log Preview — GM-only modal opened by "End Session" scene control.
 *
 * Shows the auto-generated session log (phase changes, monologues, reputation
 * events) grouped by category, lets the GM edit before saving, and creates a
 * dated JournalEntry under "Session Logs / {year} / Session {N}."
 *
 * Per docs/design/24-session-log.md.
 */

import { getSessionEvents, clearSessionEvents } from '../hooks/session-events.js';
import { generateSessionLog, generateSessionLogHTML } from '../helpers/session-log-generator.js';
import { postSystemCard } from '../helpers/chat-cards.js';
import { sessionLogFolder, entryFlags } from '../helpers/journal-folders.js';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

let _instance = null;

export function openSessionLogPreview() {
  if (_instance?.rendered) {
    _instance.bringToTop?.();
    return;
  }
  _instance = new SessionLogPreview();
  _instance.render({ force: true });
}

export class SessionLogPreview extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-session-log-preview',
    classes: ['gs-session-log-preview-app'],
    position: { width: 580, height: 'auto' },
    window: {
      title: 'GOODSOCIETY.sessionLog.windowTitle',
      frame: true,
      positioned: true,
    },
    actions: {
      editMode:    SessionLogPreview.#doEditMode,
      previewMode: SessionLogPreview.#doPreviewMode,
      saveLog:     SessionLogPreview.#doSaveLog,
      cancel:      SessionLogPreview.#doCancel,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/apps/session-log-preview.hbs',
    },
  };

  /** @type {ReturnType<generateSessionLog>|null} */
  #log = null;
  #editMode = false;
  #editedContent = null;

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);

    const events = getSessionEvents();
    const cycleNumber = (() => {
      try { return game.settings.get('good-society-homebrew', 'cycleNumber'); }
      catch { return 1; }
    })();

    // Count existing Session Logs to compute the next session number.
    const sessionNumber = (() => {
      const logFolders = game.folders?.filter(
        f => f.type === 'JournalEntry' && f.name === 'Session Logs',
      ) ?? [];
      const total = logFolders.reduce((n, f) => {
        return n + (game.journal?.filter(
          j => j.folder?.id === f.id || j.folder?.folder?.id === f.id,
        ).length ?? 0);
      }, 0);
      return total + 1;
    })();

    this.#log = generateSessionLog(events, { sessionNumber, cycleNumber });
    const year = new Date().getFullYear();

    ctx.log          = this.#log;
    ctx.editMode     = this.#editMode;
    ctx.editedContent = this.#editedContent ?? generateSessionLogHTML(this.#log);
    ctx.isEmpty      = this.#log.isEmpty;
    ctx.sessionTitle = `Session ${sessionNumber} · ${this.#log.header.date}`;
    ctx.metaLine     = `Cycle ${cycleNumber} · ${events.length} event${events.length !== 1 ? 's' : ''} captured`;
    ctx.destination  = `Session Logs / ${year} / Session ${sessionNumber}`;

    return ctx;
  }

  static #doEditMode(ev, target) {
    // Capture textarea value if re-entering from preview
    const ta = this.element?.querySelector('.gs-session-log-preview__editor');
    if (ta) this.#editedContent = ta.value;
    this.#editMode = true;
    this.render({ parts: ['main'] });
  }

  static #doPreviewMode(ev, target) {
    const ta = this.element?.querySelector('.gs-session-log-preview__editor');
    if (ta) this.#editedContent = ta.value;
    this.#editMode = false;
    this.render({ parts: ['main'] });
  }

  static async #doSaveLog(ev, target) {
    target.disabled = true;
    try {
      // Prefer textarea content (if user edited); fall back to generated HTML.
      let content = this.#editedContent;
      if (this.#editMode) {
        const ta = this.element?.querySelector('.gs-session-log-preview__editor');
        if (ta) content = ta.value;
      }
      content ??= generateSessionLogHTML(this.#log);

      const { sessionNumber, date } = this.#log.header;
      const year = new Date().getFullYear();
      const title = `Session ${sessionNumber} — ${date}`;

      // Folder + flag via the centralized helper (post-MVP §13.1).
      const folder = await sessionLogFolder(year);

      let cycleNumberAtSave = null;
      try { cycleNumberAtSave = game.settings.get('good-society-homebrew', 'cycleNumber'); } catch { /* not yet registered */ }

      await JournalEntry.create({
        name: title,
        ...(folder ? { folder: folder.id } : {}),
        flags: entryFlags({
          entryType: 'sessionLog',
          cycleNumber: cycleNumberAtSave,
        }),
        pages: [{
          name: title,
          type: 'text',
          text: {
            content: `<div class="gs-session-log-body">${content}</div>`,
            format: CONST.JOURNAL_ENTRY_PAGE_FORMATS?.HTML ?? 1,
          },
        }],
        ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2 },
      });

      await clearSessionEvents();

      // System chat card so all players see the log was saved.
      await postSystemCard({
        content: game.i18n.format('GOODSOCIETY.sessionLog.savedNotification', { title }),
      });

      this.close();
    } catch (err) {
      console.error('[Good Society] Session log save failed:', err);
      ui.notifications?.error('Session log save failed — see console for details.');
      target.disabled = false;
    }
  }

  static #doCancel() {
    this.close();
  }

  _onClose(options) {
    super._onClose(options);
    _instance = null;
  }
}
