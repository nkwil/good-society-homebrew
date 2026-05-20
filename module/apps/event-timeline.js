/**
 * EventTimeline — in-fiction event log with stage-based bucketing.
 * Per docs/design/31-event-timeline.md (rev. 2026-05-08).
 *
 * Three buckets driven by manual GM movement:
 *   coming-soon → today (with optional scene link) → past
 *
 * Two-mode rendering:
 *   - GM: full read/write — add, edit, promote, conclude, revert, delete.
 *   - Player: read-only — sees only `public` events.
 *
 * Storage in one world setting (`calendarEvents`) registered in
 * good-society.js. Foundry's setting onChange replicates writes across all
 * clients automatically.
 */

import {
  getEvents,
  getGroupedEvents,
  addEvent,
  updateEvent,
  removeEvent,
  promoteEvent,
  concludeEvent,
  revertToComingSoon,
} from '../helpers/event-timeline.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 }              = foundry.applications.api;

const VISIBILITY_OPTIONS = ['public', 'gm-only'];

// ── Singleton ─────────────────────────────────────────────────────────────

let _instance = null;

export function getEventTimeline() {
  if (!_instance) _instance = new EventTimeline();
  return _instance;
}

export function openEventTimeline() {
  getEventTimeline().render({ force: true });
}

/** Called from setting onChange — re-renders if the window is open. */
export function refreshEventTimeline() {
  if (_instance?.rendered) _instance.render();
}

// ── App ───────────────────────────────────────────────────────────────────

export class EventTimeline extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-event-timeline',
    classes: ['good-society', 'gs-event-timeline-app'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.eventTimeline.windowTitle',
    },
    position: { width: 600, height: 'auto' },
    actions: {
      addEventOpen:    EventTimeline.#addEventOpen,
      addEventCancel:  EventTimeline.#addEventCancel,
      addEventSave:    EventTimeline.#addEventSave,
      editEventOpen:   EventTimeline.#editEventOpen,
      editEventCancel: EventTimeline.#editEventCancel,
      editEventSave:   EventTimeline.#editEventSave,
      deleteEvent:     EventTimeline.#deleteEvent,
      promoteEventBtn: EventTimeline.#promoteEventBtn,
      concludeEventBtn:EventTimeline.#concludeEventBtn,
      revertEventBtn:  EventTimeline.#revertEventBtn,
      togglePast:      EventTimeline.#togglePast,
      openScene:       EventTimeline.#openScene,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/apps/event-timeline.hbs',
    },
  };

  constructor(options = {}) {
    super(options);
    this._addingEvent = false;
    this._editingId   = null;
    this._showPast    = false;
  }

  /** @override */
  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const isGM = game.user?.isGM ?? false;

    const grouped = getGroupedEvents(isGM);
    const decorate = (e) => _decorateEvent(e, isGM);

    // Scene list for the per-row Scene <select> (GM only — used by the
    // add + edit forms). Sorted alphabetically by name; an empty option
    // ("none") is added in the template.
    const scenes = isGM
      ? (game.scenes?.contents ?? [])
        .slice()
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .map(s => ({ id: s.id, name: s.name, active: !!s.active }))
      : [];

    return {
      ...ctx,
      isGM,
      comingSoon: grouped.comingSoon.map(decorate),
      today:      grouped.today.map(decorate),
      past:       grouped.past.map(decorate),
      pastCount:  grouped.past.length,
      hasAny:     (grouped.comingSoon.length + grouped.today.length + grouped.past.length) > 0,
      addingEvent: this._addingEvent,
      editingId:   this._editingId,
      showPast:    this._showPast,
      scenes,
      visibilityChoices: VISIBILITY_OPTIONS.map(v => ({
        value: v,
        label: game.i18n.localize(`GOODSOCIETY.eventTimeline.visibility.${_visKey(v)}`),
      })),
    };
  }

  // ── Add ──────────────────────────────────────────────────────────────────

  static async #addEventOpen() {
    if (!game.user?.isGM) return;
    this._addingEvent = true;
    this._editingId   = null;
    this.render();
  }

  static async #addEventCancel() {
    this._addingEvent = false;
    this.render();
  }

  static async #addEventSave() {
    if (!game.user?.isGM) return;
    const root = this.element;
    const get = (name) => root.querySelector(`[data-evt-field="${name}"]:not([data-event-id])`)?.value ?? '';
    const visEl = root.querySelector('[data-evt-field="visibility"]:not([data-event-id]):checked');

    const title = (get('title') || '').trim();
    if (!title) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.eventTimeline.errorNoTitle'));
      return;
    }

    const created = await addEvent({
      title,
      dateLabel:   get('dateLabel'),
      description: get('description'),
      visibility:  visEl?.value ?? 'public',
      sceneId:     get('sceneId'),
    });
    if (!created) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.eventTimeline.errorAdd'));
      return;
    }

    this._addingEvent = false;
    this.render();
  }

  // ── Edit ─────────────────────────────────────────────────────────────────

  static async #editEventOpen(ev, target) {
    if (!game.user?.isGM) return;
    const id = target.dataset.eventId;
    if (!id) return;
    this._editingId   = id;
    this._addingEvent = false;
    this.render();
  }

  static async #editEventCancel() {
    this._editingId = null;
    this.render();
  }

  static async #editEventSave(ev, target) {
    if (!game.user?.isGM) return;
    const id = target.dataset.eventId ?? this._editingId;
    if (!id) return;
    const root = this.element;
    const get = (name) =>
      root.querySelector(`[data-evt-field="${name}"][data-event-id="${id}"]`)?.value ?? '';
    const visEl = root.querySelector(
      `[data-evt-field="visibility"][data-event-id="${id}"]:checked`,
    );

    const title = (get('title') || '').trim();
    if (!title) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.eventTimeline.errorNoTitle'));
      return;
    }

    await updateEvent(id, {
      title,
      dateLabel:   get('dateLabel'),
      description: get('description'),
      visibility:  visEl?.value ?? 'public',
      sceneId:     get('sceneId'),
    });

    this._editingId = null;
    this.render();
  }

  // ── Delete ──────────────────────────────────────────────────────────────

  static async #deleteEvent(ev, target) {
    if (!game.user?.isGM) return;
    const id = target.dataset.eventId;
    if (!id) return;
    const ok = window.confirm(game.i18n.localize('GOODSOCIETY.eventTimeline.deleteConfirm'));
    if (!ok) return;
    await removeEvent(id);
    if (this._editingId === id) this._editingId = null;
    this.render();
  }

  // ── Promote (Coming Soon → Today) ───────────────────────────────────────

  /**
   * "Start Event" — promote a Coming Soon event into Today and, if a scene
   * was linked at create/edit time, activate that scene automatically.
   *
   * Scene linking now happens via the per-event Scene <select> on the
   * add/edit forms (so the GM commits the connection once, ahead of time).
   * Promote no longer opens a picker — the event either has a scene or
   * doesn't. Pass-through to `promoteEvent(id)` (no sceneId arg) preserves
   * whatever was already on the event.
   */
  static async #promoteEventBtn(ev, target) {
    if (!game.user?.isGM) return;
    const id = target.dataset.eventId;
    if (!id) return;

    const event = getEvents().find(e => e.id === id);
    if (!event) return;
    const wasGmOnly = event.visibility === 'gm-only';
    const linkedSceneId = event.sceneId || '';

    await promoteEvent(id); // preserve existing sceneId

    // Activate the linked scene. This is the headline behavior of
    // "Start Event" — click once, the scene goes live for everyone.
    if (linkedSceneId) {
      const scene = game.scenes?.get(linkedSceneId);
      if (scene) {
        try { await scene.activate(); }
        catch (err) { console.warn('GS | promote: scene.activate failed:', err); }
      } else {
        ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.eventTimeline.sceneMissing'));
      }
    }

    if (wasGmOnly) {
      ui.notifications?.info(game.i18n.localize('GOODSOCIETY.eventTimeline.autoRevealedNotice'));
    }

    // Optional public announcement.
    try {
      const fresh = getEvents().find(e => e.id === id);
      if (fresh?.visibility === 'public') {
        const { postSystemCard } = await import('../helpers/chat-cards.js');
        await postSystemCard({
          content: game.i18n.format('GOODSOCIETY.eventTimeline.promotedCard', {
            title: fresh.title,
          }),
          context: 'calendar',
        });
      }
    } catch (err) { console.warn('GS | promote announcement failed:', err); }

    this.render();
  }

  // ── Conclude (Today → Past) ─────────────────────────────────────────────

  static async #concludeEventBtn(ev, target) {
    if (!game.user?.isGM) return;
    const id = target.dataset.eventId;
    if (!id) return;
    await concludeEvent(id);
    this.render();
  }

  // ── Revert (Today → Coming Soon) ────────────────────────────────────────

  static async #revertEventBtn(ev, target) {
    if (!game.user?.isGM) return;
    const id = target.dataset.eventId;
    if (!id) return;
    const ok = window.confirm(game.i18n.localize('GOODSOCIETY.eventTimeline.revertConfirm'));
    if (!ok) return;
    await revertToComingSoon(id);
    this.render();
  }

  // ── Toggle past ─────────────────────────────────────────────────────────

  static async #togglePast() {
    this._showPast = !this._showPast;
    this.render();
  }

  // ── Open scene ──────────────────────────────────────────────────────────

  /** Click the scene link on a today/past row → activate that scene. */
  static async #openScene(ev, target) {
    const sceneId = target.dataset.sceneId;
    if (!sceneId) return;
    const scene = game.scenes?.get(sceneId);
    if (!scene) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.eventTimeline.sceneMissing'));
      return;
    }
    // GM activates the scene; non-GMs view it.
    if (game.user?.isGM) await scene.activate();
    else await scene.view();
  }

  /** @override */
  async _onClose(options) {
    _instance = null;
    return super._onClose?.(options);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _decorateEvent(e, isGM) {
  const isHidden = e.visibility !== 'public';
  const scene = e.sceneId ? game.scenes?.get(e.sceneId) : null;
  return {
    ...e,
    visibilityLabel: isGM
      ? game.i18n.localize(`GOODSOCIETY.eventTimeline.visibility.${_visKey(e.visibility)}`)
      : '',
    isHidden,
    canEdit:    isGM,
    sceneName:  scene?.name ?? '',
    sceneFound: !!scene,
    showsDateLabel: !!e.dateLabel,
  };
}

function _visKey(v) {
  return ({ 'public': 'public', 'gm-only': 'gmOnly' })[v] ?? 'public';
}
