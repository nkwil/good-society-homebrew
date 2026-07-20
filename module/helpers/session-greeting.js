/**
 * session-greeting.js — read/write helpers for the GM-authored "welcome
 * back" greeting that auto-pops for every player on world load.
 *
 * Storage: world setting `sessionGreeting`, shape:
 *   {
 *     title: string,                                    // e.g. "Welcome back"
 *     sections: Array<{ id, heading, body }>,           // body is plain text;
 *                                                       // newlines + @UUID
 *                                                       // resolved at render
 *     updatedAt: number,                                // ms timestamp
 *   }
 *
 * Per-user dismiss: each user's `flags.good-society-homebrew.
 * greetingDismissedAt` stores the `updatedAt` they last dismissed. The
 * auto-pop hook (module/hooks/session-greeting-auto.js) compares the two
 * — if updatedAt > dismissedAt, the greeting opens. Re-publishing (bumping
 * updatedAt) re-arms it for everyone.
 *
 * All writes are GM-only (Foundry enforces this on world-scope settings).
 * Reads are open.
 */

const NS  = 'good-society-homebrew';
const KEY = 'sessionGreeting';
export const GREETING_DISMISS_FLAG = 'greetingDismissedAt';

/** Default greeting shape — used when the setting hasn't been authored. */
function _emptyGreeting() {
  return {
    title:     '',
    sections:  [],
    updatedAt: 0,
  };
}

/** Read the current greeting. Always returns a valid shape (never null). */
export function getSessionGreeting() {
  try {
    const raw = game.settings.get(NS, KEY);
    if (!raw || typeof raw !== 'object') return _emptyGreeting();
    return {
      title:     typeof raw.title === 'string' ? raw.title : '',
      sections:  Array.isArray(raw.sections) ? raw.sections.map(_normalizeSection) : [],
      updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
    };
  } catch {
    return _emptyGreeting();
  }
}

function _normalizeSection(s) {
  return {
    id:      typeof s?.id === 'string' && s.id ? s.id : foundry.utils.randomID(),
    heading: typeof s?.heading === 'string' ? s.heading : '',
    body:    typeof s?.body    === 'string' ? s.body    : '',
  };
}

/**
 * Whether the greeting has any content the player can actually read.
 * Used by the auto-pop hook to avoid opening a blank modal.
 */
export function hasPublishableGreeting(greeting = getSessionGreeting()) {
  if (greeting.title?.trim()) return true;
  return greeting.sections.some(s => s.heading?.trim() || s.body?.trim());
}

/**
 * Persist the greeting silently — preserves the previous `updatedAt`
 * so player dismiss-flags stay valid and the auto-pop DOESN'T re-arm.
 * This is what the composer's "Save draft" button uses; the GM can
 * keep editing without popping half-baked greetings for everyone
 * on every save. `updatedAt` only changes when the GM explicitly hits
 * "Publish" (see `publishSessionGreeting`).
 */
export async function saveDraftGreeting(next) {
  if (!game.user?.isGM) return null;
  const prev = getSessionGreeting();
  const cleaned = {
    title:    typeof next.title === 'string' ? next.title : '',
    sections: Array.isArray(next.sections) ? next.sections.map(_normalizeSection) : [],
    // Preserve the last-published timestamp. Zero if never published.
    updatedAt: prev.updatedAt ?? 0,
  };
  try {
    await game.settings.set(NS, KEY, cleaned);
    return cleaned;
  } catch (err) {
    console.warn('GS | saveDraftGreeting failed:', err);
    return null;
  }
}

/**
 * Publish — same shape as save-draft but bumps `updatedAt` to now, which
 * (a) makes every player's dismiss-flag fall behind so the greeting
 * auto-pops for them on next load, and (b) advances the "Last published"
 * indicator in the composer. Use for the composer's "Publish" button
 * exclusively; every intermediate save should go through
 * `saveDraftGreeting` instead.
 */
export async function publishSessionGreeting(next) {
  if (!game.user?.isGM) return null;
  const cleaned = {
    title:    typeof next.title === 'string' ? next.title : '',
    sections: Array.isArray(next.sections) ? next.sections.map(_normalizeSection) : [],
    updatedAt: Date.now(),
  };
  try {
    await game.settings.set(NS, KEY, cleaned);
    return cleaned;
  } catch (err) {
    console.warn('GS | publishSessionGreeting failed:', err);
    return null;
  }
}

/**
 * Unpublish — clears the greeting entirely so the auto-pop stops firing.
 * Kept as a distinct action from Save Draft so the GM's intent is
 * explicit; the composer wraps it in a confirm dialog. After unpublish,
 * `hasPublishableGreeting()` returns false and the auto-open coordinator
 * falls through to the pregame checklist (or nothing).
 */
export async function unpublishSessionGreeting() {
  if (!game.user?.isGM) return null;
  const cleaned = { title: '', sections: [], updatedAt: 0 };
  try {
    await game.settings.set(NS, KEY, cleaned);
    return cleaned;
  } catch (err) {
    console.warn('GS | unpublishSessionGreeting failed:', err);
    return null;
  }
}

/** Dismiss for the local user. Writes the current updatedAt as the floor. */
export async function dismissSessionGreeting() {
  const greeting = getSessionGreeting();
  try {
    await game.user?.setFlag(NS, GREETING_DISMISS_FLAG, greeting.updatedAt || Date.now());
  } catch (err) {
    console.warn('GS | dismissSessionGreeting failed:', err);
  }
}

/** True when the current greeting is newer than this user's dismiss-mark. */
export function isGreetingFreshForUser() {
  const greeting = getSessionGreeting();
  if (!hasPublishableGreeting(greeting)) return false;
  let dismissedAt = 0;
  try { dismissedAt = game.user?.getFlag(NS, GREETING_DISMISS_FLAG) ?? 0; } catch {}
  return (greeting.updatedAt ?? 0) > (dismissedAt ?? 0);
}

/** Quick helper for the composer: insert a fresh empty section. */
export function blankSection() {
  return { id: foundry.utils.randomID(), heading: '', body: '' };
}
