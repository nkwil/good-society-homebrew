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
import { openLetterComposer } from './letter-composer.js';
import { openRumourBoard } from './rumour-board.js';
import { openDashboard } from './public-info-dashboard.js';
import { openNovelReader } from './novel-reader.js';
import { openEventCommandCenter } from './event-command-center.js';

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
  letter:      () => openLetterComposer(),
  rumours:     () => openRumourBoard(),
  dashboard:   () => openDashboard(),
  novelReader: () => openNovelReader(),
  events:      () => openEventCommandCenter(),
};

export class CabinetApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-cabinet',
    classes: ['good-society', 'gs-cabinet'],
    window: { frame: false, positioned: false, title: '' },
    position: { width: 'auto', height: 'auto' },
    actions: {
      toggleSurface: CabinetApp.#toggleSurface,
      launchSurface: CabinetApp.#launchSurface,
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
    this.render({ parts: ['cabinet'] });
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
        // Toggleable surfaces carry a real visibility flag; launchers don't.
        visible: isLauncher ? null : this.isVisible(s.id),
        isLauncher,
        label: game.i18n.localize(s.label),
        iconAsset: iconEntry?.asset ?? null,
      });
    }

    // Rail membership: any surface that ships a railGlyph or a cabinet-rail
    // SVG icon. Launchers can be in the rail too — clicking opens the modal
    // (launchSurface), unlike toggleables which flip a body class.
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
    if (!hotbar) {
      this.element.style.bottom = '80px';
      return;
    }
    const rect = hotbar.getBoundingClientRect();
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

  static async #toggleSurface(event, target) {
    const surfaceId = target.dataset.surfaceId;
    if (!surfaceId) return;
    const wasVisible = this.isVisible(surfaceId);
    return this._setVisible(surfaceId, !wasVisible);
  }

  /** Open the launcher modal for a `kind: 'launcher'` surface. Does NOT
   *  toggle visibility (launchers don't have visibility state). */
  static async #launchSurface(event, target) {
    const surfaceId = target.dataset.surfaceId;
    if (!surfaceId) return;
    const surface = COWORK_SURFACES.find(s => s.id === surfaceId);
    const fn = surface?.launcherKey ? LAUNCHERS[surface.launcherKey] : null;
    if (typeof fn !== 'function') {
      console.warn(`[GS Cabinet] No launcher registered for surface "${surfaceId}".`);
      return;
    }
    try {
      await fn();
    } catch (err) {
      console.error(`[GS Cabinet] Launcher "${surfaceId}" failed:`, err);
    }
  }

  static #toggleDrawer() {
    this._drawerOpen = !this._drawerOpen;
    this.render({ parts: ['cabinet'] });
  }

  static async #hideAll() {
    const next = this._activeSurfaces()
      .filter(s => s.kind !== 'launcher')
      .reduce((o, s) => ({ ...o, [s.id]: false }), {});
    await game.user.setFlag(FLAG_SCOPE, FLAG_KEY, next);
    this._applyVisibility();
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
