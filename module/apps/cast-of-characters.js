/**
 * Cast of Characters — one app, two modes.
 *
 *   • Viewer (`openCastOfCharacters`) — player-facing, read-only grid of
 *     every actor the GM has included. Grouped by type (Majors /
 *     Connections / NPCs). Portrait + persona-aware name + subtitle. Click
 *     an entry to open their sheet (subject to Foundry permissions —
 *     players without OBSERVER see what Foundry allows them to see).
 *
 *   • Manager (`openCastManager`) — GM-only toggle grid. One switch per
 *     actor; flipping it writes `actor.flags[NS].inCast`. The viewer
 *     refreshes live when the flag changes.
 *
 * The inclusion flag has three states:
 *   - `true`  → shown in the viewer
 *   - `false` → hidden from the viewer
 *   - `undefined` → fall back to the type default (Majors default to
 *                   shown; Connections and NPCs default to hidden). Lets
 *                   the GM start with "the party is already in the cast,
 *                   now I'll add the people they've met."
 *
 * Persona-awareness: the viewer uses `profilePic` / `profileName` so a
 * Secret-persona actor shows the persona's face and name, never the
 * underlying true identity. The manager shows the actor's true name
 * (plus persona hint when active) so the GM knows who they're toggling.
 */

import { profilePic, profileName } from '../helpers/profile-pic.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const NS   = 'good-society-homebrew';
const FLAG = 'inCast';

const TYPE_LABEL = {
  'major-character': 'GOODSOCIETY.castOfCharacters.group.majors',
  'connection':      'GOODSOCIETY.castOfCharacters.group.connections',
  'npc':             'GOODSOCIETY.castOfCharacters.group.npcs',
};

const GROUP_ORDER = ['major-character', 'connection', 'npc'];

let _viewerInstance  = null;
let _managerInstance = null;

/** Resolve the effective inclusion for an actor — explicit flag, or
 *  the type default. */
export function isInCast(actor) {
  if (!actor) return false;
  const explicit = actor.getFlag?.(NS, FLAG);
  if (typeof explicit === 'boolean') return explicit;
  return actor.type === 'major-character';
}

function _castCandidates() {
  return (game.actors ?? []).filter(a => GROUP_ORDER.includes(a.type));
}

/** Open the player-facing cast viewer. */
export function openCastOfCharacters() {
  if (!_viewerInstance) _viewerInstance = new CastOfCharactersApp({ manage: false });
  _viewerInstance.render({ force: true });
  return _viewerInstance;
}

/** Open the GM-only cast manager. */
export function openCastManager() {
  if (!game.user?.isGM) {
    ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.castOfCharacters.gmOnly'));
    return null;
  }
  if (!_managerInstance) _managerInstance = new CastOfCharactersApp({ manage: true });
  _managerInstance.render({ force: true });
  return _managerInstance;
}

/** Refresh whichever instances are open — called by the updateActor hook
 *  below when a cast-related flag changes. */
export function refreshCastApps() {
  if (_viewerInstance?.rendered)  _viewerInstance.render();
  if (_managerInstance?.rendered) _managerInstance.render();
}

export class CastOfCharactersApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ['good-society', 'gs-cast'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.castOfCharacters.windowTitle',
    },
    position: { width: 640, height: 'auto' },
    actions: {
      openActor:    CastOfCharactersApp.#openActor,
      toggleActor:  CastOfCharactersApp.#toggleActor,
      resetDefault: CastOfCharactersApp.#resetDefault,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/apps/cast-of-characters.hbs',
    },
  };

  constructor(options = {}) {
    const { manage, ...rest } = options;
    // Per-mode id so the two modes are distinct singletons in Foundry's
    // instance map — otherwise the Cabinet's open/closed launcher state
    // would conflate them.
    rest.id = manage ? 'gs-cast-manager' : 'gs-cast-viewer';
    super(rest);
    this._manage = !!manage;
  }

  get title() {
    const key = this._manage
      ? 'GOODSOCIETY.castOfCharacters.manageTitle'
      : 'GOODSOCIETY.castOfCharacters.viewTitle';
    return game.i18n.localize(key);
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    ctx.isManageMode = this._manage;

    const candidates = _castCandidates();
    const byType = Object.fromEntries(GROUP_ORDER.map(t => [t, []]));
    for (const actor of candidates) {
      if (!byType[actor.type]) continue;
      byType[actor.type].push(actor);
    }
    for (const type of GROUP_ORDER) {
      byType[type].sort((a, b) => {
        const an = this._manage ? (a.name ?? '') : (profileName(a) ?? '');
        const bn = this._manage ? (b.name ?? '') : (profileName(b) ?? '');
        return an.localeCompare(bn);
      });
    }

    const allGroups = GROUP_ORDER.map(type => {
      const actors = byType[type] ?? [];
      const rows = (this._manage ? actors : actors.filter(isInCast))
        .map(a => this._rowFor(a));
      return {
        type,
        label: game.i18n.localize(TYPE_LABEL[type]),
        rows,
        count: rows.length,
        isEmpty: rows.length === 0,
      };
    });
    // Viewer hides empty groups so players don't see an orphan "NPCs 0"
    // header; the manager keeps every type so the GM can see what's
    // togglable in each. Group-level filtering here keeps the template
    // simple (no cross-root `and`/`or` helpers needed).
    ctx.groups = this._manage
      ? allGroups
      : allGroups.filter(g => g.rows.length > 0);
    ctx.hasAny = ctx.groups.some(g => g.rows.length > 0);
    return ctx;
  }

  _rowFor(actor) {
    const explicit = actor.getFlag?.(NS, FLAG);
    const effectiveOn = isInCast(actor);
    const defaultOn = actor.type === 'major-character';
    const isDefault = typeof explicit !== 'boolean';
    const trueName = actor.name;
    const displayName = this._manage ? trueName : profileName(actor);
    const subtitle = _subtitleFor(actor);
    // GM can always open any actor; a player only when they have at least
    // LIMITED on the actor. Viewer cards without openability render as
    // static tiles (no hover affordance) so the player isn't invited to
    // click something that would error out.
    const canOpen = !!game.user?.isGM
      || !!actor.testUserPermission?.(game.user, 'LIMITED');
    return {
      id: actor.id,
      displayName,
      trueName,
      personaHint: this._manage && profileName(actor) !== trueName
        ? profileName(actor)
        : '',
      subtitle,
      portraitUrl: profilePic(actor),
      initial: (displayName?.[0] ?? '?').toUpperCase(),
      effectiveOn,
      isDefault,
      defaultOn,
      canOpen,
    };
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  static async #openActor(_ev, target) {
    const id = target?.dataset?.actorId;
    if (!id) return;
    const actor = game.actors?.get(id);
    // Honor Foundry permissions — the sheet rejects LIMITED-less users on
    // its own, but doing it here gives a visible failure note.
    if (!actor?.testUserPermission(game.user, 'LIMITED')) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.castOfCharacters.cannotOpen'));
      return;
    }
    actor.sheet?.render(true);
  }

  static async #toggleActor(_ev, target) {
    if (!game.user?.isGM) return;
    const id = target?.dataset?.actorId;
    if (!id) return;
    const actor = game.actors?.get(id);
    if (!actor) return;
    const nextOn = !isInCast(actor);
    await actor.setFlag(NS, FLAG, nextOn);
  }

  static async #resetDefault(_ev, target) {
    if (!game.user?.isGM) return;
    const id = target?.dataset?.actorId;
    if (!id) return;
    const actor = game.actors?.get(id);
    if (!actor) return;
    await actor.unsetFlag(NS, FLAG);
  }
}

function _subtitleFor(actor) {
  const sys = actor.system ?? {};
  if (actor.type === 'major-character') {
    const archetype = sys.bio?.archetype;
    if (archetype) {
      return game.i18n.localize(`GOODSOCIETY.major.archetype.${archetype}`);
    }
    return '';
  }
  if (actor.type === 'connection') {
    return (sys.bio?.relationshipLabel ?? '').trim();
  }
  if (actor.type === 'npc') {
    return (sys.bio?.role ?? '').trim();
  }
  return '';
}

/**
 * Register a hook that refreshes any open Cast app when something
 * cast-relevant changes on an actor: the flag itself, the active
 * persona, portrait/token image, or display name.
 */
export function registerCastHooks() {
  Hooks.on('updateActor', (actor, diff) => {
    if (!_viewerInstance?.rendered && !_managerInstance?.rendered) return;
    const touched =
      foundry.utils.hasProperty(diff, `flags.${NS}.${FLAG}`)
      || foundry.utils.hasProperty(diff, `flags.${NS}.-=${FLAG}`)
      || 'name' in diff
      || foundry.utils.hasProperty(diff, 'system.activePersonaId')
      || foundry.utils.hasProperty(diff, 'prototypeToken.texture.src')
      || foundry.utils.hasProperty(diff, 'img')
      || foundry.utils.hasProperty(diff, 'system.bio')
      || foundry.utils.hasProperty(diff, 'system.personas');
    if (touched) refreshCastApps();
  });
  Hooks.on('createActor', refreshCastApps);
  Hooks.on('deleteActor', refreshCastApps);
}
