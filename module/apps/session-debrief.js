/**
 * Session Debrief modal — opens for each non-GM player when the GM ends
 * a session. One textarea; a single Submit button. House-styled.
 *
 * The note writes to the user's own flags via saveMyDebriefNote so no
 * cross-client coordination is needed. The GM aggregates via the
 * Session Debrief Viewer app.
 *
 * Pattern: ApplicationV2 singleton — only one debrief modal per client
 * at a time. If the GM ends two sessions in quick succession, the second
 * call just updates the open modal's session number.
 */

import { saveMyDebriefNote, getMyDebriefNote } from '../helpers/session-mechanism.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const TEMPLATE = 'systems/good-society-homebrew/templates/apps/session-debrief.hbs';

let _instance = null;

export function openSessionDebrief({ sessionNumber } = {}) {
  if (!sessionNumber) return null;
  if (!_instance) _instance = new SessionDebriefApp();
  _instance._sessionNumber = sessionNumber;
  _instance.render({ force: true });
  return _instance;
}

export class SessionDebriefApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-session-debrief',
    classes: ['good-society', 'gs-session-debrief-app'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.sessionDebrief.windowTitle',
    },
    position: { width: 520, height: 'auto' },
    actions: {
      submitNote:  SessionDebriefApp.#submitNote,
      skipDebrief: SessionDebriefApp.#skipDebrief,
    },
  };

  static PARTS = { main: { template: TEMPLATE } };

  _sessionNumber = 0;

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const existing = getMyDebriefNote(this._sessionNumber);
    ctx.sessionNumber = this._sessionNumber;
    ctx.existingText = existing?.text ?? '';
    ctx.alreadySubmitted = !!existing?.text;
    return ctx;
  }

  static async #submitNote(_ev, _target) {
    const textarea = this.element?.querySelector('textarea[name="debriefText"]');
    const text = (textarea?.value ?? '').trim();
    if (!text) {
      ui.notifications?.warn(
        game.i18n.localize('GOODSOCIETY.sessionDebrief.emptyWarn'),
      );
      return;
    }
    await saveMyDebriefNote({
      sessionNumber: this._sessionNumber,
      text,
    });
    ui.notifications?.info(
      game.i18n.localize('GOODSOCIETY.sessionDebrief.saved'),
    );
    this.close();
  }

  static async #skipDebrief() {
    // No save — just close. Player can revisit the modal from the
    // Cabinet "Debrief" entry if they change their mind, which reads
    // the current session number from the world setting.
    this.close();
  }
}
