/**
 * PhaseSummaryModal — GM-only preview modal shown before posting an
 * end-of-phase summary publicly. Lets the GM read the auto-generated
 * recap before everyone sees it; they can post, edit text inline, or
 * cancel (in which case nothing is posted and the phase still completes
 * silently).
 *
 * Generic — used by both the Reputation Phase Wizard and the Rumour
 * helper's finishPhase. Callers pass a title + pre-rendered HTML +
 * onPost callback. The modal renders the content in an editable
 * contenteditable surface so typos can be corrected before publish.
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 }              = foundry.applications.api;

let _activeOnPost = null;
let _activeOnCancel = null;

/**
 * Open the modal. Singleton — replaces any prior in-flight preview.
 *
 * @param {object} args
 * @param {string} args.title       Window title text (already localized).
 * @param {string} args.summaryHtml The summary content to preview (HTML).
 * @param {(finalHtml: string) => Promise<void>|void} args.onPost
 *   Called when the GM clicks "Post and continue". Receives the (possibly
 *   GM-edited) final HTML. The caller is responsible for posting it as a
 *   chat card and appending whatever session-events it needs.
 * @param {() => void|Promise<void>} [args.onCancel]
 *   Called when the GM dismisses without posting. Optional.
 */
export function openPhaseSummaryModal({ title, summaryHtml, onPost, onCancel }) {
  if (!game.user?.isGM) {
    // Non-GM clients should never see this — fall through to onPost so
    // the phase still completes if somehow invoked from a player path.
    if (typeof onPost === 'function') onPost(summaryHtml);
    return null;
  }
  _activeOnPost = onPost;
  _activeOnCancel = onCancel ?? null;

  const app = new PhaseSummaryModal({
    title,
    summaryHtml,
  });
  app.render({ force: true });
  return app;
}

export class PhaseSummaryModal extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-phase-summary-modal',
    classes: ['good-society', 'gs-phase-summary-modal'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.phaseSummary.modalTitle',
    },
    position: { width: 640, height: 'auto' },
    actions: {
      postSummary:   PhaseSummaryModal.#postSummary,
      cancelSummary: PhaseSummaryModal.#cancelSummary,
    },
  };

  static PARTS = {
    main: { template: 'systems/good-society-homebrew/templates/apps/phase-summary-modal.hbs' },
  };

  constructor(options = {}) {
    super({});
    this._title = options.title || '';
    this._summaryHtml = options.summaryHtml || '';
  }

  async _prepareContext(_options) {
    return {
      heading: this._title,
      intro:   game.i18n.localize('GOODSOCIETY.phaseSummary.intro'),
      summaryHtml: this._summaryHtml,
      editHint: game.i18n.localize('GOODSOCIETY.phaseSummary.editHint'),
      cancelLabel: game.i18n.localize('GOODSOCIETY.phaseSummary.cancel'),
      postLabel:   game.i18n.localize('GOODSOCIETY.phaseSummary.post'),
    };
  }

  /** Read whatever the GM has edited into the contenteditable surface. */
  _readEditedHtml() {
    const editor = this.element?.querySelector('.gs-phase-summary-modal__editor');
    return editor ? editor.innerHTML : this._summaryHtml;
  }

  static async #postSummary() {
    const finalHtml = this._readEditedHtml();
    const cb = _activeOnPost;
    _activeOnPost = null;
    _activeOnCancel = null;
    try {
      if (typeof cb === 'function') await cb(finalHtml);
    } catch (err) { console.warn('GS | phase-summary onPost failed:', err); }
    await this.close({ gsForce: true });
  }

  static async #cancelSummary() {
    const cb = _activeOnCancel;
    _activeOnPost = null;
    _activeOnCancel = null;
    try {
      if (typeof cb === 'function') await cb();
    } catch (err) { console.warn('GS | phase-summary onCancel failed:', err); }
    await this.close({ gsForce: true });
  }

  /** Closing without a button click (X / Esc) counts as cancel. */
  async close(options = {}) {
    if (!options.gsForce) {
      const cb = _activeOnCancel;
      _activeOnPost = null;
      _activeOnCancel = null;
      try {
        if (typeof cb === 'function') await cb();
      } catch { /* non-fatal */ }
    }
    return super.close(options);
  }
}
