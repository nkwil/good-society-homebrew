# Design Integration Patch

This patch integrates the locked design-track decisions (`docs/design/01-mood-exploration.md` through `decisions.md`) into the system planning files (`PLAN.md`, `CLAUDE.md`) and the DataModels just shipped in Session A.

Apply via Claude Code with this prompt:

> Read `docs/design/decisions.md`, `docs/design/02-theme-architecture.md`, and `docs/design/03-component-inventory.md`. Then apply the patches in `design-integration-patch.md` to `PLAN.md` and `CLAUDE.md`. Show me a diff for each file before saving.

The DataModel changes ship as **Session A.5** (separate briefing). Don't apply them in the same Claude Code call as the doc patches — DataModel changes need a verify-in-Foundry step.

---

## Why this patch exists

Parallel design work in `docs/design/` has locked:

1. A top-level **design principle** — "Antique but clean and legible" with eight implementation rules
2. A **two-layer theming model** — house style (chrome, items, Family, NPC) + character themes (Major sheets, Connection sheets, in-character chat, letters, character entries on shared boards)
3. The **house style** — Inkwell & Wildflower, with full palette and type tokens
4. A **twelve-theme registry** — six Major themes (`rose`, `roger`, `mags`, `avril`, `dixon`, `clayton`), five Connection variants (`connection-green`, `connection-purple`, `connection-blue`, `connection-yellow`, `connection-grey`), one NPC theme (`npc`)
5. A **portable theme-wrapper pattern** — `.gs-themed[data-theme="..."]` for content that travels (chat, letter cards, themed board entries)
6. A **component inventory** — 59 components with theme scope assigned

These overlap with the system docs in two places:
- The Major data model had `chatStyle: { color, font }` stored directly. The decisions doc says these are **derived from the active theme** at render time.
- The Persona embedded model has `chatColor` — kept, but its meaning is now "override of the character theme's `--gs-brand` for this persona's chat cards."

The PLAN.md and CLAUDE.md need to reflect both — and be clear that `docs/design/decisions.md` is the source of truth for visual decisions going forward.

---

## Patch 1 — `PLAN.md`

### 1.1 Add a cross-reference at the top of §15 (Locked-in design decisions)

**After** the section heading and intro paragraph, **insert**:

```markdown
> **Visual design decisions** — top-level design principle, theming architecture, house style palette/type, and the twelve-theme registry — live in the parallel design track at `docs/design/decisions.md`. Treat that file as the authoritative record for visual choices; the items below cover system-architecture decisions only. Cross-references are noted where they intersect.
```

### 1.2 Add a new locked decision to §15

**Append** to the numbered list in §15:

```markdown
9. **Visual design follows the antique-but-clean principle and a two-layer theming model.** House style (Inkwell & Wildflower) owns chrome, item sheets, Family, NPC, system-emitted chat, and the Cycle HUD. Character themes own Major/Connection sheet bodies, in-character chat, letters, monologues, and character-themed entries on shared boards. Twelve theme presets are locked (six Major, five Connection, one NPC). Source of truth: `docs/design/decisions.md` and `docs/design/02-theme-architecture.md`.
10. **Per-character chat styling is derived from the active theme**, not stored on the actor. The Major actor schema carries a `theme` enum field; chat cards resolve the theme's `--gs-brand` (color) and `--gs-body` (font) at render time. Personas may override the brand color via their existing `chatColor` field.
```

### 1.3 Update §12.1 (Multi-character ergonomics) — Persona-aware chat & per-character chat styling

**Find** the "Per-character chat styling" sub-bullet and **replace** with:

```markdown
**Per-character chat styling.** Chat cards from a character render inside a `.gs-themed[data-theme="<theme-id>"]` wrapper, which locally rebinds the palette to that character's theme. The card's text color comes from the theme's `--gs-brand`; body type from `--gs-body`. Persona overrides apply via Persona.chatColor (overrides only the brand, not the type). System-emitted chat (token spends, phase changes) skips the wrapper and uses house style. See `docs/design/02-theme-architecture.md` for the wrapper mechanism.
```

### 1.4 Update §12.5 (GM tools) — Epistolary letter formatter

**Find** the "Epistolary letter formatter" bullet and **replace** the body with:

```markdown
**Epistolary letter formatter.** During Epistolary phase, GMs and players get a "Send Letter" button that opens a composer (sender persona, recipient persona, subject, body, optional handwriting style). The composer chrome uses house style; the preview pane and the posted card use the *sender's* full character theme via the `.gs-themed[data-theme="..."]` wrapper. This is the canonical proof-point for portable theming — any sender's letter renders correctly with the same template. Optionally archives the letter to a journal folder dated by cycle.
```

### 1.5 Update §6 (Sheet UI strategy) — visual styling paragraph

**Find** the §6.3 (Visual styling) paragraph and **replace** with:

```markdown
### 6.3 Visual styling

Visual styling follows the locked design system. The house style (Inkwell & Wildflower) governs chrome, item sheets, the Family and NPC sheets, the Cycle HUD, the Public Info dashboard frame, and all GM tools. Major Character and Connection sheet bodies adopt the actor's character theme via a `.gs-actor[data-theme="..."]` selector on the sheet root, which rebinds CSS custom properties. The full palette and type tokens are in `docs/design/decisions.md`; the scope-boundary table is in `docs/design/02-theme-architecture.md`.

The eight implementation rules of the antique-but-clean principle (in `decisions.md`) constrain everything: hairlines not heavy borders; generous whitespace; period type at modern sizes; one ornament per surface; WCAG AA on all body text; no distressed textures; letterpress-style precision; sentence case for prose, small caps for labels.
```

### 1.6 Add new section §6.4 (after Visual styling)

**Insert** after §6.3:

```markdown
### 6.4 Reference: design system

A full design-system documentation tree lives in `docs/design/`:

- `README.md` — folder orientation
- `01-mood-exploration.md` — mood directions explored, decision rationale (Closed)
- `02-theme-architecture.md` — two-layer model, scope boundaries, wrapper mechanism (Locked)
- `03-component-inventory.md` — 59 components mapped to theme scope and design status
- `decisions.md` — authoritative locked palette, type tokens, twelve-theme registry, antique-but-clean principle

When implementing visual surfaces, link the relevant design doc in your Claude Code prompt rather than describing the design inline. This keeps the implementation grounded in the locked decisions and prevents drift.
```

### 1.7 Revise build phases §13 — split Phase 1 into 1a / 1b / 1c

**Find** Phase 1 in §13 and **replace** with:

```markdown
**Phase 1 — Major Character sheet, fillable** (split into three sub-sessions; 5–7 days total)

Phase 1a — DataModel batch (Session A) — 1–2 days. ✓ Done.

Phase 1.5 — Theme field backfill (Session A.5) — 30 min. Add `theme` enum to Major/Connection/NPC; remove `chatStyle` storage from Major; verify in Foundry that defaults populate correctly.

Phase 1b — CSS architecture (Session B-0) — 1–2 days. House CSS variables, font loading via `@fontsource`, one card primitive in house style, the `.gs-themed[data-theme="..."]` wrapper mechanism, and one character preset (`clayton`) implemented as full overrides to validate the pipeline. No sheet templates yet.

Phase 1c — Sheet templates batch (Session B-1) — 2–3 days. Build all Handlebars templates (Major, Connection, Family, NPC, item types) consuming the theme tokens and house variables. In-sheet rule tooltips wired. Per-component implementation order follows `docs/design/03-component-inventory.md` §"Implementation order (suggested)".

Phase 1d — Remaining theme presets — 1 day. The other eleven presets implemented. Each is a CSS file with overrides under `.gs-actor[data-theme="..."]`. The `clayton` work in Phase 1b is the template.
```

---

## Patch 2 — `CLAUDE.md`

### 2.1 Update DataModel sketches in §6

**§6.1 Major Character** — find the schema block and:

- **Remove** the `chatStyle: { color, font }` block (it's derived now, not stored)
- **Add** a new field after `bio.portraitUrl`:

```
theme: enum                          // see docs/design/decisions.md theme registry
  ["rose", "roger", "mags", "avril", "dixon", "clayton"]
```

**§6.2 Connection** — find the schema block and **add** after `sceneInfo`:

```
theme: enum                          // five connection variants
  ["connection-green", "connection-purple", "connection-blue", "connection-yellow", "connection-grey"]
```

**§6.4 NPC** — find the schema block and **add** after `sceneInfo`:

```
theme: enum                          // currently single option; locked-in NPC inherits house
  ["npc"]
```

**§6.5 Persona** — leave structure intact, but **update the comment** on `chatColor`:

```
chatColor: string                    // overrides character theme's --gs-brand for this persona's chat cards (hex)
```

### 2.2 Update worked example §10 (Major Character)

In the `MajorCharacterDataModel.defineSchema()` block:

- **Remove** the `chatStyle` SchemaField block.
- **Add** a `theme` field after `bio`:

```js
theme: new StringField({
  required: true,
  choices: ["rose", "roger", "mags", "avril", "dixon", "clayton"],
  initial: "clayton",
}),
```

The `clayton` default is intentional — it's the closest preset to house style and the safest default for a new character.

### 2.3 Add new top-level section §16 — Theming

**Insert** as a new section, between current §11 (Patterns) and §12 (Reference systems):

```markdown
## 12. Theming

Visual styling for this system follows the locked design system in `docs/design/`. Key facts Claude Code needs at all times:

### 12.1 Top-level principle

**Antique but clean and legible.** Period type, parchment palette, restrained ornament — but at modern accessibility standards. Eight implementation rules in `docs/design/decisions.md` §"Design principle":

1. Generous whitespace (18–24px padding inside cards)
2. Hairlines (0.5px), not heavy borders
3. Period typography at modern sizes (20px+ display, 14px+ body)
4. One decorative flourish per surface
5. WCAG AA on all body text (4.5:1 minimum)
6. No worn/distressed textures
7. Letterpress-style precision (no shadows, no blur)
8. Sentence case for prose, small caps for labels

### 12.2 Two-layer theming model

- **House style** — Inkwell & Wildflower. Owns: chrome, item sheets, Family sheets, NPC sheets, system-emitted chat, Cycle HUD, Public Info dashboard frame, GM tools.
- **Character themes** — twelve presets, applied per-actor. Owns: Major and Connection sheet bodies, in-character chat, letters, monologues, persona-bound surfaces, character-themed entries on shared boards.

Full scope-boundary table in `docs/design/02-theme-architecture.md` §"Scope boundaries". Component-by-component assignments in `docs/design/03-component-inventory.md`.

### 12.3 House palette and type (locked)

CSS variables (full SCSS in `docs/design/decisions.md`):

```css
:root {
  --gs-paper:        #EFE6D2;
  --gs-paper-warm:   #F4ECD8;
  --gs-ink:          #3D2F26;
  --gs-brand:        #2A3A2D;
  --gs-accent-1:     #B85C3F;
  --gs-accent-2:     #708060;
  --gs-accent-3:     #C9A55C;
  --gs-muted:        rgba(112, 128, 96, 0.3);
  --gs-danger:       #8B2A2A;
  --gs-positive:     #4A7A4A;
  --gs-display:      'Lora', 'Palatino', 'Book Antiqua', Georgia, serif;
  --gs-body:         'Crimson Text', 'Palatino', Georgia, serif;
  --gs-italic:       'Crimson Text Italic', 'Palatino Italic', Georgia, serif;
  --gs-ui:           system-ui, 'Helvetica Neue', sans-serif;
}
```

### 12.4 Theme registry (locked)

Six Major themes, five Connection variants, one NPC theme. Each is a CSS file under `styles/themes/_theme-{id}.css` defining a `.gs-actor[data-theme="{id}"]` selector. Full per-theme overrides in `docs/design/decisions.md` §"Theme registry".

| ID | Layer | Notes |
|---|---|---|
| `rose` | Major | Soft pink. Cormorant Garamond + EB Garamond. |
| `roger` | Major | Mirror of rose, blue. Twin link via shared accent-3. |
| `mags` | Major | Dark, lethal. DM Serif Display + Crimson. |
| `avril` | Major | Candlelight & crimson. Didot + Crimson. |
| `dixon` | Major | Heraldic red & gold. Cinzel (names only) + Crimson. |
| `clayton` | Major | Green simple. Shares type with house — palette differs. Default for new Majors. |
| `connection-green` | Connection | Type matches house. |
| `connection-purple` | Connection | Type matches house. |
| `connection-blue` | Connection | Type matches house. |
| `connection-yellow` | Connection | Type matches house. |
| `connection-grey` | Connection | Type matches house. |
| `npc` | NPC | Inherits house. No overrides. |

### 12.5 Portable theme wrapper

For surfaces that aren't bound to a single actor (chat messages, letter cards, themed board entries), wrap rendered content in `.gs-themed[data-theme="<theme-id>"]`. CSS variables resolve inside that wrapper. The same primitive renders correctly for any sender.

```html
<div class="gs-themed" data-theme="dixon">
  <!-- letter content -->
</div>
```

### 12.6 Font loading

System loads font files for all registered themes at init time using `@fontsource` packages bundled with the system. Fallback stacks ensure missing fonts degrade gracefully. Declared in `system.json`'s `styles` array; loaded by base SCSS `@import` directives.

### 12.7 When adding themed content (recipe)

1. Determine scope from the table in `docs/design/02-theme-architecture.md` and `03-component-inventory.md`. If unsure, ask before coding.
2. If house-styled: use the root CSS variables directly.
3. If character-themed and the surface is bound to a sheet (e.g. Major sheet body): the sheet's root carries `.gs-actor[data-theme="..."]`; descendants inherit automatically.
4. If character-themed and the content travels (chat, letter, board entry): wrap the rendered content in `.gs-themed[data-theme="<theme-id>"]`.
5. Read the theme id from the actor: `actor.system.theme`. For personas, also resolve `persona.chatColor` and apply it as an inline style override on the chat-card brand.
6. Honor the eight antique-but-clean rules. If a layout decision violates them, flag it and ask.
```

(Renumber subsequent sections accordingly: old §12 References → §13, §13 Build phase status → §14, etc.)

### 2.4 Update §13 (Build phase status) — current phase tracker

**Replace** the "Currently in" / "Done" / "Next" block with:

```markdown
**Currently in:** Phase 1.5 — Theme field backfill (next: Session A.5)

**Done:**
- Phase 0: fork, rename, verify load
- Session A: all 10 DataModels defined and registered

**Next:**
- Session A.5 — backfill `theme` field on Major/Connection/NPC; remove `chatStyle` storage from Major
- Session B-0 — CSS architecture (variables, fonts, card primitive, `.gs-themed` wrapper, one preset)
- Session B-1 — sheet templates batch
- Session B-2 — remaining eleven theme presets
```

### 2.5 Add to §15 anti-patterns

**Append** to the bullet list:

```markdown
- ❌ Don't store `chatStyle.color` or `chatStyle.font` on the actor. They're derived from `actor.system.theme` at render time. Hard-coding them anywhere except the theme CSS files defeats the registry.
- ❌ Don't add new theme presets without an entry in `docs/design/decisions.md` §"Theme registry". Visual decisions live in the design track; code follows the registry, not the other way around.
- ❌ Don't put `:root` overrides inside a sheet's stylesheet. They leak globally. Scope to `.gs-actor[data-theme="..."]` or `.gs-themed[data-theme="..."]`.
```

---

## Patch 3 — Out-of-band notes

These don't belong in PLAN or CLAUDE — they're notes for Natalie:

1. **Cashmere is dropped from the registry.** Earlier session notes referenced it; the locked twelve-theme registry uses `clayton` as the simplest "validate the pipeline" preset. Use `clayton` anywhere prior docs said `cashmere`.
2. **Inkwell-character variant** — Open Question 1 in `02-theme-architecture.md` is **resolved as not needed**. The six bespoke Major themes cover it.
3. **Pearlinda preset** — Open Question 2 is **deferred** to whenever Pearlinda re-enters play. Working name `pearlinda` or `confetti`. Don't build until needed.
4. **Theme transitions** — Open Question 3 is **resolved**: 0.5px accent border at the `.gs-themed` boundary. Specifics lock during chat-card and letter-card component design.
5. **Accessibility audit** — Open Question 4 is **deferred to first component implementation pass**. Highest risk: `mags` and `avril` (dark paper). Audit with WebAIM Contrast Checker against body-text-on-paper combinations during Phase 1c. Per-user "high-contrast mode" toggle is the escape hatch if any combo fails irreparably.

---

## How to apply this patch

1. Drop this file at the repo root.
2. Open Claude Code in the repo.
3. Run the prompt at the top of this file.
4. Review the diffs Claude Code presents for `PLAN.md` and `CLAUDE.md`. Commit if they match.
5. Once those are committed, proceed to **Session A.5** (separate briefing) for the DataModel changes.
