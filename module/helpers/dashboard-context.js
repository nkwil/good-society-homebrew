/**
 * dashboard-context.js — pure context builder for the Public Info Dashboard.
 *
 * No Foundry Document mutation here — read-only.
 * Called from PublicInfoDashboard._prepareContext() and from actor hooks.
 *
 * Per post-MVP §8.5 — profile pic resolution goes through `profilePic()`.
 */

import { profilePic } from './profile-pic.js';
import { effectiveThemeOf } from './themed-wrap.js';

const NS = 'good-society-homebrew';

function _readSetting(key, fallback) {
  try { return game.settings.get(NS, key); }
  catch { return fallback; }
}

/**
 * Distinct phase TYPES — the enum values stored on `cyclePhase` setting and
 * matched by every phase-aware hook (Reputation Phase Wizard, Upkeep Wizard,
 * Letter composer, etc.).
 */
export const CYCLE_PHASES = [
  'pre-cycle',
  'novel',
  'reputation',
  'rumour-scandal',
  'epistolary',
  'upkeep',
  'ended',
];

/**
 * Canonical 8-position cycle structure per rulebook p.112.
 * Index 0 is pre-cycle (game hasn't started); 1-8 are the in-cycle positions;
 * index 9 is the post-game 'ended' state (final-cycle epilogue complete).
 *
 * Each entry is the phase TYPE that runs at that position. Some types appear
 * twice (Novel positions 1+5, Reputation 2+6, Epistolary 4+7) — same hooks
 * fire on both occurrences, so phase-aware code that switches on phase TYPE
 * keeps working without modification.
 */
export const CYCLE_POSITIONS = [
  null,             // 0 — pre-cycle (no in-cycle position yet)
  'novel',          // 1
  'reputation',     // 2
  'rumour-scandal', // 3
  'epistolary',     // 4
  'novel',          // 5 — second novel chapter
  'reputation',     // 6 — second reputation
  'epistolary',     // 7 — second epistolary (or final-cycle epilogue)
  'upkeep',         // 8
  // 9 reserved for 'ended' state (final-cycle epilogue done).
];

/**
 * Final-cycle skip set: positions to skip when isFinalCycle is true.
 * Per rulebook p.114-115, the final cycle skips Rumour & Scandal (3) and
 * the second Reputation (6); the second Epistolary (7) becomes the epilogue.
 */
export const FINAL_CYCLE_SKIP = new Set([3, 6]);

/**
 * "Which-occurrence" suffix for repeated phase types within one cycle.
 * Used by the HUD to render "Novel (1st)" vs "Novel (2nd)". Position 0 and
 * positions where the phase type appears only once map to null (no suffix).
 */
export const POSITION_OCCURRENCE = {
  1: 'first',  // novel
  2: 'first',  // reputation
  4: 'first',  // epistolary
  5: 'second', // novel
  6: 'second', // reputation
  7: 'second', // epistolary
  // 3 (rumour-scandal) and 8 (upkeep) appear only once — no suffix.
};

/**
 * Compute the next cycle position. Handles final-cycle skips, end-of-cycle
 * wrap, and game completion. Returns an object describing the transition so
 * callers can update both `cyclePosition` and `cyclePhase` (and `cycleNumber`
 * on wrap, and clear `isFinalCycle` on game completion) in one go.
 *
 * @param {number}  pos           Current cyclePosition (0-9).
 * @param {boolean} isFinalCycle  Whether this is the final cycle.
 * @returns {{ nextPos:number, nextPhase:string, wrapsCycle:boolean, gameEnds:boolean, skippedPos:number|null }}
 */
export function advanceFromPosition(pos, isFinalCycle) {
  // 0 (pre-cycle) → 1
  if (pos === 0) {
    return { nextPos: 1, nextPhase: CYCLE_POSITIONS[1], wrapsCycle: false, gameEnds: false, skippedPos: null };
  }

  // 9 (ended) → no advance.
  if (pos === 9) {
    return { nextPos: 9, nextPhase: 'ended', wrapsCycle: false, gameEnds: true, skippedPos: null };
  }

  // 8 (upkeep) → next cycle position 1, increment cycle number.
  // (Final-cycle never reaches position 8 — it ends after position 7's epilogue.)
  if (pos === 8) {
    return { nextPos: 1, nextPhase: CYCLE_POSITIONS[1], wrapsCycle: true, gameEnds: false, skippedPos: null };
  }

  // Final cycle: after epilogue (position 7), game ends.
  if (isFinalCycle && pos === 7) {
    return { nextPos: 9, nextPhase: 'ended', wrapsCycle: false, gameEnds: true, skippedPos: null };
  }

  // Standard advance: pos+1, but skip 3/6 if final cycle.
  let next = pos + 1;
  let skipped = null;
  if (isFinalCycle && FINAL_CYCLE_SKIP.has(next)) {
    skipped = next;
    next += 1;
  }

  return {
    nextPos: next,
    nextPhase: CYCLE_POSITIONS[next] ?? 'pre-cycle',
    wrapsCycle: false,
    gameEnds: false,
    skippedPos: skipped,
  };
}

/**
 * Derive a starting cyclePosition from a stored cyclePhase value, used in
 * the one-time migration for worlds that pre-date the cyclePosition setting.
 * Maps each phase type to its first occurrence in the cycle.
 */
export function deriveInitialPosition(phase) {
  switch (phase) {
    case 'novel':          return 1;
    case 'reputation':     return 2;
    case 'rumour-scandal': return 3;
    case 'epistolary':     return 4;
    case 'upkeep':         return 8;
    case 'ended':          return 9;
    case 'pre-cycle':
    default:               return 0;
  }
}

/**
 * @deprecated Kept temporarily for backwards-compat with old call sites that
 * advanced by phase TYPE alone (e.g. NEXT_PHASE['novel'] === 'reputation').
 * That assumption is broken now that 'novel' appears at two positions and
 * advances differently from each. Use advanceFromPosition() instead.
 *
 * For the sole legacy lookup that still uses this (the dashboard's
 * advancePhase before the cycle-advance helper landed), it returns the
 * first-occurrence successor. Callers should migrate.
 */
export const NEXT_PHASE = {
  'pre-cycle':     'novel',
  'novel':         'reputation',
  'reputation':    'rumour-scandal',
  'rumour-scandal':'epistolary',
  'epistolary':    'upkeep',
  'upkeep':        'novel',
  'ended':         'ended',
};

const PHASE_I18N = {
  'pre-cycle':      'GOODSOCIETY.cyclePhase.preCycle',
  'novel':          'GOODSOCIETY.cyclePhase.novel',
  'reputation':     'GOODSOCIETY.cyclePhase.reputation',
  'rumour-scandal': 'GOODSOCIETY.cyclePhase.rumourScandal',
  'epistolary':     'GOODSOCIETY.cyclePhase.epistolary',
  'upkeep':         'GOODSOCIETY.cyclePhase.upkeep',
  'ended':          'GOODSOCIETY.cyclePhase.ended',
};

/** Strip HTML tags from an HTMLField value to get plain text. */
function _stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Whether any non-GM user with OWNER access to `actor` is currently online.
 * Actors with no player-owner show as "inactive" in the footer count.
 */
function _ownerOnline(actor) {
  return game.users.some(u =>
    !u.isGM &&
    u.active &&
    actor.getUserLevel(u) >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
  );
}

/**
 * Build the context data for a single Major Character row.
 * @param {Actor} actor
 * @returns {Object}
 */
function _buildRowData(actor) {
  const sys = actor.system;

  // Display name: only honor an EXPLICIT persona selection. The data-model's
  // `activePersona` getter has a fallback chain (active → primary → first),
  // which is correct for token IMAGE resolution (always render someone) but
  // wrong for the displayed NAME — when the user picks "true identity" we
  // want the actor's canonical name, not the first-persona fallback.
  // (Same pattern as `_explicitPersona` in module/helpers/dock-context.js.)
  const explicitPersona = sys.activePersonaId
    ? (sys.personas ?? []).find(p => p.id === sys.activePersonaId)
    : null;
  const displayName = explicitPersona?.name || actor.name;
  // §8.5 — token-based image resolution. Image still uses the fallback so
  // every row always has something to render.
  const portraitUrl = profilePic(actor);
  const initial = (displayName || '?')[0].toUpperCase();

  // Role subtitle: localized archetype (the flavor-relevant identity descriptor;
  // peerage is social standing, shown elsewhere).
  const archetypeKey = `GOODSOCIETY.major.archetype.${sys.bio?.archetype ?? 'new-arrival'}`;
  const role = game.i18n.localize(archetypeKey);

  // Editable subhead from system.bio.title — free-form title or quick
  // description. Trim defensively so whitespace-only entries don't render
  // as a visible empty line.
  const title = (sys.bio?.title ?? '').trim();

  // Resolve pips — array of booleans (true = filled)
  const resolveMax = sys.tokens?.resolve?.max ?? 5;
  const resolveCurrent = sys.tokens?.resolve?.current ?? 0;
  const resolvePips = Array.from({ length: resolveMax }, (_, i) => i < resolveCurrent);

  const mtActive = sys.tokens?.major ?? false;
  const monologueAvailable = !(sys.tokens?.monologuedThisCycle ?? false);

  // Desire + visibility
  const desireVis = sys.visibility?.desire ?? 'secret';
  const desireText = _stripHtml(sys.desire ?? '');

  const ownerOnline = _ownerOnline(actor);

  // Reputation tags (always public per rulebook p.92)
  const positiveTags = actor.items.filter(
    i => i.type === 'reputation-tag' && i.system?.polarity === 'positive',
  ).map(t => ({ id: t.id, name: t.name }));
  const negativeTags = actor.items.filter(
    i => i.type === 'reputation-tag' && i.system?.polarity === 'negative',
  ).map(t => ({ id: t.id, name: t.name }));

  // Active reputation conditions
  const positiveConditions = actor.items.filter(
    i => i.type === 'reputation-condition' && i.system?.polarity === 'positive' && i.system?.active,
  ).map(c => ({ id: c.id, name: c.name }));
  const negativeConditions = actor.items.filter(
    i => i.type === 'reputation-condition' && i.system?.polarity === 'negative' && i.system?.active,
  ).map(c => ({ id: c.id, name: c.name }));

  const hasPosReputation = positiveTags.length > 0 || positiveConditions.length > 0;
  const hasNegReputation = negativeTags.length > 0 || negativeConditions.length > 0;

  // Accessible aria-label
  const desireDesc = desireVis === 'public' && desireText
    ? `Desire: ${desireText}`
    : `Desire: ${desireVis}`;
  const ariaLabel = [
    actor.name,
    `Resolve ${resolveCurrent} of ${resolveMax}`,
    mtActive ? 'MT active' : 'MT inactive',
    monologueAvailable ? 'Monologue available' : 'Monologue spent',
    desireDesc,
  ].join('. ');

  return {
    id: actor.id,
    name: displayName,
    theme: effectiveThemeOf(actor) || 'clayton',
    portraitUrl,
    initial,
    role,
    title,
    resolvePips,
    resolveMax,
    resolveCurrent,
    mtActive,
    monologueAvailable,
    desireVis,
    desireText,
    ownerOnline,
    ariaLabel,
    positiveTags,
    negativeTags,
    positiveConditions,
    negativeConditions,
    hasPosReputation,
    hasNegReputation,
    hasReputation: hasPosReputation || hasNegReputation,
  };
}

/**
 * Build the complete context for PublicInfoDashboard._prepareContext().
 * @returns {Object}
 */
export function buildDashboardContext() {
  const majors = (game.actors?.filter(a => a.type === 'major-character') ?? [])
    .map(_buildRowData);

  const activeMajorCount = majors.filter(m => m.ownerOnline).length;
  const inactiveNames    = majors.filter(m => !m.ownerOnline).map(m => m.name);

  const cyclePhase     = _readSetting('cyclePhase', 'pre-cycle');
  const cycleNumber    = _readSetting('cycleNumber', 1);
  const phaseLabelKey  = PHASE_I18N[cyclePhase] ?? PHASE_I18N['pre-cycle'];
  const cyclePhaseName = game.i18n.localize(phaseLabelKey);

  return {
    majors,
    noMajors:         majors.length === 0,
    activeMajorCount,
    totalMajorCount:  majors.length,
    inactiveNames,
    cyclePhase,
    cycleNumber,
    cyclePhaseName,
    isGM: game.user?.isGM ?? false,
  };
}
