/**
 * Event Command Center — GM-only roster of Major characters with their
 * archetype-pooled random events. Click a Major to filter the event list,
 * then click "Launch ↗" to deliver the chosen event to that Major's owner
 * via the system socket. Empty pools block the launch with a notification.
 *
 * Framed singleton ApplicationV2. Opens from the `gs-events` scene control
 * button. Per the post-MVP feature spec.
 */

import { profilePic } from '../helpers/profile-pic.js';
import { launchRandomEvent } from '../helpers/random-event.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 }              = foundry.applications.api;

const NS = 'good-society-homebrew';

let _instance = null;

/** Open or focus the singleton. GM-only — players just see a notification. */
export function openEventCommandCenter() {
  if (!game.user?.isGM) {
    ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.eventCommandCenter.gmOnly'));
    return null;
  }
  if (!_instance) _instance = new EventCommandCenter();
  _instance.render({ force: true });
  return _instance;
}

/** Refresh the open instance (no-op if closed). Used by hooks that should
 *  cause the roster / pool counts to re-render. */
export function refreshEventCommandCenter() {
  if (_instance?.rendered) _instance.render();
}

export class EventCommandCenter extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-event-command-center',
    classes: ['good-society', 'gs-event-command-center'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.eventCommandCenter.windowTitle',
    },
    position: { width: 720, height: 640 },
    actions: {
      selectMajor:  EventCommandCenter.#selectMajor,
      launchEvent:  EventCommandCenter.#launchEvent,
      openEventSheet: EventCommandCenter.#openEventSheet,
      newEvent:     EventCommandCenter.#newEvent,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/apps/event-command-center.hbs',
    },
  };

  /** @type {string} — id of the currently selected Major (or '' for none). */
  _selectedMajorId = '';

  // ── Context ────────────────────────────────────────────────────────────────

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const allEvents = (game.items?.filter(i => i.type === 'random-event')) ?? [];

    // Roster: every Major actor with archetype + matching event count.
    const majors = (game.actors?.filter(a => a.type === 'major-character')) ?? [];
    const roster = majors.map(actor => {
      const sys = actor.system ?? {};
      const archetype = sys.bio?.archetype ?? '';
      const archetypeLabel = archetype
        ? game.i18n.localize(`GOODSOCIETY.major.archetype.${archetype}`)
        : game.i18n.localize('GOODSOCIETY.eventCommandCenter.noArchetype');
      const eventCount = archetype
        ? allEvents.filter(e => e.system?.archetype === archetype).length
        : 0;
      const ownerOnline = _isAnyOwnerOnline(actor);
      const displayName = sys.activePersona?.name || actor.name;
      return {
        id: actor.id,
        name: displayName,
        portraitUrl: profilePic(actor),
        initial: (displayName?.[0] ?? '?').toUpperCase(),
        archetype,
        archetypeLabel,
        eventCount,
        ownerOnline,
        selected: actor.id === this._selectedMajorId,
      };
    });

    // Detail: events filtered by selected Major's archetype.
    const selectedActor = this._selectedMajorId
      ? game.actors?.get(this._selectedMajorId)
      : null;
    const selectedArchetype = selectedActor?.system?.bio?.archetype ?? '';
    const eventsForSelected = selectedArchetype
      ? allEvents.filter(e => e.system?.archetype === selectedArchetype)
      : [];

    ctx.roster = roster;
    ctx.totalMajors = roster.length;
    ctx.selectedMajor = selectedActor ? {
      id: selectedActor.id,
      name: selectedActor.system?.activePersona?.name || selectedActor.name,
      archetype: selectedArchetype,
      archetypeLabel: selectedArchetype
        ? game.i18n.localize(`GOODSOCIETY.major.archetype.${selectedArchetype}`)
        : '',
      ownerOnline: _isAnyOwnerOnline(selectedActor),
      hasArchetype: !!selectedArchetype,
    } : null;
    ctx.eventList = eventsForSelected.map(e => ({
      id: e.id,
      name: e.name,
      description: e.system?.description ?? '',
      positiveCount: (e.system?.positiveTagOptions ?? []).filter(Boolean).length,
      negativeCount: (e.system?.negativeTagOptions ?? []).filter(Boolean).length,
    }));
    ctx.allEventCount = allEvents.length;
    return ctx;
  }

  // ── Action handlers ───────────────────────────────────────────────────────

  static async #selectMajor(_ev, target) {
    const id = target.dataset.majorId;
    if (!id) return;
    this._selectedMajorId = id;
    this.render();
  }

  static async #launchEvent(_ev, target) {
    const eventId = target.dataset.eventId;
    const actorId = this._selectedMajorId;
    if (!eventId || !actorId) return;
    const event = game.items?.get(eventId);
    const actor = game.actors?.get(actorId);
    if (!event || !actor) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.eventCommandCenter.launchMissing'));
      return;
    }
    if (!actor.system?.bio?.archetype) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.eventCommandCenter.noArchetypeWarn'));
      return;
    }
    if (event.system?.archetype !== actor.system.bio.archetype) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.eventCommandCenter.archetypeMismatch'));
      return;
    }
    if (!_isAnyOwnerOnline(actor)) {
      ui.notifications?.warn(game.i18n.format('GOODSOCIETY.eventCommandCenter.ownerOffline', { name: actor.name }));
      return;
    }
    await launchRandomEvent(event, actor);
    ui.notifications?.info(game.i18n.format('GOODSOCIETY.eventCommandCenter.launched', { event: event.name, target: actor.name }));
  }

  static async #openEventSheet(_ev, target) {
    const eventId = target.dataset.eventId;
    if (!eventId) return;
    const event = game.items?.get(eventId);
    event?.sheet?.render(true);
  }

  static async #newEvent() {
    // Convenience: create a new random-event Item, prefilled with the
    // currently selected Major's archetype (if any).
    const selected = this._selectedMajorId
      ? game.actors?.get(this._selectedMajorId)
      : null;
    const archetype = selected?.system?.bio?.archetype || 'new-arrival';
    const created = await Item.create({
      name: game.i18n.localize('GOODSOCIETY.eventCommandCenter.newEventName'),
      type: 'random-event',
      system: { archetype },
    });
    if (created) created.sheet?.render(true);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** True iff at least one connected non-GM user owns the actor. The GM is
 *  excluded so "GM logged in only" is treated as offline for delivery purposes
 *  — events are for players. */
function _isAnyOwnerOnline(actor) {
  if (!actor) return false;
  return (game.users ?? []).some(u =>
    u.active && !u.isGM && actor.testUserPermission(u, 'OWNER')
  );
}
