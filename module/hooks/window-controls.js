/**
 * window-controls.js — universal collapse/expand button injector.
 *
 * Foundry v13's ApplicationV2 supports `app.minimize()` / `app.maximize()`
 * as methods, but the default window frame ships only a close button —
 * users have no visible affordance to collapse a window. This hook closes
 * that gap for every framed Good Society window in one place.
 *
 * How it works:
 *   1. On `ready`, scan all already-rendered `.application` elements and
 *      inject a minimize button into each eligible window header.
 *   2. Set up a MutationObserver on `document.body` so any future
 *      ApplicationV2 render gets the same treatment automatically — no
 *      per-app code, no class-name enumeration, no risk of forgetting a
 *      new app.
 *
 * The button toggles between fa-window-minimize (when expanded) and
 * fa-window-maximize (when minimized). It's a no-op for frameless apps
 * (they have no header) and for the in-flight overlays we explicitly
 * want NOT to minimize (story beat overlay, monologue overlay, Arrival).
 *
 * The injected button sits to the LEFT of the close button so it doesn't
 * shift the close button's screen position (users expect close in the
 * far-right corner; minimize is conventionally just inside it on macOS
 * traffic-light style chrome).
 */

const SKIP_IDS = new Set([
  // Frameless surfaces that have no header to inject into — observer will
  // bail anyway, but listing them here makes the intent explicit.
  'gs-arrival',
  'gs-story-beat-overlay',
  'gs-monologue-overlay',
  'gs-cycle-hud',
  'gs-my-characters-dock',
  'gs-cabinet',
  'gs-desire-reminder',
  'gs-npc-organizer',
]);

const BTN_CLASS    = 'gs-window-minimize';
const BTN_DATA_KEY = 'gsMinimize';

export function register() {
  // Wait for the UI to be mounted before scanning. `ready` fires after
  // Foundry has set up the main interface; any system apps the user opens
  // afterward are caught by the observer below.
  Hooks.once('ready', () => {
    _scanExisting();
    _setupObserver();
  });
}

/** First-pass scan — handle apps that rendered before the observer hooked up. */
function _scanExisting() {
  document.querySelectorAll('.application').forEach(_maybeInject);
}

/** Watch the DOM for new `.application` mounts and re-injects on re-render. */
function _setupObserver() {
  const root = document.body;
  if (!root) return;
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        // The added node itself might be an .application (Foundry mounts
        // them as direct body children) OR a re-rendered inner subtree.
        if (node.matches?.('.application')) _maybeInject(node);
        const inner = node.querySelectorAll?.('.application') ?? [];
        for (const el of inner) _maybeInject(el);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });
}

/** Inject a minimize button into one application's header, if appropriate. */
function _maybeInject(el) {
  // Only direct top-level window-header (skip nested .window-header markup
  // that an app might emit inside its own content for some reason).
  const header = el.querySelector(':scope > .window-header');
  if (!header) return;
  // Already injected? Just sync the icon state and bail.
  const existing = header.querySelector(`.${BTN_CLASS}`);
  if (existing) {
    const app = _resolveApp(el);
    _syncIcon(existing, app);
    return;
  }
  // Need an app instance to call minimize/maximize on.
  const app = _resolveApp(el);
  if (!app || typeof app.minimize !== 'function') return;
  // Skip frameless windows + the explicit deny list.
  if (app.options?.window?.frame === false) return;
  if (SKIP_IDS.has(el.id)) return;

  // Force `minimizable: true` — Foundry's `app.minimize()` short-circuits
  // silently when `options.window.minimizable === false`, which DialogV2
  // (and a handful of other modal-by-design apps) ships as default. By
  // injecting the button we've already decided this window should be
  // collapsible, so flip the option on at the instance level. This is a
  // local mutation; it doesn't affect other instances of the same class.
  if (app.options?.window) {
    app.options.window.minimizable = true;
  }

  // Find the close button — Foundry v13 uses `data-action="close"` on
  // the close control. We splice the minimize button in BEFORE it so the
  // close button stays anchored to the right edge of the header.
  const closeBtn = header.querySelector('[data-action="close"]')
    ?? header.querySelector('.header-control:last-of-type');
  if (!closeBtn) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `header-control icon ${BTN_CLASS}`;
  // data-action serves two purposes: (1) opts the button out of
  // foundry-chrome.css's default close-glyph rule (which targets
  // `.header-control:not([data-action])`), and (2) gives the chrome
  // stylesheet a hook for a per-action glyph (`−` / `□`). The value is
  // namespaced so it doesn't collide with any Foundry-builtin action.
  btn.dataset.action = 'gsMinimize';
  btn.dataset[BTN_DATA_KEY] = '';
  btn.setAttribute('aria-label', game.i18n.localize('GOODSOCIETY.windowControls.minimize'));
  btn.dataset.tooltip = game.i18n.localize('GOODSOCIETY.windowControls.minimize');
  // Plain `−` / `+` glyph for the chrome-OFF state. When chrome-theming
  // is ON, foundry-chrome.css hides this span and paints the glyph via
  // ::before instead (so styling stays driven from a single place).
  const glyph = document.createElement('span');
  glyph.className = 'gs-window-minimize__glyph';
  glyph.textContent = '−';
  btn.appendChild(glyph);

  btn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    _toggle(app, btn);
  });
  closeBtn.insertAdjacentElement('beforebegin', btn);

  _syncIcon(btn, app);
}

/** Resolve the ApplicationV2 instance behind a DOM element. */
function _resolveApp(el) {
  if (!el?.id) return null;
  return foundry.applications.instances?.get(el.id) ?? null;
}

/**
 * Flip the app between minimized and expanded states. After the call we
 * also re-sync the icon — the observer would catch this on re-render too,
 * but doing it inline gives instant visual feedback.
 */
async function _toggle(app, btn) {
  try {
    if (app.minimized) await app.maximize();
    else               await app.minimize();
  } catch (err) {
    console.warn('GS | window-controls toggle failed:', err);
    return;
  }
  _syncIcon(btn, app);
}

/**
 * Minimize every framed window currently open for the local user so a
 * full-viewport surface (story beat overlay, monologue overlay) reads as
 * the only thing happening. Player-only: GMs keep their tools visible
 * because they're typically driving the moment, while players' incidental
 * sheets / wizards just compete for attention.
 *
 * Windows stay in their tracking maps while minimized, so any unsaved
 * draft state (textareas, form values) is preserved — the player clicks
 * the collapsed window's header to restore it. We do NOT auto-restore on
 * overlay close: the player decides when to bring each one back.
 *
 * Frameless surfaces (dock, HUD, cabinet, tooltips, the overlays
 * themselves) are skipped — they have no header to collapse into and
 * shouldn't disappear on a player anyway.
 */
export function minimizeOtherWindowsForFocus({ exceptIds = [] } = {}) {
  if (!game?.user || game.user.isGM) return;
  const except = new Set(exceptIds);
  // v13 splits app tracking: ApplicationV2 lives in
  // `foundry.applications.instances`, legacy V1 in `ui.windows`. Walk
  // both so we don't silently miss a class of app.
  const apps = [
    ...(foundry.applications?.instances?.values?.() ?? []),
    ...Object.values(ui.windows ?? {}),
  ];
  for (const app of apps) {
    if (!app || except.has(app.id)) continue;
    if (app.options?.window?.frame === false) continue;
    if (app.minimized) continue;
    if (typeof app.minimize !== 'function') continue;
    // Same minimizable-override trick as `_maybeInject` — Foundry's
    // `app.minimize()` silently no-ops when `minimizable: false`, which
    // DialogV2 and a few other modal-by-default apps ship. If we've
    // decided to collapse them for focus, flip the flag on instance.
    if (app.options?.window) app.options.window.minimizable = true;
    try { app.minimize(); }
    catch (err) { console.warn('GS | minimizeOtherWindowsForFocus failed for', app.id, err); }
  }
}

/** Keep the icon (minimize vs maximize) and tooltip in sync with state. */
function _syncIcon(btn, app) {
  if (!btn || !app) return;
  const isMin = !!app.minimized;
  // Plain-text glyph (visible when chrome-theming is off).
  const glyph = btn.querySelector('.gs-window-minimize__glyph');
  if (glyph) glyph.textContent = isMin ? '+' : '−';
  // State class — foundry-chrome.css reads this to pick the right glyph
  // for its ::before render when chrome-theming is on.
  btn.classList.toggle('is-minimized', isMin);
  const labelKey = isMin
    ? 'GOODSOCIETY.windowControls.maximize'
    : 'GOODSOCIETY.windowControls.minimize';
  const label = game.i18n.localize(labelKey);
  btn.setAttribute('aria-label', label);
  btn.dataset.tooltip = label;
}
