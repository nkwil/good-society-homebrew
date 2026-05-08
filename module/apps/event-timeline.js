/**
 * EventTimeline — in-fiction calendar of dated events.
 * Per docs/design/31-event-timeline.md.
 *
 * Framed ApplicationV2 singleton. Two modes:
 *   - GM: full read/write — add, edit, delete events; set current date.
 *   - Player: read-only — sees only events visible under the visibility filter.
 *
 * Storage in two world settings (calendarEvents + currentInGameDate),
 * registered in good-society.js. Foundry's setting onChange replicates writes
 * across clients automatically; we re-render on every change.
 */

import {
  getEvents,
  getCurrentDate,
  getVisibleEvents,
  compareDate,
  formatDate,
  addEvent,
  updateEvent,
  removeEvent,
  setCurrentDate,
} from '../helpers/event-timeline.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 }              = foundry.applications.api;

// ── Singleton ─────────────────────────────────────────────────────────────

let _instance = null;

export function getEventTimeline() {
  if (!_instance) _instance = new EventTimeline();
  return _instance;
}

export function openEventTimeline() {
  getEventTimeline().render({ force: true });
}

/** Called from settings onChange — re-renders if the window is open. */
export function refreshEventTimeline() {
  if (_instance?.rendered) _instance.render();
}

// ── App ───────────────────────────────────────────────────────────────────

const VISIBILITY_OPTIONS = ['public', 'gm-only', 'revealed-on-date'];

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
      setDateOpen:     EventTimeline.#setDateOpen,
      setDateCancel:   EventTimeline.#setDateCancel,
      setDateSave:     EventTimeline.#setDateSave,
      togglePast:      EventTimeline.#togglePast,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/apps/event-timeline.hbs',
    },
  };

  constructor(options = {}) {
    super(options);
    this._addingEvent  = false;            // boolean — inline add form open
    this._editingId    = null;             // event id currently being edited (null = none)
    this._editingDate  = false;            // current-date editor open
    this._showPast     = false;            // past events expanded
  }

  /** @override */
  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const isGM = game.user?.isGM ?? false;
    const currentDate = getCurrentDate();

    // ── Filter (server-side defense): non-GM never receives gm-only events.
    const visible = isGM ? _sortAll(getEvents()) : getVisibleEvents(false);

    const past = [];
    const today = [];
    const upcoming = [];
    for (const e of visible) {
      const cmp = compareDate(e, currentDate);
      if (cmp < 0)  past.push(_decorateEvent(e, isGM, currentDate));
      else if (cmp === 0) today.push(_decorateEvent(e, isGM, currentDate));
      else upcoming.push(_decorateEvent(e, isGM, currentDate));
    }

    return {
      ...ctx,
      isGM,
      currentDate,
      currentDateLong: formatDate(currentDate, 'long'),
      upcoming,
      today,
      past,
      pastCount: past.length,
      hasAny: visible.length > 0,
      // Inline form state:
      addingEvent:  this._addingEvent,
      editingId:    this._editingId,
      editingDate:  this._editingDate,
      showPast:     this._showPast,
      // Visibility radio options
      visibilityChoices: VISIBILITY_OPTIONS.map(v => ({
        value: v,
        label: game.i18n.localize(`GOODSOCIETY.eventTimeline.visibility.${_visKey(v)}`),
      })),
    };
  }

  // ── Actions: add ─────────────────────────────────────────────────────────

  static async #addEventOpen() {
    if (!game.user?.isGM) return;
    this._addingEvent = true;
    this._editingId = null;
    this.render();
  }

  static async #addEventCancel() {
    this._addingEvent = false;
    this.render();
  }

  static async #addEventSave() {
    if (!game.user?.isGM) return;
    const root = this.element;
    const get = (name) => root.querySelector(`[data-evt-field="${name}"]`)?.value ?? '';
    const visEl = root.querySelector('[data-evt-field="visibility"]:checked');

    const title = (get('title') || '').trim();
    if (!title) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.eventTimeline.errorNoTitle'));
      return;
    }

    const created = await addEvent({
      year:  Number(get('year')),
      month: Number(get('month')),
      day:   Number(get('day')),
      title,
      description: get('description'),
      visibility: visEl?.value ?? 'public',
    });
    if (!created) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.eventTimeline.errorAdd'));
      return;
    }

    // Optional public announcement card (decided per scope doc §"Open questions" #3).
    if (created.visibility === 'public') {
      try {
        const { postSystemCard } = await import('../helpers/chat-cards.js');
        await postSystemCard({
          content: game.i18n.format('GOODSOCIETY.eventTimeline.publicEventCard', {
            title: created.title,
            date:  formatDate(created, 'long'),
          }),
          context: 'calendar',
        });
      } catch (err) { console.warn('GS | event timeline announce card failed:', err); }
    }

    this._addingEvent = false;
    this.render();
  }

  // ── Actions: edit ────────────────────────────────────────────────────────

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
      root.querySelector(`[data-evt-field="${name}"][data-event-id="${id}"]`)?.value
      ?? root.querySelector(`[data-evt-field="${name}"]`)?.value
      ?? '';
    const visEl =
      root.querySelector(`[data-evt-field="visibility"][data-event-id="${id}"]:checked`)
      ?? root.querySelector('[data-evt-field="visibility"]:checked');

    const title = (get('title') || '').trim();
    if (!title) {
      ui.notifications?.warn(game.i18n.localize('GOODSOCIETY.eventTimeline.errorNoTitle'));
      return;
    }

    await updateEvent(id, {
      year:  Number(get('year')),
      month: Number(get('month')),
      day:   Number(get('day')),
      title,
      description: get('description'),
      visibility: visEl?.value ?? 'public',
    });

    this._editingId = null;
    this.render();
  }

  // ── Actions: delete ──────────────────────────────────────────────────────

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

  // ── Actions: set current date ────────────────────────────────────────────

  static async #setDateOpen() {
    if (!game.user?.isGM) return;
    this._editingDate = true;
    this.render();
  }

  static async #setDateCancel() {
    this._editingDate = false;
    this.render();
  }

  static async #setDateSave() {
    if (!game.user?.isGM) return;
    const root = this.element;
    const get = (name) => root.querySelector(`[data-date-field="${name}"]`)?.value ?? '';
    await setCurrentDate({
      year:  Number(get('year')),
      month: Number(get('month')),
      day:   Number(get('day')),
    });
    this._editingDate = false;
    this.render();
  }

  // ── Actions: toggle past ─────────────────────────────────────────────────

  static async #togglePast() {
    this._showPast = !this._showPast;
    this.render();
  }

  /** @override */
  async _onClose(options) {
    _instance = null;
    return super._onClose?.(options);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _decorateEvent(e, isGM, currentDate) {
  const longDate = formatDate(e, 'long');
  const isHidden = e.visibility !== 'public';
  return {
    ...e,
    longDate,
    visibilityLabel: isGM
      ? game.i18n.localize(`GOODSOCIETY.eventTimeline.visibility.${_visKey(e.visibility)}`)
      : '',
    isPast:    compareDate(e, currentDate) < 0,
    isToday:   compareDate(e, currentDate) === 0,
    isHidden,  // GM badge: shown when visibility != public
    canEdit:   isGM,
  };
}

function _sortAll(events) {
  return [...events].sort((a, b) => {
    const c = compareDate(a, b);
    if (c !== 0) return c;
    return (a.createdAt ?? 0) - (b.createdAt ?? 0);
  });
}

function _visKey(v) {
  return ({
    'public':           'public',
    'gm-only':          'gmOnly',
    'revealed-on-date': 'revealedOnDate',
  })[v] ?? 'public';
}
