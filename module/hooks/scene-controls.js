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

    // tools may be an array (older v13) or an object (v13.346+).
    if (Array.isArray(target.tools)) {
      target.tools.push(dashboardTool, organizerTool, permissionsTool, endSessionTool, calendarTool);
    } else {
      target.tools['gs-dashboard'] = dashboardTool;
      target.tools['gs-organizer'] = organizerTool;
      target.tools['gs-permissions'] = permissionsTool;
      target.tools['gs-end-session'] = endSessionTool;
      target.tools['gs-calendar']    = calendarTool;
    }
  });
}
