# 31 — Event Timeline (in-fiction calendar)

**Status:** Drafted, ready for Claude Code implementation
**Date opened:** 2026-05-07
**Covers:** A GM-authored, player-readable calendar of dated in-fiction events. Suggested as **Session B-11**.

## Why

Austen-era play orbits social events at fixed dates: balls on the 15th, weddings on the 22nd, regiments arriving in May. The current system has no surface for tracking this; GMs ad-hoc the dates in chat or out-of-band. A simple shared timeline gives the table a canonical reference and lets the GM prep future events privately, then reveal them at the right moment.

Out of scope for this batch: full month grid, week views, in-fiction time-of-day, real-life session log.

## Architecture

### Data: world-scoped settings (no Item type)

Two world settings register at `init`:

```js
game.settings.register('good-society-homebrew', 'calendarEvents', {
  scope: 'world',
  config: false,
  type: Object,
  default: [],
  onChange: () => renderEventTimeline(),  // re-render any open instance
});

game.settings.register('good-society-homebrew', 'currentInGameDate', {
  scope: 'world',
  config: false,
  type: Object,
  default: { year: 1815, month: 1, day: 1 },
  onChange: () => renderEventTimeline(),
});
```

`calendarEvents` is an array of:

```ts
{
  id:          string,             // foundry.utils.randomID()
  year:        number,             // e.g. 1815
  month:       number,             // 1-12
  day:         number,             // 1-31
  title:       string,
  description: string,             // plain text or HTML — author's choice
  visibility:  'public' | 'gm-only' | 'revealed-on-date',
  createdAt:   number,             // Date.now()
}
```

Why a setting and not a custom Item type:

- One linear list, no parent-actor relationship.
- Foundry's setting `onChange` fires across all clients automatically — same WebSocket replication as actor data.
- Avoids cluttering the Items sidebar with calendar entries.
- Setting size stays tiny (~10-50 events × ~200 bytes = 2-10 KB).

### Visibility model

Three values per event:

- **`public`** — visible to all clients immediately.
- **`gm-only`** — visible only to GM clients. GM scratch pad.
- **`revealed-on-date`** — hidden from non-GM clients until `currentInGameDate >= event.date`. GM uses this for "I want this surprise to land on the 15th."

Filter in the context builder, not the template:

```js
function _isVisibleToUser(event, currentDate, isGM) {
  if (isGM) return true;
  if (event.visibility === 'public') return true;
  if (event.visibility === 'gm-only') return false;
  if (event.visibility === 'revealed-on-date') {
    return _compareDate(event, currentDate) <= 0;  // event.date <= today
  }
  return false;  // unknown flag — fail closed
}
```

`_compareDate` returns -1/0/1 over `{year, month, day}`. Don't rely on JavaScript `Date` for the comparison — keep it pure-numeric (year×10000 + month×100 + day) so we don't accidentally inherit timezone weirdness.

### Date display

Use JavaScript `Date` objects only at format time (never for comparison or storage). Two formats:

- **Primary:** `Intl.DateTimeFormat` with `weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'` → "Wednesday, 15 March 1815".
- **Compact:** `'15 Mar 1815'` for tight spaces (timeline grouping headers, etc.).

Edge case: years < 1900 work fine with `new Date(year, month-1, day)` in modern JS engines, including weekday computation. Spot-check 1815 in dev to confirm.

### Sorting

Events sorted by `(year, month, day, createdAt)` ascending. Past events render with `gs-event-timeline__row--past` styling (lower opacity, no edit affordance unless GM hovers). Future events render normally. The current date is marked by a horizontal "today" rule.

## App

### `module/apps/event-timeline.js`

Framed ApplicationV2, singleton (id: `gs-event-timeline`). Width 600. Height auto.

```js
static DEFAULT_OPTIONS = {
  id: 'gs-event-timeline',
  classes: ['good-society', 'gs-event-timeline-app'],
  window: { frame: true, positioned: true, title: 'GOODSOCIETY.eventTimeline.windowTitle' },
  position: { width: 600, height: 'auto' },
  actions: {
    addEvent:    EventTimeline.#addEvent,
    editEvent:   EventTimeline.#editEvent,
    deleteEvent: EventTimeline.#deleteEvent,
    setCurrentDate: EventTimeline.#setCurrentDate,
  },
};
```

Two modes:
- **GM mode:** full read/write — add button, edit/delete buttons per row, "set current date" affordance at the top. Visibility flag visible per event.
- **Player mode:** read-only — sees only events matching the visibility filter. No add/edit/delete buttons. No "set current date" controls. Visibility flags hidden (no need to expose private metadata).

Same template, same class — gate the action buttons on `isGM` in `_prepareContext` and `{{#if isGM}}` in the template. The "two modes" are one app with a context flag.

### Layout

```
┌─────────────────────────────────────────────────────┐
│ Calendar                                          ✕ │
│ Cycle 5 · current date: Wed 15 March 1815 [edit]    │
│                                                       │
│ ──────────────── upcoming ────────────────           │
│ ┌──────────────────────────────────────────────┐    │
│ │ Sat 22 March 1815                       ▲ ✕ │    │
│ │ Lord Vesper's musicale                       │    │
│ │ Charlotte to play piano. Lady Thorn host.    │    │
│ │ public                                       │    │
│ └──────────────────────────────────────────────┘    │
│ ┌──────────────────────────────────────────────┐    │
│ │ Tue 25 March 1815 · revealed on date  ▲ ✕   │    │
│ │ The carriage accident                        │    │
│ │ Henry's brother arrives unexpectedly.        │    │
│ └──────────────────────────────────────────────┘    │
│                                                       │
│ ──────────────── today ────────────────              │
│   (current date marker)                              │
│ ──────────────── past ────────────────               │
│ ┌──────────────────────────────────────────────┐    │
│ │ Fri 10 March 1815 · past                     │    │
│ │ Lady Thorn's dinner party                    │    │
│ └──────────────────────────────────────────────┘    │
│                                                       │
│ [+ add event]                                        │
└─────────────────────────────────────────────────────┘
```

CSS class root: `.gs-event-timeline`. Uses house style (no character theming — this is a shared communal surface).

### Add / Edit form

Inline expansion of the row, OR a small modal. Either works. Suggest inline (less interruption). Form:

- **Title** (text input, required)
- **Date** (three inputs: year, month, day — keep simple) — or a single `<input type="date">` if Foundry v13's date input renders well; spot-check first.
- **Description** (textarea, optional)
- **Visibility** (radio: public / GM only / reveal on date)
- **Save / Cancel** buttons

GM-only — players can't reach this form because the action handlers and templates gate on `isGM`.

### "Set current date" control

Small editable line at the top of the GM view. Click to expand into year/month/day inputs + Save. Defaults to the latest event's date if `currentInGameDate` hasn't been set yet.

Why expose this: it controls when `revealed-on-date` events flip to visible. If the GM doesn't advance the date, surprises never reveal.

Future enhancement (out of scope here): auto-advance the in-game date when the cycle phase advances, configurable per cycle. For v0 it's manual.

## Mounts

### Scene control

Add to `module/hooks/scene-controls.js` alongside `gs-dashboard`, `gs-organizer`, etc. GM-only visibility. Click opens the timeline.

```js
{
  name: 'gs-calendar',
  title: 'GOODSOCIETY.eventTimeline.sceneControlTitle',
  icon: 'fas fa-calendar',
  visible: game.user.isGM,
  onChange: () => openEventTimeline(),
  button: true,
}
```

(Actual prop shape depends on Foundry v13's controls schema — match the existing entries in `scene-controls.js`.)

For non-GM players, add a small "calendar" button in the My Characters Dock footer or as a separate dock entry, OR rely on the dashboard link below.

### Dashboard link

`templates/apps/dashboard.hbs` GM bulk row already has `permissions ↗`, `advance phase ↗` etc. Add `calendar ↗`:

```hbs
<button type="button" class="gs-btn gs-btn--sm gs-btn--outline"
        data-action="open-calendar"
        title="{{localize "GOODSOCIETY.dashboard.bulk.calendarHint"}}">
  {{localize "GOODSOCIETY.dashboard.bulk.calendar"}} ↗
</button>
```

Wire `'open-calendar'` action to `openEventTimeline()` in `public-info-dashboard.js`.

For player-side access from the dashboard: add a small `calendar ↗` button visible to all (not just GM) in a non-bulk row, OR show the same button in the GM bulk row when isGM is false. Simplest: render the button to all users; the timeline window itself enforces the read-only mode for non-GMs.

### My Characters Dock (player surface)

Optional — add a small `calendar` link in the dock footer that opens the timeline in player mode. Same `openEventTimeline()` call; the app branches internally on `game.user.isGM`.

## Real-time sync

`calendarEvents` and `currentInGameDate` are world-scoped settings. Foundry replicates setting changes via WebSocket automatically. The `onChange` callback re-renders any open `EventTimeline` instance:

```js
// In good-society.js init:
game.settings.register('good-society-homebrew', 'calendarEvents', {
  scope: 'world', config: false, type: Object, default: [],
  onChange: () => {
    const inst = getEventTimeline();
    if (inst?.rendered) inst.refreshAndReset();
  },
});
```

(`refreshAndReset` follows the Public Info Dashboard's pattern.)

GM adds an event → `game.settings.set('calendarEvents', [...])` → all clients see it within ~50-100ms.

GM advances `currentInGameDate` → all clients re-render; `revealed-on-date` events flip from hidden to visible if their date is now reached.

## Files to add / change

| File | Action | Notes |
|---|---|---|
| `module/apps/event-timeline.js` | NEW | ~250 lines. Class + render lifecycle + actions + helpers. |
| `templates/apps/event-timeline.hbs` | NEW | ~150 lines. Single-root `<section>`. |
| `styles/apps/_event-timeline.css` | NEW | ~180 lines. House-styled. |
| `styles/good-society.css` | MODIFY | `@import` the new CSS. |
| `module/helpers/event-timeline.js` | NEW | ~80 lines. Pure helpers: `addEvent`, `updateEvent`, `removeEvent`, `compareDate`, `formatDate`, `isVisibleToUser`. GM-only writes. |
| `module/good-society.js` | MODIFY | Register `calendarEvents` + `currentInGameDate` settings. |
| `module/hooks/scene-controls.js` | MODIFY | Add `gs-calendar` GM-only button. |
| `module/apps/public-info-dashboard.js` | MODIFY | Add `'open-calendar'` action handler. |
| `templates/apps/dashboard.hbs` | MODIFY | Add `calendar ↗` button (visible to all; player view enforced inside the timeline app). |
| `lang/en.json` | MODIFY | New `GOODSOCIETY.eventTimeline.*` keys. Validate top-level keys after. |
| `CLAUDE.md` §14 | MODIFY | Add Session B-11 (or appropriate) to Done. |
| `CLAUDE.md` §15 | MODIFY | Log any non-trivial decisions. |

## Date math notes

Pure numeric comparison only:

```js
function compareDate(a, b) {
  const aKey = a.year * 10000 + a.month * 100 + a.day;
  const bKey = b.year * 10000 + b.month * 100 + b.day;
  return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
}
```

Format using `Intl.DateTimeFormat`:

```js
function formatDate({ year, month, day }, style = 'long') {
  const d = new Date(year, month - 1, day);
  if (style === 'long') {
    return new Intl.DateTimeFormat(game.i18n.lang, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(d);
  }
  return new Intl.DateTimeFormat(game.i18n.lang, {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(d);
}
```

Sanity check: `new Date(1815, 2, 15).toLocaleDateString('en-US', { weekday: 'long' })` returns `'Wednesday'` in modern V8/Spidermonkey. Pre-1900 dates work; the proleptic Gregorian calendar JS uses is fine for Austen-era Britain (which had switched to Gregorian by 1752).

## Anti-pattern reminders

- **Single-root PART template.** New `event-timeline.hbs` must have one outer `<section>`.
- **JSON nesting.** New `eventTimeline` block lands inside `GOODSOCIETY`. Validate after every edit.
- **GM-only writes.** Settings are world-scoped. Players can't `game.settings.set`. All write paths in the helper must guard with `if (!game.user?.isGM) return`. Read paths are open.
- **`form.submitOnChange` audit.** If the add/edit form uses native inputs with `name=""` attributes, audit each one — same foot-gun as before.
- **Don't store derived state.** Sort + filter in `_prepareContext`, not on disk.
- **Visibility filter in JS, not Handlebars.** A non-GM player should never receive the `gm-only` event objects in the template context. Filter server-side (in `_prepareContext`) so the data simply isn't there for the template to leak. Defense-in-depth: even if a curious player opened DevTools on the rendered page, they shouldn't find GM-only event titles.
- **Don't use `actor.system`.** No actor involvement here. `game.settings.get/set` only.
- **Real-time sync via setting `onChange`.** Don't poll. The setting onChange fires on all clients; re-render in there.

## Open questions for the build

1. Should past events default to collapsed? With ~30+ events over a long campaign, the timeline could get long. Suggest: collapsed by default with an "expand past events (N)" link. Decide during build.
2. Date input UI: three numeric inputs vs. native `<input type="date">`. Suggest spot-checking the native input in Foundry v13 first; fall back to three inputs if styling fights us.
3. Should a chat card post when the GM adds a public event? "Lady Thorn's musicale scheduled for 22 March 1815." Useful for groups not actively watching the calendar. Suggest yes for `public` only; never for `gm-only`/`revealed-on-date`.
4. Player view of `revealed-on-date` events: should the entry appear at all (locked icon, hidden title) or be invisible? Suggest invisible — no metadata leak.

## Out of scope

- **Recurring events** (e.g., "every Sunday morning church service"). Single-instance only.
- **Time-of-day** ("8 PM ball"). Date-level granularity only. Time can live in the description text.
- **Multi-day events** ("Bath visit, 5-12 May"). Use two events (arrival + departure) for v0.
- **In-fiction calendar systems other than Gregorian** (Regency-era Britain used Gregorian, so this is fine).
- **Auto-advance current date on cycle phase change.** Manual GM advance for v0; auto-advance is a future enhancement.
- **Cross-link events to scenes/chat cards.** Future enhancement; events stand alone for v0.
- **Real-life session log** (the "session/cycle log" option from the spec call). Different scope; would be its own doc.

## Verification

- GM adds three events with different visibility flags. Player2 (logged in on a second window) sees only `public` ones until current date advances past `revealed-on-date` event dates.
- GM advances `currentInGameDate` past a `revealed-on-date` event → that event flips to visible on Player2's window within ~100ms.
- GM removes an event → vanishes on Player2's window.
- Past events render greyed; current date marker appears in the right place; future events render normally.
- Both GM and player can open the timeline via the scene control / dashboard link / dock button (whichever mounts you ship).
- Non-GM player using DevTools cannot find `gm-only` event titles in the rendered DOM (visibility filter is server-side).
