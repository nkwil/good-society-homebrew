/**
 * event-timeline.js — pure helpers for the GS Event Timeline (in-fiction
 * calendar). All writes guarded GM-only. Reads are open.
 *
 * Storage: world-scoped setting `calendarEvents` (Array<Event>) registered
 * in good-society.js.
 *
 * Bucketing model: stage-based. The GM manually promotes events through
 * 'coming-soon' → 'today' → 'past'. No date-based auto-bucketing — Good
 * Society play uses loose in-fiction time, so dates are free-form display
 * strings (`dateLabel`), not numeric data driving the UI.
 *
 * Per docs/design/31-event-timeline.md (rev. 2026-05-08).
 */

const NS = 'good-society-homebrew';

const VALID_STAGES     = ['coming-soon', 'today', 'past'];
const VALID_VISIBILITY = ['public', 'gm-only'];

// ── Read paths ─────────────────────────────────────────────────────────────

/** Return all events, normalized (legacy fields migrated on read). */
export function getEvents() {
  try {
    const raw = game.settings.get(NS, 'calendarEvents');
    if (!Array.isArray(raw)) return [];
    return raw.map(_normalizeEvent);
  } catch { return []; }
}

/**
 * Filter to events visible to a given user. GM sees everything; non-GMs see
 * only `public` events. (Visibility model is now just public/gm-only — the
 * old 'revealed-on-date' flag is migrated to 'gm-only' on read.)
 */
export function isVisibleToUser(event, isGM) {
  if (isGM) return true;
  return _normalizeEvent(event).visibility === 'public';
}

/** Filtered + grouped by stage. Returns { comingSoon, today, past }. */
export function getGroupedEvents(isGM = game.user?.isGM ?? false) {
  const events = getEvents().filter(e => isVisibleToUser(e, isGM));
  // Sort: coming-soon and today by createdAt asc; past by concludedAt desc
  // (most recently concluded first — useful as a story log).
  const comingSoon = events
    .filter(e => e.stage === 'coming-soon')
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  const today = events
    .filter(e => e.stage === 'today')
    .sort((a, b) => (a.promotedAt ?? a.createdAt ?? 0) - (b.promotedAt ?? b.createdAt ?? 0));
  const past = events
    .filter(e => e.stage === 'past')
    .sort((a, b) => (b.concludedAt ?? 0) - (a.concludedAt ?? 0));
  return { comingSoon, today, past };
}

// ── Write paths (GM-only) ──────────────────────────────────────────────────

/**
 * Add a new event in the 'coming-soon' stage. Returns the created event.
 *
 * @param {object} fields
 * @param {string} fields.title
 * @param {string} [fields.dateLabel]   Free-form text; e.g. "next month"
 * @param {string} [fields.description]
 * @param {'public'|'gm-only'} [fields.visibility]
 */
export async function addEvent({ title, dateLabel = '', description = '', visibility = 'public' }) {
  if (!game.user?.isGM) return null;
  if (!title || !String(title).trim()) return null;
  const v = VALID_VISIBILITY.includes(visibility) ? visibility : 'public';

  const ev = {
    id:          foundry.utils.randomID(),
    title:       String(title).trim(),
    dateLabel:   String(dateLabel ?? ''),
    description: String(description ?? ''),
    visibility:  v,
    stage:       'coming-soon',
    sceneId:     '',
    createdAt:   Date.now(),
    promotedAt:  0,
    concludedAt: 0,
  };

  await _writeEvents([...getEvents(), ev]);
  return ev;
}

/**
 * Update an existing event's editable fields (title, dateLabel, description,
 * visibility). Stage changes go through promoteEvent/concludeEvent/revert.
 */
export async function updateEvent(id, patch) {
  if (!game.user?.isGM) return null;
  if (!id) return null;
  const events = getEvents();
  const idx = events.findIndex(e => e.id === id);
  if (idx === -1) return null;

  const next = { ...events[idx] };
  if (patch.title       != null) next.title       = String(patch.title).trim() || next.title;
  if (patch.dateLabel   != null) next.dateLabel   = String(patch.dateLabel ?? '');
  if (patch.description != null) next.description = String(patch.description ?? '');
  if (patch.visibility  != null && VALID_VISIBILITY.includes(patch.visibility)) {
    next.visibility = patch.visibility;
  }

  const arr = [...events];
  arr[idx] = next;
  await _writeEvents(arr);
  return next;
}

/** Remove an event. */
export async function removeEvent(id) {
  if (!game.user?.isGM) return false;
  if (!id) return false;
  const events = getEvents();
  const next = events.filter(e => e.id !== id);
  if (next.length === events.length) return false;
  await _writeEvents(next);
  return true;
}

/**
 * Promote a 'coming-soon' event to 'today' with an optional scene link.
 * Auto-flips 'gm-only' visibility to 'public' (the GM is announcing it).
 */
export async function promoteEvent(id, sceneId = '') {
  if (!game.user?.isGM) return null;
  return _setStage(id, 'today', { sceneId, autoReveal: true });
}

/** Conclude a 'today' event, moving it to 'past'. Records concludedAt. */
export async function concludeEvent(id) {
  if (!game.user?.isGM) return null;
  return _setStage(id, 'past');
}

/** Move a 'today' event back to 'coming-soon' (oops case). Clears sceneId. */
export async function revertToComingSoon(id) {
  if (!game.user?.isGM) return null;
  return _setStage(id, 'coming-soon', { clearScene: true });
}

// ── Internal ───────────────────────────────────────────────────────────────

async function _writeEvents(events) {
  await game.settings.set(NS, 'calendarEvents', events);
}

async function _setStage(id, nextStage, opts = {}) {
  if (!VALID_STAGES.includes(nextStage)) return null;
  const events = getEvents();
  const idx = events.findIndex(e => e.id === id);
  if (idx === -1) return null;

  const now = Date.now();
  const next = { ...events[idx], stage: nextStage };

  if (nextStage === 'today') {
    next.promotedAt  = now;
    next.concludedAt = 0;
    if (opts.sceneId !== undefined) next.sceneId = String(opts.sceneId ?? '');
    if (opts.autoReveal && next.visibility === 'gm-only') {
      next.visibility = 'public';
    }
  } else if (nextStage === 'past') {
    next.concludedAt = now;
  } else if (nextStage === 'coming-soon') {
    next.promotedAt  = 0;
    next.concludedAt = 0;
    if (opts.clearScene) next.sceneId = '';
  }

  const arr = [...events];
  arr[idx] = next;
  await _writeEvents(arr);
  return next;
}

/**
 * Migrate legacy event shapes on read. Pre-rev-2 events had:
 *   year/month/day (numeric) instead of dateLabel
 *   visibility 'revealed-on-date' (now mapped to 'gm-only')
 *   no stage field (default to 'coming-soon')
 *
 * Idempotent: a fully-modern event is returned as-is.
 */
function _normalizeEvent(e) {
  if (!e || typeof e !== 'object') return e;
  const out = { ...e };

  // dateLabel: derive from legacy year/month/day if missing
  if (out.dateLabel == null) {
    if (Number.isFinite(out.year) && Number.isFinite(out.month) && Number.isFinite(out.day)) {
      out.dateLabel = _legacyDateString(out.year, out.month, out.day);
    } else {
      out.dateLabel = '';
    }
  }

  // visibility: drop 'revealed-on-date'
  if (!VALID_VISIBILITY.includes(out.visibility)) {
    out.visibility = out.visibility === 'public' ? 'public' : 'gm-only';
  }

  // stage: default 'coming-soon'
  if (!VALID_STAGES.includes(out.stage)) out.stage = 'coming-soon';

  // sceneId, timestamps: default empty/zero
  if (out.sceneId     == null) out.sceneId     = '';
  if (out.createdAt   == null) out.createdAt   = 0;
  if (out.promotedAt  == null) out.promotedAt  = 0;
  if (out.concludedAt == null) out.concludedAt = 0;

  // Title fallback (very old corrupt entries)
  if (!out.title) out.title = '(untitled)';

  return out;
}

function _legacyDateString(y, m, d) {
  try {
    const js = new Date(y, m - 1, d);
    const lang = (typeof game !== 'undefined' && game.i18n?.lang) || 'en';
    return new Intl.DateTimeFormat(lang, {
      day: 'numeric', month: 'long', year: 'numeric',
    }).format(js);
  } catch {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
}
