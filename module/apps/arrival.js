/**
 * The Arrival — empty-canvas state. Post-MVP §2.1 / patch-world-identity §4.
 *
 * Frameless ApplicationV2 rendered when no scene is active. Renders centered
 * title + gilt rule + drifting motes + corner ornaments over a dark gradient.
 * Pointer-events pass through so the GM can still click chrome to load a
 * scene.
 *
 * Show/hide is driven from `module/hooks/arrival-sync.js` via the public
 * `syncArrivalToCanvas()` function — single source of truth.
 */

import { PHASE_SPLASHES } from '../constants.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** cyclePhase value → splash title localization key. */
const PHASE_SPLASH_TITLE_KEY = {
  reputation:       'GOODSOCIETY.phaseSplash.reputation',
  'rumour-scandal': 'GOODSOCIETY.phaseSplash.rumourScandal',
  epistolary:       'GOODSOCIETY.phaseSplash.epistolary',
  upkeep:           'GOODSOCIETY.phaseSplash.upkeep',
};

let _instance = null;

export class ArrivalApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-arrival',
    classes: ['good-society', 'gs-arrival'],
    window: { frame: false, positioned: false, title: '' },
    position: { width: '100vw', height: '100vh' },
  };

  static PARTS = {
    main: { template: 'systems/good-society-homebrew/templates/apps/arrival.hbs' },
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    let title = '';
    let bg = '';
    let showTitle = true;
    try {
      title = game.settings.get('good-society-homebrew', 'arrivalTitle') || '';
      bg    = game.settings.get('good-society-homebrew', 'arrivalBackgroundUrl') || '';
      showTitle = !!game.settings.get('good-society-homebrew', 'arrivalShowTitle');
    } catch { /* not yet registered */ }

    // Phase-aware splash: during reputation / rumour-scandal / epistolary /
    // upkeep the Arrival shows that phase's background + name instead of the
    // GM-configured default. Novel + pre-cycle keep the default Arrival.
    // Gated by `phaseSplashEnabled` — the whole phase-oomph feature toggle.
    let phase = 'pre-cycle';
    let splashEnabled = true;
    try {
      phase = game.settings.get('good-society-homebrew', 'cyclePhase') || 'pre-cycle';
      splashEnabled = !!game.settings.get('good-society-homebrew', 'phaseSplashEnabled');
    } catch { /* unregistered */ }
    const phaseSplash = splashEnabled ? PHASE_SPLASHES[phase] : null;
    if (phaseSplash) {
      bg = phaseSplash;
      const titleKey = PHASE_SPLASH_TITLE_KEY[phase];
      if (titleKey) title = game.i18n.localize(titleKey);
      showTitle = true;   // the phase name always shows on a phase splash
    }

    ctx.title = title || game.i18n.localize('GOODSOCIETY.arrival.defaultTitle');
    ctx.showTitle = showTitle;

    // Dispatch the background asset by extension. CSS background-image
    // doesn't support video sources cross-browser, so video URLs render
    // through a <video autoplay loop muted playsinline> element while
    // still images stay on the CSS background variable.
    const videoExts = /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i;
    if (bg && videoExts.test(bg)) {
      ctx.videoUrl = bg;
      ctx.videoType = _videoMime(bg);
      ctx.imageUrl  = '';
    } else {
      ctx.videoUrl = '';
      ctx.videoType = '';
      ctx.imageUrl = bg;
    }
    return ctx;
  }

  /** Apply per-render CSS asset variables from settings + tune the video
   *  playback rate. The video case renders via the template <video>
   *  element; we still clear the CSS background variable so the gradient
   *  (set on .gs-wi-stage) shows through any letterbox bars. */
  _onRender(ctx, options) {
    super._onRender?.(ctx, options);
    try {
      const corner  = game.settings.get('good-society-homebrew', 'arrivalCornerOrnamentUrl') || '';
      const bgValue = ctx?.imageUrl ? `url('${ctx.imageUrl}')` : 'none';
      const cnValue = corner        ? `url('${corner}')`       : 'none';
      // Set on the application root so the var cascades…
      this.element?.style?.setProperty('--gs-arrival-bg',     bgValue);
      this.element?.style?.setProperty('--gs-arrival-corner', cnValue);
      // …AND directly on the .gs-wi-stage descendant + the background-image
      // shorthand, so the splash renders even if `frame: false` or PART
      // wrapping mounts the stage outside the cascade root. The shared CSS
      // chains `--gs-arrival-bg → --gs-wi-bg-asset` at `:root`, which can fail
      // to inherit reliably depending on the application's wrapper element.
      const stage = this.element?.querySelector?.('.gs-wi-stage')
                  ?? (this.element?.classList?.contains?.('gs-wi-stage') ? this.element : null);
      if (stage) {
        stage.style.setProperty('--gs-arrival-bg',     bgValue);
        stage.style.setProperty('--gs-arrival-corner', cnValue);
        // Direct background-image as a belt-and-suspenders fallback. The
        // `.gs-wi-stage` rule layers `var(--gs-wi-bg-asset, none)` over the
        // gradient; an inline `background-image` wins over the rule's
        // composite `background:`, so we re-build the same layered stack.
        stage.style.backgroundImage = ctx?.imageUrl
          ? `url('${ctx.imageUrl}'), var(--gs-wi-bg-gradient)`
          : 'var(--gs-wi-bg-gradient)';
        stage.style.backgroundSize     = 'cover, auto';
        stage.style.backgroundPosition = 'center, 0 0';
        stage.style.backgroundRepeat   = 'no-repeat, no-repeat';
      }

      // Apply playback rate to the video element. Clamp defensively so a
      // hand-edited setting can't ask for 1000x or zero (which pauses).
      const v = this.element?.querySelector?.('.gs-arrival__video');
      if (v) {
        let rate = 0.5;
        try { rate = Number(game.settings.get('good-society-homebrew', 'arrivalVideoPlaybackRate')); } catch {}
        if (!Number.isFinite(rate) || rate <= 0) rate = 0.5;
        rate = Math.max(0.1, Math.min(2.0, rate));
        v.playbackRate = rate;
        v.defaultPlaybackRate = rate;
      }
    } catch { /* settings not yet registered, ignore */ }
  }
}

/** Map a media URL to a `<source>` MIME type. Falls back to a generic
 *  `video/mp4` when the extension is unrecognized — most browsers will
 *  still play it (mp4 is the default container). */
function _videoMime(url) {
  const ext = (url.match(/\.(mp4|webm|mov|m4v|ogv)(?:\?|$)/i)?.[1] || '').toLowerCase();
  switch (ext) {
    case 'webm': return 'video/webm';
    case 'mov':
    case 'm4v':  return 'video/quicktime';
    case 'ogv':  return 'video/ogg';
    case 'mp4':
    default:     return 'video/mp4';
  }
}

export function getArrival() {
  return _instance;
}

/**
 * Show/hide the Arrival in response to canvas state. Called from
 * `module/hooks/arrival-sync.js` on relevant Foundry hooks.
 */
export async function syncArrivalToCanvas() {
  let enabled = true;
  try { enabled = game.settings.get('good-society-homebrew', 'arrivalEnabled'); } catch {}
  const sceneActive = !!game.scenes?.viewed;
  const shouldShow = enabled && !sceneActive;

  if (shouldShow) {
    if (!_instance) _instance = new ArrivalApp();
    if (!_instance.rendered) {
      await _instance.render(true);
    } else {
      _instance.render({ parts: ['main'] });
    }
  } else if (_instance?.rendered) {
    await _instance.close();
  }
}
