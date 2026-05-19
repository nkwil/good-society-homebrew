/**
 * Cycle Phase HUD Strip — persistent 40px bar injected into #ui-top above
 * the scene navigation tabs.
 *
 * Per docs/design/08-cycle-phase-hud.md.
 *
 * Architectural choice: vanilla DOM injection (not ApplicationV2).
 * The design doc says "not ApplicationV2 — too heavy"; CLAUDE.md §16
 * forbids Application v1; vanilla DOM matches the spirit of both.
 * Same pattern as rule-tooltip.js and the Speaking-As switcher.
 *
 * Re-render is triggered by onChange callbacks wired to cyclePhase and
 * cycleNumber in good-society.js (debounced to 100ms to handle the upkeep
 * wrap where both settings change in rapid succession).
 *
 * Advance-phase logic here also handles autoRefreshOnUpkeep (resetting
 * monologuedThisCycle flags). The dashboard's #advancePhase action does
 * not yet implement this — that's a follow-up, not a blocker.
 *
 * Narrow-viewport collapse (<800px / <600px, per design doc §"Edge cases")
 * is deferred to a follow-up; CSS overflow: hidden prevents layout breakage.
 */

import {
  CYCLE_POSITIONS,
  POSITION_OCCURRENCE,
  FINAL_CYCLE_SKIP,
} from '../helpers/dashboard-context.js';
import { advanceCyclePhase, markFinalCycle } from '../helpers/cycle-advance.js';
import { reopenUpkeepFlow } from '../hooks/upkeep.js';
import { reopenReputationPhaseFlow } from '../hooks/reputation-phase.js';

const NS = 'good-society-homebrew';
const HUD_ID = 'gs-cycle-hud';
const RERENDER_DEBOUNCE_MS = 100;

/** Strip display labels — abbreviated for the compact HUD track. */
const STRIP_LABEL_KEY = {
  'pre-cycle':      'GOODSOCIETY.hud.phase.preCycle',
  'novel':          'GOODSOCIETY.hud.phase.novel',
  'reputation':     'GOODSOCIETY.hud.phase.reputation',
  'rumour-scandal': 'GOODSOCIETY.hud.phase.rumourScandal',
  'epistolary':     'GOODSOCIETY.hud.phase.epistolary',
  'upkeep':         'GOODSOCIETY.hud.phase.upkeep',
  'ended':          'GOODSOCIETY.hud.phase.ended',
};

/** Full canonical name keys, used for the current-phase pill and chat cards. */
const FULL_LABEL_KEY = {
  'pre-cycle':      'GOODSOCIETY.cyclePhase.preCycle',
  'novel':          'GOODSOCIETY.cyclePhase.novel',
  'reputation':     'GOODSOCIETY.cyclePhase.reputation',
  'rumour-scandal': 'GOODSOCIETY.cyclePhase.rumourScandal',
  'epistolary':     'GOODSOCIETY.cyclePhase.epistolary',
  'upkeep':         'GOODSOCIETY.cyclePhase.upkeep',
  'ended':          'GOODSOCIETY.cyclePhase.ended',
};

let _debounceTimer = null;
let _observer = null;
let _listenerAttached = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

function _readSetting(key, fallback) {
  try { return game.settings.get(NS, key); }
  catch { return fallback; }
}

function _isGM() {
  return game.user?.isGM ?? false;
}

function _fullPhaseName(phaseId, position) {
  const key = FULL_LABEL_KEY[phaseId];
  const base = key ? game.i18n.localize(key) : phaseId;
  const occurrence = position != null ? POSITION_OCCURRENCE[position] : null;
  if (!occurrence) return base;
  const sKey = `GOODSOCIETY.cyclePosition.suffix.${occurrence}`;
  const suffix = game.i18n.localize(sKey);
  if (suffix === sKey) return base;
  return `${base} ${suffix}`;
}

function _stripPhaseLabel(phaseId, position) {
  const key = STRIP_LABEL_KEY[phaseId];
  const base = key ? game.i18n.localize(key) : phaseId;
  const occurrence = position != null ? POSITION_OCCURRENCE[position] : null;
  if (!occurrence) return base;
  // Compact suffix on the strip — "Novel ²" rather than "Novel (2nd)".
  const compactKey = `GOODSOCIETY.cyclePosition.compactSuffix.${occurrence}`;
  const compact = game.i18n.localize(compactKey);
  if (compact === compactKey) return base;
  return `${base}${compact}`;
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function _buildHtml() {
  const cycleNumber  = _readSetting('cycleNumber', 1);
  const currentPos   = _readSetting('cyclePosition', 0);
  const isFinalCycle = _readSetting('isFinalCycle', false);
  const currentPhase = _readSetting('cyclePhase', 'pre-cycle');
  const isGM = _isGM();
  const ended = currentPhase === 'ended' || currentPos === 9;

  const cycleLabel = game.i18n.localize('GOODSOCIETY.hud.cycleLabel');
  const finalBadge = isFinalCycle && !ended
    ? `<span class="gs-cycle-hud__final-badge" title="${game.i18n.localize('GOODSOCIETY.hud.finalCycleBadgeHint')}">${game.i18n.localize('GOODSOCIETY.hud.finalCycleBadge')}</span>`
    : '';
  const counterHtml = `
    <div class="gs-cycle-hud__counter">
      <span class="gs-cycle-hud__counter-label">${cycleLabel}</span>
      <span class="gs-cycle-hud__counter-number">${cycleNumber}</span>
      ${finalBadge}
    </div>`.trim();

  // Render 8 positional markers (1-8). Position 0 (pre-cycle) and 9 (ended)
  // are conveyed by the current-phase styling: when currentPos is 0, every
  // marker is rendered as 'future'; when currentPos is 9, every marker is
  // rendered as 'complete' and an 'ended' pill follows the track.
  let trackInner = '';
  for (let pos = 1; pos <= 8; pos++) {
    const phase = CYCLE_POSITIONS[pos];
    const skipped = isFinalCycle && FINAL_CYCLE_SKIP.has(pos);

    // Connector before each marker (except first).
    if (pos > 1) {
      let connClass;
      if (currentPos >= pos)        connClass = 'gs-cycle-hud__connector--complete';
      else if (currentPos === pos - 1) connClass = 'gs-cycle-hud__connector--current';
      else                          connClass = 'gs-cycle-hud__connector--future';
      trackInner += `<span class="gs-cycle-hud__connector ${connClass}" aria-hidden="true"></span>`;
    }

    let stateClass;
    let label;
    if (ended || pos < currentPos) {
      // Already passed this position (or game ended) — render as complete even
      // if the position would have been skipped under the current final-cycle
      // flag. The flag may have been toggled mid-cycle, in which case the
      // "skipped" position actually ran before the toggle.
      stateClass = 'gs-phase-marker--complete';
      label = _stripPhaseLabel(phase, pos);
    } else if (pos === currentPos) {
      stateClass = 'gs-phase-marker--current';
      label = _fullPhaseName(phase, pos);
    } else if (skipped) {
      // Future position, marked for skip on advance.
      stateClass = 'gs-phase-marker--skipped';
      label = _stripPhaseLabel(phase, pos);
    } else {
      stateClass = 'gs-phase-marker--future';
      label = _stripPhaseLabel(phase, pos);
    }

    const ariaCurrent = (pos === currentPos && !ended) ? ' aria-current="step"' : '';
    const skippedHint = skipped
      ? ` title="${game.i18n.localize('GOODSOCIETY.hud.skippedHint')}"`
      : '';
    trackInner += `<span class="gs-phase-marker ${stateClass}" data-phase="${phase}" data-position="${pos}"${ariaCurrent}${skippedHint}>
  <span class="gs-phase-marker__dot" aria-hidden="true"></span>
  <span class="gs-phase-marker__label">${label}</span>
</span>`;
  }

  // 'Ended' pill rendered after the track when the game is over.
  const endedPillHtml = ended
    ? `<span class="gs-phase-marker gs-phase-marker--ended" aria-current="step">
  <span class="gs-phase-marker__dot" aria-hidden="true"></span>
  <span class="gs-phase-marker__label">${game.i18n.localize('GOODSOCIETY.cyclePhase.ended')}</span>
</span>`
    : '';

  const currentFullName = ended
    ? game.i18n.localize('GOODSOCIETY.cyclePhase.ended')
    : _fullPhaseName(currentPhase, currentPos);
  const trackHtml = `<div class="gs-cycle-hud__track" role="list" aria-label="${game.i18n.localize('GOODSOCIETY.hud.trackAriaLabel')}">${trackInner}${endedPillHtml}</div>`;

  // GM controls: advance button + final-cycle toggle pill.
  let advanceHtml;
  if (isGM) {
    const advanceLabel = game.i18n.localize('GOODSOCIETY.hud.advancePhase');
    const advanceDisabled = ended ? 'disabled' : '';
    const finalToggleLabel = game.i18n.localize('GOODSOCIETY.hud.finalCycleToggle');
    const finalToggleHint  = game.i18n.localize('GOODSOCIETY.hud.finalCycleToggleHint');
    const finalActiveClass = isFinalCycle ? 'gs-cycle-hud__final-toggle--on' : '';
    advanceHtml = `<div class="gs-cycle-hud__advance">
  <button class="gs-cycle-hud__final-toggle ${finalActiveClass}" data-action="gs-toggle-final-cycle" type="button" title="${finalToggleHint}" aria-pressed="${isFinalCycle ? 'true' : 'false'}">
    <span class="gs-cycle-hud__final-toggle-dot" aria-hidden="true"></span>
    <span class="gs-cycle-hud__final-toggle-label">${finalToggleLabel}</span>
  </button>
  <button class="gs-cycle-hud__advance-btn" data-action="gs-advance-phase" type="button" ${advanceDisabled}>${advanceLabel}</button>
</div>`;
  } else {
    advanceHtml = '<div class="gs-cycle-hud__advance gs-cycle-hud__advance--player"></div>';
  }

  const ariaLabel = game.i18n.format('GOODSOCIETY.hud.ariaLabel', { cycle: cycleNumber, phase: currentFullName });
  const endedClass = ended ? ' gs-cycle-hud--ended' : '';
  return `<div id="${HUD_ID}" class="gs-cycle-hud${endedClass}" role="status" aria-label="${ariaLabel}">
  ${counterHtml}
  ${trackHtml}
  ${advanceHtml}
</div>`;
}

// ── Injection ─────────────────────────────────────────────────────────────────

function _inject() {
  const uiTop = document.querySelector('#ui-top');
  if (!uiTop) return;

  const existing = document.getElementById(HUD_ID);
  if (existing) existing.remove();

  const wrapper = document.createElement('div');
  wrapper.innerHTML = _buildHtml();
  const hud = wrapper.firstElementChild;
  if (!hud) return;

  // Insert before #navigation so the HUD sits above the scene tabs.
  const nav = uiTop.querySelector('#navigation');
  if (nav) {
    uiTop.insertBefore(hud, nav);
  } else {
    uiTop.prepend(hud);
  }
}

// ── Re-render (replaces element in-place; CSS animation on --current fires) ──

function _rerender() {
  const existing = document.getElementById(HUD_ID);
  if (!existing) {
    _inject();
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = _buildHtml();
  const newEl = wrapper.firstElementChild;
  if (newEl) existing.replaceWith(newEl);
}

// ── Advance Phase + Final Cycle Toggle ────────────────────────────────────────
// Both actions delegate to module/helpers/cycle-advance.js so the Public Info
// Dashboard's identical buttons share the same logic.

async function _onToggleFinalCycle() {
  if (!_isGM()) return;
  const current = _readSetting('isFinalCycle', false);
  await markFinalCycle(!current);
}

// ── Observer — re-inject if Foundry strips the HUD ───────────────────────────

function _attachObserver() {
  if (_observer) return;
  const uiTop = document.querySelector('#ui-top');
  if (!uiTop) return;

  _observer = new MutationObserver(() => {
    if (!document.getElementById(HUD_ID)) _inject();
  });
  _observer.observe(uiTop, { childList: true });
}

// ── Delegated click listener ──────────────────────────────────────────────────

function _attachListeners() {
  if (_listenerAttached) return;
  _listenerAttached = true;

  // Capture-phase delegation — survives re-renders (CLAUDE.md §16 anti-pattern).
  document.addEventListener('click', (ev) => {
    if (!(ev.target instanceof HTMLElement)) return;

    // Upkeep marker click — anyone (GM or player) can re-open the upkeep flow.
    // Marker carries data-phase="upkeep". Lives outside the GM-only branch so
    // players can re-open their own wizard after closing it accidentally.
    const upkeepMarker = ev.target.closest('.gs-phase-marker[data-phase="upkeep"]');
    if (upkeepMarker) {
      ev.preventDefault();
      reopenUpkeepFlow();
      return;
    }

    // Reputation marker click — both occurrences (positions 2 + 6) carry
    // data-phase="reputation", so one handler covers both. Anyone can click.
    const repMarker = ev.target.closest('.gs-phase-marker[data-phase="reputation"]');
    if (repMarker) {
      ev.preventDefault();
      reopenReputationPhaseFlow();
      return;
    }

    // Novel marker click — opens the Novel-phase informational popup.
    // Anyone can click; covers both Novel¹ and Novel² occurrences.
    const novelMarker = ev.target.closest('.gs-phase-marker[data-phase="novel"]');
    if (novelMarker) {
      ev.preventDefault();
      // Lazy import to avoid a circular dep between cycle-hud and the popup.
      import('./novel-phase-popup.js').then(m => m.openNovelPhasePopup?.());
      return;
    }

    // Remaining controls are GM-only.
    if (!_isGM()) return;

    const advance = ev.target.closest('[data-action="gs-advance-phase"]');
    if (advance) {
      ev.preventDefault();
      advanceCyclePhase();
      return;
    }

    const finalToggle = ev.target.closest('[data-action="gs-toggle-final-cycle"]');
    if (finalToggle) {
      ev.preventDefault();
      _onToggleFinalCycle();
    }
  }, { capture: true });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialize the HUD. Call once from Hooks.once('ready').
 * Injects the strip, sets up the MutationObserver, and attaches the delegated
 * click listener. Re-renders are driven by onChange callbacks on cyclePhase and
 * cycleNumber in good-society.js.
 */
export function initCycleHud() {
  _inject();
  _attachObserver();
  _attachListeners();
}

/**
 * Re-render the HUD in place. Debounced internally.
 * Called from onChange callbacks in good-society.js so rapid consecutive
 * setting changes (upkeep wrap: both cyclePhase + cycleNumber update) collapse
 * into one render.
 */
export function renderCycleHud() {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(_rerender, RERENDER_DEBOUNCE_MS);
}
