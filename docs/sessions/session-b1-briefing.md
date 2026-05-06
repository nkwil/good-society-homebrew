# Session B-1 — Sheet Templates Batch

**Goal:** build every Handlebars template + its sheet class for all four Actor types and all five Item types. Templates consume the house CSS variables and the `.gs-actor[data-theme="..."]` mechanism set up in Session B-0. **No automation logic, no hooks beyond sheet registration, no chat cards.** Visual fidelity to the design system is the bar.

This is the largest session of the build. Schedule 2–3 days of focused work. Following the implementation order strictly is what keeps it manageable — don't jump ahead.

**Source-of-truth design docs to keep open:**
- `docs/design/03-component-inventory.md` — 59 components, theme scope, recommended order
- `docs/design/decisions.md` — palette/type/registry
- `docs/design/02-theme-architecture.md` — scope boundaries
- `CLAUDE.md` §10 — Major Character sheet skeleton (already written)
- `CLAUDE.md` §9 — Reputation Tag worked example

## Implementation order

Build per `03-component-inventory.md` §"Implementation order (suggested)" — that document is the authoritative roadmap for this session. The summary:

1. **Component primitives that everyone uses** — buttons (#40, #41, #42), text input + dropdown + checkbox (#36, #37, #38). Build as Handlebars partials in `templates/partials/` and matching CSS in `styles/_house.css`.
2. **Major Character sheet header** (#1) — first character-themed surface. Validates that the `.gs-actor[data-theme="..."]` selector is being set on the sheet root by the sheet class. If it isn't, fix here before any other character-themed work.
3. **Token economy primitives** — resolve track (#45), MT toggle (#46), monologue dot (#47).
4. **Reputation primitives** — tag pills positive (#43) and negative (#44), visual reputation meter (#49).
5. **Inner Conflict box grid** (#39) — the highest-stakes primitive in the entire system. The 5+5 grid needs to feel weighty when boxes fill. Get it right here; it shows up on every Major sheet.
6. **Major Character full layout** (#2, #3, #4, #5) — Public, Private, Tokens & Cycle tabs.
7. **Connection sheet** (#6) — second character-themed actor type. Connections use a `.gs-connection[data-theme="..."]` selector; mostly mirrors Major patterns.
8. **Family sheet** (#7) — house-styled. Crest display (#57) inline.
9. **NPC sheet** (#8) — house-styled. Inherits NPC theme (which inherits house — no overrides).
10. **Item sheets** (#9–13) — Reputation Tag (already worked example in CLAUDE.md §9), Reputation Condition, Inner Conflict (the item, not the embedded data on Major), Magic/Skill, Backstory Action.
11. **Persona switcher** (#56) — sits inside the Major sheet bio header. Holds for last because it composes from the primitives above.

## What's NOT in this session

- ❌ Automation logic. No "click this and resolve token decrements." Click handlers can be wired but their bodies are stubs (`console.log` is fine).
- ❌ Chat cards. They live in Session B-3 alongside the chat-styling layer.
- ❌ Custom apps (Public Info dashboard, My Characters dock, Cycle HUD, Upkeep wizard, etc.). Those are Phase 6+.
- ❌ Hover cards, scene controls, persona switching pipeline, monologue journal flow — all later phases.
- ❌ The remaining eleven theme presets. That's Session B-2 — small and parallel-safe to do after this lands.

This session is **shape and styling only**. Resist scope creep.

## Per-component briefing

Rather than re-stating each component's spec here, **link the relevant inventory entry in your Claude Code prompt for each component**:

> Build component #1 (Major Character sheet header). See `docs/design/03-component-inventory.md` row 1 for the spec. The sheet class lives in `module/sheets/major-character-sheet.js` (skeleton in CLAUDE.md §10.2). The template lives in `templates/actors/major-character/header.hbs`.

Note especially:
- Major Character sheet header has a **120px portrait column + flex main**, with the portrait in an oval frame at 78×92px. Side panel uses `--gs-side-panel` (per-theme).
- Reputation tag pills are **hybrid** — pill stays neutral, accent stripe colors come from the originator's theme. On a character's own sheet they use that character's theme; on the public board (later phase) they pick up the theme of the originator.
- Inner Conflict box grid: 18px squares, hand-drawn-ish corners, fill with `--gs-brand` when checked. Two columns of 5, separated by the conflict's left/right labels.
- Visibility flag indicator (#48) is a three-state inline pill: secret (closed eye, `--gs-accent-2`), public (open eye, `--gs-brand`), redacted (slash, `--gs-danger`). Renders inline next to every sensitive field on the Private tab.
- Item sheets are **all house-styled** — items are objects in the world. Don't accidentally apply character themes to them.

## Critical: setting `data-theme` on the sheet root

The whole CSS architecture rests on the sheet class setting two attributes on its root element:

1. A class — `.gs-actor` (for Majors), `.gs-connection` (for Connections), `.gs-npc` (for NPCs). Family and item sheets don't need these — they're house-styled.
2. A `data-theme` attribute — value pulled from `actor.system.theme`.

Wire this in the sheet class via the ApplicationV2 `_renderHTML` or `_onRender` hook. Pattern:

```js
async _onRender(context, options) {
  await super._onRender(context, options);
  const root = this.element;
  if (this.document.type === "major-character") {
    root.classList.add("gs-actor");
    root.dataset.theme = this.document.system.theme || "clayton";
  } else if (this.document.type === "connection") {
    root.classList.add("gs-connection");
    root.dataset.theme = this.document.system.theme || "connection-green";
  } else if (this.document.type === "npc") {
    root.classList.add("gs-npc");
    root.dataset.theme = this.document.system.theme || "npc";
  }
}
```

A common mistake will be setting `data-theme` on the *sheet body* instead of the sheet *root*. ApplicationV2's `this.element` is the root element; setting it there ensures every descendant inherits via the CSS variable cascade.

## Starting prompt for Claude Code

> Phase 1c, Session B-1 — Sheet templates batch. Read `session-b1-briefing.md` end-to-end. Also read `docs/design/03-component-inventory.md` (your component-by-component implementation guide), `docs/design/decisions.md`, and CLAUDE.md §9 + §10 for the worked patterns.
>
> Build the components in the order listed in `03-component-inventory.md` §"Implementation order (suggested)". For each component:
>
> 1. State which inventory row you're building.
> 2. Show me the Handlebars template + the CSS additions + the sheet-class wiring.
> 3. Pause. I'll say "next" or "stop, this needs adjustment."
>
> Critical patterns:
> - Sheet roots get `.gs-actor` / `.gs-connection` / `.gs-npc` class + `data-theme` attribute via the `_onRender` hook (see briefing for the snippet).
> - Item sheets and Family/NPC sheets stay house-styled — no `.gs-actor` class.
> - Honor the eight antique-but-clean rules. If a layout violates one, flag it and ask before proceeding.
>
> No automation logic, no chat cards, no custom apps. Visual fidelity to the design system is the bar.

## Mid-session prompts you'll likely use

- `next` — proceed to next inventory row
- `show me the current state of styles/_house.css`
- `show me the current state of templates/actors/major-character/`
- `pause, I need to compare against widget good_society_major_character_sheet_headers_locked` (the sketched headers visual)
- `summarize what's been built so far in Session B-1`
- `we're drifting from the antique-but-clean principle, restate it and try again`

## End-of-session verification

1. Restart Foundry world. Console (F12) → no red errors.
2. Open one of each: Major Character, Connection, Family, NPC. Each renders its full layout with default values populated. No visual breakage, no missing CSS.
3. Major Character sheet — set `theme` to each of `rose`, `clayton`, `dixon` (via the test world or console: `actor.update({ "system.theme": "dixon" })`). Sheet visibly re-themes between switches. **The remaining themes won't work yet** because Session B-2 hasn't built them — that's expected.
4. Open one of each item type. Each renders cleanly using house style only.
5. Visibility flag indicators appear on every sensitive field on the Major Private tab.
6. Inner Conflict box grid renders with 5+5 boxes; clicking checkboxes toggles state visually (logic is fine if it's persisted via `actor.update`).
7. Resolve token track, MT toggle, monologue dot all render on the Major Tokens & Cycle tab. Click handlers update visual state.
8. **No regression** on Session A's verification: `game.actors.contents[0].system` still shows the schema fields with proper values; no `undefined` introduced by template work.

If anything fails, stop and fix before Session B-2. Theme presets are easy to add once the templates are stable; the reverse is much harder.

## Update CLAUDE.md §13 after the session

```markdown
**Currently in:** Phase 1d — Theme presets (next: Session B-2)

**Done:**
- Phase 0: fork, rename, verify load
- Session A: all 10 DataModels defined and registered
- Session A.5: theme field backfilled
- Session B-0: CSS architecture
- Session B-1: sheet templates
  - Component primitives: buttons, inputs, checkboxes, hairlines, cards, section headers
  - Token primitives: resolve track, MT toggle, monologue dot
  - Reputation primitives: tag pills, visual meter, visibility flag indicators
  - Inner Conflict box grid
  - Major Character full sheet (Public, Private, Tokens & Cycle tabs)
  - Connection sheet
  - Family sheet (house style)
  - NPC sheet (house style)
  - All five item sheets
  - Persona switcher in Major bio header

**Next:**
- Session B-2 — remaining eleven theme presets (rose, roger, mags, avril, dixon, all five connections, npc-as-empty)
- Phase 2 onward — token economy logic, cycle phase mechanics, etc. (per PLAN.md §13)
```

Commit and push. Session B-2 follows immediately — it's parallel-safe and mostly mechanical CSS files.
