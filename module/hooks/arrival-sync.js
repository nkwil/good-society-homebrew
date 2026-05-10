/**
 * Arrival sync — drives `syncArrivalToCanvas()` on every relevant Foundry
 * canvas/scene event. Per post-MVP §2.1 / patch-world-identity §4.4.
 */

import { syncArrivalToCanvas } from '../apps/arrival.js';

export function register() {
  Hooks.on('canvasReady', () => { syncArrivalToCanvas(); });
  Hooks.on('canvasInit',  () => { syncArrivalToCanvas(); });
  Hooks.on('updateScene', (scene, change) => {
    // Only re-sync when the active flag changed — every other scene update is
    // irrelevant to the arrival state.
    if ('active' in (change ?? {})) syncArrivalToCanvas();
  });
  Hooks.on('deleteScene', () => { syncArrivalToCanvas(); });
}
