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

import { CYCLE_PHASES, NEXT_PHASE } from '../helpers/dashboard-context.js';

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
};

/** Full canonical name keys, used for the current-phase pill and chat cards. */
const FULL_LABEL_KEY = {
  'pre-cycle':      'GOODSOCIETY.cyclePhase.preCycle',
  'novel':          'GOODSOCIETY.cyclePhase.novel',
  'reputation':     'GOODSOCIETY.cyclePhase.reputation',
  'rumour-scandal': 'GOODSOCIETY.cyclePhase.rumourScandal',
  'epistolary':     'GOODSOCIETY.cyclePhase.epistolary',
  'upkeep':         'GOODSOCIETY.cyclePhase.upkeep',
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

function _fullPhaseName(phaseId) {
  const key = FULL_LABEL_KEY[phaseId];
  return key ? game.i18n.localize(key) : phaseId;
}

function _stripPhaseLabel(phaseId) {
  const key = STRIP_LABEL_KEY[phaseId];
  return key ? game.i18n.localize(key) : phaseId;
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function _buildHtml() {
  const cycleNumber = _readSetting('cycleNumber', 1);
  const currentPhase = _readSetting('cyclePhase', 'pre-cycle');
  const isGM = _isGM();

  const cycleLabel = game.i18n.localize('GOODSOCIETY.hud.cycleLabel');
  const counterHtml = `
    <div class="gs-cycle-hud__counter">
      <span class="gs-cycle-hud__counter-label">${cycleLabel}</span>
      <span class="gs-cycle-hud__counter-number">${cycleNumber}</span>
    </div>`.trim();

  const currentIndex = CYCLE_PHASES.indexOf(currentPhase);

  let trackInner = '';
  for (let i = 0; i < CYCLE_PHASES.length; i++) {
    const phase = CYCLE_PHASES[i];

    // Connector before each phase (except first).
    if (i > 0) {
      // Connector is "complete" if it leads into a completed or current marker.
      const connComplete = i <= currentIndex;
      const connClass = connComplete
        ? 'gs-cycle-hud__connector--complete'
        : 'gs-cycle-hud__connector--future';
      trackInner += `<span class="gs-cycle-hud__connector ${connClass}" aria-hidden="true"></span>`;
    }

    if (i < currentIndex) {
      // Completed marker — filled dot, abbreviated label.
      const label = _stripPhaseLabel(phase);
      trackInner += `<span class="gs-phase-marker gs-phase-marker--complete" data-phase="${phase}">
  <span class="gs-phase-marker__dot" aria-hidden="true"></span>
  <span class="gs-phase-marker__label">${label}</span>
</span>`;
    } else if (i === currentIndex) {
      // Current marker — terracotta pill, full name.
      const label = _fullPhaseName(phase);
      trackInner += `<span class="gs-phase-marker gs-phase-marker--current" data-phase="${phase}" aria-current="step">
  <span class="gs-phase-marker__dot" aria-hidden="true"></span>
  <span class="gs-phase-marker__label">${label}</span>
</span>`;
    } else {
      // Future marker — outlined dot, abbreviated label.
      const label = _stripPhaseLabel(phase);
      trackInner += `<span class="gs-phase-marker gs-phase-marker--future" data-phase="${phase}">
  <span class="gs-phase-marker__dot" aria-hidden="true"></span>
  <span class="gs-phase-marker__label">${label}</span>
</span>`;
    }
  }

  const currentFullName = _fullPhaseName(currentPhase);
  const trackHtml = `<div class="gs-cycle-hud__track" role="list" aria-label="${game.i18n.localize('GOODSOCIETY.hud.trackAriaLabel')}">${trackInner}</div>`;

  const advanceLabel = game.i18n.localize('GOODSOCIETY.hud.advancePhase');
  const advanceHtml = isGM
    ? `<div class="gs-cycle-hud__advance">
  <button class="gs-cycle-hud__advance-btn" data-action="gs-advance-phase" type="button">${advanceLabel}</button>
</div>`
    : '<div class="gs-cycle-hud__advance gs-cycle-hud__advance--player"></div>';

  return `<div id="${HUD_ID}" class="gs-cycle-hud" role="status" aria-label="${game.i18n.format('GOODSOCIETY.hud.ariaLabel', { cycle: cycleNumber, phase: currentFullName })}">
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

// ── Advance Phase ─────────────────────────────────────────────────────────────

async function _doAdvancePhase() {
  const current = _readSetting('cyclePhase', 'pre-cycle');
  const next = NEXT_PHASE[current] ?? 'novel';
  const currentName = _fullPhaseName(current);
  const nextName = _fullPhaseName(next);

  const confirmed = window.confirm(
    game.i18n.format('GOODSOCIETY.hud.advanceConfirm', { current: currentName, next: nextName })
  );
  if (!confirmed) return;

  const updates = [game.settings.set(NS, 'cyclePhase', next)];

  if (current === 'upkeep') {
    const cycleNum = _readSetting('cycleNumber', 1);
    updates.push(game.settings.set(NS, 'cycleNumber', cycleNum + 1));
  }

  await Promise.all(updates);

  // Reset monologuedThisCycle when wrapping upkeep → novel, if setting is on.
  if (current === 'upkeep' && _readSetting('autoRefreshOnUpkeep', true)) {
    const majors = game.actors?.filter(a => a.type === 'major-character') ?? [];
    for (const actor of majors) {
      await actor.update({ 'system.tokens.monologuedThisCycle': false });
    }
  }

  await ChatMessage.create({
    content: `<div class="gs-chat-system"><p>${game.i18n.format('GOODSOCIETY.hud.advancePosted', { phase: nextName })}</p></div>`,
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    speaker: { alias: game.i18n.localize('GOODSOCIETY.dashboard.systemAlias') },
  });
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
    if (!_isGM()) return;
    const btn = ev.target instanceof HTMLElement
      ? ev.target.closest('[data-action="gs-advance-phase"]')
      : null;
    if (!btn) return;
    ev.preventDefault();
    _doAdvancePhase();
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
