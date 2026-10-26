/**
 * Scene Controls — registers the "Public Info Dashboard" button in the
 * Foundry canvas left-hand tool panel.
 *
 * Foundry v13.346+ changed `getSceneControlButtons` to pass `controls` as an
 * OBJECT keyed by control name (e.g. `{ tokens, notes, walls, ... }`), not
 * an array. Each control's `tools` is also an object keyed by tool name.
 * Older v13 builds (pre-.346) passed arrays. We handle both shapes.
 *
 * We attach to the 'notes' control group (map pins) so we don't have to
 * declare a canvas layer. The button fires a callback (button: true) — it
 * does not activate a persistent tool.
 */

import { openDashboard } from '../apps/public-info-dashboard.js';
import { openEventTimeline } from '../apps/event-timeline.js';
import { openLetterComposer } from '../apps/letter-composer.js';
import { openRumourBoard } from '../apps/rumour-board.js';
import { openNovelReader } from '../apps/novel-reader.js';
import { openCastOfCharacters } from '../apps/cast-of-characters.js';
import { openGmToolsPopover, findGmToolsAnchor } from '../apps/gm-tools-popover.js';

/**
 * Drop the local canvas to the Arrival splash — without needing another
 * scene to activate. Three cases:
 *   1. There IS an active scene → deactivate it (Foundry tears down the
 *      canvas for all clients).
 *   2. No active scene but the GM is still viewing one (a non-active scene
 *      pulled up just to look at) → tear down the local canvas explicitly.
 *   3. Already at the splash → toast "splash already showing" and bail.
 *
 * Either path ends with arrival-sync deciding to show the Arrival.
 */
export async function returnToSplash() {
  const active = game.scenes?.active;
  const viewed = canvas?.scene ?? game.scenes?.viewed;

  // Case 3: nothing to do.
  if (!active && !viewed) {
    ui.notifications?.info(game.i18n.localize('GOODSOCIETY.phaseSplash.noActiveScene'));
    // Belt-and-suspenders — re-run the arrival sync just in case it didn't
    // render on the most recent canvas/scene transition.
    try {
      const { syncArrivalToCanvas } = await import('../apps/arrival.js');
      await syncArrivalToCanvas();
    } catch { /* arrival unavailable */ }
    return;
  }

  // Case 1: deactivate the active scene world-wide.
  if (active) {
    try {
      await active.update({ active: false });
    } catch (err) {
      console.warn('GS | return-to-splash deactivate failed:', err);
      ui.notifications?.error('Could not deactivate the active scene.');
      return;
    }
  }

  // Case 2 (or case 1 fallback): tear down the local canvas if anything
  // is still being viewed. Foundry doesn't expose a public "unview" API;
  // tearDown clears the canvas, and the canvasReady-style hooks let the
  // arrival-sync re-evaluate and show the splash.
  try {
    if (canvas?.scene) {
      await canvas.tearDown();
    }
  } catch (err) {
    console.warn('GS | return-to-splash tearDown failed:', err);
  }

  // Final defensive push — ensure the Arrival renders even if the hook
  // chain (updateScene → arrival-sync) didn't fire for some reason.
  try {
    const { syncArrivalToCanvas } = await import('../apps/arrival.js');
    await syncArrivalToCanvas();
  } catch (err) {
    console.warn('GS | return-to-splash arrival render failed:', err);
  }
}

export function register() {
  Hooks.on('getSceneControlButtons', (controls) => {
    // Prefer the 'notes' control group; fall back to the first group.
    // `controls` may be an array (older v13) or an object (v13.346+).
    let target;
    if (Array.isArray(controls)) {
      target = controls.find(c => c.name === 'notes') ?? controls[0];
    } else {
      target = controls.notes ?? Object.values(controls)[0];
    }
    if (!target?.tools) return;

    const dashboardTool = {
      name: 'gs-dashboard',
      title: 'GOODSOCIETY.dashboard.sceneControlTitle',
      icon: 'fa-solid fa-users',
      button: true,
      onChange: () => openDashboard(),
      visible: true,
    };

    // GM Tools — one scene button that opens a popover listing the five
    // GM-only tools (events, cast manager, organizer, permissions, session
    // log, splash return). Replaces the five separate scene buttons we
    // used to render, cutting canvas-chrome clutter for GMs who also have
    // the Cabinet open. Players never see this button.
    const gmToolsTool = {
      name: 'gs-gm-tools',
      title: 'GOODSOCIETY.gmToolsPopover.sceneControlTitle',
      icon: 'fa-solid fa-gears',
      button: true,
      onChange: () => openGmToolsPopover({ anchor: findGmToolsAnchor() }),
      visible: game.user?.isGM,
    };

    const calendarTool = {
      name: 'gs-calendar',
      title: 'GOODSOCIETY.eventTimeline.sceneControlTitle',
      icon: 'fa-solid fa-calendar',
      button: true,
      onChange: () => openEventTimeline(),
      // Visible to all — the timeline app enforces read-only mode for non-GMs.
      visible: true,
    };

    const letterTool = {
      name: 'gs-letter',
      title: 'GOODSOCIETY.letterComposer.sceneControlTitle',
      icon: 'fa-solid fa-envelope',
      button: true,
      onChange: () => openLetterComposer(),
      visible: true,
    };

    const rumourTool = {
      name: 'gs-rumours',
      title: 'GOODSOCIETY.rumourBoard.sceneControlTitle',
      icon: 'fa-solid fa-comments',
      button: true,
      onChange: () => openRumourBoard(),
      // Visible to all — the board itself enforces read-only mode for non-GMs.
      // Players need an always-available path to see what rumours are at play.
      visible: true,
    };

    // Post-MVP §13.3 — Novel Reader entry point. Visible to all.
    const novelReaderTool = {
      name: 'gs-novel-reader',
      title: 'GOODSOCIETY.novel.sceneControlTitle',
      icon: 'fa-solid fa-book-open',
      button: true,
      onChange: () => openNovelReader(),
      visible: true,
    };

    // Cast of Characters — viewer for everyone. GMs reach the "Manage"
    // path via the GM Tools popover (above), which keeps this scene
    // button in a single read-only mode for all users.
    const castTool = {
      name: 'gs-cast',
      title: 'GOODSOCIETY.castOfCharacters.sceneControlTitle',
      icon: 'fa-solid fa-masks-theater',
      button: true,
      onChange: () => openCastOfCharacters(),
      visible: true,
    };

    // tools may be an array (older v13) or an object (v13.346+).
    if (Array.isArray(target.tools)) {
      target.tools.push(dashboardTool, calendarTool, letterTool, rumourTool, novelReaderTool, castTool, gmToolsTool);
    } else {
      target.tools['gs-dashboard']    = dashboardTool;
      target.tools['gs-calendar']     = calendarTool;
      target.tools['gs-letter']       = letterTool;
      target.tools['gs-rumours']      = rumourTool;
      target.tools['gs-novel-reader'] = novelReaderTool;
      target.tools['gs-cast']         = castTool;
      target.tools['gs-gm-tools']     = gmToolsTool;
    }
  });
}
