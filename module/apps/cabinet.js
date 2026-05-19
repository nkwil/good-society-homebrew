/**
 * The Cabinet — player module menu. Post-MVP §9 / patch-cabinet.md.
 *
 * Frameless ApplicationV2 docked to the right edge of the viewport. Default
 * state is a single vertical rail of glyphs. Clicking the toggle expands a
 * drawer with per-surface visibility toggles. State persists per user via
 * `game.user.flags['good-society-homebrew'].cabinetVisibility`.
 *
 * Hiding a surface flips a body class; surface CSS keys off that class via
 * `display: none !important`. Toggling is reversible — nothing is unregistered.
 */

import { COWORK_SURFACES, CHROME_ICONS } from '../constants.js';
import { toggleOrganizer } from './npc-organizer.js';
import { openBulkPermissionsPanel } from './bulk-permissions-panel.js';
import { openSessionLogPreview } from './session-log-preview.js';
import { openEventTimeline } from './event-timeline.js';
import { openRumourBoard } from './rumour-board.js';
import { openDashboard } from './public-info-dashboard.js';
import { openNovelReader } from './novel-reader.js';
import { openEventCommandCenter } from './event-command-center.js';
import { openEpistolaryInbox } from './epistolary-wizard.js';
import { openPregameChecklist } from './pregame-checklist.js';
import { openNovelPhasePopup } from './novel-phase-popup.js';
import { openConditionsCompendium, findConditionsCompendiumPack } from '../helpers/conditions-compendium.js';
import { openMonologueFromCabinet, monologueFlowApp } from './monologue-overlay.js';
import { openResetCampaign } from '../helpers/reset-campaign.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const FLAG_SCOPE = 'good-society-homebrew';
const FLAG_KEY = 'cabinetVisibility';

let _instance = null;

const GROUP_LABELS = {
  system:  'GOODSOCIETY.cabinet.group.system',
  tools:   'GOODSOCIETY.cabinet.group.tools',
  gmTools: 'GOODSOCIETY.cabinet.group.gmTools',
  modules: 'GOODSOCIETY.cabinet.group.modules',
  foundry: 'GOODSOCIETY.cabinet.group.foundry',
};

/**
 * Launcher functions for `kind: 'launcher'` surfaces. Keyed by the
 * `launcherKey` field on the COWORK_SURFACES entry. Each value is a
 * zero-arg function that opens the corresponding modal/dialog.
 *
 * Adding a new launcher: import its opener, add an entry here, add the
 * matching `launcherKey` to a COWORK_SURFACES entry with `kind: 'launcher'`.
 */
const LAUNCHERS = {
  organizer:   () => toggleOrganizer(),
  permissions: () => openBulkPermissionsPanel(),
  sessionLog:  () => openSessionLogPreview(),
  calendar:    () => openEventTimeline(),
  rumours:     () => openRumourBoard(),
  dashboard:   () => openDashboard(),
  novelReader: () => openNovelReader(),
  events:      () => openEventCommandCenter(),
  inbox:       () => openEpistolaryInbox(),
  pregame:     () => openPregameChecklist(),
  novelPhase:  () => openNovelPhasePopup(),
  monologue:    () => openMonologueFromCabinet(),
  conditions:   () => openConditionsCompendium(),
  resetCampaign: () => openResetCampaign(),
};

/**
 * The fixed ApplicationV2 `id` each launcher opens — lets the Cabinet render
 * launcher rows as live open/closed toggles (via `foundry.applications.
 * instances`) rather than one-way "open" buttons.
 *
 * `conditions` and `monologue` have no entry: `conditions` opens a compendium
 * pack window and `monologue` runs a multi-step picker flow — both are
 * tracked specially in `_launcherApp`.
 */
const LAUNCHER_APP_IDS = {
  organizer:   'gs-npc-organizer',
  permissions: 'gs-bulk-permissions-panel',
  sessionLog:  'gs-session-log-preview',
  calendar:    'gs-event-timeline',
  rumours:     'gs-rumour-board',
  dashboard:   'gs-public-info-dashboard',
  novelReader: 'gs-novel-reader',
  events:      'gs-event-command-center',
  inbox:       'gs-epistolary-wizard',
  pregame:       'gs-pregame-checklist',
  novelPhase:    'gs-novel-phase-popup',
  // Reset Campaign is an "action" launcher — the only thing rendered is a
  // confirm dialog. Tracking it lets a second toggle-click close the confirm
  // and abort the reset.
  resetCampaign: 'gs-reset-campaign-confirm',
};

export class CabinetApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-cabinet',
    classes: ['good-society', 'gs-cabinet'],
    window: { frame: false, positioned: false, title: '' },
    position: { width: 'auto', height: 'auto' },
    actions: {
      toggleSurface: CabinetApp.#toggleSurface,
      toggleDrawer:  CabinetApp.#toggleDrawer,
      hideAll:       CabinetApp.#hideAll,
      showAll:       CabinetApp.#showAll,
    },
  };

  static PARTS = {
    cabinet: { template: 'systems/good-society-homebrew/templates/apps/cabinet.hbs' },
  };

  /** Drawer open/closed — instance state, doesn't persist between sessions. */
  _drawerOpen = false;

  /** Resolve the visibility map from user flags (or empty default). */
  get visibility() {
    return game.user?.getFlag(FLAG_SCOPE, FLAG_KEY) ?? {};
  }

  /** Resolve a single surface's visibility (default-aware). */
  isVisible(surfaceId) {
    const persisted = this.visibility[surfaceId];
    if (typeof persisted === 'boolean') return persisted;
    return COWORK_SURFACES.find(s => s.id === surfaceId)?.defaultVisible ?? true;
  }

  /** Resolve the live Application a launcher surface controls, if any is
   *  currently constructed. Returns null when nothing is open. */
  _launcherApp(surface) {
    // `monologue` runs a multi-step picker flow — tracked by its picker id.
    if (surface.launcherKey === 'monologue') return monologueFlowApp();
    const appId = LAUNCHER_APP_IDS[surface.launcherKey];
    if (appId) return foundry.applications.instances?.get(appId) ?? null;
    // `conditions` opens a compendium pack window — tracked via the pack.
    if (surface.launcherKey === 'conditions') {
      const pack = findConditionsCompendiumPack();
      return pack?.apps?.find(a => a.rendered) ?? null;
    }
    return null;
  }

  /** Whether a launcher surface's window is currently open. */
  _isLauncherOpen(surface) {
    return !!this._launcherApp(surface)?.rendered;
  }

  /** Close whatever window a launcher surface controls. */
  async _closeLauncher(surface) {
    const app = this._launcherApp(surface);
    if (app?.rendered) await app.close();
  }

  /** Filter the registry to surfaces whose gates are satisfied:
   *   - `ifModule` — only when the named module is active
   *   - `gmOnly`   — only for GM users
   */
  _activeSurfaces() {
    const isGM = !!game.user?.isGM;
    return COWORK_SURFACES.filter(s => {
      if (s.gmOnly && !isGM) return false;
      if (s.ifModule && !game.modules?.get(s.ifModule)?.active) return false;
      return true;
    });
  }

  /** Apply visibility classes to <body> for each known toggleable surface.
   *  Launchers have no visibility state and are skipped. */
  _applyVisibility() {
    for (const surface of this._activeSurfaces()) {
      if (surface.kind === 'launcher' || !surface.hideBodyClass) continue;
      const visible = this.isVisible(surface.id);
      document.body.classList.toggle(surface.hideBodyClass, !visible);
    }
  }

  async _setVisible(surfaceId, value) {
    const next = { ...this.visibility, [surfaceId]: value };
    await game.user.setFlag(FLAG_SCOPE, FLAG_KEY, next);
    this._applyVisibility();
    // No re-render: the toggle's `is-on` class is flipped in place by
    // `_reflectToggle` so the CSS transition animates. A full re-render would
    // replace the element and skip the animation.
  }

  /**
   * Flip a surface's toggle switch (and its rail dot, for persistent
   * surfaces) on the live DOM. Flipping the class in place lets the CSS
   * transition animate; it also avoids the re-render race where a launcher
   * window's async render hasn't finished yet and the toggle reads stale.
   *
   * @param {string}  surfaceId
   * @param {boolean} on
   */
  _reflectToggle(surfaceId, on) {
    const root = this.element;
    if (!root) return;
    const sw = root.querySelector(`.gs-cabinet-toggle[data-surface-id="${surfaceId}"]`);
    if (sw) {
      sw.classList.toggle('is-on', on);
      sw.setAttribute('aria-checked', String(on));
    }
    // Rail dots track persistent surfaces only (launcher windows can't be
    // tracked live on the always-visible rail).
    const surface = COWORK_SURFACES.find(s => s.id === surfaceId);
    if (surface && surface.kind !== 'launcher') {
      const rail = root.querySelector(`.gs-cabinet-rail-btn[data-surface-id="${surfaceId}"]`);
      rail?.classList.toggle('is-active', on);
    }
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const surfaces = this._activeSurfaces();

    // Group by `group` field — order preserved from registry.
    const groups = {};
    for (const s of surfaces) {
      groups[s.group] ??= [];
      const iconEntry = CHROME_ICONS.cabinetRail?.[s.id];
      const isLauncher = s.kind === 'launcher';
      groups[s.group].push({
        ...s,
        // Every row renders as a toggle. Persistent surfaces report their
        // body-class visibility; launchers report whether their window is
        // currently open.
        visible: isLauncher ? this._isLauncherOpen(s) : this.isVisible(s.id),
        isLauncher,
        label: game.i18n.localize(s.label),
        iconAsset: iconEntry?.asset ?? null,
      });
    }

    // Rail membership: any surface that ships a railGlyph or a cabinet-rail
    // SVG icon. Every rail button toggles its surface — launchers open/close
    // their window, persistent surfaces flip a body class.
    const railGroups = Object.entries(groups).map(([key, items]) => ({
      key,
      items: items.filter(i => i.railGlyph || i.iconAsset),
    })).filter(g => g.items.length > 0);

    ctx.groupLabels = Object.fromEntries(
      Object.entries(GROUP_LABELS).map(([k, key]) => [k, game.i18n.localize(key)]),
    );
    ctx.groups = groups;
    ctx.railGroups = railGroups;
    ctx.drawerOpen = this._drawerOpen;
    return ctx;
  }

  /** Hook Esc to close the drawer when open. Also re-anchor the rail to
   *  sit flush above the macro hotbar — the hotbar's rendered height
   *  varies with Foundry version, chrome-theme state, and macro-page-
   *  controls visibility, and Foundry sometimes repaints the hotbar
   *  AFTER our render runs. We subscribe to multiple events so the
   *  Cabinet always tracks the hotbar's actual top edge. */
  _onRender(ctx, options) {
    super._onRender?.(ctx, options);
    // Defensive: every render re-applies the flag → body-class mapping so the
    // hide-state can never drift from what the toggles in the drawer claim.
    // (A stale `gs-hide-sidebar` class from a prior session that wasn't
    // cleared by user click would otherwise persist invisibly.)
    this._applyVisibility();
    if (this._escHandler) document.removeEventListener('keydown', this._escHandler);
    this._escHandler = (ev) => {
      if (ev.key === 'Escape' && this._drawerOpen) {
        this._drawerOpen = false;
        this.render({ parts: ['cabinet'] });
      }
    };
    document.addEventListener('keydown', this._escHandler);

    // Anchor immediately, then again after the next paint (Foundry's
    // hotbar styles sometimes finish resolving after our render runs).
    this._anchorAboveHotbar();
    requestAnimationFrame(() => this._anchorAboveHotbar());

    // Re-anchor on viewport resize.
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
    this._resizeHandler = () => this._anchorAboveHotbar();
    window.addEventListener('resize', this._resizeHandler);

    // Re-anchor whenever Foundry redraws the hotbar (page change, macro
    // assignment, lock toggle, etc.). The hotbar's rendered height can
    // change between renders, so we tie our position to its updates.
    if (this._hotbarHookId == null) {
      this._hotbarHookId = Hooks.on('renderHotbar', () => {
        // Defer one frame so Foundry's CSS classes settle first.
        requestAnimationFrame(() => this._anchorAboveHotbar());
      });
    }

    // Defense-in-depth: watch the hotbar element for size changes (e.g.
    // Foundry reflowing its macro list to multiple rows) and re-anchor.
    // ResizeObserver fires whenever the hotbar's bounding box changes,
    // which the `renderHotbar` hook alone doesn't always catch (Foundry
    // sometimes resizes the hotbar after the render hook has fired).
    if (this._hotbarResizeObserver) this._hotbarResizeObserver.disconnect();
    const hotbar = document.querySelector('#hotbar');
    if (hotbar && typeof ResizeObserver !== 'undefined') {
      this._hotbarResizeObserver = new ResizeObserver(() => {
        this._anchorAboveHotbar();
      });
      this._hotbarResizeObserver.observe(hotbar);
    }
  }

  /** Measure the hotbar's actual rendered top edge and pin the Cabinet's
   *  bottom to that value. Uses `getBoundingClientRect().top` rather than
   *  `offsetHeight` because the former includes any margin/transform/etc.
   *  Foundry might apply at the chrome layer. Falls back to 80px when
   *  the hotbar isn't measurable yet. */
  _anchorAboveHotbar() {
    if (!this.element) return;
    const hotbar = document.querySelector('#hotbar');
    const rect = hotbar?.getBoundingClientRect();
    // Hotbar absent OR hidden (display:none → zero-size rect): the Cabinet
    // rests at a fixed margin off the viewport bottom rather than trying to
    // measure a surface that isn't there. Without this, a hidden hotbar
    // reports rect.top = 0 and the Cabinet would fly to the top of the screen.
    if (!hotbar || !rect || rect.height === 0) {
      this.element.style.bottom = '24px';
      return;
    }
    // Distance from viewport bottom to hotbar's top edge.
    const hotbarTopFromBottom = window.innerHeight - rect.top;
    // 2 px gap so the two surfaces read as one composite UI without
    // visually merging into the same pill.
    const bottom = Math.max(0, hotbarTopFromBottom + 2);
    this.element.style.bottom = `${bottom}px`;
  }

  async _onClose(options) {
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    if (this._hotbarHookId != null) {
      Hooks.off('renderHotbar', this._hotbarHookId);
      this._hotbarHookId = null;
    }
    if (this._hotbarResizeObserver) {
      this._hotbarResizeObserver.disconnect();
      this._hotbarResizeObserver = null;
    }
    await super._onClose?.(options);
  }

  // ── Action handlers ──────────────────────────────────────────────────────

  /** Toggle a surface. Persistent surfaces flip a body class; launcher
   *  surfaces open their window when off and close it when on. The switch
   *  is flipped optimistically on the live DOM (so it animates and never
   *  lags an async window render); state is only re-read on the next full
   *  render (e.g. when the drawer is reopened). */
  static async #toggleSurface(event, target) {
    const surfaceId = target.dataset.surfaceId;
    if (!surfaceId) return;
    const surface = COWORK_SURFACES.find(s => s.id === surfaceId);
    if (!surface) return;

    if (surface.kind === 'launcher') {
      const wasOpen = this._isLauncherOpen(surface);
      if (wasOpen) {
        // Closing — flip the switch in place, keep the drawer open.
        this._reflectToggle(surfaceId, false);
        try {
          await this._closeLauncher(surface);
        } catch (err) {
          console.error(`[GS Cabinet] Launcher "${surfaceId}" close failed:`, err);
          this._reflectToggle(surfaceId, true); // revert on failure
        }
        return;
      }
      // Opening — flip the switch on, launch the window, and keep the
      // drawer open. The window is lifted above the Cabinet afterwards.
      this._reflectToggle(surfaceId, true);
      try {
        const fn = LAUNCHERS[surface.launcherKey];
        if (typeof fn === 'function') await fn();
        else console.warn(`[GS Cabinet] No launcher registered for "${surfaceId}".`);
      } catch (err) {
        console.error(`[GS Cabinet] Launcher "${surfaceId}" open failed:`, err);
        this._reflectToggle(surfaceId, false); // revert on failure
        return;
      }
      // Defer one frame so the window has finished its async render, then
      // pull it to the front above the still-open Cabinet drawer, AND
      // re-sync the switch with reality. The sync matters for "action"
      // launchers (Reset Campaign): after the confirm dialog dismisses,
      // nothing is rendered, so the switch should flip back to OFF instead
      // of staying optimistically ON.
      requestAnimationFrame(() => {
        const app = this._launcherApp(surface);
        if (app?.bringToFront) app.bringToFront();
        else if (app?.bringToTop) app.bringToTop();
        this._reflectToggle(surface.id, !!app?.rendered);
      });
      return;
    }

    const next = !this.isVisible(surfaceId);
    this._reflectToggle(surfaceId, next);
    await this._setVisible(surfaceId, next);
  }

  static #toggleDrawer() {
    this._drawerOpen = !this._drawerOpen;
    this.render({ parts: ['cabinet'] });
  }

  static async #hideAll() {
    const surfaces = this._activeSurfaces();
    // Persistent surfaces — hide via body class.
    const next = surfaces
      .filter(s => s.kind !== 'launcher')
      .reduce((o, s) => ({ ...o, [s.id]: false }), {});
    await game.user.setFlag(FLAG_SCOPE, FLAG_KEY, next);
    this._applyVisibility();
    // Launcher surfaces — close any open popup windows too.
    for (const s of surfaces) {
      if (s.kind !== 'launcher' || !this._isLauncherOpen(s)) continue;
      try {
        await this._closeLauncher(s);
      } catch (err) {
        console.error(`[GS Cabinet] hideAll: closing "${s.id}" failed:`, err);
      }
    }
    this.render({ parts: ['cabinet'] });
  }

  static async #showAll() {
    const next = this._activeSurfaces()
      .filter(s => s.kind !== 'launcher')
      .reduce((o, s) => ({ ...o, [s.id]: true }), {});
    await game.user.setFlag(FLAG_SCOPE, FLAG_KEY, next);
    this._applyVisibility();
    this.render({ parts: ['cabinet'] });
  }
}

/**
 * Public API — render or get the singleton, gate on the `cabinetEnabled`
 * setting, and apply current visibility on first load.
 */
export async function renderCabinet() {
  let enabled = true;
  try { enabled = game.settings.get('good-society-homebrew', 'cabinetEnabled'); } catch {}

  if (!enabled) {
    if (_instance?.rendered) await _instance.close();
    _instance = null;
    return null;
  }

  if (!_instance) _instance = new CabinetApp();
  if (!_instance.rendered) {
    await _instance.render(true);
  }
  _instance._applyVisibility();
  return _instance;
}

export function getCabinet() {
  return _instance;
}
