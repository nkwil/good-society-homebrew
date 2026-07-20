/**
 * SessionNotesApp — GM authoring hub for "what happened in the last
 * session" prose notes. Each note is a JournalEntry under
 * "Session Notes / Cycle N" (see module/helpers/journal-folders.js) flagged
 * `entryType: 'sessionNote'`, with `cycleNumber` + `recordedAt` flags so
 * the Novel Reader (post-MVP §13.3) and any future indexers can dispatch
 * on the same channel.
 *
 * The list view groups every existing sessionNote by `cycleNumber`. The
 * current cycle's group is expanded by default and is also the destination
 * for new notes from the "+ New Note" button. Clicking a note row opens
 * its JournalEntry sheet — that's where the GM actually types content,
 * using Foundry's native ProseMirror editor. We don't try to embed a rich
 * editor here; the journal sheet is already excellent.
 *
 * Default ownership: OBSERVER. Per the user's design call ("just allow my
 * session notes to be added to the journal publicly") session notes are
 * NOT GM-only — players can read them in the journal sidebar AND they
 * surface in the Novel Reader. The Session Greeting (see
 * session-greeting-*.js) is the curated "what matters tonight" surface
 * that links to these via `@UUID`; the notes are the archive.
 *
 * Cabinet entry: GM Tools group, launcherKey `sessionNotes`.
 */

import { sessionNoteFolder } from '../helpers/journal-folders.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const FLAG_SCOPE = 'good-society-homebrew';
const TEMPLATE = 'systems/good-society-homebrew/templates/apps/session-notes.hbs';

let _instance = null;

export class SessionNotesApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-session-notes',
    classes: ['good-society', 'gs-session-notes-app'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.sessionNotes.windowTitle',
    },
    position: { width: 560, height: 'auto' },
    actions: {
      createNote:    SessionNotesApp.#createNote,
      openNote:      SessionNotesApp.#openNote,
      deleteNote:    SessionNotesApp.#deleteNote,
      toggleCycle:   SessionNotesApp.#toggleCycle,
    },
  };

  static PARTS = {
    main: { template: TEMPLATE },
  };

  constructor(options = {}) {
    super(options);
    // Collapsed cycle groups. Default-expanded for the current cycle only;
    // older cycles collapse on first render so the list stays scannable
    // once a campaign has run a while.
    this._collapsedCycles = new Set();
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);

    // Resolve current cycle so we know which group to expand by default
    // and where the "+ New Note" button writes.
    let currentCycle = 1;
    try { currentCycle = game.settings.get(FLAG_SCOPE, 'cycleNumber') ?? 1; } catch {}

    // Pull every session note from the journal and bucket by cycle.
    // Read-time scan is fine — sessionNotes are low-volume (one per
    // session, ~4-8 sessions per cycle).
    const allNotes = (game.journal?.contents ?? [])
      .filter(j => j.getFlag(FLAG_SCOPE, 'entryType') === 'sessionNote')
      .map(j => ({
        id:         j.id,
        uuid:       j.uuid,
        name:       j.name,
        cycleNumber: j.getFlag(FLAG_SCOPE, 'cycleNumber') ?? null,
        recordedAt: j.getFlag(FLAG_SCOPE, 'recordedAt') ?? 0,
      }))
      // Sort newest first within each cycle so the most recent recap
      // surfaces at the top of its group.
      .sort((a, b) => (b.recordedAt ?? 0) - (a.recordedAt ?? 0));

    // Bucket by cycle. Notes with no cycleNumber land in a synthetic
    // "Unfiled" bucket so legacy data doesn't disappear.
    const buckets = new Map();
    for (const note of allNotes) {
      const key = note.cycleNumber ?? 'unfiled';
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(note);
    }

    // Ensure the current cycle's bucket exists even when empty — gives
    // the GM a visible "Cycle N" header to drop a first note under.
    if (!buckets.has(currentCycle)) buckets.set(currentCycle, []);

    // Sort cycle keys descending (current cycle first; older below;
    // 'unfiled' sinks to the bottom). On first render we collapse any
    // cycle that isn't the current one — but if the user has already
    // expanded/collapsed manually we respect their _collapsedCycles set.
    const cycleKeys = [...buckets.keys()].sort((a, b) => {
      if (a === 'unfiled') return 1;
      if (b === 'unfiled') return -1;
      return Number(b) - Number(a);
    });

    const cycles = cycleKeys.map(key => {
      const isUnfiled = key === 'unfiled';
      const notes = buckets.get(key) ?? [];
      // Auto-collapse: cycles OTHER than the current one start collapsed
      // unless the user has already opened them in this session.
      const autoCollapsed = !isUnfiled && key !== currentCycle && !this._userExpanded(key);
      const collapsed = this._collapsedCycles.has(key) || autoCollapsed;
      return {
        key,
        label: isUnfiled
          ? game.i18n.localize('GOODSOCIETY.sessionNotes.unfiled')
          : game.i18n.format('GOODSOCIETY.sessionNotes.cycleHeading', { cycle: key }),
        isCurrent: key === currentCycle,
        notes: notes.map(n => ({
          ...n,
          dateLabel: n.recordedAt
            ? new Date(n.recordedAt).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
              })
            : '',
        })),
        count: notes.length,
        collapsed,
      };
    });

    ctx.cycles = cycles;
    ctx.currentCycle = currentCycle;
    ctx.hasAny = allNotes.length > 0;
    return ctx;
  }

  /** Track whether the user has explicitly toggled a cycle's group open. */
  _userExpanded(key) {
    // _collapsedCycles is the inverse — we don't store "expanded" separately.
    // For now, "not collapsed by user" = expanded. The auto-collapse rule
    // only kicks in on first render; once the user clicks a header we
    // honor their state via _collapsedCycles.
    return this._userTouched?.has(key) ?? false;
  }

  // ── Action handlers ─────────────────────────────────────────────────────

  /**
   * Create a new note in the current cycle's folder and open its sheet
   * for editing. Default name includes the cycle + timestamp so the GM
   * can leave it untouched on small one-off notes; they can also rename.
   */
  static async #createNote() {
    if (!game.user?.isGM) return;
    let currentCycle = 1;
    try { currentCycle = game.settings.get(FLAG_SCOPE, 'cycleNumber') ?? 1; } catch {}
    const folder = await sessionNoteFolder(currentCycle);
    const now = Date.now();
    const dateLabel = new Date(now).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    const name = game.i18n.format('GOODSOCIETY.sessionNotes.defaultName', {
      cycle: currentCycle,
      date: dateLabel,
    });

    let entry;
    try {
      entry = await JournalEntry.create({
        name,
        ...(folder ? { folder: folder.id } : {}),
        // Public-by-default per the user's design call. Players can read
        // (OBSERVER); only the GM can edit. Foundry's enum: OBSERVER = 2.
        ownership: {
          default: CONST.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2,
        },
        flags: {
          [FLAG_SCOPE]: {
            entryType: 'sessionNote',
            cycleNumber: currentCycle,
            recordedAt: now,
          },
        },
        // One empty text page so the entry opens directly into the editor.
        pages: [{
          name,
          type: 'text',
          text: {
            content: '',
            format: CONST.JOURNAL_ENTRY_PAGE_FORMATS?.HTML ?? 1,
          },
        }],
      });
    } catch (err) {
      console.error('GS | session note create failed:', err);
      ui.notifications?.error(game.i18n.localize('GOODSOCIETY.sessionNotes.createFailed'));
      return;
    }
    // Open the entry's native sheet for editing; re-render the list so
    // the new entry shows up under the current cycle.
    entry?.sheet?.render(true);
    this.render();
  }

  /** Open a note's JournalEntry sheet. */
  static async #openNote(_ev, target) {
    const id = target?.dataset?.entryId;
    if (!id) return;
    const entry = game.journal?.get(id);
    if (!entry) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.sessionNotes.notFound'));
      this.render(); // entry was probably deleted; refresh
      return;
    }
    entry.sheet?.render(true);
  }

  /** Confirm + delete a note. */
  static async #deleteNote(_ev, target) {
    if (!game.user?.isGM) return;
    const id = target?.dataset?.entryId;
    if (!id) return;
    const entry = game.journal?.get(id);
    if (!entry) return;
    const ok = window.confirm(
      game.i18n.format('GOODSOCIETY.sessionNotes.deleteConfirm', { name: entry.name }),
    );
    if (!ok) return;
    try {
      await entry.delete();
    } catch (err) {
      console.error('GS | session note delete failed:', err);
      ui.notifications?.error(game.i18n.localize('GOODSOCIETY.sessionNotes.deleteFailed'));
      return;
    }
    this.render();
  }

  /** Toggle a cycle group open/closed. */
  static async #toggleCycle(_ev, target) {
    const raw = target?.dataset?.cycleKey;
    if (raw == null) return;
    // Reconstruct the original key — numeric for cycle numbers, the
    // literal string 'unfiled' for the unfiled bucket.
    const key = raw === 'unfiled' ? 'unfiled' : Number(raw);
    if (!this._userTouched) this._userTouched = new Set();
    this._userTouched.add(key);
    if (this._collapsedCycles.has(key)) this._collapsedCycles.delete(key);
    else                                this._collapsedCycles.add(key);
    this.render();
  }
}

/** Resolve-or-create the singleton + render. GM-only. */
export function openSessionNotes() {
  if (!game.user?.isGM) {
    ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.sessionNotes.gmOnly'));
    return null;
  }
  if (!_instance) _instance = new SessionNotesApp();
  _instance.render(true);
  return _instance;
}

/** Called by hooks that mutate session-note entries to refresh the open list. */
export function refreshSessionNotes() {
  if (_instance?.rendered) _instance.render();
}

/**
 * Register JournalEntry lifecycle hooks so the Session Notes list stays
 * in sync when the GM edits notes from OUTSIDE the app — via the Foundry
 * journal sidebar's rename/delete, drag-to-folder, ownership edit, etc.
 * Without this, the app's list goes stale until reopened; with it, any
 * mutation to a sessionNote-flagged entry immediately re-renders.
 *
 * Guarded to only refresh when the affected entry actually carries
 * `entryType: 'sessionNote'` — no wasted re-renders when the GM
 * renames some unrelated journal entry (which happens constantly during
 * scene prep).
 *
 * Wired from good-society.js `ready` alongside other hook registrations.
 */
export function registerSessionNotesHooks() {
  const isSessionNote = (entry) =>
    entry?.getFlag?.(FLAG_SCOPE, 'entryType') === 'sessionNote';

  // Rename, cycleNumber flag flip, page content edits — all land here.
  Hooks.on('updateJournalEntry', (entry) => {
    if (!_instance?.rendered) return;
    if (!isSessionNote(entry)) return;
    refreshSessionNotes();
  });

  // Deleted-from-elsewhere: the app's row would 404 on click otherwise.
  Hooks.on('deleteJournalEntry', (entry) => {
    if (!_instance?.rendered) return;
    if (!isSessionNote(entry)) return;
    refreshSessionNotes();
  });

  // Rare — a fresh sessionNote created via macro / another surface.
  Hooks.on('createJournalEntry', (entry) => {
    if (!_instance?.rendered) return;
    if (!isSessionNote(entry)) return;
    refreshSessionNotes();
  });
}
