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
import { toggleOrganizer } from '../apps/npc-organizer.js';
import { openBulkPermissionsPanel } from '../apps/bulk-permissions-panel.js';
import { openSessionLogPreview } from '../apps/session-log-preview.js';
import { openEventTimeline } from '../apps/event-timeline.js';
import { openLetterComposer } from '../apps/letter-composer.js';
import { openRumourBoard } from '../apps/rumour-board.js';
import { openNovelReader } from '../apps/novel-reader.js';
import { openEventCommandCenter } from '../apps/event-command-center.js';

/**
 * Deactivate the active scene so the canvas drops to the Arrival splash —
 * without needing another scene to activate. Foundry has no built-in
 * "no active scene" control; this provides one. The Arrival then renders
 * the current phase's splash (or the default) via arrival-sync.
 */
async function _returnToSplash() {
  const active = game.scenes?.active;
  if (!active) {
    ui.notifications?.info(game.i18n.localize('GOODSOCIETY.phaseSplash.noActiveScene'));
    return;
  }
  try {
    await active.update({ active: false });
  } catch (err) {
    console.warn('GS | return-to-splash failed:', err);
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

    const organizerTool = {
      name: 'gs-organizer',
      title: 'GOODSOCIETY.npcOrganizer.sceneControlTitle',
      icon: 'fa-solid fa-list',
      button: true,
      onChange: () => toggleOrganizer(),
      visible: game.user?.isGM,
    };

    const permissionsTool = {
      name: 'gs-permissions',
      title: 'GOODSOCIETY.bulkPermissions.sceneControlTitle',
      icon: 'fa-solid fa-key',
      button: true,
      onChange: () => openBulkPermissionsPanel(),
      visible: game.user?.isGM,
    };

    const endSessionTool = {
      name: 'gs-end-session',
      title: 'GOODSOCIETY.sessionLog.sceneControlTitle',
      icon: 'fa-solid fa-book-bookmark',
      button: true,
      onChange: () => openSessionLogPreview(),
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

    // Random-event GM command center — GM-only.
    const eventsTool = {
      name: 'gs-events',
      title: 'GOODSOCIETY.eventCommandCenter.sceneControlTitle',
      icon: 'fa-solid fa-bolt',
      button: true,
      onChange: () => openEventCommandCenter(),
      visible: game.user?.isGM,
    };

    // Deactivate the active scene → drop to the Arrival splash. GM-only.
    const splashTool = {
      name: 'gs-return-to-splash',
      title: 'GOODSOCIETY.phaseSplash.sceneControlTitle',
      icon: 'fa-solid fa-door-open',
      button: true,
      onChange: () => _returnToSplash(),
      visible: game.user?.isGM,
    };

    // tools may be an array (older v13) or an object (v13.346+).
    if (Array.isArray(target.tools)) {
      target.tools.push(dashboardTool, organizerTool, permissionsTool, endSessionTool, calendarTool, letterTool, rumourTool, novelReaderTool, eventsTool, splashTool);
    } else {
      target.tools['gs-dashboard']        = dashboardTool;
      target.tools['gs-organizer']        = organizerTool;
      target.tools['gs-permissions']      = permissionsTool;
      target.tools['gs-end-session']      = endSessionTool;
      target.tools['gs-calendar']         = calendarTool;
      target.tools['gs-letter']           = letterTool;
      target.tools['gs-rumours']          = rumourTool;
      target.tools['gs-novel-reader']     = novelReaderTool;
      target.tools['gs-events']           = eventsTool;
      target.tools['gs-return-to-splash'] = splashTool;
    }
  });
}
