/**
 * SessionGreetingApp — player-facing themed modal that renders the
 * GM-authored greeting. Read-only: title + sections (heading + body),
 * each body enriched via TextEditor.enrichHTML so @UUID references
 * become clickable links and \n preserves line breaks.
 *
 * Open paths:
 *   1. Auto-pop on world load (module/hooks/session-greeting-auto.js)
 *      when greeting.updatedAt > user.flags.greetingDismissedAt AND
 *      cyclePhase !== 'pre-cycle'.
 *   2. Manual reopen via the Cabinet → Player tools entry, which calls
 *      openSessionGreeting() ignoring the dismiss-mark.
 *   3. GM preview from the composer — opens with draft state instead
 *      of the saved value; no dismiss-write on close.
 *
 * The modal is house-styled (not character-themed). The GM is composing
 * for the whole table; binding it to one actor's theme would feel
 * arbitrary.
 */

import {
  getSessionGreeting,
  dismissSessionGreeting,
} from '../helpers/session-greeting.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const TEMPLATE = 'systems/good-society-homebrew/templates/apps/session-greeting.hbs';

let _instance = null;

export class SessionGreetingApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-session-greeting',
    classes: ['good-society', 'gs-session-greeting-app'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.sessionGreeting.title',
    },
    position: { width: 560, height: 'auto' },
    actions: {
      dismissGreeting: SessionGreetingApp.#dismissGreeting,
    },
  };

  static PARTS = {
    main: { template: TEMPLATE },
  };

  constructor(options = {}) {
    super(options);
    // When `previewState` is set (by openSessionGreetingPreview),
    // render that draft instead of the persisted greeting and skip the
    // dismiss-flag write on close. Otherwise pull from disk.
    this._previewState = options.previewState ?? null;
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const greeting = this._previewState ?? getSessionGreeting();

    // Enrich every section body so @UUID resolves and \n becomes <br>.
    // Resolves on both GM (links work) and player clients (links work
    // if the user has permission; otherwise the label text renders as
    // plain). Foundry's enrichHTML handles both modes.
    const TextEditor =
      foundry.applications.ux?.TextEditor?.implementation
      ?? globalThis.TextEditor;

    const sections = [];
    for (const s of greeting.sections ?? []) {
      const raw = (s.body ?? '').trim();
      let bodyHtml = '';
      if (raw) {
        // Normalize \n into <br> BEFORE enrichHTML — enrichHTML doesn't
        // touch line breaks, only document references and inline rolls.
        // We also wrap paragraphs (double-newline) into <p>…</p> so the
        // prose breathes.
        const paragraphs = raw
          .split(/\n\s*\n/)
          .map(p => p.trim())
          .filter(Boolean)
          .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
          .join('');
        try {
          bodyHtml = await TextEditor.enrichHTML(paragraphs, { async: true });
        } catch (err) {
          console.warn('GS | greeting enrichHTML failed:', err);
          bodyHtml = paragraphs;
        }
      }
      sections.push({
        id:      s.id,
        heading: (s.heading ?? '').trim(),
        bodyHtml,
        hasBody: !!bodyHtml,
        hasHeading: !!(s.heading ?? '').trim(),
      });
    }

    ctx.title = (greeting.title ?? '').trim();
    ctx.hasTitle = !!ctx.title;
    ctx.sections = sections;
    ctx.hasSections = sections.length > 0;
    // True when the greeting has ANY renderable content — title OR at
    // least one section. Template gates the "not published yet" empty
    // state on `!hasAnyContent`, so a title-only publish (which is
    // legitimate: the GM might just want a warm "Welcome back" splash
    // for tonight) renders as a proper greeting instead of falsely
    // reading as unpublished. Previously the empty state fired whenever
    // sections was empty, which contradicted the visible title.
    ctx.hasAnyContent = ctx.hasTitle || ctx.hasSections;
    ctx.isPreview = !!this._previewState;
    return ctx;
  }

  /** Manual dismiss — writes the per-user flag so auto-pop won't fire again. */
  static async #dismissGreeting() {
    // Skip the dismiss-write when this is a preview render (the GM
    // shouldn't accidentally mark the greeting "read" by previewing).
    if (!this._previewState) await dismissSessionGreeting();
    this.close();
  }

  /** Foundry's close — also fires the dismiss flag for non-preview opens. */
  async _onClose(options) {
    if (!this._previewState) {
      try { await dismissSessionGreeting(); } catch {}
    }
    return super._onClose?.(options);
  }
}

/**
 * Open the player greeting modal. By default reads from the saved
 * setting; pass `{ force: true }` to bypass the "already dismissed"
 * check (used by Cabinet → Reopen Greeting).
 */
export function openSessionGreeting({ force = false } = {}) {
  const greeting = getSessionGreeting();
  if (!force) {
    // Auto-open contract: only when there's actually content.
    if (!greeting.sections?.length && !(greeting.title ?? '').trim()) return null;
  }
  if (!_instance) _instance = new SessionGreetingApp();
  else _instance._previewState = null; // back to live mode on re-open
  _instance.render(true);
  return _instance;
}

/**
 * Open with a draft state from the composer's "Preview" button. GM-only
 * in practice; the composer is GM-only. Renders the draft without
 * writing the per-user dismiss flag on close.
 */
export function openSessionGreetingPreview(draftState) {
  // Create a fresh instance for previews so we don't disturb the live
  // singleton (the GM might be in mid-edit while previewing).
  const app = new SessionGreetingApp({ previewState: draftState });
  app.render(true);
  return app;
}
