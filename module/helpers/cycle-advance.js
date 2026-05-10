/**
 * cycle-advance.js — single source of truth for advancing the cycle.
 *
 * Both the Cycle HUD's "Advance Phase" button and the Public Info Dashboard's
 * "Advance Phase ↗" button call advanceCyclePhase(). Centralizing here means
 * the position-aware logic, final-cycle skips, end-of-game state, and chat
 * card emission live in one place.
 *
 * Per rulebook p.112 (cycle structure: 8 ordered positions per cycle) and
 * p.114-115 (final cycle skips Rumour & Scandal + 2nd Reputation; ends after
 * the epilogue epistolary).
 *
 * Public API:
 *   advanceCyclePhase()          — async, prompts confirmation, runs advance.
 *   markFinalCycle(isFinal)      — async, sets the GM-only isFinalCycle flag.
 *   getCycleState()              — returns { position, phase, cycleNumber, isFinalCycle }.
 */

import {
  CYCLE_POSITIONS,
  POSITION_OCCURRENCE,
  advanceFromPosition,
} from './dashboard-context.js';
import { postSystemCard } from './chat-cards.js';

const NS = 'good-society-homebrew';

function _read(key, fallback) {
  try { return game.settings.get(NS, key); }
  catch { return fallback; }
}

/** Localize a phase name; respects the position-occurrence suffix where present. */
function _phaseLabel(phaseId, position) {
  const baseKey = {
    'pre-cycle':      'GOODSOCIETY.cyclePhase.preCycle',
    'novel':          'GOODSOCIETY.cyclePhase.novel',
    'reputation':     'GOODSOCIETY.cyclePhase.reputation',
    'rumour-scandal': 'GOODSOCIETY.cyclePhase.rumourScandal',
    'epistolary':     'GOODSOCIETY.cyclePhase.epistolary',
    'upkeep':         'GOODSOCIETY.cyclePhase.upkeep',
    'ended':          'GOODSOCIETY.cyclePhase.ended',
  }[phaseId];
  const base = baseKey ? game.i18n.localize(baseKey) : phaseId;

  const occurrence = POSITION_OCCURRENCE[position];
  if (!occurrence) return base;

  // "Novel (1st)" / "Novel (2nd)" — keys live under GOODSOCIETY.cyclePosition.suffix.*
  const suffixKey = `GOODSOCIETY.cyclePosition.suffix.${occurrence}`;
  const suffix = game.i18n.localize(suffixKey);
  // If the suffix key is missing, fall back to base label without suffix.
  if (suffix === suffixKey) return base;
  return `${base} ${suffix}`;
}

/** Return the current cycle state in one call. */
export function getCycleState() {
  return {
    position:     _read('cyclePosition', 0),
    phase:        _read('cyclePhase', 'pre-cycle'),
    cycleNumber:  _read('cycleNumber', 1),
    isFinalCycle: _read('isFinalCycle', false),
  };
}

/**
 * Advance the cycle by one position. Reads current state, computes next state
 * via advanceFromPosition(), confirms with the GM, then writes both cyclePosition
 * and cyclePhase (plus cycleNumber on wrap, and clears isFinalCycle on game end).
 * Posts a system chat card describing the transition.
 *
 * Caller is expected to be GM. Non-GM callers will fail silently when the
 * world-scoped settings.set call rejects.
 */
export async function advanceCyclePhase() {
  // GM-only — non-GM clients can't write the world-scoped cycle settings.
  // Without this guard the call would still fail, but with a confusing
  // settings-rejection error rather than a clean no-op.
  if (!game.user?.isGM) {
    ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.hud.gmOnlyAdvance'));
    return;
  }
  const { position, isFinalCycle, cycleNumber } = getCycleState();

  // Compute next state (skips, wraps, end).
  const transition = advanceFromPosition(position, isFinalCycle);
  const { nextPos, nextPhase, wrapsCycle, gameEnds, skippedPos } = transition;

  // No-op: already in 'ended' state.
  if (position === 9) {
    ui.notifications?.info(game.i18n.localize('GOODSOCIETY.hud.gameAlreadyEnded'));
    return;
  }

  // Confirm.
  const currentPhase = CYCLE_POSITIONS[position] ?? 'pre-cycle';
  const currentLabel = _phaseLabel(currentPhase, position);
  const nextLabel    = _phaseLabel(nextPhase, nextPos);

  let confirmKey = 'GOODSOCIETY.hud.advanceConfirm';
  if (skippedPos !== null) confirmKey = 'GOODSOCIETY.hud.advanceConfirmWithSkip';
  if (wrapsCycle)          confirmKey = 'GOODSOCIETY.hud.advanceConfirmWrap';
  if (gameEnds)            confirmKey = 'GOODSOCIETY.hud.advanceConfirmEnd';

  const skippedLabel = skippedPos !== null
    ? _phaseLabel(CYCLE_POSITIONS[skippedPos], skippedPos)
    : '';

  const confirmed = window.confirm(game.i18n.format(confirmKey, {
    current: currentLabel,
    next:    nextLabel,
    skipped: skippedLabel,
    cycle:   wrapsCycle ? cycleNumber + 1 : cycleNumber,
  }));
  if (!confirmed) return;

  // Build updates. cyclePhase and cyclePosition are written in parallel; both
  // have onChange handlers but the HUD's render is debounced (100ms) so the
  // double-fire collapses into one render.
  const updates = [
    game.settings.set(NS, 'cyclePosition', nextPos),
    game.settings.set(NS, 'cyclePhase',    nextPhase),
  ];

  if (wrapsCycle) {
    updates.push(game.settings.set(NS, 'cycleNumber', cycleNumber + 1));
  }

  // Reset monologuedThisCycle on cycle wrap (only when not ending the game),
  // honoring autoRefreshOnUpkeep.
  if (wrapsCycle && _read('autoRefreshOnUpkeep', true)) {
    const majors = game.actors?.filter(a => a.type === 'major-character') ?? [];
    for (const actor of majors) {
      updates.push(actor.update({ 'system.tokens.monologuedThisCycle': false }));
    }
  }

  // On game end, clear isFinalCycle so that if the GM starts a new game in the
  // same world (advancing past 'ended' isn't supported, but they could reset
  // settings manually), the next game starts clean.
  if (gameEnds) {
    updates.push(game.settings.set(NS, 'isFinalCycle', false));
  }

  await Promise.all(updates);

  // Post-MVP §13.4 — fire the canonical phase-change + (when applicable)
  // game-ended hooks so subscribers (Epistolary phase auto-open / close,
  // Novel Reader auto-open) react.
  Hooks.callAll('goodSociety.cyclePhaseChanged', nextPhase);
  if (gameEnds) {
    Hooks.callAll('goodSociety.gameEnded', { cycleNumber, finalPhase: nextPhase });
  }

  // Chat card.
  const cardKey = gameEnds
    ? 'GOODSOCIETY.hud.advancePostedEnd'
    : skippedPos !== null
      ? 'GOODSOCIETY.hud.advancePostedSkip'
      : wrapsCycle
        ? 'GOODSOCIETY.hud.advancePostedWrap'
        : 'GOODSOCIETY.hud.advancePosted';

  try {
    await postSystemCard({
      content: game.i18n.format(cardKey, {
        phase:   nextLabel,
        skipped: skippedLabel,
        cycle:   wrapsCycle ? cycleNumber + 1 : cycleNumber,
      }),
      context: 'cycle',
    });
  } catch (err) {
    console.warn('GS | advance chat card failed:', err);
  }
}

/**
 * Toggle the isFinalCycle flag. GM-only. Posts a system card so all players
 * see the announcement (per rulebook p.114 step 1: "Let everyone know that
 * the game is entering its final cycle").
 */
export async function markFinalCycle(isFinal) {
  if (!game.user?.isGM) return;
  await game.settings.set(NS, 'isFinalCycle', isFinal);
  try {
    const key = isFinal
      ? 'GOODSOCIETY.hud.finalCyclePosted'
      : 'GOODSOCIETY.hud.finalCycleClearedPosted';
    await postSystemCard({
      content: game.i18n.localize(key),
      context: 'cycle',
    });
  } catch (err) {
    console.warn('GS | final-cycle chat card failed:', err);
  }
}
