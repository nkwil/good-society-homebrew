/**
 * event-timeline.js — pure helpers for the GS Event Timeline (in-fiction
 * calendar). All writes guarded GM-only. Reads are open.
 *
 * Storage: two world-scoped settings registered in good-society.js
 *   - calendarEvents     : Array<Event>
 *   - currentInGameDate  : { year, month, day }
 *
 * Per docs/design/31-event-timeline.md.
 */

const NS = 'good-society-homebrew';

// ── Date math (pure-numeric, no Date objects) ──────────────────────────────

/**
 * Compare two {year, month, day} objects.
 * Returns -1 if a < b, 0 if equal, 1 if a > b.
 * Pure numeric — no JavaScript Date involvement, so no timezone surprises.
 */
export function compareDate(a, b) {
  if (!a || !b) return 0;
  const aKey = (a.year ?? 0) * 10000 + (a.month ?? 0) * 100 + (a.day ?? 0);
  const bKey = (b.year ?? 0) * 10000 + (b.month ?? 0) * 100 + (b.day ?? 0);
  return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
}

/**
 * Format a {year, month, day} for display. Uses Intl.DateTimeFormat at format
 * time only (never for storage or comparison). Pre-1900 dates work fine on
 * modern engines via the proleptic Gregorian calendar.
 *
 * @param {{year:number, month:number, day:number}} d
 * @param {'long'|'short'|'numeric'} style
 */
export function formatDate(d, style = 'long') {
  if (!d || d.year == null) return '—';
  try {
    const js = new Date(d.year, (d.month ?? 1) - 1, d.day ?? 1);
    const lang = (typeof game !== 'undefined' && game.i18n?.lang) || 'en';
    if (style === 'long') {
      return new Intl.DateTimeFormat(lang, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }).format(js);
    }
    if (style === 'short') {
      return new Intl.DateTimeFormat(lang, {
        day: 'numeric', month: 'short', year: 'numeric',
      }).format(js);
    }
    return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
  } catch {
    return `${d.year}-${d.month}-${d.day}`;
  }
}

// ── Visibility ─────────────────────────────────────────────────────────────

/**
 * Whether the given user can see the event under current visibility rules.
 *
 * - GM sees everything.
 * - 'public' visible to all.
 * - 'gm-only' visible only to GM.
 * - 'revealed-on-date' visible to non-GMs only when currentDate >= event.date.
 *
 * @returns {boolean}
 */
export function isVisibleToUser(event, currentDate, isGM) {
  if (isGM) return true;
  switch (event?.visibility) {
    case 'public': return true;
    case 'gm-only': return false;
    case 'revealed-on-date':
      return compareDate(event, currentDate) <= 0;
    default:
      return false; // unknown flag — fail closed
  }
}

// ── Read paths ─────────────────────────────────────────────────────────────

export function getEvents() {
  try {
    const raw = game.settings.get(NS, 'calendarEvents');
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

export function getCurrentDate() {
  try {
    const raw = game.settings.get(NS, 'currentInGameDate');
    if (!raw || typeof raw !== 'object') return { year: 1815, month: 1, day: 1 };
    return {
      year:  Number(raw.year)  || 1815,
      month: Number(raw.month) || 1,
      day:   Number(raw.day)   || 1,
    };
  } catch { return { year: 1815, month: 1, day: 1 }; }
}

/** Sort events ascending by date, then by createdAt. */
export function sortEvents(events) {
  return [...events].sort((a, b) => {
    const c = compareDate(a, b);
    if (c !== 0) return c;
    return (a.createdAt ?? 0) - (b.createdAt ?? 0);
  });
}

/**
 * Filter to only events visible to the given user, then sort.
 * @returns {Array<Event>}
 */
export function getVisibleEvents(isGM = game.user?.isGM ?? false) {
  const current = getCurrentDate();
  return sortEvents(
    getEvents().filter(e => isVisibleToUser(e, current, isGM)),
  );
}

// ── Write paths (GM-only) ──────────────────────────────────────────────────

const VALID_VISIBILITY = ['public', 'gm-only', 'revealed-on-date'];

/**
 * Add a new event. Returns the created event (with id) or null on failure.
 * GM-only.
 */
export async function addEvent({ year, month, day, title, description = '', visibility = 'public' }) {
  if (!game.user?.isGM) return null;
  if (!title || !title.trim()) return null;
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const v = VALID_VISIBILITY.includes(visibility) ? visibility : 'public';

  const ev = {
    id: foundry.utils.randomID(),
    year:  Math.trunc(year),
    month: Math.max(1, Math.min(12, Math.trunc(month))),
    day:   Math.max(1, Math.min(31, Math.trunc(day))),
    title: String(title).trim(),
    description: String(description ?? ''),
    visibility: v,
    createdAt: Date.now(),
  };

  const next = [...getEvents(), ev];
  await game.settings.set(NS, 'calendarEvents', next);
  return ev;
}

/**
 * Update an existing event by id. Only fields present in `patch` are written.
 * Returns the updated event, or null if not found / not GM.
 */
export async function updateEvent(id, patch) {
  if (!game.user?.isGM) return null;
  if (!id) return null;

  const events = getEvents();
  const idx = events.findIndex(e => e.id === id);
  if (idx === -1) return null;

  const original = events[idx];
  const merged = { ...original };

  if (patch.year  != null && Number.isFinite(patch.year))  merged.year  = Math.trunc(patch.year);
  if (patch.month != null && Number.isFinite(patch.month)) merged.month = Math.max(1, Math.min(12, Math.trunc(patch.month)));
  if (patch.day   != null && Number.isFinite(patch.day))   merged.day   = Math.max(1, Math.min(31, Math.trunc(patch.day)));
  if (patch.title       != null) merged.title = String(patch.title).trim() || original.title;
  if (patch.description != null) merged.description = String(patch.description);
  if (patch.visibility  != null && VALID_VISIBILITY.includes(patch.visibility)) {
    merged.visibility = patch.visibility;
  }

  const next = [...events];
  next[idx] = merged;
  await game.settings.set(NS, 'calendarEvents', next);
  return merged;
}

/** Remove an event by id. GM-only. Returns true on success. */
export async function removeEvent(id) {
  if (!game.user?.isGM) return false;
  if (!id) return false;
  const events = getEvents();
  const next = events.filter(e => e.id !== id);
  if (next.length === events.length) return false;
  await game.settings.set(NS, 'calendarEvents', next);
  return true;
}

/** Set the current in-game date. GM-only. */
export async function setCurrentDate({ year, month, day }) {
  if (!game.user?.isGM) return false;
  const next = {
    year:  Number.isFinite(year)  ? Math.trunc(year)  : getCurrentDate().year,
    month: Number.isFinite(month) ? Math.max(1, Math.min(12, Math.trunc(month))) : getCurrentDate().month,
    day:   Number.isFinite(day)   ? Math.max(1, Math.min(31, Math.trunc(day)))   : getCurrentDate().day,
  };
  await game.settings.set(NS, 'currentInGameDate', next);
  return true;
}
