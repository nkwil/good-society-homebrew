# 20 — In-Sheet Rule Tooltips

**Status:** Locked — primitive specified, content authoring conventions specified, comprehensive tooltip catalog provided
**Date opened:** 2026-05-05
**Covers inventory entry:** #55 In-sheet rule tooltips (originally listed under primitives but elevated to a system-level component)

## Goal

Specify the system-wide tooltip layer that lets users hover any section header on any sheet and see a paraphrased rule explanation plus an optional rulebook page reference (Plan §12.6). Cuts down "what does this section do?" friction for new players without adding ornament for experienced players.

This is a single primitive deployed everywhere — every section header on every sheet, every persistent UI surface, every modal. Specifying it once and authoring content centrally (in `lang/en.json`) means the system gains discoverability uniformly without per-sheet design work.

## Trigger and behavior

### Hover trigger

Section headers carry a `data-tooltip-key` attribute pointing at a localization key. On hover (after a 600ms delay — see below), the tooltip renders anchored to the header.

```html
<div class="gs-section-header" data-tooltip-key="reputationTags">
  REPUTATION TAGS
</div>
```

The tooltip's content comes from `game.i18n.localize("GOODSOCIETY.tooltips.reputationTags.body")` and (optionally) `game.i18n.localize("GOODSOCIETY.tooltips.reputationTags.pageRef")`.

### Hover delay

600ms before the tooltip appears. Long enough to filter out idle mouse movement; short enough to feel responsive when the user actually wants the tooltip.

The delay is suppressed once the user has dwelled on *any* tooltip in the same scroll/focus session — once they've shown intent to read tooltips, subsequent ones appear immediately on hover. The reset happens on tab/sheet/modal change.

### Visual indicator on the header

Each tooltip-bearing section header gets a small `?` glyph in the corner — a deliberate hint that the header carries explanation. The glyph is small (8px), positioned `top: -2px; right: -14px` relative to the header text, color `var(--gs-accent-3)` (honey/gold — subtle, antique).

The glyph is the most contentious design choice here. Two alternatives considered:
- **No glyph** — relies on the tooltip itself to be discoverable. Cleaner at a glance, but new users may not realize tooltips exist.
- **Underline-on-hover** — a hairline underline appears under the header text on hover, signaling interactivity. Cleaner than a glyph but conflicts with the small-caps section header treatment.

**Locked: small `?` glyph.** It's the most discoverable and the lowest visual cost.

If a user reports the glyph feels visually noisy after a few sessions, a "hide tooltip indicators" setting can be added (defer to v1.1).

### Dismiss

The tooltip dismisses on:
- Pointer leaves the header (with a 150ms grace period — pointer can briefly cross over the tooltip itself without dismissing).
- User clicks anywhere outside the tooltip.
- Any focus change (sheet closes, tab switches, modal opens).

The tooltip is non-interactive — clicking inside it does nothing. (Don't add "learn more" links; defer to v1.1 if needed.)

## Tooltip layout

CSS class root: `.gs-rule-tooltip`

Width: 290px. Height: auto.

```
┌───────────────────────────────────┐
│  Reputation Tags                    │ ← title (display, 14px)
│                                     │
│  Adjectives the world has begun to │ ← body (italic, 12px)
│  associate with this character.   │
│  Three positive or three negative │
│  tags trigger a Reputation        │
│  Condition.                        │
│                                     │
│  ─── RULEBOOK · P. 89 ───          │ ← page ref (small caps, 10px)
└───────────────────────────────────┘
```

### Container

- Background: `var(--gs-paper)` — house style throughout. Tooltips don't theme.
- 0.5px border in `var(--gs-accent-2)` (sage).
- `border-radius: 8px`.
- Padding: 12px 14px.
- Drop shadow: `box-shadow: 0 2px 8px rgba(20, 12, 14, 0.25);` — same intensity as the token hover card. Tooltips need to read against a busy background; the shadow gives lift.

### Title

- Display type Lora, 14px, color `var(--gs-brand)` (forest green).
- Sentence case (e.g. "Reputation Tags", not "REPUTATION TAGS"). The header itself is already in small caps; the tooltip title is its sentence-case form.
- 4px margin-bottom.

### Body

- Crimson Text italic, 12px, line-height 1.55, color `var(--gs-ink)` (sepia).
- 1–3 sentences. The "1–2 sentences" prescription from Plan §12.6 is the target; up to 3 is acceptable for genuinely complex sections (Inner Conflict's completion rule is a legitimate edge case).
- 8px margin-bottom (or 0 if no page ref follows).

### Page reference (optional)

- 0.5px hairline rule above (`var(--gs-accent-2)`) at 6px padding-top.
- Crimson Text italic, 10px, letter-spacing 0.12em, color `var(--gs-accent-2)`.
- Format: "RULEBOOK · P. {N}" — small caps, with the page number. The "·" separator and the small-caps treatment matches the system's eyebrow conventions.
- Optional. Many tooltips don't need a page reference (especially homebrew sections).

### Arrow indicator

The tooltip carries a small triangular arrow pointing back to the header it's anchored to. The arrow:
- Sits centered (or near-centered) on whichever edge of the tooltip faces the header.
- 8px wide, 8px tall, paper-color triangle with a sage border.
- Implementation: two stacked CSS triangles, one for the border (slightly larger, sage) and one for the fill (paper, slightly inset to leave the border showing).

Default arrow position: bottom of the tooltip pointing down toward the header below. If the tooltip is below the header (because of viewport edge handling), the arrow flips to top. Same logic as the token hover card.

## Position-aware behavior

Same pattern as the token hover card (`17-token-hover-card.md`):

- Default position: above the header.
- Top clip: position below.
- Right clip: align right edge to header.
- Top + right clip: position below and align right.
- Bottom clip (rare for tooltips since they're triggered by sheet content, not canvas tokens): position above with downward growth.

Implementation can reuse the position calculator from the token hover card. One helper, two callers.

## Content authoring (lang/en.json)

All tooltip text lives in `lang/en.json` under the `GOODSOCIETY.tooltips.*` namespace. Each tooltip has up to two keys:

```json
{
  "GOODSOCIETY.tooltips.reputationTags.body": "Adjectives the world has begun to associate with this character. Three positive or three negative tags trigger a Reputation Condition.",
  "GOODSOCIETY.tooltips.reputationTags.pageRef": "RULEBOOK · P. 89"
}
```

The `body` key is required. The `pageRef` key is optional — if absent, the tooltip omits the reference section.

The tooltip's title is *not* a localization key — it's derived from the section header text itself, sentence-cased. (e.g. "REPUTATION TAGS" header → "Reputation Tags" tooltip title.) This avoids duplication and ensures the tooltip is always semantically tied to its header.

### Authoring style

Bodies should:
- Be 1–2 sentences when possible (3 only for genuinely complex rules).
- Use active voice.
- Paraphrase, not quote, the rulebook. The page reference is for users who want the exact rule text.
- Match the system's prose register: italic body, sentence-case prose, no em-dashes for bullet substitutes (use commas or rewrite).
- Avoid telling the user *what to do* ("click here to..."). The tooltip explains *what the section is*; the UI itself handles affordance.

Example acceptable: "Adjectives the world has begun to associate with this character."
Example unacceptable: "Click + add to give this character a new tag. Three of any polarity trigger a Reputation Condition."

The line between "explanation" and "instruction" is the tooltip's design constraint. Stay on the explanation side.

### Page reference style

Page refs use the format "RULEBOOK · P. 89" — small caps in the rendered tooltip. The localization value is stored in sentence case ("Rulebook · P. 89") and the CSS applies `text-transform: uppercase; letter-spacing: 0.12em;` as needed. Or store it in the format actually displayed; either approach works.

For homebrew sections, the page reference can point at a project journal entry instead: "Project · House Cloudcandle Houserules". For sections without a clear rulebook anchor, omit the page ref.

## Comprehensive tooltip catalog

This is the master list of every section header in the system that carries (or should carry) a tooltip. Use it as the implementation checklist for `lang/en.json` content authoring.

### Major Character sheet (`04-character-sheet.md`)

| Tooltip key | Header | Body (suggested) | Page ref |
|---|---|---|---|
| `reputationCriteria` | REPUTATION CRITERIA | Family-specific judgment that the world applies to all members of this house. Set on the Family sheet — read-only here. | rulebook · p. 92 |
| `reputationTags` | POSITIVE / NEGATIVE | Adjectives the world has begun to associate with this character. Three of one polarity triggers a Reputation Condition. | rulebook · p. 89 |
| `reputationMeter` | (the 3-pip meter) | Tracks tag count toward a Reputation Condition. Two filled pips means one more tag will trigger. | rulebook · p. 89 |
| `activeConditions` | ACTIVE CONDITIONS | Lasting social consequences earned by reputation. Each shapes how the world treats this character until lifted. | rulebook · p. 94 |
| `innerConflict` | INNER CONFLICT | Two opposing pressures. Mark a box on either side as your character acts. Completes at 6 total or 5 on one side. | rulebook · p. 98 |
| `completedConflicts` | COMPLETED CONFLICTS | Conflicts this character has resolved. Each grants an Expanded Backstory Action — a tool for shaping the story. | rulebook · p. 100 |
| `bioHeader` | (bio chips row) | Compact identity: age, peerage status, appearance, temperament given and taken. | rulebook · p. 67 |
| `desire` | DESIRE | What this character wants this cycle. Drives Novel Chapter scenes. May change at Upkeep when a desire-arc wraps. | rulebook · p. 71 |
| `notesObjectives` | NOTES & OBJECTIVES | Player-authored running notes. What is this character paying attention to? What would they like to accomplish next? | (no page ref) |
| `connections` | CONNECTIONS | Other characters this person has formed relationships with. Click any to open their sheet. | rulebook · p. 78 |
| `backstory` | BACKSTORY | The character's history. May grow over time as Expanded Backstory Actions reveal new chapters. | rulebook · p. 75 |
| `magicSkills` | MAGIC & SKILLS | Homebrew abilities tied to family bloodline or training. Casting plays an on-screen effect; some trigger persona changes. | (homebrew) |
| `adventurerSentiment` | ADVENTURER SENTIMENT | Pure flavor field. How does this character regard adventurers, freelancers, and the questing rabble? | (homebrew) |
| `resolveTrack` | RESOLVE | A character's determination to shape the story. Spend to do something difficult, harm another's interests, or compel them. | rulebook · p. 81 |
| `mtToggle` | MT | The Major Threshold marker. Spent to introduce or shape large narrative consequences. | rulebook · p. 84 |
| `monologueDot` | MONOLOGUE | Each cycle, this character may take one Inner Monologue — a scene revealing their true thoughts. Cleared at Upkeep. | rulebook · p. 103 |

### Connection sheet (`06-connection-sheet.md`)

| Tooltip key | Header | Body | Page ref |
|---|---|---|---|
| `connectionDescription` | DESCRIPTION | This connection's bio and personality. Authored by the GM, edited by the linked Major's owner if granted ownership. | rulebook · p. 78 |
| `impressions` | IMPRESSIONS | What this connection thinks of each Major they've encountered. Shapes how they behave when scenes unfold. | rulebook · p. 80 |
| `linkedMajor` | LINKED TO | The Major character this connection primarily belongs to. Most connections have one; some are shared. | (no page ref) |
| `publicTags` | PUBLIC TAGS | Visible labels that appear on the canvas hover card and in scene listings. Anyone in the world can see them. | (no page ref) |
| `hoverSummary` | HOVER SUMMARY | One-line elevator pitch shown when a player mouses over this character's token on the canvas. | (no page ref) |
| `connectionResolve` | RESOLVE | This connection's smaller resolve track. Default 1 of 5. Used in scenes where they're acting on their own interests. | rulebook · p. 81 |
| `personas` | PERSONAS | Alternate identities. Each carries its own name, portrait, and visibility overrides. Switch via the picker. | (homebrew) |

### Family sheet (`14-family-sheet.md`)

| Tooltip key | Header | Body | Page ref |
|---|---|---|---|
| `familyMotto` | HOUSE MOTTO | The house's declared values. Often invoked at toasts, weddings, and moments of family pressure. | (no page ref) |
| `familyOrigin` | ORIGIN | Whether this house is locally rooted (heir), newly arrived (new-arrival), or foreign. Shapes social standing. | rulebook · p. 67 |
| `heirStatus` | HEIR STATUS | Who's named to inherit. Contested or vacant statuses signal upcoming family drama. | (homebrew) |
| `uniqueNegativeRepCriteria` | UNIQUE NEGATIVE REPUTATION CRITERIA | A family-wide standard the world judges all members against. Failing it can drag the whole house down. | rulebook · p. 92 |
| `familyNotes` | NOTES · HISTORY | GM-only family history and behind-the-scenes context. Not visible to players. | (no page ref) |
| `memberMajors` | MEMBER MAJORS | The Major characters in this house. Click any to open. Each carries their own theme color. | (no page ref) |

### NPC sheet (`16-npc-sheet.md`)

| Tooltip key | Header | Body | Page ref |
|---|---|---|---|
| `npcDescription` | DESCRIPTION | This NPC's bio and personality. GM-only by default — promote to Connection if they become important. | (no page ref) |

(Other NPC sheet headers — Public Tags, Hover Summary, Personas — share tooltip keys with the Connection sheet equivalents.)

### Item sheets (`12-item-sheets.md`)

| Tooltip key | Header | Body | Page ref |
|---|---|---|---|
| `tagPolarity` | POLARITY | Positive ▲ for desirable traits, Negative ▼ for risky ones. Three of one polarity trigger a Reputation Condition. | rulebook · p. 89 |
| `tagDescription` | DESCRIPTION | What this tag means in play. Helps the GM and table understand the tag's narrative weight. | (no page ref) |
| `tagSource` | SOURCE | Where this tag came from — the scene or moment of play that earned it. Shows in the Upkeep review. | (no page ref) |
| `conditionActive` | (active toggle) | Whether this Reputation Condition is currently in effect. Auto-deactivates if source tag count drops below 3. | rulebook · p. 94 |
| `conditionSourceTags` | SOURCE TAGS | The reputation tags that triggered this condition. Removing one may deactivate the condition. | rulebook · p. 94 |
| `innerConflictLabel` | LEFT LABEL / RIGHT LABEL | The two abstract pressures pulling this character apart. Family vs. Independence, Ambition vs. Love, etc. | rulebook · p. 98 |
| `magicVfxKey` | VFX KEY | The Sequencer/JB2A asset path that plays when this skill is cast. Optional — falls back to a chat card if missing. | (homebrew) |
| `magicHidden` | HIDDEN | Whether this skill is hidden from the Public Info dashboard. Useful for secret abilities (Dixon's hidden magic). | (homebrew) |
| `magicPersonaSwap` | PERSONA SWAP | Casting this skill also switches the character to the named persona. Used for transformation skills like Alter Self. | (homebrew) |
| `backstorySource` | EARNED FROM | The Inner Conflict whose resolution earned this Backstory Action. Read-only — links to the source conflict. | rulebook · p. 100 |
| `backstoryStatus` | STATUS | Whether this action has been expanded into play and whether it's been used yet. Helps track unspent actions. | rulebook · p. 100 |

### Public Info Dashboard (`07-public-info-dashboard.md`)

| Tooltip key | Header | Body | Page ref |
|---|---|---|---|
| `dashboardMajors` | MAJOR CHARACTERS | All Major characters in the world, with their current resolve, MT, monologue state, and public desires. | (no page ref) |
| `gmBulkActions` | GM · | Bulk actions affecting all Majors at once. Confirmations are required — these moments are dramatic. | (no page ref) |

### My Characters Dock (`09-my-characters-dock.md`)

| Tooltip key | Header | Body | Page ref |
|---|---|---|---|
| `dockMajors` | MAJOR | The Major characters you own. State updates live as you and others play. Click any to open. | (no page ref) |
| `dockConnections` | CONNECTIONS | Connections currently assigned to you. The GM can promote shared-pool Connections to your ownership any time. | (no page ref) |
| `speakingAs` | SPEAKING AS | Whose voice your chat will appear as. Switching here updates both this dock and the chat input. | (no page ref) |

### Cycle Phase HUD (`08-cycle-phase-hud.md`)

| Tooltip key | Header | Body | Page ref |
|---|---|---|---|
| `cycleNumber` | (cycle counter) | The current cycle of play. Each cycle ends with Upkeep before a new one begins. | rulebook · p. 111 |
| `phaseTrack` | (phase markers) | The six phases of a cycle: pre-cycle, novel, reputation, rumour & scandal, epistolary, upkeep. | rulebook · p. 111 |

### Persona switcher (`13-persona-switcher.md`)

| Tooltip key | Header | Body | Page ref |
|---|---|---|---|
| `personaPicker` | PERSONA | This character's current identity. Click to switch — token, portrait, name, and chat color all update. | (homebrew) |
| `visibilityOverrides` | VISIBILITY OVERRIDES | Per-persona overrides for desire, backstory, and magic visibility. Lets one character hide more from one identity than another. | (homebrew) |

### Reputation flow (`18-condition-picker.md`)

| Tooltip key | Header | Body | Page ref |
|---|---|---|---|
| `conditionPicker` | REPUTATION THRESHOLD | A condition picker for choosing which Reputation Condition to apply at the 3-tag threshold. | rulebook · p. 94 |

### Other surfaces

| Tooltip key | Surface | Body | Page ref |
|---|---|---|---|
| `revealControl` | REVEAL CONTROL | Flip a field's visibility for one or more characters. Reveals are logged and broadcast — choose deliberately. | (no page ref) |
| `npcOrganizer` | SCENE TOKENS | Connection and NPC tokens currently placed on this scene. Click to focus the camera; right-click for actions. | (no page ref) |

The catalog is approximately 50 tooltip keys covering the system's section headers. Each is a small text snippet — the total localization burden is roughly 1500-2000 words of authored copy across all keys.

## Theme behavior

Tooltips are **pure house style**, never themed. Reasoning: tooltips are system-level explanations belonging to the engine, not character voices. A tooltip on Avril's sheet about "Inner Conflict" reads identically to a tooltip on Rose's sheet about "Inner Conflict" — the rule is the rule, not Avril's interpretation of it.

The header that *triggers* the tooltip is themed (it sits inside a themed sheet), but the tooltip itself uses house style.

## Edge cases

### Missing tooltip key
If `data-tooltip-key` points at a key that doesn't exist in `lang/en.json`, no tooltip renders. The hover does nothing. (Don't show a "tooltip not found" placeholder — that's developer error, not user-facing content.)

### Tooltip key exists but body is empty
Same — no tooltip. The body is required content.

### Tooltip overflows viewport
The position-aware logic handles this (mirroring the token hover card). If repositioning still doesn't fit, the tooltip clips with a small ellipsis indicator at the cut edge. Click-to-dismiss reveals the full content via the page reference.

### Header changes mid-hover
If the underlying section header re-renders during a hover (e.g. an actor update), the tooltip dismisses. Re-hover triggers a fresh tooltip with the current state.

### Multiple section headers visible simultaneously
Only the hovered one shows a tooltip at a time. Moving between headers cancels the previous tooltip's delay timer and starts a new 600ms (or instant if dwell-mode is active).

### Touch devices
Mobile/tablet users don't hover. **Tentative answer: tap the `?` glyph to show the tooltip.** Tap-and-hold doesn't work in Foundry's iframe context reliably. Tap-to-toggle is the practical alternative. Defer the touch experience to v1.1 if it proves complicated.

### Long tooltip body
The tooltip's max-height is 240px (about 8 lines). Longer content scrolls inside the tooltip. But the design ideal is to keep all bodies under 3 sentences, so scrolling should be rare.

### Tooltips inside modals (Upkeep Wizard, Condition Picker, etc.)
Modals can have section headers too. The tooltip system works inside modals — same `data-tooltip-key` attribute, same render behavior. The tooltip simply renders at a higher z-index than the modal backdrop.

## Implementation notes for Claude Code

When prompted to build the tooltip system:

1. Build the `RuleTooltip` `Application` (lightweight — not v2). It accepts a target element + tooltip key, renders to a layer above sheets/modals, positions itself.
2. Build the global hover handler. Subscribes to `mouseenter` / `mouseleave` on `[data-tooltip-key]` elements via event delegation. Implements the 600ms delay (with dwell-mode bypass).
3. Build the `?` glyph as a CSS pseudo-element on `[data-tooltip-key]` elements. Auto-applied — no per-header markup needed.
4. Author all tooltip keys in `lang/en.json` per the catalog above. Start with the Major Character sheet keys (most-used) and expand.
5. Add `data-tooltip-key` attributes to every section header partial (`templates/partials/*.hbs`).

CSS organization:
- `styles/components/_rule-tooltip.css` — the tooltip's visual styling
- `styles/components/_section-header.css` — augment with the `?` glyph + `data-tooltip-key` styling

### Test path

1. Hover the "REPUTATION TAGS" header on Lady Rose's Major sheet. Verify the tooltip appears after 600ms with the right title and body.
2. Hover several headers in sequence. Verify the dwell-mode bypass — second tooltip onward appears immediately.
3. Open Avril's sheet (different theme). Hover the same header. Verify the tooltip looks identical (house style, not Avril's theme).
4. Open the Upkeep Wizard. Hover the section header in step 5 (Reputation review). Verify the tooltip renders correctly inside the modal.
5. Hover near the right edge of a sheet. Verify the tooltip flips to align right.
6. Close all sheets. Verify any open tooltip dismisses.
7. Edit `lang/en.json` to remove a body key. Hover that header. Verify no tooltip renders (no error).
8. Touch test (if mobile) — tap the `?` glyph. Verify the tooltip toggles.

If 1–8 pass, the tooltip system is production-ready.

## Open questions

1. **Should the `?` glyph appear on every tooltip-bearing header, or only on first-load until dismissed?** Constant glyph = always discoverable; first-load-only = less visual noise after orientation. **Tentative answer: always visible**, with a user setting to hide them after orientation. The setting can be added later if requested.

2. **Should tooltips support inline links?** E.g. "See [Reputation Conditions](link to other tooltip)." **Tentative answer: no for v1.** Tooltips reference rulebook page numbers; cross-referencing other tooltips would require additional logic and isn't necessary.

3. **Should there be a "tooltip pin" affordance?** Click the tooltip to keep it pinned open. Useful for re-reading. **Tentative answer: defer to v1.1.** The 600ms delay + dwell-mode bypass is enough for most use cases.

4. **Should there be a global "tooltips off" setting?** Some experienced GMs may want to suppress all tooltips. **Tentative answer: yes, via user setting `tooltipsEnabled` (default true).** Disabling hides the `?` glyph and suppresses all hovers.

5. **Should tooltips auto-translate as `lang/en.json` is the only locale shipped?** I.e. should other locales fall back to English if a key is missing in their language? **Tentative answer: yes**, Foundry's standard `i18n.localize` already does this. No extra handling.

6. **Should the catalog table be split per-sheet for easier maintenance?** Or stay in one big `tooltips.md` doc? **Tentative answer: keep in one doc** for now (it's the design canon). Localization files are split per-language but the *catalog* of which keys exist is single-source.

7. **Should homebrew tooltip page refs link to a homebrew journal entry instead of "(homebrew)"?** **Tentative answer: yes**, when the homebrew rules are authored as journal entries. For now, "(homebrew)" is a placeholder.

## Visual proof

Two visualizations are rendered above (`good_society_in_sheet_rule_tooltips`):

1. **Tooltip in context** — a section header on a Major sheet (Lady Rose's Reputation Tags grid) with the tooltip floating above. Shows the small `?` glyph next to the header, the tooltip's positioning arrow pointing back to the header, and the full content (title + body + page ref).
2. **Three tooltip examples** — short (Resolve Tokens, no page ref), medium (Inner Conflict, with page ref), long (Reputation Conditions, with page ref). Demonstrates the range of content lengths and shows that the design holds across all three.

Validates: tooltip layout, the `?` glyph as a discoverability cue, the page ref's small-caps treatment, the drop shadow that gives the tooltip lift.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Tooltip primitive specified (visual, behavior, position). Content authoring conventions specified (lang/en.json structure, prose register). Comprehensive tooltip catalog provided covering ~50 section headers across all sheets, modals, and persistent surfaces. Visual proof rendered with three content-length examples plus an in-context proof. |
