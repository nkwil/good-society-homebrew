/**
 * Rumour & Scandal phase trigger hook.
 *
 * Fires when cyclePhase changes to 'rumour-scandal':
 *   - All clients (GM + players) → opens the singleton Rumour Wizard.
 *
 * Also fires on 'ready' if the world is already mid-phase when a user
 * connects.
 *
 * Per docs/design/32-rumour-wizard.md.
 */

import { openRumourWizard } from '../apps/rumour-wizard.js';

export function onRumourPhaseStart() {
  openRumourWizard();
}

export function register() {
  Hooks.once('ready', () => {
    const phase = (() => {
      try { return game.settings.get('good-society-homebrew', 'cyclePhase'); }
      catch { return null; }
    })();
    if (phase === 'rumour-scandal') onRumourPhaseStart();
  });
}
