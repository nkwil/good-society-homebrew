/**
 * Story Beat Overlay — full-viewport scene-freeze overlay that plays a
 * dramatic moment chosen from the `STORY_BEATS` registry. Triggered by the
 * Story Beats Command Center (GM-only) and broadcast to every connected
 * client via the system socket.
 *
 * Architecture mirrors `MonologueOverlayApp`:
 *   - Frameless ApplicationV2, z-index 35 (above canvas, below tooltips).
 *   - Singleton per process; second-start while one's active is dropped.
 *   - Each beat renders its own template from
 *     `templates/apps/story-beats/<id>.hbs` keyed by the registry entry.
 *   - Auto-dismisses after `beat.autoDismissMs` if set; otherwise the GM
 *     dismisses it (and players too, if `beat.dismissibleByAll === true`).
 *
 * Socket actions: `storyBeatStart` / `storyBeatEnd`.
 */

import { findStoryBeat } from '../data/story-beats.js';
import { SEAL_TYPES, STATIONERY_TYPES } from '../constants.js';
import { minimizeOtherWindowsForFocus } from '../hooks/window-controls.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const SOCKET_NAME = 'system.good-society-homebrew';
const TEMPLATE = 'systems/good-society-homebrew/templates/apps/story-beat-overlay.hbs';

let _instance = null;
let _activeState = null;       // { beatId, payload, byUserId, startedAt }
let _autoDismissTimer = null;  // setTimeout id

export class StoryBeatOverlayApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-story-beat-overlay',
    classes: ['good-society', 'gs-story-beat-overlay'],
    window: { frame: false, positioned: false, title: '' },
    position: { width: 'auto', height: 'auto' },
    actions: {
      dismiss:   StoryBeatOverlayApp.#dismiss,
      breakSeal: StoryBeatOverlayApp.#breakSeal,
    },
  };

  static PARTS = {
    main: { template: TEMPLATE },
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const state = _activeState ?? {};
    const beat  = state.beatId ? findStoryBeat(state.beatId) : null;
    ctx.beat = beat ? {
      id:           beat.id,
      label:        beat.label,
      icon:         beat.icon,
      paletteClass: beat.paletteClass,
    } : null;
    // Enrich the payload — for any field of type `actor`/`majorActor`,
    // resolve the id to a display name and inject it as `<field>Name` so
    // the beat templates can just say `{{payload.targetActorName}}`. For
    // `seal` fields, resolve the id → `<field>Asset` / `<field>Color` /
    // `<field>Label` from SEAL_TYPES so the sealed-envelope render has
    // everything it needs without re-doing the lookup in the template.
    const rawPayload = state.payload ?? {};
    const enriched = { ...rawPayload };
    for (const f of (beat?.formFields ?? [])) {
      if (f.type === 'textarea') {
        // Preserve line breaks: HTML-escape the user text and convert \n to
        // <br>, exposed as `<field>Html`. Templates render via triple-stache
        // (`{{{payload.bodyHtml}}}`) to honor the breaks — the only HTML in
        // the string is the <br> we just inserted, so this is XSS-safe.
        const text = rawPayload[f.name] ?? '';
        const escaped = (typeof foundry.utils.escapeHTML === 'function')
          ? foundry.utils.escapeHTML(text)
          : String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
        enriched[`${f.name}Html`] = escaped.replace(/\r?\n/g, '<br>');
      }
      if (f.type === 'actor' || f.type === 'majorActor') {
        const actor = game.actors?.get(rawPayload[f.name]) ?? null;
        enriched[`${f.name}Name`] = actor?.name ?? '';
      } else if (f.type === 'seal') {
        const seal = SEAL_TYPES.find(s => s.id === rawPayload[f.name]) ?? null;
        enriched[`${f.name}Asset`] = seal?.iconAsset ?? '';
        enriched[`${f.name}Color`] = seal?.color ?? '';
        const lk = seal ? `GOODSOCIETY.seal.${seal.label}` : '';
        const txt = lk ? game.i18n.localize(lk) : '';
        enriched[`${f.name}Label`] = (lk && txt && txt !== lk) ? txt : (seal?.label ?? '');
      } else if (f.type === 'stationery') {
        // Default to 'plain' when the GM didn't pick one (empty payload).
        const id = rawPayload[f.name] || 'plain';
        const st = STATIONERY_TYPES.find(s => s.id === id)
                ?? STATIONERY_TYPES.find(s => s.id === 'plain');
        enriched[`${f.name}Id`]          = st?.id ?? 'plain';
        enriched[`${f.name}Asset`]       = st?.asset ?? '';
        enriched[`${f.name}AspectRatio`] = st?.aspectRatio ?? '';
        // Build the CSS custom-property style string the template injects
        // on the card wrapper. We do it here so the template stays clean.
        const c = st?.content;
        enriched[`${f.name}Style`] = c
          ? `--gs-stationery-asset: url('${st.asset}'); `
          + `aspect-ratio: ${st.aspectRatio}; `
          + `--gs-stationery-pad-t: ${c.top}%; `
          + `--gs-stationery-pad-r: ${c.right}%; `
          + `--gs-stationery-pad-b: ${c.bottom}%; `
          + `--gs-stationery-pad-l: ${c.left}%;`
          : '';
      }
    }
    // Resolve the viewing user's owned Major character name(s) for the
    // invitation's "To:" line. Each client renders its own copy of the
    // overlay so each player sees their own name slotted in. Filter by
    // EXPLICIT per-user ownership at the OWNER level — `a.isOwner` would
    // be true for the GM on every actor (GM default ownership) and pollute
    // the addressee with every Major in the world. The GM (with no
    // explicitly-owned Major) sees no addressee line.
    const userId = game.user?.id;
    const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
    const ownedMajors = (game.actors?.contents ?? [])
      .filter(a => a.type === 'major-character' && a.ownership?.[userId] === OWNER);
    const recipientNames = ownedMajors.map(a => {
      // Use the actor's TRUE name, NOT the active persona's name. An
      // invitation is private correspondence addressed to the character;
      // the GM (who's sending it) and the player (who's playing the
      // character) both know the true identity even if the character is
      // currently operating under a cover persona at the table. This is
      // the deliberate exception to the system's general displayName
      // convention (`activePersona?.name || actor.name`).
      return a.name;
    }).filter(Boolean);
    // Slot it onto the payload so the inner template (rendered with a
    // {beat, payload}-only context below) can read it as
    // `{{payload.viewerRecipient}}`. Per-client value — each player sees
    // their own.
    enriched.viewerRecipient = recipientNames.join(' & ');
    ctx.viewerRecipient = enriched.viewerRecipient;

    ctx.payload = enriched;
    ctx.isGM     = !!game.user?.isGM;
    ctx.canDismiss = !!game.user?.isGM
      || (beat?.dismissibleByAll === true)
      || (state.byUserId === game.user?.id);

    // Pre-render the beat-specific inner template so the outer overlay can
    // just emit `{{{innerHtml}}}` — Handlebars partials don't take dynamic
    // template paths, so this side-render is the cleanest dispatch.
    if (beat) {
      const inner = await foundry.applications.handlebars.renderTemplate(
        beat.template,
        { beat: ctx.beat, payload: ctx.payload },
      );
      ctx.innerHtml = inner;
    } else {
      ctx.innerHtml = '';
    }
    return ctx;
  }

  /**
   * Break the wax seal on a sealed beat (currently just `invitation`). Each
   * player breaks their own seal locally — NOT synced. We add `.is-open` to
   * the live envelope DOM rather than re-rendering, so the CSS transitions
   * actually animate (a re-render would mount the open state instantly with
   * no motion). Matches the epistolary-wizard `#breakSeal` pattern.
   */
  static #breakSeal(event, target) {
    const envelope = target.closest('.gs-letter-envelope')
      ?? this.element?.querySelector('.gs-letter-envelope');
    if (!envelope) return;
    envelope.classList.add('is-open');
  }

  static async #dismiss() {
    // Anyone allowed can locally request end; the broadcaster is the GM or
    // the original sender — either way emit + locally hide.
    if (!game.user?.isGM
      && _activeState?.byUserId !== game.user?.id
      && findStoryBeat(_activeState?.beatId)?.dismissibleByAll !== true) {
      return;
    }
    game.socket?.emit(SOCKET_NAME, {
      action: 'storyBeatEnd',
      payload: { beatId: _activeState?.beatId },
    });
    await _hideOverlay();
  }
}

/** Resolve the singleton, creating if needed. */
function _instanceApp() {
  if (!_instance) _instance = new StoryBeatOverlayApp();
  return _instance;
}

/** Locally show the overlay for the given start payload. */
async function _showOverlay(state) {
  // Singleton — drop if one's already running.
  if (_activeState) return;

  // Activation gate: world-identity body class controls every full-viewport
  // surface. If a user has it disabled, they get the chat-card fallback.
  if (!document.body.classList.contains('gs-world-identity')) {
    console.warn('GS | story beat overlay: gs-world-identity disabled, skipping local render');
    return;
  }

  _activeState = { ...state, startedAt: Date.now() };
  const app = _instanceApp();
  await app.render(true);
  // Player-only: collapse any other framed windows so the beat is the
  // only thing competing for attention. Drafts in those windows are
  // preserved (minimized, not closed) — player restores each manually.
  minimizeOtherWindowsForFocus({ exceptIds: ['gs-story-beat-overlay'] });

  // Schedule auto-dismiss if the beat declares one.
  const beat = findStoryBeat(state.beatId);
  if (beat?.autoDismissMs) {
    clearTimeout(_autoDismissTimer);
    _autoDismissTimer = setTimeout(() => {
      // Only the original triggering user (or GM) re-emits the end socket —
      // single broadcast even though every client has a timer.
      if (game.user?.id === state.byUserId || game.user?.isGM) {
        game.socket?.emit(SOCKET_NAME, {
          action: 'storyBeatEnd',
          payload: { beatId: state.beatId },
        });
      }
      _hideOverlay();
    }, beat.autoDismissMs);
  }
}

/** Hide the overlay locally + clear any pending auto-dismiss timer. */
async function _hideOverlay() {
  clearTimeout(_autoDismissTimer);
  _autoDismissTimer = null;
  if (_instance?.rendered) await _instance.close({ gsForce: true });
  _activeState = null;
}

/**
 * Public API — GM-side trigger. Broadcasts a `storyBeatStart` socket and
 * shows the overlay locally.
 *
 * @param {string} beatId  one of `STORY_BEATS[].id`
 * @param {object} payload form-field values from the Command Center dialog
 */
export async function playStoryBeat(beatId, payload) {
  const beat = findStoryBeat(beatId);
  if (!beat) {
    console.warn('GS | unknown story beat:', beatId);
    return;
  }
  if (_activeState) {
    ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.storyBeats.alreadyRunning'));
    return;
  }
  const startState = { beatId, payload, byUserId: game.user?.id };
  game.socket?.emit(SOCKET_NAME, { action: 'storyBeatStart', payload: startState });
  await _showOverlay(startState);

  // Fire a canonical hook so downstream wiring (Event Timeline auto-entry,
  // future logging, etc.) doesn't need to wrap this function. Fires once on
  // the triggering client (which is the GM, since only the GM hits the
  // Command Center) — keeps the timeline write GM-only without an extra
  // guard. Payload mirrors the socket shape for consistency.
  try { Hooks.callAll('goodSociety.storyBeatPlayed', { beatId, payload, beat }); }
  catch (err) { console.warn('GS | storyBeatPlayed hook listener threw:', err); }
}

/** Whether any story beat is currently on screen. */
export function isStoryBeatActive() {
  return !!_activeState;
}

/** Register socket listeners — called from good-society.js ready hook. */
export function registerStoryBeatSocket() {
  game.socket?.on(SOCKET_NAME, (msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.action === 'storyBeatStart') {
      _showOverlay(msg.payload ?? {});
    } else if (msg.action === 'storyBeatEnd') {
      _hideOverlay();
    }
  });
}
