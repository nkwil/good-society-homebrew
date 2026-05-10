/**
 * Epistolary phase hook — post-MVP §11.
 *
 * Auto-opens the wizard for each Major-owner user when `cyclePhase` becomes
 * `epistolary`; auto-closes when the phase advances away. The GM additionally
 * gets the Roster.
 *
 * Mirrors the pattern in reputation-phase.js: ready-time check picks up the
 * world's current phase so a refresh during epistolary re-opens the wizard.
 * Phase change is detected via the `cyclePhase` setting's `onChange` (which
 * is set up by the cycle-advance helper); we also listen on the canonical
 * `goodSociety.cyclePhaseChanged` hook for completeness.
 */

import { openEpistolaryWizard, openEpistolaryRoster, closeEpistolaryWizard, closeEpistolaryRoster } from '../apps/epistolary-wizard.js';

const FLAG_SCOPE = 'good-society-homebrew';

let _lastPhase = null;

function _onPhaseChange(newPhase) {
  if (newPhase === 'epistolary') {
    onEpistolaryPhaseStart();
  } else if (_lastPhase === 'epistolary' && newPhase !== 'epistolary') {
    closeEpistolaryWizard();
    closeEpistolaryRoster();
  }
  _lastPhase = newPhase;
}

export function onEpistolaryPhaseStart() {
  const myMajors = (game.actors?.filter(
    (a) => a.type === 'major-character' && a.testUserPermission(game.user, 'OWNER'),
  ) ?? []);

  if (myMajors.length > 0) {
    openEpistolaryWizard(myMajors[0].id);
  }
  if (game.user?.isGM) {
    openEpistolaryRoster();
  }
}

/** Re-open the flow on demand from an HUD click etc. */
export function reopenEpistolaryFlow() {
  onEpistolaryPhaseStart();
}

export function register() {
  Hooks.once('ready', () => {
    const phase = (() => {
      try { return game.settings.get(FLAG_SCOPE, 'cyclePhase'); }
      catch { return null; }
    })();
    _lastPhase = phase;
    if (phase === 'epistolary') onEpistolaryPhaseStart();
  });

  // Listen for canonical phase-change hook (emitted by cycle-advance.js when
  // it lands the per-cycle helpers). Also fall back to a direct setting
  // onChange watcher.
  Hooks.on('goodSociety.cyclePhaseChanged', (phase) => _onPhaseChange(phase));
}
