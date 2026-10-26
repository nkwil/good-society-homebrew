/**
 * Session Debrief Viewer — GM-only. Walks every connected user's flags
 * via `gatherAllDebriefs` and groups the notes by session number so the
 * GM can scan what each player said about each session.
 *
 * Pattern: singleton ApplicationV2. Re-renders on `updateUser` so a new
 * player note shows up immediately after submission.
 */

import { gatherAllDebriefs, currentSessionNumber } from '../helpers/session-mechanism.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const TEMPLATE = 'systems/good-society-homebrew/templates/apps/session-debrief-viewer.hbs';
const NS = 'good-society-homebrew';

let _instance = null;

export function openSessionDebriefViewer() {
  if (!game.user?.isGM) {
    ui.notifications?.warn(
      game.i18n.localize('GOODSOCIETY.sessionDebriefViewer.gmOnly'),
    );
    return null;
  }
  if (!_instance) _instance = new SessionDebriefViewerApp();
  _instance.render({ force: true });
  return _instance;
}

export class SessionDebriefViewerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-session-debrief-viewer',
    classes: ['good-society', 'gs-session-debrief-viewer'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.sessionDebriefViewer.windowTitle',
    },
    position: { width: 640, height: 'auto' },
  };

  static PARTS = { main: { template: TEMPLATE } };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const groups = gatherAllDebriefs();
    // Sort sessions descending (newest first — the GM usually wants the
    // most recent one).
    const sessionNumbers = Object.keys(groups)
      .map(n => Number(n))
      .filter(n => Number.isFinite(n))
      .sort((a, b) => b - a);

    ctx.currentSession = currentSessionNumber();
    ctx.sessions = sessionNumbers.map(n => {
      const notes = (groups[String(n)] ?? []).slice().sort((a, b) => b.ts - a.ts);
      return {
        number: n,
        isCurrent: n === ctx.currentSession,
        notes: notes.map(note => ({
          userId: note.userId,
          userName: note.userName,
          text: note.text,
          dateLabel: new Date(note.ts).toLocaleString(),
        })),
        noteCount: notes.length,
      };
    });
    ctx.hasAny = ctx.sessions.length > 0;
    return ctx;
  }
}

/** Register the hook that keeps an open viewer live when players save
 *  their debrief notes. */
export function registerSessionDebriefHooks() {
  Hooks.on('updateUser', (user, diff) => {
    if (!_instance?.rendered) return;
    // Only re-render when the diff touches our debrief flags.
    if (foundry.utils.hasProperty(diff, `flags.${NS}.sessionDebriefNotes`)) {
      _instance.render();
    }
  });
}
