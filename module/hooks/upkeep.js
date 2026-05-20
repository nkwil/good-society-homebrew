/**
 * Upkeep phase trigger hooks.
 *
 * Fires when cyclePhase changes to 'upkeep':
 *   - Non-GM users with upkeepWizardEnabled=true → wizard per owned Major.
 *   - GM → UpkeepRoster.
 *
 * Also fires on 'ready' to open wizards for users who were offline when
 * Upkeep began and have not yet completed it.
 *
 * Exported: register(), onUpkeepPhaseStart().
 */

import { openUpkeepWizard } from '../apps/upkeep-wizard.js';
import { openUpkeepRoster } from '../apps/upkeep-roster.js';
import { createCycleDivider, promptCycleSummary } from '../helpers/cycle-divider.js';

/**
 * Called by good-society.js when cyclePhase changes to 'upkeep'.
 * Safe to call multiple times — guards against re-entry if already handled.
 */
export function onUpkeepPhaseStart() {
  // Auto-create the cycle divider on transition into upkeep (post-MVP §13.4),
  // then prompt the GM to write a free-form cycle summary for the novel.
  // Both GM-client-only and idempotent — the prompt skips itself if the GM
  // has already written one this cycle.
  if (game.user?.isGM) {
    let cycleNumber = null;
    try { cycleNumber = game.settings.get('good-society-homebrew', 'cycleNumber'); } catch {}
    if (cycleNumber != null) {
      createCycleDivider(cycleNumber)
        .then(() => {
          // Defer the prompt so the Roster has time to mount first; the GM
          // sees their wrap-up state, then the summary modal lands on top.
          setTimeout(() => {
            promptCycleSummary(cycleNumber).catch(err =>
              console.warn('GS | cycle summary prompt failed:', err),
            );
          }, 600);
        })
        .catch(err =>
          console.warn('GS | cycle divider auto-create failed (non-fatal):', err),
        );
    }
  }

  if (game.user.isGM) {
    openUpkeepRoster();
    return;
  }

  const enabled = (() => {
    try { return game.settings.get('good-society-homebrew', 'upkeepWizardEnabled'); }
    catch { return true; }
  })();
  if (!enabled) return;

  // Collect owned Majors that haven't completed Upkeep yet
  const pending = (game.actors?.contents ?? [])
    .filter(a => a.type === 'major-character' && a.isOwner)
    .filter(a => !a.getFlag('good-society-homebrew', 'upkeepCompletedAt'));

  if (pending.length === 0) return;

  _openSequential(pending);
}

/**
 * Re-open the Upkeep flow on demand (e.g. user clicked the 'upk' marker in
 * the Cycle HUD to revisit the wizard). Unlike onUpkeepPhaseStart(), this
 * does NOT skip actors that already have an upkeepCompletedAt flag — the
 * user explicitly asked to re-enter, so let them.
 *
 * GM gets the Roster; players get the per-Major wizard queue for every owned
 * Major. No-op when the user has no qualifying actors.
 */
export function reopenUpkeepFlow() {
  if (game.user.isGM) {
    openUpkeepRoster();
    return;
  }

  const enabled = (() => {
    try { return game.settings.get('good-society-homebrew', 'upkeepWizardEnabled'); }
    catch { return true; }
  })();
  if (!enabled) {
    ui.notifications?.info(
      game.i18n.localize('GOODSOCIETY.upkeepWizard.disabled')
    );
    return;
  }

  const owned = (game.actors?.contents ?? [])
    .filter(a => a.type === 'major-character' && a.isOwner);
  if (owned.length === 0) {
    ui.notifications?.info(
      game.i18n.localize('GOODSOCIETY.upkeepWizard.noOwnedMajors')
    );
    return;
  }

  _openSequential(owned);
}

/**
 * Register hook — call from good-society.js Hooks.once('ready').
 * If the world is already in Upkeep when the user connects, open their wizard.
 */
export function register() {
  Hooks.once('ready', () => {
    const phase = (() => {
      try { return game.settings.get('good-society-homebrew', 'cyclePhase'); }
      catch { return null; }
    })();
    if (phase === 'upkeep') onUpkeepPhaseStart();
  });
}

// ── Private helpers ────────────────────────────────────────────────────────

/** Open wizards sequentially with a 600ms gap between them. */
async function _openSequential(actors) {
  for (let i = 0; i < actors.length; i++) {
    await openUpkeepWizard(actors[i]);
    if (i < actors.length - 1) {
      await new Promise(r => setTimeout(r, 600));
    }
  }
}
