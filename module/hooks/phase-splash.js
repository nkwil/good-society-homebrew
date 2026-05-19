/**
 * phase-splash.js — "oomph" for cycle phase changes.
 *
 * On every cycle phase change the system:
 *   1. plays a page-turn sound,
 *   2. (GM only) closes the active scene so the canvas drops to the Arrival,
 *   3. refreshes the Arrival, which renders a phase-specific splash
 *      (background + phase name) for phases keyed in `PHASE_SPLASHES`.
 *
 * `runPhaseSplash()` is invoked from the `cyclePhase` setting's `onChange`
 * (see `module/good-society.js`). A setting `onChange` fires on EVERY
 * connected client, so the sound plays everywhere with no socket needed; the
 * scene-close is gated to the GM and propagates normally.
 *
 * Gated by the world setting `phaseSplashEnabled` (default true).
 */

import { syncArrivalToCanvas } from '../apps/arrival.js';
import { PHASE_SPLASH_SOUND } from '../constants.js';

const NS = 'good-society-homebrew';

/**
 * React to a cycle phase change. Called once per change on every client.
 * @param {string} phase  the new `cyclePhase` value
 */
export function runPhaseSplash(phase) {
  let enabled = true;
  try { enabled = game.settings.get(NS, 'phaseSplashEnabled'); } catch { /* unregistered */ }
  if (!enabled) return;

  // 1. Page-turn sound — onChange runs on every client, so each plays it
  //    locally; no socket broadcast required.
  try {
    const AudioHelper = foundry.audio?.AudioHelper ?? globalThis.AudioHelper;
    AudioHelper?.play(
      { src: PHASE_SPLASH_SOUND, volume: 0.8, autoplay: true, loop: false },
      false,
    );
  } catch (err) {
    console.warn('GS | phase splash sound failed:', err);
  }

  // 2. Close the active scene (GM only) — drops every client's canvas to the
  //    empty state, where the Arrival picks up the phase splash. Fire-and-
  //    forget; the resulting updateScene propagates the Arrival to all.
  if (game.user?.isGM) {
    try {
      const active = game.scenes?.active;
      if (active) active.update({ active: false });
    } catch (err) {
      console.warn('GS | phase splash scene close failed:', err);
    }
  }

  // 3. Refresh the Arrival so a phase change with no active scene still
  //    swaps the splash background + title immediately.
  try { syncArrivalToCanvas(); } catch { /* arrival not available */ }
}
