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

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

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
      const corner = game.settings.get('good-society-homebrew', 'arrivalCornerOrnamentUrl') || '';
      this.element?.style?.setProperty('--gs-arrival-bg',     ctx?.imageUrl ? `url('${ctx.imageUrl}')` : 'none');
      this.element?.style?.setProperty('--gs-arrival-corner', corner ? `url('${corner}')` : 'none');

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
