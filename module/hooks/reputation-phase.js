/**
 * Reputation phase trigger hooks.
 *
 * Fires when cyclePhase changes to 'reputation':
 *   - GM with reputationPhaseWizardEnabled=true → opens the shared GM Reputation Phase Wizard.
 *   - Non-GM with owned Majors → opens per-Major queue sequentially (mirrors Upkeep pattern).
 *   - Non-GM with no owned Majors → toast notification only.
 *
 * Also fires on 'ready' to re-open wizards for users who were offline when
 * Reputation phase began and have not yet completed it. Completed Majors
 * (reputationPhaseCompletedAt flag set) are skipped on the initial queue,
 * but re-open (reopenReputationPhaseFlow) skips nothing.
 *
 * Exported: register(), onReputationPhaseStart(), reopenReputationPhaseFlow().
 */

import { openReputationPhaseWizard } from '../apps/reputation-phase-wizard.js';
import { openPlayerReputationPhaseWizard } from '../apps/player-reputation-phase-wizard.js';

export function onReputationPhaseStart() {
  if (game.user.isGM) {
    const enabled = (() => {
      try { return game.settings.get('good-society-homebrew', 'reputationPhaseWizardEnabled'); }
      catch { return true; }
    })();
    if (!enabled) return;
    openReputationPhaseWizard();
    return;
  }

  const enabled = (() => {
    try { return game.settings.get('good-society-homebrew', 'reputationPhaseWizardEnabled'); }
    catch { return true; }
  })();
  if (!enabled) return;

  // Collect owned Majors that have not yet completed this phase
  const pending = (game.actors?.contents ?? [])
    .filter(a => a.type === 'major-character' && a.isOwner)
    .filter(a => !a.getFlag('good-society-homebrew', 'reputationPhaseCompletedAt'));

  if (pending.length === 0) {
    ui.notifications?.info(
      game.i18n.localize('GOODSOCIETY.reputationPhaseWizard.playerToast'),
    );
    return;
  }

  _openSequential(pending);
}

/**
 * Re-open the Reputation Phase flow on demand (e.g. user clicked the rep
 * marker in the Cycle HUD). Unlike onReputationPhaseStart(), this does NOT
 * skip actors that already have a reputationPhaseCompletedAt flag — the user
 * explicitly asked to re-enter.
 *
 * GM gets the GM wizard; players get the per-Major queue for every owned Major.
 * Mirrors reopenUpkeepFlow() from hooks/upkeep.js.
 */
export function reopenReputationPhaseFlow() {
  if (game.user.isGM) {
    openReputationPhaseWizard();
    return;
  }

  const enabled = (() => {
    try { return game.settings.get('good-society-homebrew', 'reputationPhaseWizardEnabled'); }
    catch { return true; }
  })();
  if (!enabled) {
    ui.notifications?.info(
      game.i18n.localize('GOODSOCIETY.reputationPhaseWizard.playerToast'),
    );
    return;
  }

  const owned = (game.actors?.contents ?? [])
    .filter(a => a.type === 'major-character' && a.isOwner);

  if (owned.length === 0) {
    ui.notifications?.info(
      game.i18n.localize('GOODSOCIETY.playerReputationPhaseWizard.noOwnedMajors'),
    );
    return;
  }

  _openSequential(owned);
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

// ── Private helpers ────────────────────────────────────────────────────────

/** Open player wizards sequentially with a 600ms gap between them. */
async function _openSequential(actors) {
  for (let i = 0; i < actors.length; i++) {
    await openPlayerReputationPhaseWizard(actors[i]);
    if (i < actors.length - 1) {
      await new Promise(r => setTimeout(r, 600));
    }
  }
}
