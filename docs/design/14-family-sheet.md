# 14 — Family Sheet

**Status:** Locked — single-page layout specified; crest medallion specified; cross-theme member rendering specified
**Date opened:** 2026-05-05
**Covers inventory entry:** #7 Family sheet

## Goal

Specify the Family actor sheet (CLAUDE.md §6.3). Families are shared structural entities — multiple Majors share one Family actor, referenced by `familyId`. House Willowood is shared between the Marquess, Lady Rose, and Roger; House Cloudcandle is shared between Dixon and his cousins. The Family holds the unique negative reputation criteria, motto, crest, and GM-only history that propagates onto every member's sheet.

This is the heraldic centerpiece of the system — the only place where the actual coat of arms, motto, and lineage live as first-class data. The sheet has to feel like a manor library record, not a spreadsheet row.

## Why house-styled

Family sheets are explicitly **house-styled**, not character-themed. Reason: a Family is shared by multiple Majors who each have their own theme. House Willowood's sheet can't be styled as Rose's pink-and-gold without colliding with Roger's blue-and-gold or with the Marquess's hypothetical theme. There's no "family theme" that doesn't disenfranchise some members.

The house style instead lets the Family sheet feel like an *institutional document* — the manor's official register, neutral in voice, where each member is referenced through their own theme color via cross-theme rendering (same pattern as Connection sheet's linked-Major reference and Public Info Dashboard rows).

The heraldic feel — gold ring on the crest, motto in italic display type, period typography — comes from the Inkwell house style being deployed at its most ceremonial register.

## Structural recommendation — single page, no tabs

The Family schema is small (about 8 fields). A single-page layout fits comfortably; tabs would over-engineer the surface.

### PARTS composition

```js
static PARTS = {
  header:       { template: "systems/good-society-homebrew/templates/actors/family/header.hbs" },
  crest:        { template: "systems/good-society-homebrew/templates/actors/family/crest.hbs" },
  origin:       { template: "systems/good-society-homebrew/templates/actors/family/origin.hbs" },
  reputation:   { template: "systems/good-society-homebrew/templates/actors/family/reputation.hbs" },
  notes:        { template: "systems/good-society-homebrew/templates/actors/family/notes.hbs" },
  members:      { template: "systems/good-society-homebrew/templates/actors/family/members.hbs" },
};
```

## Sheet dimensions

```js
position: { width: 580, height: "auto" }
```

580px gives the crest medallion room to breathe alongside the motto without crowding. Height auto.

## Top-level layout

```
┌─────────────────────────────────────────────┐
│  HEADER                                       │
│  FAMILY · House Willowood    est. 1612 · 3    │
├─────────────────────────────────────────────┤
│  CREST + MOTTO                                │
│  [crest medallion]   "Probity. Patience..."  │
├─────────────────────────────────────────────┤
│  ORIGIN  ·  HEIR STATUS                       │
│  ● heir   |  ● named — a daughter             │
├─────────────────────────────────────────────┤
│  UNIQUE NEGATIVE REPUTATION CRITERIA  [public]│
│  [italic prose, paper-warm card with gold accent]
├─────────────────────────────────────────────┤
│  GM · NOTES                          [secret] │
│  [italic GM prose]                            │
├─────────────────────────────────────────────┤
│  MEMBER MAJORS · 3                            │
│  [member rows with cross-theme accents]       │
└─────────────────────────────────────────────┘
```

## Header spec

CSS class root: `.gs-family-sheet__header`

- Background: `var(--gs-paper)`.
- Padding: 18px 26px.
- 0.5px bottom border in `var(--gs-accent-2)`.
- Two-span row, justified:
  - Left stack:
    - "FAMILY" eyebrow in 11px small caps, letter-spacing 0.18em, color `var(--gs-accent-2)`.
    - Family name as the prominent display: 26px Lora, color `var(--gs-brand)` (forest green).
  - Right: italic 11px metadata. Format: "est. {year} · {N} members". The year is optional flavor; if not set, omit the "est. {year} · " prefix.

The family name reads as the protagonist of the sheet. No portrait — families don't have faces; they have crests.

## Crest block

CSS class root: `.gs-family-sheet__crest`

The visual centerpiece. Two-column layout with the crest medallion on the left and the motto on the right.

### Layout

```
┌───────────┬────────────────────────────────┐
│  ╭─────╮  │ HOUSE MOTTO                     │
│  │  W  │  │ "Probity. Patience. Honour."   │
│  ╰─────╯  │                                  │
│           │ Engraved over the gate of...    │
│ WILLOWOOD │                                  │
└───────────┴────────────────────────────────┘
```

- Padding: 22px 26px.
- 0.5px bottom border in `var(--gs-accent-1)` (sage→light, internal section divider).
- Grid: `grid-template-columns: 130px 1fr; gap: 24px; align-items: center`.

### Crest medallion (left column)

Stacked vertically:

- **Medallion**: a 92×110px oval with two layers — outer ring in `var(--gs-accent-3)` (heraldic honey-gold), inner field in `var(--gs-brand)` (forest green). Inside the inner field, the family monogram (first letter of the family name) in display type 38px, color `var(--gs-accent-3)`. Letter-spacing 0.04em for visual weight.
- **Engraving label**: below the medallion, family name in 10px small caps, letter-spacing 0.2em, centered.

If `crest.imageUrl` is set, the medallion shows that image instead of the monogram fallback. The image fits within the inner field with a small honey-gold ring overlay. If unset, the monogram renders.

### Motto (right column)

- "HOUSE MOTTO" eyebrow in 10px small caps.
- Motto text in italic display type, 22px, line-height 1.3, color `var(--gs-brand)`.
- Optional flavor subtext below in italic 12px, color `var(--gs-accent-1)` (terracotta — the warmer accent), line-height 1.55. Used for "Engraved over the gate of the manor house. Read aloud at every formal toast." kind of context.

The motto is the canonical declaration of the family. It's pulled into chat cards and the family panel on member Majors' sheets — being the central display here keeps the source of truth obvious.

### Why the medallion is heraldic, not realistic

A real coat of arms would require commissioned art per family. The monogram-in-medallion approach is:
- **Always available** — no asset pipeline needed.
- **Stylistically consistent** — every family has the same visual treatment.
- **Upgradeable** — set `crest.imageUrl` later to swap in real art when the GM has it.

The honey-gold ring + forest-green field + serif monogram reads unambiguously as "heraldic" to the eye, even without a true crest. This is the antique-but-clean principle applied at maximum: a single ornamental gesture (the medallion) carries the heraldic feel without requiring per-family art.

## Origin and Heir Status row

CSS class root: `.gs-family-sheet__status`

A compact row showing two pieces of family-level state side by side.

### Layout

```
┌────────────────────────────────────────────┐
│ ORIGIN                  HEIR STATUS         │
│ ● heir         │        ● named — a daughter │
│                              unprecedented...│
└────────────────────────────────────────────┘
```

- Padding: 18px 26px.
- 0.5px bottom border.
- Display: `flex; gap: 24px; align-items: center`.
- A 1px × 30px vertical divider (`var(--gs-accent-1)`) between the two columns.

### Origin

- Label: small caps 10px, "ORIGIN".
- Value: small dot indicator + label.
  - Dot color encodes the origin (per CLAUDE.md §6.3 enum):
    - `heir`: terracotta `var(--gs-accent-1)` — the locally-rooted nobility.
    - `new-arrival`: honey `var(--gs-accent-3)` — newly-titled or recently moved.
    - `foreign`: cold steel (a hardcoded gray-blue, since "foreign" suggests a separate visual register) — outsider lineage.
  - Label: display type 14px, color `var(--gs-ink)`, plain text spelling out the value.

### Heir Status

- Label: small caps 10px, "HEIR STATUS".
- Value: dot + label + optional flavor.
  - Dot color: `var(--gs-positive)` (verdant) if an heir is named, `var(--gs-danger)` (oxblood) if heirless / disputed.
  - Label: "named — a daughter" or "named — a son" or "named — a foster" or "no heir" depending on house state.
  - Optional flavor: italic 11px to the right, e.g. "unprecedented in 200 years" — for the Willowood naming-a-daughter case specifically.

The flavor field is sourced from a small free-text field on the Family schema (suggested addition: `heirStatusFlavor: string`, optional). If not set, omit. Worth proposing in the schema review.

## Reputation Criteria block

CSS class root: `.gs-family-sheet__reputation`

The most consequential field on the sheet — what's written here propagates onto every member Major's Public tab as a read-only Reputation Criteria card.

### Layout

```
┌─────────────────────────────────────────────┐
│ UNIQUE NEGATIVE REPUTATION CRITERIA  [public]│
│                                                │
│ ┌─────────────────────────────────────────┐  │
│ │ A daughter of Willowood is judged by    │  │
│ │ her constancy of affection and her      │  │
│ │ composure under scrutiny...              │  │
│ └─────────────────────────────────────────┘  │
│                                                │
│ — shown read-only on every member Major's tab │
└─────────────────────────────────────────────┘
```

- Padding: 18px 26px.
- 0.5px bottom border.

### Content

- Header row, justified:
  - Left: "UNIQUE NEGATIVE REPUTATION CRITERIA" eyebrow in 10px small caps, letter-spacing 0.16em.
  - Right: visibility flag pill (per inventory #48 and `04-character-sheet.md` Private tab pattern). Three-state: secret / public / redacted. Click to cycle, with confirm before flipping to public from secret.
- Body card: HTML editor with soft-paper bg (`var(--gs-paper-warm)`), 0.5px 2.5px-thick honey-gold left-edge accent (`var(--gs-accent-3)`), italic body type 13px, line-height 1.6.
- Footer note: italic 11px in `var(--gs-accent-2)`, "— shown read-only on every member Major's tab". Reminds the GM that this field has reach.

### Why the visibility flag matters here

If the criteria is `secret`, member Majors see their family panel without the criteria visible (it's hidden). If `redacted`, member Majors see a redaction bar where the criteria would be. If `public`, they see the text.

This lets a GM author family criteria privately and reveal them at a dramatic moment — the criteria is what defines the family's vulnerability, so its reveal can itself be a story beat.

## GM Notes block

CSS class root: `.gs-family-sheet__notes`

GM-only field for family history, internal politics, secrets the players don't know.

### Layout

```
┌─────────────────────────────────────────────┐
│ [GM] NOTES · history                 [secret]│
│                                                │
│ The Marquess named Rose as heir over Roger  │
│ after the latter was discovered with three  │
│ duelling debts...                             │
└─────────────────────────────────────────────┘
```

- Padding: 18px 26px.
- 0.5px bottom border.

### Content

- Header row, justified:
  - Left cluster: small "GM" pill in `var(--gs-accent-1)` (terracotta) bg with paper text + "NOTES · history" eyebrow in 10px small caps.
  - Right: visibility flag pill.
- Body: HTML editor, italic body type 13px, line-height 1.6, opacity 0.85 (a subtle visual cue that this is "behind the scenes" rather than published lore).

The GM pill in the header makes it obvious at a glance who can edit this. Even if a player somehow gets the family sheet open (typically via Foundry permission edge cases), the GM badge visually flags the field as out-of-bounds.

## Member Majors block

CSS class root: `.gs-family-sheet__members`

The list of Majors that belong to this family. Each row uses cross-theme rendering — the row is house-styled but each member's accent stripe + name + theme code uses *their* character theme.

### Layout

```
┌─────────────────────────────────────────────┐
│ MEMBER MAJORS · 3              click any... │
│                                                │
│ ┌─[M]─ The Marquess of Willowood ─ no theme │
│ ┌─[R]─ Lady Rose Willowood ─── theme · rose │
│ ┌─[R]─ Roger Willowood ──────── theme · roger│
└─────────────────────────────────────────────┘
```

- Padding: 18px 26px.
- No bottom border — this is the last block.

### Content

- Header row, justified:
  - Left: "MEMBER MAJORS · {N}" eyebrow.
  - Right: italic helper text "click any to open".
- Member rows below.

### Member row

Each row is wrapped in `.gs-themed[data-theme="{member-theme}"]` so the accents pull from that Major's theme.

- Layout: `display: grid; grid-template-columns: 36px 1fr auto; gap: 12px; padding: 8px 14px; background: var(--gs-paper-warm); border-radius: 6px; cursor: pointer;`
- 2.5px left-edge accent stripe in the member's `var(--gs-brand)`.
- Portrait: 32×38px oval, themed paper bg, member's brand-colored border, initial in their display type.
- Name + role stack:
  - Top: member name in their display type, 14–16px (some display fonts run small), color `var(--gs-brand)`.
  - Bottom: italic body type 11px, role/title (e.g. "The Heir · named", "The Hedonist · twin", "patriarch · primary").
- Right: italic 11px, theme code "theme · {theme-id}" or "no theme assigned" if the member hasn't picked a theme.

Click a row → opens that Major's sheet.

### Adding members

Members are added via the Major sheet (each Major has a `familyId` field). When a Major's `familyId` is set to this Family, the member appears here automatically. There's no "add member" action on the Family sheet itself — that would be the wrong direction of authorship.

The Family sheet does have a small "[+ link a Major]" affordance in the header for the case where a GM wants to bulk-link members (opens an actor picker scoped to Majors not currently linked elsewhere).

## Theme behavior

The Family sheet itself uses **house style throughout**. Variables resolve to Inkwell defaults; no `.gs-themed` wrapper at the sheet root.

The member rows in the Member Majors block use **cross-theme rendering**: each row is independently wrapped in `.gs-themed[data-theme="{member-theme}"]` so the accents pull from each member's theme palette while the row's own structural CSS (padding, gap, background) uses house values.

This is the same pattern used in:
- Connection sheet's impressions list (per `06-connection-sheet.md`).
- Public Info Dashboard rows (per `07-public-info-dashboard.md`).
- My Characters Dock rows (per `09-my-characters-dock.md`).

The Family sheet is the third high-leverage proof of the cross-theme pattern. By the time it's implemented, the wrapper mechanism is well-validated.

## Edge cases

### No members yet
Show the section header and an empty-state placeholder card: italic "No Major characters linked to this family yet. Set their familyId field to begin." in muted text. Don't hide the section.

### Member without a theme
Render the row with `data-theme="npc"` (which inherits house). The row visually merges into the house chrome — appropriate for an unfinished character. Right-side label reads "no theme assigned" in muted italic.

### Crest image is set but fails to load
Foundry handles broken-image fallback; show the monogram. Log a warning to the console for the GM to find.

### Family with one member
Single member row. The "{N} members" count in the header reads "1 member" (singular). No special layout.

### Family with many members (8+)
Member rows wrap or scroll. **Tentative answer: no internal scroll**, just let the sheet grow vertically. Families with that many Majors are rare; if it becomes common, add scroll later.

### Heir status flavor field unset
The italic flavor text is omitted; the dot + label still render normally.

### Reputation criteria visibility = redacted (member view)
On member Majors' Public tabs (per `04-character-sheet.md`), the criteria card shows a redaction bar instead of the text. The Family sheet itself shows the text to whoever can edit (typically GM); the member-side mirroring respects the visibility flag.

## Implementation notes for Claude Code

When prompted to build this sheet, the recommended order:

1. Build the header + crest block. The crest medallion is the most distinctive component — get it visually right before moving on. Use the monogram fallback initially.
2. Build the origin/heir status row. Validate the dot-and-label pattern (it'll likely be reused on the NPC sheet later).
3. Build the reputation criteria block. Verify the field propagates to a member Major's Public tab (cross-actor data flow — touch the Family sheet, see the change on Rose's sheet).
4. Build the GM notes block. Verify the GM pill renders only for GM users.
5. Build the member rows with cross-theme rendering. Test with at least two members of distinct themes (Rose + Roger ideal).

CSS organization:
- `styles/sheets/_family.css` — sheet-level layout
- `styles/components/_crest-medallion.css` — the heraldic medallion (potentially reusable for emblems elsewhere)
- Reuse: `_visibility-flag.css`, `_themed-row.css` (the Member Majors row pattern)

### Test path

1. Open House Willowood's Family sheet. Verify the header, crest, motto, origin/status row.
2. Type into the unique negative reputation criteria field. Save.
3. Open Lady Rose's Major sheet → Public tab. Verify the criteria field is visible (read-only) with the same text.
4. Toggle the criteria visibility from public → secret. Verify Rose's tab now hides the section.
5. Add a third member by setting Roger's `familyId` to House Willowood. Reload the family sheet. Verify Roger's row appears with his blue theme accent.
6. Verify the Marquess's row (assuming he's a Major linked to the family but with no theme assigned) renders in muted house style with "no theme assigned" label.
7. Click any member row. Verify their Major sheet opens.

If 1–7 pass, the Family sheet is production-ready and the read-only mirroring pipeline is validated.

## Open questions

1. **Should the family motto support italics or rich text formatting?** A two-clause motto might want a stylistic break. **Tentative answer: italic display type by default; no rich text editing.** Mottos are short and benefit from a uniform treatment.

2. **Should the crest medallion be customizable beyond `imageUrl`?** Color choices for the ring or field, alternate shapes (shield, banner)? **Tentative answer: no for v1.** Single canonical treatment keeps the visual consistent across families. If a GM really wants a custom crest, they upload an image to `imageUrl`.

3. **Should heir status track non-binary positions (regent, contested, vacant)?** The schema currently has `heirStatus: boolean`. **Tentative answer: expand to enum** in the schema review: `named-son | named-daughter | named-foster | vacant | contested`. The visual treatment described above already accommodates the enum; the schema change is the only blocker.

4. **Should the "established year" be a real schema field?** Currently described as "optional flavor" in the header metadata. **Tentative answer: yes, add `establishedYear: number` to the schema.** Small addition with meaningful display value.

5. **Should families have crests visible in chat cards?** When a chat card mentions a family ("House Willowood declared..."), should it carry a small crest thumbnail? **Tentative answer: defer to v1.1.** The cross-theme reference pattern works without crests; adding family crests to chat would expand the wrapper mechanism beyond character themes (which is the architecture's foundation).

6. **Should the Family sheet allow editing each member's `familyId` directly from this sheet?** A "remove from family" action on a member row, for instance. **Tentative answer: no.** Edit `familyId` from the Major sheet. The Family sheet shows the consequence; the Major sheet authors the relationship. One-way data flow keeps mental model clean.

7. **Should there be a Family-level "Public Info" view in the Public Info Dashboard?** Listing all houses with their members and reputations. **Tentative answer: defer to v1.1.** The dashboard is currently per-Major; per-Family aggregation is a different design problem and would expand scope significantly.

## Visual proof

The Family sheet for House Willowood is rendered above (`good_society_family_sheet_house_willowood`). It validates: header with eyebrow + family name + member count, crest medallion paired with motto and flavor subtext, origin and heir status row with the unprecedented-daughter flavor field, reputation criteria block with public visibility flag, GM notes block with GM pill and secret visibility flag, three member rows each with cross-theme accent stripes (Marquess unthemed/muted, Rose pink, Roger blue).

Confirms the heraldic feel reads correctly within Inkwell house style — gold ring, forest-green field, period typography, restrained ornament.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Single-page layout specified. Crest medallion (with monogram fallback when no image URL is set) specified. Cross-theme member rendering pattern reused from Connection sheet, Dashboard, and Dock. Visual proof rendered for House Willowood with three members of distinct themes. |
