# 12 — Item Sheets

**Status:** Locked — common conventions plus five item sheet specs (Reputation Tag, Reputation Condition, Inner Conflict, Magic/Skill, Backstory Action). Inner Conflict box grid primitive folded into the sheet spec.
**Date opened:** 2026-05-05
**Covers inventory entries:** #9 Reputation Tag, #10 Reputation Condition, #11 Inner Conflict, #12 Magic/Skill, #13 Backstory Action, #39 Inner Conflict box grid (primitive)

## Goal

Specify all five item sheet types as a batch. Item sheets are house-styled — items are objects in the world, not voices. They share enough structural conventions that documenting them together prevents drift; they also have enough per-type variation (the inner conflict box grid, the magic/skill cast button) to deserve individual specs within the batch.

## Common item sheet conventions

All item sheets in the system share these structural rules. Per-type sections below only cover deviations.

### Sizing

```js
position: { width: 360-540, height: "auto" }
```

Width varies by content density:
- Reputation Tag: 360px (smallest)
- Reputation Condition: 380px
- Backstory Action: 400px
- Magic/Skill: 460px (description + cast pipeline)
- Inner Conflict: 540px (the box grid needs space)

Height is always auto. No tabs — every item sheet is single-page.

### Theme

All item sheets are **house-styled**. No `.gs-themed` wrapper. Items are objects in the world — they belong to actors, but they don't carry voices of their own.

When opened from a themed surface (e.g. clicking a tag pill on the Major sheet), the item sheet appears as a popup distinct from the parent. The visual transition is intentional: opening an item sheet feels like reaching for an object in the world rather than continuing the actor's voice.

### Common layout structure

```
┌─────────────────────────────────────────┐
│  [TYPE LABEL eyebrow]    [optional meta] │ ← header
│  [name input — large, prominent]         │
├─────────────────────────────────────────┤
│                                            │
│  [field stack with small-caps labels]    │ ← body
│                                            │
├─────────────────────────────────────────┤
│  [optional footer with action buttons]   │ ← footer
└─────────────────────────────────────────┘
```

CSS class root pattern: `.gs-item-sheet--{type}` (e.g. `.gs-item-sheet--reputation-tag`)

#### Header

- Background: `var(--gs-paper)`.
- Padding: 14px 20–22px (varies slightly by sheet width).
- 0.5px bottom border in `var(--gs-accent-2)` (sage).
- Type label eyebrow on the left: small caps 11px, letter-spacing 0.18em, color `var(--gs-accent-2)`. Examples: "REPUTATION TAG", "MAGIC · SKILL", "INNER CONFLICT".
- Optional metadata on the right: italic 10–11px, `var(--gs-accent-2)`. Used for state ("hidden from Public Info", "complete at 6 total or 5 on one side").
- Name input: full-width, transparent background, 0.5px bottom border in `var(--gs-accent-1)` (sage→light), display type 20–22px (per sheet), color `var(--gs-brand)`. The bottom border emphasizes the name as the editable focus without enclosing it in a box.

#### Body

- Padding: 16px 20–22px.
- Background: `var(--gs-paper)`.
- Display: `flex; flex-direction: column; gap: 14px`.
- Each field is a vertical stack: label on top (small caps 11px, letter-spacing 0.14em, color `var(--gs-accent-2)`), control below.

#### Field control styles

- **Text input**: padding 6px 12px, background `var(--gs-paper-warm)`, 0.5px border `var(--gs-accent-2)`, 4px corner radius, body type 12–13px, color `var(--gs-ink)`. No focus ring beyond a subtle border color shift to `var(--gs-brand)`.
- **HTML editor (description)**: same surface as text input but min-height 40–50px. Body type 13px. Italic by default in display state. Click to edit.
- **Polarity dropdown**: two-button toggle showing positive ▲ and negative ▼. Selected state has a 1px border in `var(--gs-positive)` or `var(--gs-danger)` and the corresponding ramp text. See Reputation Tag spec for details.
- **Toggle**: small inline pill, "off" state outlined in `var(--gs-accent-2)`, "on" state filled in `var(--gs-brand)` with paper text.
- **Reference picker**: shows the referenced object's name + type as an inline pill; click to change.
- **Multi-reference picker**: same but shows multiple pills with "[+ add]" to extend.

#### Footer

- Used only when an item sheet has primary actions beyond the form fields (most don't — auto-save handles persistence).
- Magic/Skill has a footer (Cast button).
- Inner Conflict has an optional footer (manual completion override for GM).
- Other item sheets omit the footer.

### Antique-but-clean execution

Item sheets are the smallest surfaces in the system, so the antique-but-clean principle gets stress-tested at compact scale:

- Generous padding (14–22px) even though sheets are small.
- Hairlines (0.5px) for every separator.
- Section labels in small caps with breathing letter-spacing.
- Period typography (Lora display, Crimson Text body) at sizes that read clearly even at popup scale.
- Single ornament per surface — usually the polarity arrow (▲▼) or the box grid; never both.

## Reputation Tag sheet

**Width: 360px**
**Schema (CLAUDE.md §9):** `{ name, polarity, description, source }`

The simplest item sheet. Compact popup.

### Layout

```
┌─────────────────────────────────────────┐
│  REPUTATION TAG                           │
│  Restrained                               │ ← name
├─────────────────────────────────────────┤
│  POLARITY                                 │
│  [▲ positive]  [▼ negative]               │ ← polarity toggle
│                                            │
│  DESCRIPTION                              │
│  [Composed under provocation. Holds her  │ ← description editor
│   tongue when others would not.]          │
│                                            │
│  SOURCE                                   │
│  [Scene 4: refused Roger's carnival]     │ ← source field
└─────────────────────────────────────────┘
```

### Fields

- **name** — text input. Required. The tag's display label (e.g. "Restrained", "Naïve", "Ambitious").
- **polarity** — two-button toggle. Positive ▲ uses `var(--gs-positive)` styling when selected; negative ▼ uses `var(--gs-danger)`. Defaults to positive.
- **description** — HTML editor. Short paragraph explaining what the tag means — useful for GM and players reviewing tags out of context.
- **source** — single-line text input. Records *where* the tag came from. Examples: "Scene 4: refused Roger's carnival", "Reputation phase: chose duty over desire", "Imported from rulebook". The source is what shows in the reputation review step of the Upkeep Wizard.

### Auto-save

Every field auto-saves on change (Foundry default). No explicit save button. Closing the sheet preserves changes.

### Compendium origin

Tags can be drag-dropped from a compendium pack (per Plan §4 — `packs/conditions.db` or similar). When a tag is dragged onto a Major sheet, an instance of the tag item is created on that actor with the canonical fields pre-filled and the source field initialized to "(unset)".

## Reputation Condition sheet

**Width: 380px**
**Schema (CLAUDE.md §7):** `{ name, polarity, description, active, sourceTagIds }`

Like Reputation Tag plus an active toggle and source-tag references. Conditions are the cumulative consequences that fire when a polarity reaches three tags (per Plan §12.3).

### Layout

```
┌─────────────────────────────────────────┐
│  REPUTATION CONDITION       ◉ active     │
│  Quite Indebted                           │
├─────────────────────────────────────────┤
│  POLARITY                                 │
│  [▲ positive]  [▼ negative]               │
│                                            │
│  DESCRIPTION                              │
│  [The character's name has become         │
│   synonymous with debt. Society offers    │
│   credit reluctantly...]                  │
│                                            │
│  SOURCE TAGS (3 required)                 │
│  [▼ Spendthrift]  [▼ Reckless]  [▼ Bold] │
└─────────────────────────────────────────┘
```

### Fields beyond Tag's

- **active** — toggle in the header right (visible state on/off). Conditions can be present but inactive (e.g. when tag count drops below 3, the condition deactivates but stays on the sheet for narrative continuity). Off = outlined; On = filled `var(--gs-brand)` with "active" label in paper color.
- **sourceTagIds** — multi-reference picker. Lists the tag instances that triggered this condition. Each tag pill shows the tag's polarity arrow + name. Clicking a tag opens its sheet. The picker shows "(3 required)" or similar count hint.

### Conditions don't auto-create

Unlike Backstory Actions, conditions are not auto-created by the system. The Condition Picker modal (referenced in `04-character-sheet.md`, fired when a third tag of a polarity is added) opens a list of canonical conditions from the compendium plus any homebrew. The player drags a condition onto their sheet, which creates the item instance and links the source tags.

## Inner Conflict sheet

**Width: 540px**
**Schema (CLAUDE.md §7):** `{ leftLabel, rightLabel, leftBoxes: bool[5], rightBoxes: bool[5], completed: bool, completedSide: "left"|"right"|null }`

The most distinctive item sheet. The 5+5 box grid is the headline component, and is also rendered on the Major sheet's Public tab (per `04-character-sheet.md`). The grid as a primitive (inventory #39) is fully specified here; the Major sheet uses the same primitive.

### Layout

```
┌─────────────────────────────────────────────┐
│  INNER CONFLICT      complete at 6 total or 5 on one side
├─────────────────────────────────────────────┤
│                                                 │
│   LEFT LABEL              RIGHT LABEL            │
│   Family       vs.        Independence          │
│                                                  │
│   ┌──────────────────────────────────────┐     │
│   │   ■ ■ ■ □ □   │   ■ □ □ □ □          │     │
│   │                                       │     │
│   │ total 4 of 6 · left 3 of 5 · right 1 │     │
│   │ of 5 · the conflict is unresolved     │     │
│   └──────────────────────────────────────┘     │
│                                                  │
└─────────────────────────────────────────────┘
```

### Fields

- **leftLabel / rightLabel** — text inputs side by side, with a "vs." italic divider between. Each input shows its own small-caps label above ("LEFT LABEL", "RIGHT LABEL"). The right input is left-aligned; the left input is right-aligned (so the two labels lean toward each other across the "vs.").
- **box grid** — see the primitive spec below.
- **completed / completedSide** — derived from box state. Not directly editable; updates automatically when completion fires.

### Inner Conflict box grid primitive (#39)

CSS class root: `.gs-inner-conflict-grid`

Used in:
- The Inner Conflict item sheet (this doc, primary rendering).
- The Major sheet's Public tab (per `04-character-sheet.md` — same primitive, same behavior).

#### Visual

```
┌────────────────────────────────────────┐
│   ■ ■ ■ □ □  │  ■ □ □ □ □              │
│                                          │
│  total {N} of 6 · left {N} of 5 · right │
│  {N} of 5 · {status}                     │
└────────────────────────────────────────┘
```

- Outer card: `var(--gs-paper-warm)` background, 0.5px border in `var(--gs-accent-2)`, `border-radius: 8px`, padding 18px 22px.
- Three-column grid: 5 boxes left, hairline divider, 5 boxes right.
- Each box: 22×22px square, 1px border in `var(--gs-brand)` (filled state) or `var(--gs-accent-2)` (empty state), `border-radius: 3px`. Filled boxes use solid `var(--gs-brand)` fill.
- Center divider: 1px wide × 30px tall vertical line in `var(--gs-accent-2)`.
- Below the boxes: 0.5px hairline rule, then completion summary in italic 12px `var(--gs-ink)`.

#### Completion summary text

The text changes based on state:
- Active (no completion): "total {N} of 6 · left {N} of 5 · right {N} of 5 · the conflict is unresolved"
- Completed left: "total {N} of {6 or 5+} · resolved on the side of {leftLabel}"
- Completed right: "total {N} of {6 or 5+} · resolved on the side of {rightLabel}"
- 6 total: "total 6 · resolved" (the player chooses the side via a popup before completion fires).

#### Interaction

- Click an empty box → fills it. Click a filled box → unfills it (in case of misclicks).
- Right-click a row → resets that side to all-empty.
- When a side reaches 5 boxes filled, completion fires immediately.
- When total reaches 6 (with neither side at 5), a small popover prompts: "The conflict is complete with 6 total. Which side prevails?" The player picks left or right; that's `completedSide`.

#### Completion behavior

When `completed === true`:
1. The sheet's box grid card briefly highlights with a `var(--gs-accent-3)` (honey/gold) glow over 800ms (slow, ceremonial — see `04-character-sheet.md` Public tab spec).
2. The Inner Conflict completion ceremony chat card fires (per `10-chat-cards.md`).
3. A new `backstory-action` item is auto-created on the parent Major (per Backstory Action spec below). The item references this Inner Conflict's id in `sourceConflictId`.
4. On the Major sheet, this conflict moves from `innerConflictsActiveIds` to `innerConflictsCompletedIds`.
5. The grid is now read-only — the boxes don't toggle anymore. The summary reads "resolved on the side of {label}".

To re-open a completed conflict (rare — usually for narrative reasons or to fix a misclick), the GM has access to a "reopen" action button in the sheet footer. Confirms before firing. Resets `completed` and `completedSide` and removes the auto-created Backstory Action.

### Why this is the headline component

Inner conflicts are the mechanical engine of character development in Good Society. Filling boxes is small, satisfying, frequent. Completing one is rare and dramatic. The grid has to feel rewarding to interact with — boxes that respond cleanly, a completion that earns its weight via the chat card and the Backstory Action.

The 22×22px box size is deliberately a touch larger than typical UI checkboxes — these aren't form controls, they're earned victories.

## Magic/Skill sheet

**Width: 460px**
**Schema (CLAUDE.md §7, Plan §10):** `{ name, description, referenceUrl, vfxKey, soundUrl, hidden, triggersPersonaSwap }`

The most action-oriented item sheet. The Cast button in the footer is the headline.

### Layout

```
┌─────────────────────────────────────────────┐
│  MAGIC · SKILL          ○ hidden from Public  │
│  Mage Hand                                     │
├─────────────────────────────────────────────┤
│  DESCRIPTION                                   │
│  [A spectral hand for delicate intrigue.      │
│   Lifts a teacup, slips a note, opens a       │
│   latch from across the room.]                 │
│                                                 │
│  VFX KEY              PERSONA SWAP             │
│  [jb2a.mage_hand ▾]   [— none —]              │
├─────────────────────────────────────────────┤
│  visibility · secret will prompt before public cast
│                                       [cast ↗] │
└─────────────────────────────────────────────┘
```

### Fields

- **name** — text input, prominent.
- **description** — HTML editor, short prose.
- **vfxKey** — string, points at a Sequencer/JB2A asset path (e.g. `jb2a.mage_hand`, `jb2a.alter_self.blue`). Could be a dropdown auto-populated from installed JB2A modules, or a free-text input with autocomplete. Implementation choice.
- **soundUrl** — optional URL string for an accompanying sound file. Not visible in the compact sheet by default; expand a "more options" disclosure if needed.
- **hidden** — toggle in the header right ("hidden from Public Info"). When true, this skill doesn't appear in any public listing.
- **triggersPersonaSwap** — reference to a target persona. When set, casting this skill *also* triggers a persona swap to the named persona (Plan §11.5 — Alter Self pattern). When `null`/unset, just the VFX fires.
- **referenceUrl** — optional URL to a rulebook page or external doc. Hidden in compact view; appears as a small link in the description's footer area.

### Footer with Cast button

- 0.5px top border in `var(--gs-accent-2)`.
- Padding: 12px 22px.
- Display: `flex; justify-content: space-between; align-items: center`.
- Left: italic 11px helper text. Reads "visibility · secret will prompt before public cast" if the parent actor's `visibility.magic === "secret"`. Otherwise reads "visibility · public · all players will see the cast".
- Right: **Cast button** — primary filled, `var(--gs-brand)` bg, paper text, "cast ↗" label.

### Cast pipeline

When the Cast button is clicked:

1. Check the parent actor's `visibility.magic` flag.
2. If `secret`: show a confirm dialog: "Casting Mage Hand will play a visible animation on your token. All players will see it. Proceed?" Two buttons: "cast publicly" / "cast hidden (GM only)".
   - If GM-only: the chat card whispers to GM and the actor's owner; the Sequencer effect fires only on the GM's view (advanced — defer to v1.1 if not feasible).
   - If publicly: continue to step 3.
3. If `public`: proceed directly.
4. Trigger the Sequencer animation (per Plan §10):
   ```js
   new Sequence()
     .effect()
       .atLocation(token)
       .file(item.system.vfxKey)
       .scaleToObject(1.5)
     .sound()
       .file(item.system.soundUrl)
     .play();
   ```
5. If `triggersPersonaSwap` is set, run the persona-swap pipeline (CLAUDE.md §11) and post the persona switch announcement chat card (per `10-chat-cards.md`).
6. Post a system chat card describing the cast: "Lady Rose Willowood casts Mage Hand."
7. If Sequencer is not installed, fall back to step 6 only (chat card without animation).

### Why visibility matters

Plan §10's caveat about Dixon: he's publicly anti-magic but secretly a magic user. Casting his magic publicly would reveal him. The system has to make this consequential rather than easy — the confirm dialog with explicit "this will reveal you" wording is the design's safeguard.

## Backstory Action sheet

**Width: 400px**
**Schema (CLAUDE.md §7):** `{ name, description, sourceConflictId, expanded, used }`

Auto-created when an Inner Conflict completes. Earned, not authored from scratch.

### Layout

```
┌─────────────────────────────────────────┐
│  BACKSTORY ACTION                          │
│  An Old Letter Arrives                     │
├─────────────────────────────────────────┤
│  EARNED FROM                              │
│  ⌜ Family vs. Independence ⌟              │ ← reference to source conflict
│  resolved on the side of Family            │
│                                            │
│  DESCRIPTION                              │
│  [What does Rose's reflection on her     │
│   conflict introduce into play? A new    │
│   character, a hidden letter, a buried   │
│   memory...]                              │
│                                            │
│  STATUS                                   │
│  [○ expanded]  [○ used]                   │
└─────────────────────────────────────────┘
```

### Fields

- **name** — text input. Player fills in after the action is auto-created.
- **sourceConflictId** — read-only reference to the Inner Conflict that produced this action. Renders as an inline pill showing the conflict's labels. Click → opens the Inner Conflict sheet.
- **resolved on the side of {label}** — derived display from the source conflict, italic muted.
- **description** — HTML editor. Where the player writes what the action *is* — a new character, a plot twist, a buried memory, an introduced event.
- **expanded** — toggle. Has the player worked this action into play yet? Defaults to off.
- **used** — toggle. Has the action been "spent" — i.e. the introduced element has played out? Defaults to off.

### Auto-creation

When an Inner Conflict completes (per the box grid primitive's completion behavior), the system auto-creates a Backstory Action item on the parent Major actor with:
- `name`: empty (player fills in)
- `description`: empty (player fills in, prompted by the chat card)
- `sourceConflictId`: the completed conflict's id
- `expanded: false`
- `used: false`

The completion ceremony chat card (per `10-chat-cards.md`) links to this auto-created action, prompting the player: "Click to expand your Backstory Action."

### Why the two toggles

The Backstory Action has a small lifecycle:
1. **Auto-created** — exists but empty (`expanded: false`, `used: false`).
2. **Expanded** — player has filled in the name and description.
3. **Used** — the introduced element has played out in fiction.

The two toggles (`expanded` and `used`) let the GM and player track which actions are still available. A common UI gesture: in the Major sheet's "Earned Actions" section (deferred to a future spec), expanded-but-unused actions are highlighted as "ready to spend"; used actions are dimmed.

## Theme behavior

All five item sheets are house-styled. No `.gs-themed` wrapper. Items don't carry voices.

This is true even when an item's parent Major has a strong theme — opening Avril's Inner Conflict from her sheet brings up the Inner Conflict sheet in *Inkwell*, not in Candlelight. The visual transition is intentional.

## Edge cases

### Reputation Tag dropped onto a sheet that already has it
Foundry's default item-on-actor behavior creates a duplicate. The system's drop handler should check for existing tags by name+polarity and either prompt ("This actor already has 'Restrained'. Add a duplicate or skip?") or silently update the existing tag's source field with the new context.

### Reputation Condition with fewer than 3 source tags
The condition can exist but `active === false`. The header's active toggle is disabled with a tooltip: "Activates when 3 source tags of this polarity are present."

### Inner Conflict edited mid-cycle
Changing left/right labels mid-cycle is allowed but rare. No special behavior — the change just propagates to the Major sheet's Public tab rendering.

### Magic/Skill cast button when Sequencer isn't installed
The Cast button still works but the visual fallback is a system chat card only (no canvas animation). A small italic "Sequencer not installed — chat-only cast" notice appears in the footer when applicable.

### Backstory Action expanded but never used
That's fine. Plenty of actions sit unspent for several cycles. They surface as available reminders on the Major sheet.

### Backstory Action used before expanded
Edge case — typically the player expands before using. If a GM-fired use happens first, the system prompts: "This action hasn't been expanded yet. Mark expanded too?"

## Implementation notes for Claude Code

When prompted to build these sheets, the recommended order:

1. Build the Reputation Tag sheet first — simplest, validates the common item sheet template (header, body, field stack, auto-save). The CLAUDE.md §9 worked example is for this exact sheet — reference it directly.
2. Build the Reputation Condition sheet — adds the active toggle and multi-reference picker.
3. Build the Backstory Action sheet — adds the read-only reference field pattern and the two-toggle status row.
4. Build the Inner Conflict sheet — the box grid is the most complex new primitive. Implement the grid as `templates/components/inner-conflict-grid.hbs` so the same partial is used by both this sheet and the Major sheet's Public tab.
5. Build the Magic/Skill sheet — the Cast button pipeline is the most action-oriented. Test the Sequencer fallback path explicitly (disable Sequencer, verify the chat-only path works).

CSS organization:
- `styles/sheets/_item-base.css` — common header/body/footer conventions and field control styles
- `styles/sheets/_item-reputation-tag.css` — polarity toggle styling
- `styles/sheets/_item-reputation-condition.css` — header active toggle, multi-tag picker
- `styles/sheets/_item-inner-conflict.css` — box grid (also used in Major sheet, share via `styles/components/_inner-conflict-grid.css`)
- `styles/sheets/_item-magic-skill.css` — VFX picker, cast button, footer
- `styles/sheets/_item-backstory-action.css` — source conflict reference, status toggles

### Test path

1. Open a Reputation Tag sheet from a Major's tag pill. Verify the popup, edit fields, close. Re-open and verify changes persisted.
2. Drag a tag from a compendium onto a Major. Verify the tag instance is created with canonical fields and the source field is "(unset)".
3. Open an Inner Conflict sheet, edit the labels, fill some boxes. Verify the same boxes are filled when the parent Major's Public tab is opened.
4. Fill a side to 5 boxes. Verify completion fires: glow, ceremony card, Backstory Action auto-created.
5. Open the auto-created Backstory Action. Verify the source conflict reference is set and read-only.
6. Open a Magic/Skill sheet on Dixon (whose `visibility.magic === "secret"`). Click Cast. Verify the confirm dialog. Cast publicly. Verify Sequencer effect + chat card.
7. Disable Sequencer. Cast again. Verify chat-only fallback.
8. Reopen a completed Inner Conflict as GM. Verify the reopen action restores the editable state and removes the Backstory Action.

If 1–8 pass, the item sheet batch is production-ready.

## Open questions

1. **Should Reputation Tags support emoji or icons?** Currently no — the polarity arrow is the only visual marker. Icons would clash with the antique aesthetic. **Tentative answer: no for v1.** If players want differentiation, the polarity arrow + tag name is enough.

2. **Should Inner Conflict labels accept rich text (italics, bold)?** **Tentative answer: no.** Plain text only. Conflict labels appear in many places (sheet, chat cards, journal); rich text would complicate rendering.

3. **Should the box grid show numbered boxes (1, 2, 3...) inside?** **Tentative answer: no.** The boxes are visual checkboxes, not numbered scores. Numbering would feel mechanical in the wrong way.

4. **Magic/Skill VFX preview button?** A button that fires the Sequencer effect without "casting" the skill (no chat card, no persona swap). For testing/tweaking. **Tentative answer: yes, GM-only.** Add a small "preview" link next to the VFX key field. GM-only because preview-firing in front of players would spoil the actual cast moment.

5. **Should Backstory Action auto-create the action item or just prompt the player?** **Tentative answer: auto-create.** The friction of "the system created an empty action — fill it in" is much lower than "the system told you to make an item somewhere." The completion ceremony chat card links to the auto-created item.

6. **Reputation Condition source tags — how strictly to enforce 3?** Currently the active toggle is disabled when fewer than 3 source tags. Should the system also prevent activating manually if the count drops below 3? **Tentative answer: yes.** The active toggle disables automatically when the source tag count drops below 3. GM has an override.

7. **Should item sheets support locking (read-only) for finalized states?** A used Backstory Action is essentially "spent" and shouldn't be edited further. **Tentative answer: yes, but soft.** Used actions render with reduced opacity and a "completed" lock indicator; clicking still allows edit (with a confirm dialog) for narrative retcons.

## Visual proof

Three item sheets are rendered above (`good_society_item_sheets_three_variants`):

1. **Reputation Tag** — compact 360px sheet with name input, polarity toggle, description, source. Validates the common template.
2. **Magic/Skill** — 460px sheet with description, VFX key, persona swap reference, hidden indicator in the header, and the prominent Cast button in the footer. Validates the action-oriented item pattern.
3. **Inner Conflict** — 540px sheet with left/right label inputs and the 5+5 box grid (3 boxes filled on the left side, 1 on the right) with completion summary. Validates the headline primitive.

Reputation Condition and Backstory Action follow the common template closely enough that they don't need separate visual proof — their layouts are described in text above.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Common item sheet conventions specified. Five item sheet types specified (Reputation Tag, Reputation Condition, Inner Conflict, Magic/Skill, Backstory Action). Inner Conflict box grid primitive folded into the sheet spec. Visual proof rendered for three representative variants. |
