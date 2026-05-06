# 26 — Pending Changes Log

**Status:** Locked — full inline section specified, click-through to source spec'd
**Date opened:** 2026-05-05
**Covers:** Plan §12.3 small per-sheet feature (new inventory entry, also referenced in `04-character-sheet.md` and `11-upkeep-wizard.md`)

## Goal

Specify the inline "Since last Upkeep" section on the Major sheet's Public tab. Surfaces the same `actor.system.reputation.pendingChanges` array that the Upkeep Wizard's Reputation Review step uses (per `11-upkeep-wizard.md`) — but inline on the sheet, between Upkeeps, so players can see at any time what reputation events are accumulating toward the next review.

This is a small but valuable per-sheet feature. Without it, players have to wait for Upkeep to see what their character has been "marked with" since the last reset. With it, the sheet itself shows the running tally, providing context for in-cycle decisions ("I've already been called Naïve once this cycle — should I lean into Composed?").

## Where it lives on the Major sheet

The section sits in the Public tab body, between the Reputation Tags grid and the Inner Conflict section. It only renders when there are pending changes — empty state collapses entirely, leaving no gap.

In the Public tab spec from `04-character-sheet.md`, the section ordering becomes:

1. Reputation Criteria (read-only from Family)
2. Reputation Tags grid (positive/negative)
3. Active Conditions
4. **Pending Changes Log** ← new section (only when non-empty)
5. Inner Conflict (active)
6. Completed Conflicts

When the section is empty (most cycles start this way), step 4 is skipped — the Public tab flows from Active Conditions directly to Inner Conflict. No empty placeholder.

## Layout

```
┌──────────────────────────────────────────────┐
│ SINCE LAST UPKEEP · 3      cleared on Upkeep ack│
│                                                  │
│ ▲ Restrained   refused Roger's carnival   scene 4│
│ ▲ Dutiful      chose duty over desire   rep phase│
│ ▼ Naïve        trusted Lord Vesper        scene 7│
└──────────────────────────────────────────────┘
```

CSS class root: `.gs-pending-changes-log`

### Container

- Background: themed `var(--gs-paper-warm)` (slightly raised from the Public tab body's `var(--gs-paper)`).
- 0.5px border in `var(--gs-accent-3)` (honey-gold — small ceremonial cue that this is "the running tally that matters").
- `border-radius: 8px`.
- Padding: 18px 22px.
- Margin: 0 below (the Inner Conflict section provides its own top spacing).

### Header row

- Display: `flex; justify-content: space-between; align-items: baseline;`
- Margin-bottom: 12px.

Left side: section eyebrow with count.
- Format: "SINCE LAST UPKEEP · {N}" in 12px small caps, letter-spacing 0.16em, color `var(--gs-brand)` (theme primary).

Right side: small italic helper text.
- Format: "cleared on Upkeep acknowledge" in 10px italic, color `var(--gs-accent-3)`.
- Subtle reminder that this list isn't growing forever — Upkeep clears it.

### Entry row

Each pending change is one row.

- Display: `display: grid; grid-template-columns: 90px 1fr auto; gap: 10px; align-items: baseline; padding: 6px 12px;`
- Background: `var(--gs-paper-warm-deeper)` (one shade darker than the container — soft inset).
- 2px left-edge accent stripe in polarity color: `var(--gs-positive)` for ▲, `var(--gs-danger)` for ▼.
- `border-radius: 6px`.
- Margin-bottom: 6px (or 0 for the last entry).
- Cursor: pointer (rows are clickable — see Click behavior below).

### Entry content

Three columns:

#### Column 1 (90px) — polarity arrow + tag name

- Display: `flex; align-items: baseline; gap: 6px;`
- Polarity arrow: 12px, themed display font, color matching polarity.
- Tag name: 13px display type (Cormorant for Rose, Didot for Avril, etc.), color `var(--gs-ink)`.

#### Column 2 (flex 1) — source context

- Italic body type, 11px, line-height 1.4, color `var(--gs-ink)` (slightly muted via opacity 0.85).
- Concise — typically 4-8 words. The source field on the Reputation Tag item provides this.
- Truncates with ellipsis if too long.

#### Column 3 (auto) — phase/scene

- Italic body type, 9px, color `var(--gs-accent-3)` (honey).
- Format: "scene 4" or "rep phase" or similar — pulled from the change's source phase metadata.
- White-space: nowrap.

## Click behavior

Clicking a row opens the source chat message in a small popover. The chat message is the original event ("Lady Rose gained ▲ Restrained — Scene 4: refused Roger's carnival") posted at the time the tag was added.

This is the lightweight "revisit the moment" affordance — the same one the Upkeep Wizard's reputation review uses. Players can quickly trace a reputation tag back to its scene without scrolling through the chat log.

Hover shows a subtle border emphasis (0.5px `var(--gs-accent-3)` on the row) to signal clickability.

## Theme behavior

Themed via the parent sheet's `.gs-themed[data-theme="..."]` wrapper. Inherits the Major's full theme — the section's accent stripes use theme polarity colors (which map back to `var(--gs-positive)` and `var(--gs-danger)` — these usually stay close to verdant and oxblood across themes, but Mags and Avril have darker palette renderings).

The polarity-color accent stripes are the cross-cutting visual signal — even in a heavily-themed sheet (like Avril's dark candlelight), the green/red accent on each entry remains the at-a-glance polarity cue.

## Edge cases

### Many pending changes (10+)
The section grows vertically. No internal scroll — let the Public tab scroll naturally if needed. Most sessions generate 2-5 changes per character; 10+ is rare and signals an upcoming Upkeep is overdue.

### Same tag added and removed within a cycle
The pending log shows both events: one "gained" entry and one "lost" entry. The order reflects when each fired. Net-zero effect on the actor's tag count, but the events are part of the narrative record.

### Pending changes from a different character (e.g. someone added a tag to this Major)
The events show the same regardless of who added them. The source context describes the action; the actor receiving the tag has no fingerprint distinguishing "self-acquired" from "other-acquired" tags.

### Source chat message has been deleted
Clicking the row falls back to a small toast: "Source chat message no longer available." The pending change entry still shows in the log; only the click-through fails gracefully.

### Cleared mid-display by Upkeep wizard
If the GM advances cycle to Upkeep and the player completes the wizard, the pending log clears. Any open Major sheets re-render to remove the section. No empty placeholder; the section just disappears.

## Accessibility considerations

- Each row has an `aria-label`: "Gained Restrained tag, refused Roger's carnival, scene 4. Click to open source message."
- Tab navigation through rows; Enter activates the click action.
- Polarity color is paired with the arrow glyph — color isn't the sole signal.

## Implementation notes for Claude Code

When prompted to build:

1. Add a new partial: `templates/components/pending-changes-log.hbs`. Renders the section conditionally (when `actor.system.reputation.pendingChanges.length > 0`).
2. Wire the section into the Major sheet's Public tab template (`templates/actors/major-character/tab-public.hbs`), positioned per the section ordering in this doc.
3. Wire the row click handler to open the source chat message via `ChatMessage.get(message.id)._render({force: true})` or similar.
4. Wire reactivity: the section re-renders when `actor.system.reputation.pendingChanges` changes (Foundry's standard sheet update flow).

CSS organization:
- `styles/components/_pending-changes-log.css` — section and entry styling

### Test path

1. Start with Lady Rose having no pending changes. Verify the section doesn't render.
2. Add a positive tag. Verify the section appears with one entry.
3. Add two more (one positive, one negative). Verify three entries.
4. Click a row. Verify the source chat message opens.
5. Complete Upkeep on Lady Rose. Verify the section disappears (cleared by Upkeep wizard's "acknowledge" action).
6. Verify the section's polarity-color accents render correctly in different themes (test with Rose, Avril, Dixon, Mags).

If 1–6 pass, the pending changes log is production-ready.

## Open questions

1. **Should the log show changes from previous cycles too (a longer historical view)?** **Tentative answer: no, current cycle only.** The Pending Changes Log is specifically about "since last Upkeep." For deeper history, players read the Session Logs.

2. **Should the log entries be editable (e.g. GM can adjust the source text)?** **Tentative answer: no.** Entries are auto-generated records. GM editing of the underlying tag's source field is the right place for adjustments.

3. **Should removed-tag entries appear differently from gained-tag entries?** Currently same row format with the polarity arrow indicating direction. **Tentative answer: yes, removed entries get a small ↓ indicator** in front of the tag name and italicize the tag name (e.g. "↓ ▲ *Restrained*"). Visual cue that the tag was lost, not gained.

4. **Should the log show condition adds/removes too, or just tag changes?** **Tentative answer: tag changes only for v1.** Conditions appear in the Active Conditions section directly; log churn from condition changes would muddy the tag-focused log.

## Visual proof

The Pending Changes Log section is rendered above (`good_society_final_three_designs`, middle section) showing three pending changes for Lady Rose: two positive (Restrained from Scene 4, Dutiful from Reputation phase) and one negative (Naïve from Scene 7), each with source context and phase metadata. The section's honey-gold border and polarity accent stripes visually distinguish it from the surrounding sheet sections.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Inline section spec'd including container, header, entry rows, click-through to source, edge cases. Visual proof rendered. |
