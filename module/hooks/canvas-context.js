/**
 * Canvas right-click context hook — opens NPC Quick-Create on empty canvas.
 *
 * Only fires for the GM, only when right-clicking empty canvas (not on a
 * placed token, tile, drawing, etc.). Detected by checking whether the PIXI
 * event target is the stage itself rather than a child interactive object.
 *
 * Re-wires on canvasReady so scene changes don't lose the listener.
 */

import { NpcQuickCreate } from '../apps/npc-quick-create.js';

export function register() {
  Hooks.once('ready', _wire);
  Hooks.on('canvasReady', _wire);
}

function _wire() {
  canvas.stage?.off('rightdown', _onCanvasRightDown);
  canvas.stage?.on('rightdown', _onCanvasRightDown);
}

function _onCanvasRightDown(event) {
  if (!game.user?.isGM || !canvas.scene) return;
  // event.target is the topmost PIXI object under the cursor.
  // When it equals canvas.stage the click landed on empty canvas.
  if (event.target !== canvas.stage) return;
  const pos = { x: canvas.mousePosition.x, y: canvas.mousePosition.y };
  new NpcQuickCreate(pos).render(true);
}
