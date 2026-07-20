/**
 * SessionGreetingComposer — GM authoring UI for the player-facing
 * "welcome back" greeting. Highly custom: title + an arbitrary list of
 * `{heading, body}` sections the GM adds / reorders / deletes.
 *
 * State lives in the world setting `sessionGreeting` (see
 * helpers/session-greeting.js). "Save draft" writes silently (bumps
 * `updatedAt` per the helper's contract, so technically also re-arms
 * the auto-pop — kept simple by design; the GM toggles open the
 * composer when they want to author, presses Save when done, and the
 * next world load shows it to players).
 *
 * Quick action: "Insert latest session note" — pulls the most recent
 * `entryType: 'sessionNote'` JournalEntry into a new section, with the
 * note's first text-page content as the body and a localized recap
 * heading. Lets the GM compose a recap → publish flow in a few clicks.
 */

import {
  getSessionGreeting,
  saveDraftGreeting,
  publishSessionGreeting,
  unpublishSessionGreeting,
  blankSection,
} from '../helpers/session-greeting.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const FLAG_SCOPE = 'good-society-homebrew';
const TEMPLATE = 'systems/good-society-homebrew/templates/apps/session-greeting-composer.hbs';

let _instance = null;

export class SessionGreetingComposer extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-session-greeting-composer',
    classes: ['good-society', 'gs-session-greeting-composer'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.sessionGreeting.composerTitle',
    },
    position: { width: 600, height: 'auto' },
    actions: {
      addSection:        SessionGreetingComposer.#addSection,
      removeSection:     SessionGreetingComposer.#removeSection,
      moveSectionUp:     SessionGreetingComposer.#moveSectionUp,
      moveSectionDown:   SessionGreetingComposer.#moveSectionDown,
      insertLastNote:    SessionGreetingComposer.#insertLastNote,
      saveDraft:         SessionGreetingComposer.#saveDraft,
      publishGreeting:   SessionGreetingComposer.#publishGreeting,
      unpublishGreeting: SessionGreetingComposer.#unpublishGreeting,
      previewGreeting:   SessionGreetingComposer.#previewGreeting,
    },
  };

  static PARTS = {
    main: { template: TEMPLATE },
  };

  constructor(options = {}) {
    super(options);
    // Local working state — deep-cloned from the stored greeting on each
    // open so inline edits don't leak before Save/Publish.
    this._state = _cloneState(getSessionGreeting());
  }

  async _prepareContext(options) {
    // Sync from form before any action handler re-renders; the textareas
    // hold the latest text and we shouldn't lose it on a "+ Add Section"
    // click.
    this._syncFromDom();
    const ctx = await super._prepareContext(options);
    ctx.title    = this._state.title;
    ctx.sections = this._state.sections.map((s, i) => ({
      ...s,
      isFirst: i === 0,
      isLast:  i === this._state.sections.length - 1,
    }));
    ctx.hasSections = this._state.sections.length > 0;

    // "Last published" indicator. Reads the persisted updatedAt (NOT the
    // draft state's copy, which lags behind saves-that-don't-bump). Uses
    // Intl.RelativeTimeFormat for a plain-English relative time. When
    // never published, the template shows a distinct "never" copy.
    const persisted = getSessionGreeting();
    const ts = Number(persisted.updatedAt) || 0;
    ctx.lastPublishedAt = ts;
    ctx.hasBeenPublished = ts > 0;
    ctx.lastPublishedLabel = ts > 0
      ? _relativeTimeLabel(ts)
      : game.i18n.localize('GOODSOCIETY.sessionGreeting.neverPublished');
    // Absolute-date tooltip on hover so the GM can see the exact time
    // when the relative label ("2 hours ago") gets stale.
    ctx.lastPublishedExact = ts > 0
      ? new Date(ts).toLocaleString()
      : '';

    return ctx;
  }

  /** Copy current DOM input values back into local state. */
  _syncFromDom() {
    const root = this.element;
    if (!root) return;
    const titleEl = root.querySelector('[data-greeting-field="title"]');
    if (titleEl) this._state.title = titleEl.value;
    for (const sec of this._state.sections) {
      const head = root.querySelector(`[data-greeting-field="heading"][data-section-id="${sec.id}"]`);
      const body = root.querySelector(`[data-greeting-field="body"][data-section-id="${sec.id}"]`);
      if (head) sec.heading = head.value;
      if (body) sec.body    = body.value;
    }
  }

  // ── Action handlers ─────────────────────────────────────────────────────

  static async #addSection() {
    this._syncFromDom();
    this._state.sections.push(blankSection());
    this.render();
  }

  static async #removeSection(_ev, target) {
    const id = target?.dataset?.sectionId;
    if (!id) return;
    this._syncFromDom();
    this._state.sections = this._state.sections.filter(s => s.id !== id);
    this.render();
  }

  static async #moveSectionUp(_ev, target) {
    const id = target?.dataset?.sectionId;
    if (!id) return;
    this._syncFromDom();
    const i = this._state.sections.findIndex(s => s.id === id);
    if (i <= 0) return;
    const arr = this._state.sections;
    [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    this.render();
  }

  static async #moveSectionDown(_ev, target) {
    const id = target?.dataset?.sectionId;
    if (!id) return;
    this._syncFromDom();
    const i = this._state.sections.findIndex(s => s.id === id);
    if (i < 0 || i >= this._state.sections.length - 1) return;
    const arr = this._state.sections;
    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    this.render();
  }

  /**
   * Append a new section pre-filled with the most recent session note's
   * content. Heading is the note's name; body is a Foundry @UUID link so
   * players can click straight through to the full archive entry.
   */
  static async #insertLastNote() {
    this._syncFromDom();
    const latest = (game.journal?.contents ?? [])
      .filter(j => j.getFlag(FLAG_SCOPE, 'entryType') === 'sessionNote')
      .sort((a, b) => {
        const ta = a.getFlag(FLAG_SCOPE, 'recordedAt') ?? 0;
        const tb = b.getFlag(FLAG_SCOPE, 'recordedAt') ?? 0;
        return tb - ta;
      })[0];
    if (!latest) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.sessionGreeting.noNotesYet'));
      return;
    }
    const section = blankSection();
    section.heading = game.i18n.localize('GOODSOCIETY.sessionGreeting.lastSessionHeading');
    // Foundry's @UUID resolver renders `@UUID[…]{Display Text}` as a
    // clickable link in enriched content. The player surface enriches
    // bodies via TextEditor.enrichHTML so this lights up as a link.
    section.body = `@UUID[${latest.uuid}]{${latest.name}}`;
    this._state.sections.push(section);
    this.render();
  }

  /**
   * Silent save — writes the current draft to the setting but keeps the
   * previous `updatedAt`, so no player's auto-pop dismiss-flag falls
   * behind. Use this for mid-editing checkpoints; players won't re-see
   * the greeting until Publish.
   */
  static async #saveDraft() {
    this._syncFromDom();
    const saved = await saveDraftGreeting(this._state);
    if (saved) {
      this._state = _cloneState(saved);
      ui.notifications?.info(game.i18n.localize('GOODSOCIETY.sessionGreeting.draftSaved'));
      this.render();
    } else {
      ui.notifications?.error(game.i18n.localize('GOODSOCIETY.sessionGreeting.saveFailed'));
    }
  }

  /**
   * Publish — writes AND bumps updatedAt, which re-arms the auto-pop for
   * every user (their dismiss-flag falls behind the fresh timestamp).
   * This is the only path that should ever mint a new `updatedAt`; every
   * other save flows through `#saveDraft` above.
   */
  static async #publishGreeting() {
    this._syncFromDom();
    const saved = await publishSessionGreeting(this._state);
    if (saved) {
      // Refresh local state's updatedAt so the composer reflects what's
      // now stored — important if the GM keeps editing.
      this._state = _cloneState(saved);
      ui.notifications?.info(game.i18n.localize('GOODSOCIETY.sessionGreeting.published'));
      this.render();
    } else {
      ui.notifications?.error(game.i18n.localize('GOODSOCIETY.sessionGreeting.publishFailed'));
    }
  }

  /**
   * Unpublish — clears the greeting so the auto-pop stops firing. Wrapped
   * in a confirm because it's destructive (title + sections + timestamp
   * all zeroed). GMs will use this at end-of-session to prevent the
   * greeting from lingering into next week's load.
   */
  static async #unpublishGreeting() {
    const ok = window.confirm(
      game.i18n.localize('GOODSOCIETY.sessionGreeting.unpublishConfirm'),
    );
    if (!ok) return;
    const cleared = await unpublishSessionGreeting();
    if (cleared) {
      this._state = _cloneState(cleared);
      ui.notifications?.info(game.i18n.localize('GOODSOCIETY.sessionGreeting.unpublished'));
      this.render();
    } else {
      ui.notifications?.error(game.i18n.localize('GOODSOCIETY.sessionGreeting.unpublishFailed'));
    }
  }

  /**
   * Local preview — open the player-facing greeting modal on the GM's
   * screen using current draft state (NOT the saved value). Lets the
   * GM see what players will see before publishing. No socket emit.
   */
  static async #previewGreeting() {
    this._syncFromDom();
    const { openSessionGreetingPreview } = await import('./session-greeting.js');
    openSessionGreetingPreview(this._state);
  }
}

function _cloneState(g) {
  return {
    title:     g.title ?? '',
    sections:  (g.sections ?? []).map(s => ({ ...s })),
    updatedAt: g.updatedAt ?? 0,
  };
}

/**
 * Human-readable relative time for the "Last published" indicator.
 * Uses Intl.RelativeTimeFormat with the largest sensible unit — so a
 * timestamp 3 hours old reads "3 hours ago", not "180 minutes ago".
 * Falls back to a short absolute date for anything older than ~7 days
 * (relative labels beyond a week feel imprecise: "13 days ago" is
 * cognitively worse than "May 6").
 */
function _relativeTimeLabel(timestamp) {
  const now = Date.now();
  const diffMs = timestamp - now;                  // negative for past
  const absSec = Math.abs(diffMs) / 1000;
  const lang = game.i18n?.lang || 'en';
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });

  if (absSec < 60)               return rtf.format(Math.round(diffMs / 1000), 'second');
  if (absSec < 3600)             return rtf.format(Math.round(diffMs / 60_000), 'minute');
  if (absSec < 86_400)           return rtf.format(Math.round(diffMs / 3_600_000), 'hour');
  if (absSec < 7 * 86_400)       return rtf.format(Math.round(diffMs / 86_400_000), 'day');
  return new Date(timestamp).toLocaleDateString(lang, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/** Singleton open — GM-only. */
export function openSessionGreetingComposer() {
  if (!game.user?.isGM) {
    ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.sessionGreeting.gmOnly'));
    return null;
  }
  if (!_instance) _instance = new SessionGreetingComposer();
  else _instance._state = _cloneState(getSessionGreeting()); // refresh from disk
  _instance.render(true);
  return _instance;
}

export function refreshSessionGreetingComposer() {
  if (_instance?.rendered) _instance.render();
}
