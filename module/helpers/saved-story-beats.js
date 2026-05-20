/**
 * Saved story beats — GM-side draft system for the Story Beats Command
 * Center. Lets the GM compose a beat (today: invitations; tomorrow: any beat
 * with form fields) ahead of time and deploy it when the moment arrives at
 * the table.
 *
 * Storage: world setting `savedStoryBeats` (registered in good-society.js).
 * All writes are GM-only; reads are open so the Command Center can render
 * the list when the GM opens it (the Center itself is GM-only).
 *
 * Each saved entry:
 *   - id        — random id, used as key for deploy/delete actions
 *   - beatId    — matches STORY_BEATS[].id
 *   - label     — short display label (auto-derived from the payload at
 *                 save time; the GM doesn't have to type it)
 *   - payload   — the form-field values the dialog collected
 *   - createdAt — ms timestamp, sort order
 */

import { findStoryBeat } from '../data/story-beats.js';

const NS  = 'good-society-homebrew';
const KEY = 'savedStoryBeats';

/** Read all saved beats. Returns an array (may be empty). */
export function getSavedStoryBeats() {
  try {
    const raw = game.settings.get(NS, KEY);
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

/** Filter to saved beats matching a given beat id. */
export function getSavedForBeat(beatId) {
  return getSavedStoryBeats().filter(s => s.beatId === beatId);
}

/**
 * Derive a short display label for a saved entry from the beat's form
 * payload. Centralized here so the Command Center, log, and any future
 * surface share the same heuristic.
 *
 * Today: invitation uses `occasion — sender`, news uses `headline`,
 * accusation uses the charge, etc. Falls back to the beat's own label.
 */
export function deriveSavedLabel(beatId, payload) {
  const beat = findStoryBeat(beatId);
  if (!beat) return '(unknown beat)';
  const p = payload ?? {};
  switch (beatId) {
    case 'invitation': {
      const occ = (p.occasion || '').trim();
      const snd = (p.sender   || '').trim();
      if (occ && snd) return `${occ} — ${snd}`;
      return occ || snd || beat.label;
    }
    case 'news':         return (p.headline || '').trim() || beat.label;
    case 'accusation':   return (p.charge   || '').trim() || beat.label;
    case 'death':        return (p.deceased || '').trim() || beat.label;
    case 'reveal-secret':return (p.subject  || '').trim() || beat.label;
    case 'time-skip':    return (p.when     || '').trim() || beat.label;
    default:             return beat.label;
  }
}

/**
 * Save a beat for later deployment. Returns the created entry or null.
 * GM-only.
 *
 * @param {string} beatId  one of STORY_BEATS[].id
 * @param {object} payload form-field values
 */
export async function saveStoryBeat(beatId, payload) {
  if (!game.user?.isGM) return null;
  if (!findStoryBeat(beatId)) return null;

  const entry = {
    id:        foundry.utils.randomID(),
    beatId,
    label:     deriveSavedLabel(beatId, payload),
    payload:   foundry.utils.deepClone(payload ?? {}),
    createdAt: Date.now(),
  };
  const existing = getSavedStoryBeats();
  try {
    await game.settings.set(NS, KEY, [...existing, entry]);
    return entry;
  } catch (err) {
    console.warn('GS | saveStoryBeat failed:', err);
    return null;
  }
}

/** Remove a saved beat by id. GM-only. Returns true if removed. */
export async function deleteSavedStoryBeat(id) {
  if (!game.user?.isGM) return false;
  if (!id) return false;
  const existing = getSavedStoryBeats();
  const next = existing.filter(s => s.id !== id);
  if (next.length === existing.length) return false;
  try {
    await game.settings.set(NS, KEY, next);
    return true;
  } catch (err) {
    console.warn('GS | deleteSavedStoryBeat failed:', err);
    return false;
  }
}
