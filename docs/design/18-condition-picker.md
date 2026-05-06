# 18 — Condition Picker Modal

**Status:** Locked — full modal specified including trigger, compendium sourcing, pick workflow, dismiss paths
**Date opened:** 2026-05-05
**Covers:** New inventory entry to be added (between #19 Bulk Permissions Panel and #20 Reveal Control widget — suggest renumbering as #20a Condition Picker, or simply adding as #19.5 / a new sequential entry)

## Goal

Specify the Condition Picker modal — the non-blocking modal that fires when a Major character's third reputation tag of a polarity is added (Plan §12.3, referenced in `04-character-sheet.md` Public tab spec and `12-item-sheets.md` Reputation Condition spec).

This component closes the reputation tag flow. Without it, the player's third tag has no automatic narrative consequence — the system tracks the count but the dramatic moment passes unmarked. With it, the threshold becomes a small, well-scoped story beat: "the world has begun to notice you" (or, for negatives, "the world has begun to talk").

The picker is not blocking — players can dismiss and pick later, or decide no condition applies this time. Mechanical consequences only fire when a condition is actually applied; the trigger itself just opens this modal.

## When and how it triggers

### Trigger conditions

When a player adds a reputation tag (positive or negative) that brings their count of that polarity to exactly 3:

1. The world setting `promptOnThreeTags` (default `true`) is checked. If false, no picker — silent.
2. If true, the picker opens for the actor's owner (if connected). The GM also sees a small toast notification: "Lady Rose has reached 3 positive reputation tags — picker opened for her player."
3. The picker is themed to the actor.

### Trigger location

The trigger fires on tag-add events in two places:
- The Reputation Tags grid on the Major sheet's Public tab (drag-drop a tag, or "+ add" from a compendium).
- The Reputation phase's tag-resolution flow (when tags get formally added during phase advance).

In both cases, the picker is fired by a single helper, `module/helpers/reputation-rules.js`'s `checkThresholdAndPrompt(actor, polarity)`.

### Re-trigger

If the player picks a condition, the count is preserved (tags don't get removed by condition application — see Picking a condition below). If a fourth tag of the same polarity is added later, the picker does NOT re-fire automatically. The player already has an active condition; adding more tags reinforces the polarity but doesn't reset the trigger.

If a tag is later removed (bringing count below 3), the active condition's `active` flag may flip to false (per `12-item-sheets.md` Condition spec) but the picker doesn't re-fire on subsequent re-add unless the count crosses 3 again from below.

## Modal characteristics

CSS class root: `.gs-condition-picker`

Width: 520px. Height: auto with `max-height: 80vh` — internal scroll on the body if many conditions.

The modal is **non-blocking**:
- The user can interact with the underlying sheet while the modal is open.
- The modal can be moved (dragged from the header).
- The modal closes on the user's own action (pick, "later", "no condition", or a small × in the header). It does NOT close from clicking outside.

Backdrop: 30% opacity ink-tone, lighter than the Upkeep Wizard's 45% — signals "less blocking" visually.

## Layout

```
┌──────────────────────────────────────────────────┐
│  REPUTATION THRESHOLD · LADY ROSE   [▲ 3 positive]│ ← header
│  The world has begun to notice you.               │
│  Three positive tags this cycle. Society has...   │
├──────────────────────────────────────────────────┤
│  [scrollable list of condition cards]              │
│                                                     │
│  ▲ Of Interest                              [pick] │
│  ▲ Quite Endeared                           [pick] │
│  ▲ Unexpected Connection                    [pick] │
│  ▲ Promising Match (homebrew · willowood)   [pick] │
│                                                     │
├──────────────────────────────────────────────────┤
│  SOURCE TAGS  [▲ Restrained] [▲ Dutiful] [▲ Composed]│
│                              [later]   [no condition]│
└──────────────────────────────────────────────────┘
```

## Header

CSS class root: `.gs-condition-picker__header`

- Background: `var(--gs-paper)`.
- Padding: 18px 26px.
- 0.5px bottom border in `var(--gs-accent-3)` (honey-gold — this is a moment, the gold-edge signals that).

### Eyebrow row

Justified between two spans:

- Left: "REPUTATION THRESHOLD · {actor name uppercase}" eyebrow in 11px small caps, letter-spacing 0.18em, color `var(--gs-brand)`. The actor name is uppercased for the small-caps treatment.
- Right: a polarity pill showing "▲ 3 positive" or "▼ 3 negative" — paper bg, 0.5px border in `var(--gs-positive)` (verdant) or `var(--gs-danger)` (oxblood), polarity arrow + italic text matching the polarity color.

### Title and prompt

Below the eyebrow:

- **Title** in display type, 22px, color `var(--gs-brand)`, line-height 1.1. The title varies by polarity:
  - Positive: "The world has begun to notice you."
  - Negative: "The world has begun to talk."

These are deliberately literary, not literal. They set the tone of the moment. (If we want to localize alternative phrasings later, both come through `lang/en.json` keys: `GOODSOCIETY.condition.threshold.positive`, `GOODSOCIETY.condition.threshold.negative`.)

- **Prompt** below the title in italic body type, 13px, line-height 1.55, color `var(--gs-ink)`. Provides context: "Three positive tags this cycle. Society has formed an opinion. Choose a Reputation Condition to mark it, or dismiss to handle later."

The prompt explicitly mentions the dismiss-for-later option, signaling that picking now is not required.

## Body — condition list

CSS class root: `.gs-condition-picker__body`

- Padding: 14px 22px.
- Display: `flex; flex-direction: column; gap: 10px`.
- Max-height: 380px with `overflow-y: auto` — scrollable if the compendium has many matching conditions.

### Condition card

Each condition renders as a clickable card:

- Background: `var(--gs-paper-warm)`.
- 2.5px left-edge accent stripe matching polarity (`var(--gs-positive)` or `var(--gs-danger)`).
- `border-radius: 8px`.
- Padding: 12px 16px.
- Cursor: pointer.

Card content: `display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;`.

#### Left column (content)

- Top row: polarity arrow + condition name + provenance badge.
  - Polarity arrow: 14px, color `var(--gs-positive)` or `var(--gs-danger)`.
  - Condition name: display type 17px, color `var(--gs-ink)`.
  - Provenance badge: italic body type 10px, letter-spacing 0.06em.
    - "canonical" in `var(--gs-accent-3)` (honey) for conditions from the system's bundled compendium.
    - "homebrew · {scope}" in `var(--gs-brand)` (theme primary) for world-authored conditions. The scope is the family or world name where applicable (e.g. "homebrew · willowood" for a Willowood-specific condition).
- Below: condition description in italic 12px, line-height 1.55, color `var(--gs-ink)` (slightly muted).

#### Right column (action)

- A "pick ↗" button: primary filled with theme `var(--gs-brand)` (paper text) for visually-prominent options — but only one option should be primary-styled at a time, otherwise the picker reads as overwhelming.

**Recommendation: only the first card** (or a system-recommended option, see below) gets the primary filled treatment. The rest get the secondary outlined treatment (`var(--gs-brand)` border and text, transparent background).

### System-recommended ordering

The list is sorted by:
1. **Recommended** based on which source tags are active (heuristic — see below).
2. **Canonical** before **homebrew** as a tiebreaker.
3. **Alphabetical** within those.

Recommendation heuristic: the system inspects the source tags and matches against the conditions' descriptions or tag-association metadata. For instance, if all three positive tags are about composure ("Restrained", "Dutiful", "Composed"), conditions like "Of Interest" and "Quite Endeared" rank higher than "Unexpected Connection" (which fits an alliance-based polarity).

This is a soft recommendation — players can pick any condition. The visual ranking is just to surface the most plausible match first.

### "More options" link

If the compendium has many homebrew conditions and the body lists them all, a "more options ▾" disclosure link appears at the bottom of the body (after the canonical conditions). Click expands to show all homebrew. Default state: only canonical + best-match homebrew shown.

## Footer

CSS class root: `.gs-condition-picker__footer`

- Background: `var(--gs-paper-warm)`.
- 0.5px top border in `var(--gs-accent-3)`.
- Padding: 14px 22px.
- Display: `flex; justify-content: space-between; align-items: center; gap: 14px`.

### Source tags display

Left cluster: shows the three tags that triggered the threshold, as small pills.

- Eyebrow: "SOURCE TAGS" italic 10px small caps, letter-spacing 0.08em, color `var(--gs-accent-3)`.
- Pills: each tag rendered as a small pill, paper bg, 0.5px border, 1.5px left-edge polarity stripe, 10px Crimson Text. Format: "▲ Restrained" / "▼ Naïve".

These tags are read-only here; clicking does nothing. The pills exist to remind the player *what* society is responding to.

### Action buttons

Right cluster:
- **later** — secondary outline. Closes the picker without applying a condition. The picker can be re-opened later via a small "[reputation threshold reached →]" badge that appears in the Public tab's Reputation Tags grid (next to the polarity meter that's at 3 pips). Click the badge → re-opens this modal.
- **no condition** — secondary outline. Marks this threshold as explicitly resolved-without-condition. The badge from "later" doesn't re-appear; the threshold is acknowledged. If a fourth tag is added later, the threshold is exceeded silently (no new picker). This is for the rare case where the player and GM agree the third tag doesn't warrant a condition.

The two close-without-applying buttons are deliberate: "later" is "I'll think about it," "no condition" is "this doesn't deserve a condition." Different intents.

## Picking a condition

When the player clicks "pick ↗" on a condition card:

1. The system creates a new `reputation-condition` Item on the Major actor. Fields populated:
   - `name`: condition's name from the compendium
   - `polarity`: matches the trigger polarity
   - `description`: condition's description from the compendium
   - `active`: true
   - `sourceTagIds`: the IDs of the three source tags that triggered the threshold
2. The condition appears in the Major sheet's Public tab "Active Conditions" section (per `04-character-sheet.md`).
3. The picker closes.
4. A chat card posts (system-emitted, per `10-chat-cards.md`): "Lady Rose Willowood has gained the Reputation Condition: Of Interest."
5. If `autoRefreshOnUpkeep` and similar settings imply downstream effects, those fire (none currently — conditions are mechanical hooks for narrative play, not automatic effects).

The source tags themselves are NOT consumed or removed when a condition is applied. They remain on the actor; the condition references them. If a tag is later removed, the condition's `active` may flip to false but the condition item persists for narrative continuity.

## Compendium sourcing

The picker pulls condition options from two places:

### Bundled compendium

`packs/conditions/` — included with the system. Contains canonical conditions from the rulebook plus any conditions the system author chose to ship as defaults. Each item is a `reputation-condition` document with the canonical schema (per `12-item-sheets.md`).

The bundled compendium is read-only at the world level (Foundry's compendium permission default). Players can drag from it; the original isn't modified.

### World compendium (homebrew)

If the world has its own compendium pack of `reputation-condition` items (e.g. authored by the GM for their campaign), those appear in the picker too, badged as "homebrew · {world or scope name}".

Multiple homebrew packs are supported — the picker collects from all `reputation-condition` items in any compendium the user has read access to.

### Filtering by polarity

Only conditions matching the trigger polarity appear. A positive threshold shows only ▲ conditions; a negative threshold shows only ▼ conditions. The picker's data layer filters at query time: `compendium.find({polarity: triggerPolarity})`.

## Theme behavior

The picker is **themed to the actor**. The whole modal is wrapped in `.gs-themed[data-theme="{actor.system.theme}"]`. Rose's threshold gets a pink-and-gold picker; Avril's gets candlelight-and-crimson; Mags's gets her cold-steel palette.

This is intentional. The threshold is a per-character moment — the player should feel it happening *with* their character, not in a system box.

## Edge cases

### Player is offline when threshold fires
The picker doesn't open for the offline player. A small flag on the actor records `pendingConditionPicker = {polarity: "positive", sourceTagIds: [...]}`. When the player reconnects, the picker opens automatically. If the threshold has been resolved by the GM in the meantime (by manually applying or dismissing), the flag clears and no picker appears.

### GM applies a condition manually before the picker opens
The flag clears and no picker fires. The GM can pre-empt the player's pick — useful when the GM wants to direct the narrative.

### `promptOnThreeTags` setting is false
No picker. The threshold is reached silently. Tags continue to accumulate; no condition is auto-applied.

### Compendium has no matching conditions
Rare but possible if the bundled compendium isn't loaded. The picker shows an empty body with italic "No conditions available. Check that the conditions compendium is loaded." in muted text. The footer's "later" and "no condition" actions still work.

### Tag is removed *after* threshold but *before* picker opens
The picker still opens (it was triggered by the threshold being reached, not by the threshold being currently held). However, the source tags shown in the footer reflect the *current* state — if a tag was just removed, it's not in the source tags display. The player can still pick a condition, but the resulting condition's `active` may immediately be false depending on the condition's source-tag count requirement.

### Tag re-added after the picker was dismissed-for-later
If the player picked "later", the badge in the Public tab is showing. Re-adding a tag (still at 3) doesn't re-fire the picker; the badge already invites the action. If the count exceeds 3 (4+), the badge updates its label ("4 positive — pick a condition?"), still inviting click.

### Multiple thresholds simultaneously
A character could conceivably reach both positive AND negative thresholds in the same session (or even the same action chain — a complicated scene). Two pickers can coexist; they queue. The first opens immediately; the second opens when the first is closed (whatever way).

## Implementation notes for Claude Code

When prompted to build this picker:

1. Build the picker `ApplicationV2` skeleton — opens, closes, themes itself based on a passed-in actor reference.
2. Wire the trigger from `reputation-rules.js`. The helper `checkThresholdAndPrompt(actor, polarity)` runs after every reputation-tag-add operation:
   ```js
   if (
     game.settings.get("good-society-homebrew", "promptOnThreeTags") &&
     actor.system.reputation[`${polarity}Tags`].length === 3 &&
     !actor.getFlag("good-society-homebrew", `pickerResolved.${polarity}`)
   ) {
     new ConditionPicker({actor, polarity}).render(true);
   }
   ```
3. Build the header partial (eyebrow + polarity pill + title + prompt). Localize the title strings.
4. Build the condition card partial (`templates/components/condition-card.hbs`). Reuse for the picker AND for the "Active Conditions" section on the Major sheet (with slight variation — sheet doesn't show pick button).
5. Wire compendium querying. Test with bundled-only first, then add world-pack support.
6. Build the footer with source-tag pills and the two action buttons. Wire "later" (set flag, close) and "no condition" (set resolved flag, close).
7. Wire the "pick" action. Test the full flow: pick → condition created → picker closes → chat card posts → Active Conditions section updates.
8. Wire the badge in the Public tab's Reputation Tags grid (when threshold is reached but unresolved). Click → re-opens picker.

CSS organization:
- `styles/apps/_condition-picker.css` — modal-specific styling
- `styles/components/_condition-card.css` — the card primitive (shared with sheet's Active Conditions)

### Test path

1. As Rose's owner, add a third positive tag. Verify: picker opens themed to Rose, shows ~3-4 positive conditions from the bundled compendium.
2. Click "later". Verify: picker closes. Open the Public tab. Verify: a small "[3 positive — pick a condition?]" badge appears next to the positive polarity meter.
3. Click the badge. Verify: picker re-opens with the same content.
4. Click "pick" on "Of Interest". Verify: picker closes, condition appears in Active Conditions, chat card posts.
5. Add a fourth positive tag. Verify: picker does NOT re-fire. Active Conditions still shows "Of Interest".
6. Remove a tag (back to 3, then to 2). Verify: condition's `active` flag flips to false (visible on the sheet as a slightly dimmed condition pill).
7. Test with `promptOnThreeTags = false`: add a third tag. Verify: no picker, condition tracking still occurs in the data.
8. Test with the bundled compendium unloaded (rare). Verify: empty-body fallback message.

If 1–8 pass, the Condition Picker is production-ready and the reputation flow is end-to-end functional.

## Open questions

1. **Should the picker auto-open for the GM as well, or only the actor's owner?** Currently only the owner; GM gets a toast. **Tentative answer: GM toast only, never auto-open for GM.** GMs handling pickers for absent players use the manual "open picker for {actor}" GM-only menu in the actor sheet's GM tools, but defer that surface design to the GM tools batch.

2. **Should condition descriptions be GM-editable per-instance after pick?** Currently the description copies from the compendium and is editable on the resulting Reputation Condition item sheet (per `12-item-sheets.md`). **Locked.** Confirms that the compendium is the seed; instances drift from it as the campaign-specific play unfolds.

3. **Should the picker support "preview the condition's effect" before picking?** Conditions don't have automatic mechanical effects in this system (they're narrative hooks), but a preview could show "this condition will: appear in the Active Conditions section, trigger {role-specific consequence} per Plan §12.3." **Tentative answer: no preview for v1.** Conditions are descriptive enough that the description-as-shown-in-the-card is sufficient context.

4. **Should "later" track how long the player has been deferring?** A small "deferred for {N} days" indicator in the Public tab badge after a few sessions. **Tentative answer: no.** Pressure-free. Players defer when they want; the system doesn't nudge.

5. **Should the picker show the polarity meter visually?** The header has the "▲ 3 positive" pill, but a fuller meter (●●● filled vs ○○○ empty) could be more evocative. **Tentative answer: keep the pill.** The meter itself lives on the Public tab; duplicating it here adds noise.

6. **Should homebrew conditions sort with their world/family scope as a header section?** "Canonical" / "Willowood-specific" / "World" sections rather than a single sorted list. **Tentative answer: no for v1.** Single sorted list with provenance badges is cleaner. Revisit if the homebrew compendium grows large.

7. **Should the source-tag pills in the footer be clickable?** Click → opens the source tag's item sheet. **Tentative answer: yes, but secondary.** Hover to reveal a small chevron, click opens the sheet. Helpful for the rare "wait, why was this tag added?" question.

## Visual proof

The Condition Picker themed for Lady Rose at her positive-3 threshold is rendered above (`good_society_condition_picker_rose_positive_threshold`). Validates: themed pink-and-gold modal on darkened backdrop, header with threshold context and polarity pill, four condition cards (three canonical, one homebrew with provenance badge), the recommended-first card with primary filled pick button, footer with three source-tag pills and the two close-without-applying actions.

When implementation begins, render at least one negative-polarity case (perhaps for Avril's third negative threshold — the dark theme makes the "the world has begun to talk" feel land) to validate the polarity inversion in colors and copy.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Condition Picker fully specified including trigger conditions, themed-modal layout, condition card primitive, compendium sourcing (bundled + homebrew), pick workflow, and dismiss paths (later vs. no-condition). Visual proof rendered for Rose's positive threshold. New inventory entry needed (suggest: between #19 and #20 in the master inventory). |
