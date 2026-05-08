/**
 * Reputation phase trigger hook.
 *
 * Fires when cyclePhase changes to 'reputation':
 *   - GM with reputationPhaseWizardEnabled=true → opens the shared Reputation Phase Wizard.
 *   - Non-GM users → toast notification only.
 *
 * Also fires on 'ready' if the world is already in a reputation phase when the
 * user connects (GM re-open path).
 *
 * Exported: register(), onReputationPhaseStart().
 */

import { openReputationPhaseWizard } from '../apps/reputation-phase-wizard.js';

export function onReputationPhaseStart() {
  if (!game.user.isGM) {
    ui.notifications?.info(
      game.i18n.localize('GOODSOCIETY.reputationPhaseWizard.playerToast'),
    );
    return;
  }

  const enabled = (() => {
    try { return game.settings.get('good-society-homebrew', 'reputationPhaseWizardEnabled'); }
    catch { return true; }
  })();
  if (!enabled) return;

  openReputationPhaseWizard();
}

export function register() {
  Hooks.once('ready', () => {
    const phase = (() => {
      try { return game.settings.get('good-society-homebrew', 'cyclePhase'); }
      catch { return null; }
    })();
    if (phase === 'reputation') onReputationPhaseStart();
  });
}
