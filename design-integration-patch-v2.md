# Design Integration Patch v2

This patch folds in the second wave of locked design decisions — six per-component design docs (`04-character-sheet.md` through `09-my-characters-dock.md`) — into the system planning files (`PLAN.md`, `CLAUDE.md`).

Apply via Claude Code with this prompt:

> Read the new per-component design docs in `docs/design/`: `04-character-sheet.md`, `05-epistolary-ui.md`, `06-connection-sheet.md`, `07-public-info-dashboard.md`, `08-cycle-phase-hud.md`, `09-my-characters-dock.md`. Then apply the patches in `design-integration-patch-v2.md` to `PLAN.md` and `CLAUDE.md`. Show me a unified diff for each file before saving. No DataModel changes — those are unaffected by this wave.

The B-0 and B-1 briefings are already revised in `docs/sessions/`. This patch handles the planning-doc updates.

---

## Why this patch exists

Six new per-component design docs landed:

| Doc | Covers |
|---|---|
| 04-character-sheet.md | Major Character sheet — full layout (header + two tabs + persistent strip), all section specs, edge cases |
| 05-epistolary-ui.md | Letter composer + letter card + the `themedWrap` helper pattern proven end-to-end |
| 06-connection-sheet.md | Connection sheet — single-page layout, cross-theme rendering inside impressions list |
| 07-public-info-dashboard.md | Public Info / Facilitator dashboard — hybrid theming on shared surface, GM bulk actions |
| 08-cycle-phase-hud.md | Cycle Phase HUD strip — 40px persistent bar, six-phase track, GM advance button |
| 09-my-characters-dock.md | My Characters dock — pinned per-user panel, Major + Connection rows, Speaking-As switcher in footer |

The most important structural change: **the Major Character sheet drops the third tab and uses a persistent bottom strip for tokens & cycle**. CLAUDE.md §10.2 currently shows three tabs; that's now wrong.

The most important new pattern: a **`themedWrap(actor, content)` helper** centralizes the `.gs-themed[data-theme="..."]` wrapping logic. Every chat card, letter card, dashboard row, and dock row uses it. This is now the canonical way to render character-themed content.

Two other patterns to capture:

- **Hybrid-theming CSS gotcha**: when a component (like a dashboard row) has a `.gs-themed` wrapper but should keep some properties house-only (like the row background), the wrapper's variable cascade leaks. Workaround: hardcode house values for "always-house" properties on the inner component. Document with a comment.
- **Cross-theme rendering inside a sheet**: the Connection sheet's impressions list shows accent stripes in each *target Major's* theme color, not the connection's. This works because each impression card is itself wrapped in `.gs-themed[data-theme="<major-theme>"]`. The same pattern enables Major reference pills, dashboard rows, and any future "see this character in their voice while inside another character's surface" feature.

---

## Patch 1 — `CLAUDE.md`

### 1.1 Replace §10.2 (Major Character sheet — tabs structure)

**Find** the §10.2 block titled "Sheet — tabs structure" and **replace** with:

```markdown
### 10.2 Sheet structure — two tabs + persistent strip

The Major Character sheet uses two tabs (Public, Private) plus a persistent tokens & cycle strip at the bottom. The strip stays rendered across tab switches so resolve, MT, and monologue state are always visible.

Sheet width: 720px. Height auto.

PARTS composition:

```js
static PARTS = {
  header: { template: "systems/good-society-homebrew/templates/actors/major-character/header.hbs" },
  tabs:   { template: "systems/good-society-homebrew/templates/actors/major-character/nav.hbs" },
  public: { template: "systems/good-society-homebrew/templates/actors/major-character/tab-public.hbs" },
  private:{ template: "systems/good-society-homebrew/templates/actors/major-character/tab-private.hbs" },
  strip:  { template: "systems/good-society-homebrew/templates/actors/major-character/strip-tokens.hbs" },
};
```

If implementation surfaces a reason this won't work in ApplicationV2 (e.g. composing three siblings around a tab body), fall back to a third tab. Default to the strip — full rationale in `docs/design/04-character-sheet.md` §"Structural recommendation."

Action handlers map button clicks (`data-action="..."`) to instance methods. See the boilerplate's example for the wiring pattern.
```

### 1.2 Replace §10.3 (Build order)

**Find** the §10.3 build-order list and **replace** with:

```markdown
### 10.3 Build order

Don't build the whole sheet at once. Build it in this order — sourced from `docs/design/04-character-sheet.md` §"Implementation notes":

1. DataModel + empty sheet that opens without errors
2. Header partial — portrait side panel, name, role, theme attribute on the sheet root
3. Tab nav — Public / Private toggle
4. Persistent strip — resolve track + MT + monologue + cycle indicator. Get the resolve track click-to-toggle working first; it's the most-clicked element.
5. Public tab — section by section, top to bottom: Reputation Criteria (read-only from Family), Reputation Tags grid, Active Conditions, Inner Conflict, Completed Conflicts.
6. Private tab — section by section: Bio header, Desire, Notes & Objectives, Connections, Backstory, Magic/Skills, Adventurer Sentiment.

Test in Foundry after each step. Each step is small enough that if it breaks, you know which step.

For full per-section specs (layout, CSS classes, behavior, edge cases) refer to `docs/design/04-character-sheet.md`. Don't paraphrase from this file — link the design doc.
```

### 1.3 Add a new §11 recipe — "Adding a chat card or themed surface"

**Find** the existing §11 "Adding a chat card" recipe and **replace** with:

```markdown
### Adding a chat card or themed surface

Use the `themedWrap` helper. All chat cards, letter cards, dashboard rows, and dock rows go through it:

```js
import { themedWrap } from "../helpers/themed-wrap.js";

// Wraps content in <div class="gs-themed" data-theme="<actor-theme>">.
// If the actor has an active persona with a chatColor override, applies it as inline style.
const html = themedWrap(actor, innerHTML, ["gs-letter-card"]);
```

The helper lives in `module/helpers/themed-wrap.js` and is the canonical implementation of the `.gs-themed[data-theme="..."]` wrapper pattern from §12.5. Centralizing the wrapping means every themed surface stays in sync if class names ever change.

Persona overrides: when the actor's active persona has a `chatColor`, the helper applies it as `style="--gs-brand: ${chatColor};"` so the chat card's brand color shifts without redefining the rest of the theme. See `docs/design/05-epistolary-ui.md` §"Sender is a Persona override" for the full pattern.

For chat-message specifics (flags carried, whisper rules, archive behavior), see `module/helpers/chat-cards.js` and `docs/design/05-epistolary-ui.md`.
```

### 1.4 Add new content to §12.5 (Portable theme wrapper)

**Find** the §12.5 block and **append** at the bottom:

```markdown
A canonical helper centralizes the wrapping:

```js
// module/helpers/themed-wrap.js
export function themedWrap(actor, content, extraClasses = []) {
  const themeId = actor?.system?.theme || "npc";
  const persona = actor?.system?.activePersonaId
    ? actor.system.personas.find(p => p.id === actor.system.activePersonaId)
    : null;
  const overrideColor = persona?.chatColor;
  const styleAttr = overrideColor ? ` style="--gs-brand: ${overrideColor};"` : "";
  const classList = ["gs-themed", ...extraClasses].join(" ");
  return `<div class="${classList}" data-theme="${themeId}"${styleAttr}>${content}</div>`;
}
```

Used by every chat card, letter card, dashboard row, dock row. If the wrapper class names ever change, update one file.
```

### 1.5 Add CSS organization spec to §5

**Find** §5 "Repository layout" and **replace** the `styles/` block (currently a single line) with:

```
├── styles/
│   ├── good-society.css            # entry point — imports everything in order
│   ├── _variables.css              # house CSS variables (palette, type, scale)
│   ├── _fonts.css                  # @fontsource imports
│   ├── _house.css                  # antique-but-clean base styling
│   ├── _themed-wrapper.css         # .gs-themed plumbing
│   ├── themes/                     # one file per registry theme
│   │   ├── _theme-clayton.css
│   │   ├── _theme-rose.css
│   │   └── ...                     # one per registry id
│   ├── components/                 # reusable primitives — see docs/design/03 inventory
│   │   ├── _card.css
│   │   ├── _section-header.css
│   │   ├── _hairline.css
│   │   ├── _resolve-track.css
│   │   ├── _mt-badge.css
│   │   ├── _monologue-dot.css
│   │   ├── _reputation-tag.css
│   │   ├── _reputation-meter.css
│   │   ├── _inner-conflict.css
│   │   ├── _visibility-flag.css
│   │   ├── _portrait-frame.css
│   │   ├── _persona-switcher.css
│   │   ├── _magic-skill-tile.css
│   │   ├── _letter-card.css        # used by composer + chat + journal
│   │   ├── _impression-card.css    # cross-theme accent stripe
│   │   ├── _dashboard-row.css      # hybrid-theming gotcha lives here
│   │   ├── _dock-row-major.css
│   │   ├── _dock-row-connection.css
│   │   └── _phase-marker.css
│   ├── sheets/                     # one file per actor sheet
│   │   ├── _major-character.css
│   │   ├── _connection.css
│   │   ├── _family.css
│   │   └── _npc.css
│   └── apps/                       # one file per custom app
│       ├── _dashboard.css
│       ├── _dock.css
│       ├── _letter-composer.css
│       └── _cycle-hud.css
```

### 1.6 Add to §15 anti-patterns

**Append** to the §15 bullet list:

```markdown
- ❌ Don't let a `.gs-themed` wrapper's variable cascade override "always-house" properties (e.g. dashboard row backgrounds). Hardcode house values inside the themed component for those properties, and document with a comment. See `docs/design/07-public-info-dashboard.md` §"Theme behavior" for the canonical example.
- ❌ Don't manually concatenate `<div class="gs-themed" data-theme="...">` inline. Always go through `themedWrap()` from `module/helpers/themed-wrap.js`. Centralized wrapping survives class-name changes; inline concatenation doesn't.
- ❌ Don't render the Tokens & Cycle strip as a third tab on the Major sheet. It's a persistent strip below the tab body; tokens state must remain visible across tab switches. See `docs/design/04-character-sheet.md` §"Structural recommendation."
```

### 1.7 Update §14 Build phase status — current state

**Replace** the "Currently in" / "Done" / "Next" block with:

```markdown
**Currently in:** Phase 1b — CSS architecture (next: Session B-0)

**Done:**
- Phase 0: fork, rename, verify load
- Session A: all 10 DataModels defined and registered
- Session A.5: theme field backfilled on Major/Connection/NPC; chatStyle removed from Major
- Design integration v1: theming architecture, twelve-theme registry, antique-but-clean principle integrated into PLAN/CLAUDE
- Design integration v2: per-component design docs (04 character sheet, 05 epistolary, 06 connection, 07 dashboard, 08 cycle HUD, 09 dock) integrated; structural changes (two tabs + strip on Major sheet, themedWrap helper, per-component CSS organization, hybrid-theming gotcha) reflected in PLAN/CLAUDE

**Next:**
- Session B-0 — CSS architecture (variables, fonts, themedWrap helper, card primitive, .gs-themed wrapper, clayton preset)
- Session B-1 — sheet templates batch (per docs/design/04, 06, 07; structural changes locked)
- Session B-2 — remaining eleven theme presets
```

---

## Patch 2 — `PLAN.md`

### 2.1 Update §6.1 (Sheet UI strategy → Major Character)

**Find** the "Major Character sheet — three tabs" sub-block in §6.1 and **replace** with:

```markdown
### 6.1 Major Character sheet — two tabs + persistent strip

1. **Public** (front of sheet, image 1)
   - Portrait side panel + main column header (name, theme, persona switcher)
   - Reputation Criteria (read-only from Family)
   - Reputation Tags grid (positive / negative)
   - Active Reputation Conditions
   - Inner Conflict pair, with the 5+5 boxes as clickable checkboxes
   - Completed Inner Conflicts list

2. **Private** (back of sheet, image 2)
   - Bio header (age, peerage, appearance, temperament given/taken)
   - Desire, Notes & Objectives, Backstory, Adventurer Sentiment (all with per-field visibility flags)
   - Connections list
   - Magic/Skills

3. **Tokens & Cycle persistent strip** (always visible, below the tab body)
   - Resolve tokens (clickable 5-pip row)
   - MT toggle
   - Monologue dot
   - Current cycle phase indicator (read-only)
   - "Take Monologue" button

Full per-section spec lives in `docs/design/04-character-sheet.md`. Sheet dimensions: 720px wide, height auto.
```

### 2.2 Update §12.5 — note Letter composer in design docs

**Find** the "Epistolary letter formatter" bullet in §12.5 and **append** at the end:

```markdown
Full composer spec in `docs/design/05-epistolary-ui.md` — covers the two-zone layout (house chrome + sender-themed preview), the seal-color picker, the send flow with chat flags, and the canonical `themedWrap` helper that powers all themed-content rendering across the system.
```

### 2.3 Update §6.4 — flesh out custom apps with design-doc references

**Replace** §6.4 with:

```markdown
### 6.4 Reference: design system

A full design-system documentation tree lives in `docs/design/`:

- `README.md` — folder orientation
- `01-mood-exploration.md` — mood directions explored, decision rationale (Closed)
- `02-theme-architecture.md` — two-layer model, scope boundaries, wrapper mechanism (Locked)
- `03-component-inventory.md` — 59 components mapped to theme scope and design status
- `04-character-sheet.md` — Major Character sheet spec (Locked)
- `05-epistolary-ui.md` — Letter composer + letter card + `themedWrap` helper (Locked)
- `06-connection-sheet.md` — Connection sheet (Locked)
- `07-public-info-dashboard.md` — Public Info dashboard (Locked)
- `08-cycle-phase-hud.md` — Cycle Phase HUD strip (Locked)
- `09-my-characters-dock.md` — My Characters dock (Locked)
- `decisions.md` — authoritative locked palette, type tokens, twelve-theme registry, antique-but-clean principle

When implementing visual surfaces, link the relevant design doc in your Claude Code prompt rather than describing the design inline. This keeps the implementation grounded in the locked decisions and prevents drift.
```

### 2.4 Update build phases §13 — refine Phase 1c through Phase 6

**Find** Phase 1c in §13 and **replace** along with related phases:

```markdown
Phase 1c — Sheet templates batch (Session B-1) — 2–3 days. Build all Handlebars templates following `docs/design/04-character-sheet.md`, `docs/design/06-connection-sheet.md`, and the inventory order in `03-component-inventory.md`. The themedWrap helper from B-0 is consumed by chat-card and letter-card primitives built here. Persistent tokens & cycle strip on Major sheets (not a third tab — see §6.1).

Phase 1d — Remaining theme presets (Session B-2) — 1 day. Eleven presets implemented. Each is a CSS file with `.gs-actor[data-theme="..."]` and `.gs-themed[data-theme="..."]` selectors per `docs/design/decisions.md` §Theme registry.
```

**Find** Phase 6 (Public Info dashboard) and **append** at the end of its description:

```markdown
Full spec in `docs/design/07-public-info-dashboard.md` — covers the hybrid-theming row pattern, GM bulk actions, real-time updates via `updateActor` hooks, and the CSS hybrid-theming gotcha (row backgrounds use hardcoded house values to prevent wrapper cascade).
```

**Find** Phase 5 (Personas + multi-character ergonomics) and **append**:

```markdown
The My Characters dock (`docs/design/09-my-characters-dock.md`) ships in this phase. It's a pinned per-user panel showing owned actors with full state for Majors and tighter rows for Connections. Footer hosts the Speaking-As switcher.
```

**Find** Phase 3 (Cycle phase + automation hooks) and **append**:

```markdown
The Cycle Phase HUD strip (`docs/design/08-cycle-phase-hud.md`) ships in this phase. It's a 40px persistent strip at the top of the canvas with cycle counter, six-phase track, and GM advance button.
```

---

## Patch 3 — Out-of-band notes (no file changes)

These are notes for Natalie (and future-Claude-Code reading the running log):

1. **Major Character sheet structure was a recommendation, now locked.** Per `04-character-sheet.md` Open Question 5 "tentative answer: bottom" — the persistent strip lives at the bottom, not the top. If implementation reveals a reason to change, document and revisit. Don't quietly make it a tab again.

2. **The `themedWrap` helper is the new canonical primitive for any character-bound rendering that travels.** It's used in chat cards, letter cards, dashboard rows, dock rows, monologue popups, persona switch announcements, and impression card cross-theme accents. Build it once, in `module/helpers/themed-wrap.js`, in Session B-0. Every later surface consumes it.

3. **The hybrid-theming gotcha is real and worth documenting in code.** When a `.gs-themed` wrapper exists around a component but some properties (like dashboard row backgrounds) should *not* pick up the theme, the wrapper's CSS variable cascade leaks. Workaround: hardcode house values inside the inner component for those properties, with a comment explaining why. The Public Info dashboard CSS will be the first place this matters; the Dock CSS will be the second.

4. **Cross-theme rendering inside a sheet** (Connection sheet's impressions, the Major reference pill, future "guest list" surfaces) is enabled by the same `.gs-themed[data-theme="..."]` wrapper. Each themed element rebinds variables locally, so a Connection-themed parent can contain a Major-themed child without leaking either way.

5. **The Speaking-As switcher** lives in the dock footer (`09-my-characters-dock.md`), not above the chat input. This was an open question we resolved in favor of dock-footer placement. Keep it there unless playtest surfaces a problem.

6. **Sheet dimensions are locked.** Major: 720px. Connection: 600px. Dashboard: 720px. Dock: 290px. Don't tinker with these without a design-doc revision.

---

## How to apply this patch

1. The file is already at the repo root (`design-integration-patch-v2.md`).
2. The six new design docs are already in `docs/design/`.
3. The B-0 and B-1 briefings are already revised in `docs/sessions/`.
4. Open Claude Code in the repo. Run the prompt at the top of this file.
5. Review the diffs Claude Code presents for `PLAN.md` and `CLAUDE.md`. Commit if they match.
6. Once those are committed, proceed with Session A.5, then B-0, then B-1 — using the revised briefings.
