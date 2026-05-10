/**
 * Novel Reader — post-MVP §13.3 / patch-journal-elevation §6.
 *
 * Singleton framed ApplicationV2 (920 × 780). Two display modes:
 *   - Cover mode (default on first open) — title page with the novel's title,
 *     cycle count, status, author byline, and a "Begin reading" pill.
 *   - Reader mode — left rail (cycle nav) + right reader (chronological
 *     archive: letters, monologues, session logs, cycle dividers grouped by
 *     cycle). Cycle divider entries render as chapter breaks.
 *
 * Per-user state (last cycle viewed, scroll position, cover-vs-reader mode)
 * persists in `game.user.flags['good-society-homebrew'].novelReader`. Reader
 * also auto-opens for all users when the `goodSociety.gameEnded` hook fires
 * (post-MVP §13.4 — the rulebook p.115 "title your novel" ritual).
 */

import { profilePic, profileName } from '../helpers/profile-pic.js';
import { CHROME_ICONS } from '../constants.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const FLAG_SCOPE = 'good-society-homebrew';
const FLAG_KEY = 'novelReader';
const TEMPLATE = 'systems/good-society-homebrew/templates/apps/novel-reader.hbs';

let _instance = null;

export class NovelReaderApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-novel-reader',
    classes: ['good-society', 'gs-novel-reader'],
    window: {
      title: 'GOODSOCIETY.novel.windowTitle',
      icon: 'fa-solid fa-book-open',
      contentClasses: ['gs-novel-reader__content'],
    },
    position: { width: 920, height: 780 },
    actions: {
      beginReading: NovelReaderApp.#beginReading,
      goToCycle:    NovelReaderApp.#goToCycle,
      titleNovel:   NovelReaderApp.#titleNovel,
      saveTitle:    NovelReaderApp.#saveTitle,
      cancelTitle:  NovelReaderApp.#cancelTitle,
      backToCover:  NovelReaderApp.#backToCover,
      openInJournal: NovelReaderApp.#openInJournal,
    },
  };

  static PARTS = {
    main: { template: TEMPLATE },
  };

  constructor(options = {}) {
    super(options);
    const stored = game.user?.getFlag(FLAG_SCOPE, FLAG_KEY) ?? {};
    this._mode = stored.mode ?? 'cover';
    this._activeCycle = stored.lastCycleViewed ?? 1;
    this._editingTitle = false;
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);

    // Resolve title: world setting falls back to the world's name.
    let novelTitle = '';
    try { novelTitle = game.settings.get(FLAG_SCOPE, 'novelTitle') || ''; } catch {}
    novelTitle = novelTitle || game.world?.title || game.i18n.localize('GOODSOCIETY.novel.windowTitle');

    // Cycle status — derived from cyclePhase + isFinalCycle + cyclePosition.
    let cycleNumber = 1;
    let isFinalCycle = false;
    let cyclePosition = 0;
    try {
      cycleNumber = game.settings.get(FLAG_SCOPE, 'cycleNumber') ?? 1;
      isFinalCycle = !!game.settings.get(FLAG_SCOPE, 'isFinalCycle');
      cyclePosition = game.settings.get(FLAG_SCOPE, 'cyclePosition') ?? 0;
    } catch {}
    const isComplete = isFinalCycle && cyclePosition === 9;

    const statusKey = isComplete
      ? 'GOODSOCIETY.novel.cover.statusComplete'
      : isFinalCycle
        ? 'GOODSOCIETY.novel.cover.statusFinalCycle'
        : 'GOODSOCIETY.novel.cover.statusInProgress';

    // Author list — connected GMs + players.
    const authors = (game.users?.contents ?? [])
      .filter((u) => u.active || u.role >= CONST.USER_ROLES.PLAYER)
      .map((u) => u.name)
      .filter(Boolean);

    // All entries with the post-MVP §13.1 entryType flag, grouped by cycle.
    const archivedEntries = (game.journal?.contents ?? [])
      .filter((j) => !!j.getFlag(FLAG_SCOPE, 'entryType'))
      .map((entry) => {
        const flag = entry.getFlag(FLAG_SCOPE, 'entryType');
        const cn = entry.getFlag(FLAG_SCOPE, 'cycleNumber') ?? null;
        const speakerActorId = entry.getFlag(FLAG_SCOPE, 'speakerActorId') ?? null;
        const speaker = speakerActorId ? game.actors?.get(speakerActorId) : null;
        const firstPage = entry.pages?.contents?.[0] ?? null;
        const body = firstPage?.text?.content ?? '';
        const glyphAsset = CHROME_ICONS.journalEntries?.[flag]?.asset ?? null;
        return {
          id: entry.id,
          uuid: entry.uuid,
          name: entry.name,
          entryType: flag,
          cycleNumber: cn,
          speakerName: speaker ? profileName(speaker) : '',
          speakerPortrait: speaker ? profilePic(speaker) : '',
          body,
          glyphAsset,
          createdAt: firstPage?.createdAt ?? entry._stats?.createdAt ?? 0,
          isCycleDivider: flag === 'cycleDivider',
        };
      })
      .sort((a, b) => (a.cycleNumber ?? 0) - (b.cycleNumber ?? 0) || a.createdAt - b.createdAt);

    // Group by cycle. The cycle divider for a cycle (if any) sorts to the
    // FRONT of that cycle's entries — it's the chapter break heading.
    const cycleMap = new Map();
    for (const e of archivedEntries) {
      const key = e.cycleNumber ?? 0;
      if (!cycleMap.has(key)) cycleMap.set(key, { divider: null, entries: [] });
      const bucket = cycleMap.get(key);
      if (e.isCycleDivider) bucket.divider = e;
      else bucket.entries.push(e);
    }

    // Sorted cycle list for the rail.
    const cycles = [...cycleMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([n, bucket]) => {
        const counts = bucket.entries.reduce((acc, e) => {
          acc[e.entryType] = (acc[e.entryType] ?? 0) + 1;
          return acc;
        }, {});
        const subtitle = [
          counts.letter ? `${counts.letter} ${counts.letter === 1 ? 'letter' : 'letters'}` : null,
          counts.monologue ? `${counts.monologue} ${counts.monologue === 1 ? 'monologue' : 'monologues'}` : null,
          counts.sessionLog ? `${counts.sessionLog} session${counts.sessionLog === 1 ? '' : 's'}` : null,
        ].filter(Boolean).join(' · ');
        return {
          n,
          divider: bucket.divider,
          entries: bucket.entries,
          totalEntries: bucket.entries.length + (bucket.divider ? 1 : 0),
          subtitle: subtitle || game.i18n.localize('GOODSOCIETY.novel.rail.empty'),
          isActive: this._activeCycle === n,
        };
      });

    const totalEntries = archivedEntries.length;

    ctx.mode = this._mode;
    ctx.isCoverMode = this._mode === 'cover';
    ctx.isReaderMode = this._mode === 'reader';
    ctx.isComplete = isComplete;
    ctx.isFinalCycle = isFinalCycle;
    ctx.editingTitle = this._editingTitle;
    ctx.novelTitle = novelTitle;
    ctx.novelTitleFirstLetter = (novelTitle || '?').charAt(0);
    ctx.novelTitleRest = (novelTitle || '').substring(1);
    ctx.cycleCount = cycles.length;
    ctx.cyclesLine = game.i18n.format('GOODSOCIETY.novel.cover.cyclesLine', {
      n: cycles.length,
      status: game.i18n.localize(statusKey),
    });
    ctx.byline = authors.length
      ? game.i18n.format('GOODSOCIETY.novel.cover.byline', {
          authors: _formatAuthors(authors),
        })
      : '';
    ctx.cycles = cycles;
    ctx.activeCycle = this._activeCycle;
    ctx.activeCycleData = cycles.find((c) => c.n === this._activeCycle) ?? cycles[0] ?? null;
    ctx.allCyclesView = cycles; // reader scrolls through every cycle
    ctx.totalEntries = totalEntries;
    ctx.isEmpty = totalEntries === 0;
    return ctx;
  }

  // ── Action handlers ──────────────────────────────────────────────────────

  static async #beginReading() {
    this._mode = 'reader';
    await this._persistState();
    this.render({ parts: ['main'] });
  }

  static async #backToCover() {
    this._mode = 'cover';
    await this._persistState();
    this.render({ parts: ['main'] });
  }

  static async #goToCycle(event, target) {
    const cycle = Number(target?.dataset?.cycle ?? 0);
    if (!Number.isFinite(cycle)) return;
    this._activeCycle = cycle;
    this._mode = 'reader';
    await this._persistState();
    this.render({ parts: ['main'] });
    // After render, scroll to the cycle's heading.
    const node = this.element?.querySelector(`[data-cycle-anchor="${cycle}"]`);
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  static async #titleNovel() {
    this._editingTitle = true;
    this.render({ parts: ['main'] });
  }

  static async #saveTitle(event, target) {
    const input = this.element?.querySelector('input[name="novelTitleInput"]');
    const value = (input?.value ?? '').trim();
    try { await game.settings.set(FLAG_SCOPE, 'novelTitle', value); } catch (err) {
      console.warn('GS | novel title save failed:', err);
    }
    this._editingTitle = false;
    this.render({ parts: ['main'] });
  }

  static async #cancelTitle() {
    this._editingTitle = false;
    this.render({ parts: ['main'] });
  }

  static async #openInJournal(event, target) {
    const uuid = target?.dataset?.entryUuid;
    if (!uuid) return;
    const entry = await fromUuid(uuid);
    entry?.sheet?.render(true);
  }

  async _persistState() {
    try {
      await game.user.setFlag(FLAG_SCOPE, FLAG_KEY, {
        mode: this._mode,
        lastCycleViewed: this._activeCycle,
      });
    } catch (err) {
      console.warn('GS | novel reader state persist failed (non-fatal):', err);
    }
  }
}

function _formatAuthors(names) {
  if (!names.length) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export function openNovelReader() {
  let enabled = true;
  try { enabled = game.settings.get(FLAG_SCOPE, 'novelReaderEnabled'); } catch {}
  if (!enabled) {
    ui.notifications?.info(game.i18n.localize('GOODSOCIETY.novel.disabledHint'));
    return null;
  }
  if (!_instance) _instance = new NovelReaderApp();
  // If already open, bring to front rather than re-rendering (which can
  // briefly collapse the window and look like it's "toggling").
  if (_instance.rendered) {
    _instance.bringToTop?.();
    return _instance;
  }
  _instance.render({ force: true });
  return _instance;
}

export function getNovelReader() {
  return _instance;
}

/**
 * Game-end auto-open hook. Called from `module/helpers/cycle-advance.js`
 * when the GM advances past the final epilogue (post-MVP §13.4).
 */
export function registerNovelReaderHooks() {
  Hooks.on('goodSociety.gameEnded', () => {
    const inst = openNovelReader();
    if (inst) inst._mode = 'cover';
  });
}
