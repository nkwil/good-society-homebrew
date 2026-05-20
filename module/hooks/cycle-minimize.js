/**
 * cycle-minimize.js — minimize the system's tool windows when the cycle
 * phase advances, so the table starts the new phase with a clean canvas.
 *
 * Listens for `goodSociety.cyclePhaseChanged`, iterates every rendered
 * ApplicationV2 whose id starts with `gs-`, and calls `.minimize()` on
 * each — EXCEPT for the persistent / in-flight surfaces in the skip list
 * (cabinet, dock, cycle HUD, active monologue or story-beat overlay).
 *
 * The windows aren't closed — `.minimize()` keeps them in the Foundry
 * window manager so users can bring them back with a single click on the
 * minimized tab. This is the difference between "tidy up between scenes"
 * and "destroy the GM's work."
 */

/** App ids that should NOT be minimized on phase change. */
const KEEP_OPEN_IDS = new Set([
  'gs-cabinet',                  // the Cabinet rail/drawer
  'gs-my-characters-dock',       // persistent dock
  'gs-cycle-hud',                // persistent HUD
  'gs-monologue-overlay',        // active in-flight monologue
  'gs-monologue-picker',         // monologue picker dialog mid-flow
  'gs-story-beat-overlay',       // active in-flight story beat
  'gs-story-beats-command-center', // the GM's command center
]);

function _minimizeSystemTools() {
  const map = foundry.applications.instances;
  if (!map) return;
  let minimized = 0;
  for (const [id, app] of map.entries()) {
    if (!id?.startsWith?.('gs-')) continue;
    if (KEEP_OPEN_IDS.has(id)) continue;
    if (!app?.rendered) continue;
    // Only minimize windows that ACTUALLY have a frame to minimize.
    // Frameless apps treat .minimize() as a no-op (or worse, error). We
    // detect frame status via the documented `window.frame` option, but
    // also try / catch so a hostile app can't break the loop.
    const hasFrame = app.options?.window?.frame !== false;
    if (!hasFrame) continue;
    try {
      app.minimize?.();
      minimized++;
    } catch (err) {
      console.warn(`GS | cycle-minimize: ${id} failed to minimize:`, err);
    }
  }
  if (minimized) {
    console.log(`GS | cycle-minimize: tidied ${minimized} tool window(s) for the new phase.`);
  }
}

export function register() {
  Hooks.on('goodSociety.cyclePhaseChanged', () => _minimizeSystemTools());
}
