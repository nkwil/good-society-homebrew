# 11 — Upkeep Wizard

**Status:** Locked — six-step wizard specified, GM roster view specified, completion progression rules specified
**Date opened:** 2026-05-05
**Covers inventory entry:** #17 Upkeep Wizard

## Goal

Specify the Upkeep Wizard (Plan §12.2). When the GM advances the cycle into Upkeep phase, every player's owned Major(s) get a guided modal that walks through resolve refresh → monologue prompt → notes update → desire check → reputation review → completion confirmation.

The wizard turns Upkeep from "did everyone remember to do the things" into a guided 60-second checklist. Plan §12.2 calls it "the single most impactful QoL feature for actual play."

It's also the one screen in the system that touches almost every mechanical surface — resolve, MT, monologues, notes, desire, reputation. Getting it right means the game's most administrative phase becomes a pleasant ritual rather than an interruption.

## When and how it opens

Triggered automatically when the world's `cyclePhase` setting changes to `upkeep`. For each Major actor with a connected user (the user is online), the wizard opens on that user's screen as a modal.

If the user owns multiple Majors, they get the wizard sequentially — finish one Major's Upkeep, then the next opens. The order matches the My Characters Dock sort.

The GM never gets a wizard for their own owned Majors automatically; instead, they get the **GM Roster View** (see below) showing every player's progress and the option to manually open any Major's wizard.

If a user is offline when Upkeep begins, their wizard opens the next time they connect (during the same Upkeep phase). If the phase advances out of Upkeep before they connect, their wizard is dismissed — they missed it. The GM can manually trigger it from the Roster View if needed.

### Why this design

The wizard is per-Major, not per-player. A player with two Majors has two distinct Upkeep moments — one for each character's headspace. Cramming both into a single dialog would dilute the per-character ritual.

## Per-player wizard structure

CSS class root: `.gs-upkeep-wizard`

Modal sized 580px wide, height auto. Sits on a 45% opacity ink-tone backdrop. Themed to the active Major (using the same `.gs-themed[data-theme="..."]` wrapper as everything else).

```
┌─ Upkeep · {Character Name} ──── step N of 6 ─┐
│                                                │
│ [step indicator ribbon — 6 dots with labels]  │ ← header
├────────────────────────────────────────────────┤
│                                                │
│ [step content varies]                         │ ← body
│                                                │
├────────────────────────────────────────────────┤
│  [back]              [skip]      [next ↗]     │ ← footer
└────────────────────────────────────────────────┘
```

### Header

- Background: `var(--gs-paper)`.
- Padding: 18px 26px.
- 0.5px bottom border in `var(--gs-accent-3)`.
- Top row, justified:
  - Left stack: eyebrow "UPKEEP · cycle {n} close" in 11px small caps, letter-spacing 0.18em, color `var(--gs-brand)`. Below: character name in display type 22px, `var(--gs-brand)`.
  - Right: italic "step {N} of 6" in 11px, color `var(--gs-accent-3)`.
- Below the top row: the **step indicator ribbon** (see next).

### Step indicator ribbon

Six step markers connected by hairline rules:

```
●─welcome  ●─tokens  ●─notes  ●─desire  ◉─REPUTATION  ○─done
```

- Completed steps: 9px filled circle in `var(--gs-brand)`. Step name beside in italic 10px `var(--gs-accent-3)`.
- Current step: a pill (theme `var(--gs-brand)` background, `border-radius: 100px`, padding 3px 9px) with a 9px paper-filled circle and the step name in display type 11px paper color. Same visual idiom as the Cycle Phase HUD.
- Future steps: 9px outlined circle in `var(--gs-accent-3)`. Step name in italic 10px `var(--gs-accent-3)`.
- Connectors: 0.5px lines between markers, 0.3 flex weight (not too long, not too short). Completed segments use `var(--gs-brand)`; future segments use `var(--gs-accent-3)`.

The ribbon serves three purposes: shows current progress, hints at what's coming, and gives the player a sense of "I'm almost done."

### Body

Padding: 24px 28px. Background: `var(--gs-paper)`.

Each step has:
- A title (display type, 20px, color `var(--gs-brand)`).
- A short italic prompt (1–2 sentences, color `var(--gs-accent-3)` or muted ink) that sets the tone and explains what's being asked.
- Step-specific content — see each step's spec below.
- An optional summary line at the bottom giving feedback ("3 changes acknowledged", "monologue posted", etc.).

### Footer

- Background: `var(--gs-paper-warm)`.
- Padding: 16px 26px.
- 0.5px top border in `var(--gs-accent-3)`.
- Three buttons:
  - **back**: secondary outline button on the left. Disabled on step 1.
  - **skip**: secondary outline in the center-right. Skips the current step without acting on it. Hidden on the welcome and complete steps; visible but discouraged on tokens/notes/desire/reputation.
  - **next ↗ / acknowledge ↗ / complete ↗**: primary filled button on the far right. The label changes per step ("acknowledge" on reputation, "complete upkeep" on the final step).

## Step 1 — Welcome

### Purpose

Set the tone. Name the character. Make the player feel like Upkeep is a moment, not a chore.

### Body

- Title: "It is Upkeep, Lady Rose." (Or "It is Upkeep, Sir." / "It is Upkeep, Avril." — uses character first name and an honorific where appropriate. Pulled from bio.)
- Italic prompt: "A breath between cycles. Let us tend to the close together."
- Below the prompt, a small summary card (soft-paper bg) showing the character's state at the start of Upkeep:
  - Resolve: 1 of 5
  - Monologue: not yet taken
  - Reputation changes pending review: 3
  - Inner conflict status: 4 of 6 boxes filled (active)
  - Notes last updated: 2 cycles ago
- Button label on next: "begin ↗".

This step doesn't change anything — it's a pause-and-orient screen. Skip is hidden (you can't skip your own welcome).

## Step 2 — Tokens

### Purpose

Refresh resolve to the default starting value (game setting, default 3). Prompt for monologue if the character hasn't yet monologued this cycle.

### Body

Title: "Tokens"
Italic prompt: "Resolve is restored. The cycle begins again."

Two sub-cards:

**Resolve card:**
```
┌─────────────────────────────────────────┐
│ RESOLVE                                   │
│ current: 1 of 5    →    after: 3 of 5     │
│ ●○○○○                    ●●●○○            │
│ [refresh resolve]                          │
└─────────────────────────────────────────┘
```
- Shows current resolve track on the left, target on the right with a → arrow.
- A "refresh resolve" button (primary). Click → updates `tokens.resolve.current` to the default starting value. The card collapses to a green "✓ Refreshed to 3 of 5" confirmation.
- If the player has manually adjusted resolve recently (it's already at 3 or higher), the button is replaced by italic "Already at default. Continue." and the card collapses immediately.

**Monologue card:**
```
┌─────────────────────────────────────────┐
│ MONOLOGUE TOKEN                           │
│ Lady Rose has not yet taken her monologue │
│ this cycle. The token expires on advance. │
│                                            │
│ [take monologue now]   [let it expire]    │
└─────────────────────────────────────────┘
```
- If `monologuedThisCycle === false`: shows a prompt with two actions. "take monologue now" opens the Inner Monologue editor (see `10-chat-cards.md`); on post, the card collapses to "✓ Monologue posted." "let it expire" sets `monologuedThisCycle = true` without posting and the card collapses to "○ Token expired (no monologue this cycle)."
- If `monologuedThisCycle === true`: shows a quiet confirmation: "✓ Monologue already taken this cycle." No action.

After the user has resolved both sub-cards, the next button enables. Skip is allowed but discouraged ("Skip refresh? Resolve will not be restored." confirm dialog).

## Step 3 — Notes & Objectives

### Purpose

Encourage the player to update their character's running notes and objectives. This is where players plan what they want to do next cycle.

### Body

Title: "Notes & Objectives"
Italic prompt: "Where is Lady Rose, in herself? What does she want to do next?"

A larger HTML editor (Foundry's `editor` helper, themed with the actor's body type and ink color). Pre-populated with the existing `notesObjectives` field. The player can edit inline.

Below the editor, a small "last updated {N} cycles ago" indicator in italic muted, helping the player see if they've been neglecting this field.

Skip is allowed — not every cycle warrants notes updates.

## Step 4 — Desire

### Purpose

Prompt the player to reconsider their character's current desire. Per Plan §6.1 and the Good Society rules, a desire can be replaced if a story arc has wrapped up.

### Body

Title: "Desire"
Italic prompt: "Has Lady Rose's desire shifted? Or does it still drive her?"

Current desire card:
```
┌─────────────────────────────────────────┐
│ CURRENT DESIRE                            │
│ "to please her father"                    │
│                                            │
│ visibility: ◉ public                      │
└─────────────────────────────────────────┘
```

Two actions:
- **Keep** — primary on the right. Click → moves to next step.
- **Change** — secondary inline. Click → expands the card with a textarea to write a new desire. On save, the old desire is archived (Plan §12.4 inner monologue ceremony pattern: a small chat card posts to the log: "Lady Rose has set aside her desire 'to please her father' and now seeks 'to be plainly understood.'"). The card collapses to the new desire.

Skip allowed (defaults to keep).

The visibility indicator is interactive (per `04-character-sheet.md` Private tab pattern) — click to flip secret/public/redacted with confirm.

## Step 5 — Reputation review

### Purpose

Walk the player through every reputation change since the last Upkeep, using the `reputation.pendingChanges` log (Plan §12.3, schema in CLAUDE.md §6.1). Acknowledging clears the pending log.

### Body

Title: "Reputation since the last Upkeep"
Italic prompt: "A small audit of how the world has come to think of you. Acknowledge each change, or click to revisit the moment that earned it."

A list of pending change cards, one per entry in `pendingChanges`. Each card:

- Soft-paper background (`var(--gs-paper-warm)`).
- 2.5px left-edge accent stripe in `var(--gs-positive)` (gained-positive), `var(--gs-danger)` (gained-negative), or `var(--gs-accent-2)` (removed-tag).
- Top row: polarity arrow (▲/▼) + tag name in display type 16px + change kind ("gained" / "removed") in italic small-caps 11px + scene context badge on the right (italic 10px, e.g. "scene 4", "reputation phase").
- Below: italic 12px description of *why* — pulls from the change's source field. This is the moment-in-play that earned the change. Hovering shows the timestamp.
- Click the card → opens the originating chat message (if available) in a small popover, so the player can revisit the actual scene.

Below the list, a summary line: "Three changes this cycle. The reputation meter shifts: ●●○ positive · ●○○ negative." This previews how the reputation meter will read going into the next cycle.

The next button changes label to "acknowledge ↗" — clicking it clears `pendingChanges` and proceeds. Skip clears nothing (the changes stay pending until next Upkeep — usually undesirable).

If `pendingChanges` is empty, this step shows a quiet "No reputation changes this cycle. Nothing to review." and the next button advances immediately.

## Step 6 — Complete

### Purpose

Summarize what was done. Mark Upkeep complete for this Major. Quietly affirming.

### Body

Title: "Upkeep complete for Lady Rose."
Italic prompt: "Until the cycle resumes."

A summary list of what happened this Upkeep:
```
✓ Resolve refreshed to 3 of 5
✓ Monologue posted to chat
✓ Notes & Objectives updated
○ Desire unchanged ("to please her father")
✓ 3 reputation changes acknowledged
```

Each line: small ✓ glyph (`var(--gs-positive)`) for actions taken, ○ glyph (`var(--gs-accent-3)`) for skipped or no-op steps. Plain body type, 13px.

Below the summary, optionally:
- "Inner conflict standing: 4 of 6 boxes filled (active)" if there's an active conflict — a small reminder of where they stand mechanically going into the next cycle.
- A "frame a small reflective scene" prompt if any inner conflict completed during this cycle — points at the existing completion ceremony chat card (per `10-chat-cards.md`).

The footer's primary button reads "complete upkeep ↗". Click → marks `upkeepCompletedAt = {timestamp}` on the actor (a flag the GM Roster View reads), closes the modal, and posts a quiet system chat card: "Lady Rose Willowood has completed Upkeep."

If the user has another Major waiting for Upkeep, that Major's wizard opens automatically after a 600ms delay (gives the close-confirmation a beat to land).

## GM Roster View

CSS class root: `.gs-upkeep-roster`

When the GM advances into Upkeep phase, instead of getting their own wizard, they get a roster view showing every Major's Upkeep status.

### Layout

```
┌─ Upkeep · cycle 3 close ──────────────────────┐
│ Track everyone's progress before advancing     │
├────────────────────────────────────────────────┤
│                                                  │
│ ┌─[R]─ Lady Rose Willowood ───────── ✓ done   │
│ ┌─[R]─ Roger Willowood ───────── ◉ in progress │
│ ┌─[A]─ Avril Eclair ──────────────── ○ waiting │
│ ┌─[D]─ Dixon Cloudcandle ─────── ○ user offline│
│ ┌─[C]─ Clayton Trotwood ─────── ◉ in progress  │
│                                                  │
├────────────────────────────────────────────────┤
│ 1 of 5 complete · 2 in progress · 1 offline    │
│              [advance to next cycle ↗]           │
└────────────────────────────────────────────────┘
```

Width: 600px. Height: auto.

### Roster row

Each Major gets one row, similar to the dashboard rows but with a status indicator instead of state widgets.

- Background: `var(--gs-paper-warm)` (house). 0.5px left-edge accent in the character's `var(--gs-brand)` (themed via wrapper).
- Portrait + name + role on the left (same primitives as the dashboard).
- Status indicator on the right:
  - **✓ done** in `var(--gs-positive)` — Upkeep completed. Italic timestamp ("3m ago").
  - **◉ in progress** in `var(--gs-accent-3)` — wizard is open and being worked through.
  - **○ waiting** in `var(--gs-accent-2)` — wizard hasn't been opened yet.
  - **○ user offline** in `var(--gs-accent-2)` — owning user isn't connected.
- Click a row → opens that Major's wizard *for the GM* (so they can complete it on the player's behalf if needed). Confirms: "Open Lady Rose's Upkeep wizard? Changes will be attributed to you."

### Footer

- Live count: "{N} of {M} complete · {N} in progress · {N} offline".
- Primary button: "advance to next cycle ↗". Disabled until either:
  - All online Majors have completed Upkeep, OR
  - The GM clicks an explicit "advance anyway" override (with a confirm: "{N} player(s) haven't completed Upkeep. Advance anyway?").

The advance button advances the world's `cyclePhase` to `pre-cycle` (or directly to `novel` if pre-cycle is skipped) and increments `cycleNumber`. This fires the standard phase-change chat card.

## Theme behavior

The wizard chrome is themed to the active Major (entire modal wrapped in `.gs-themed[data-theme="..."]`). This is intentional — the player should feel like Upkeep is happening *with* their character, not in a system box.

The GM Roster View is house-styled chrome with hybrid per-row character accents (same pattern as the Public Info Dashboard).

## Edge cases

### User has multiple Majors
Wizards open sequentially. Order matches My Characters Dock sort (family + creation date). After completing one, the next opens with a 600ms gap.

### Cycle advanced out of Upkeep before user finishes
The wizard auto-saves progress (per-step completion is stored in actor flag `upkeepProgress`). If the cycle advances back to Upkeep later, the wizard resumes where left off. If the cycle advances to a non-Upkeep phase, any unfinished wizard dismisses with a quiet "Upkeep ended before you finished. Resume next cycle?" toast.

### Player declines to take monologue
The "let it expire" path is supported. The token is marked as spent without posting. This is the canonical Good Society "use it or lose it" behavior.

### No pending reputation changes
Step 5 shows a quiet placeholder and advances immediately. Doesn't block.

### Inner conflict completed mid-cycle
Step 6's summary mentions it: "An inner conflict was resolved this cycle (Family vs. Independence — Family). The Backstory Action awaits." Points at the completion ceremony's chat card.

### Major has no theme
The wizard falls back to house style. Rare — most Majors will have themes assigned.

### GM tries to advance phase before all wizards complete
The advance button confirms: "{N} of {M} Upkeep wizards still open. Advance anyway?" If they confirm, the open wizards dismiss with the "ended before you finished" toast.

### Player's wizard opens but they close it without completing
The wizard saves progress to `upkeepProgress` flag. When they reopen the actor sheet (or rejoin), a small banner appears: "Upkeep is incomplete. [Resume ↗]"

## Implementation notes for Claude Code

When prompted to build this wizard, the recommended order:

1. Build the wizard `ApplicationV2` skeleton — opens, closes, accepts a Major actor reference, themes itself.
2. Build the step indicator ribbon as a reusable partial (six markers + connectors). Test it with hardcoded current-step values.
3. Build the welcome step. Verify the modal opens themed to the right character.
4. Build the tokens step (resolve refresh + monologue prompt). This wires up the resolve update and integrates with the Inner Monologue editor from `10-chat-cards.md`.
5. Build the notes step. Integrates with Foundry's HTML editor.
6. Build the desire step. Wires up the desire-change archival chat card.
7. Build the reputation review step. Reads from `pendingChanges`, renders cards, clears on acknowledge.
8. Build the complete step. Renders the summary, sets `upkeepCompletedAt`, closes.
9. Build the GM Roster View as a separate `ApplicationV2`.
10. Wire the trigger: when `cyclePhase` becomes `upkeep`, open the wizard for each connected user's owned Majors; show the roster for the GM.

CSS organization:
- `styles/apps/_upkeep-wizard.css` — modal chrome, step ribbon, footer
- `styles/components/_upkeep-step.css` — step body container
- `styles/apps/_upkeep-roster.css` — GM roster view
- Reuse: `_phase-marker.css` (the step ribbon uses the same primitive as the Cycle HUD)

### Test path

1. Set `cyclePhase` to `upkeep` via the Foundry console. Verify the wizard opens for the active user, themed to their owned Major.
2. Walk through all six steps. Verify each step's content renders, the footer buttons behave correctly, and the step indicator advances.
3. On the tokens step, click "take monologue now". Verify the Inner Monologue editor opens themed; post the monologue; verify the wizard's monologue card collapses to "✓ Monologue posted".
4. On the reputation step, verify each pending change card renders correctly and "acknowledge" clears the log.
5. Complete the wizard. Verify `upkeepCompletedAt` is set and the GM Roster View row updates.
6. As GM, click a player's row to open their wizard. Verify the confirm dialog and that opening still works.
7. Click "advance to next cycle" with one player offline. Verify the confirm. Confirm. Verify cycle advances and offline player gets the "ended before you finished" toast on reconnect.

If 1–7 pass, the wizard is production-ready.

## Open questions

1. **Should the wizard be opt-out per-user?** Some experienced players may want to skip the wizard entirely and use the sheet directly. **Tentative answer: yes, via a user setting `upkeepWizardEnabled` (default true).** If disabled, the user just gets a small "Upkeep is now active" toast and is expected to refresh resolve etc. manually.

2. **Should the "frame a reflective scene" prompt at the end of an inner-conflict-completed cycle be enforced or suggested?** **Tentative answer: suggested only.** Forcing reflection would feel coercive. The prompt makes it easy; players can decline.

3. **Should reputation changes also include impressions changes?** Connections form impressions about Majors over time. Should those changes appear here? **Tentative answer: no for v1.** Impressions are GM-controlled and rarely change between Upkeeps. If they do, surface them in a separate review pass.

4. **Should the wizard support undo within a session?** E.g. "I clicked acknowledge but I want to revisit." **Tentative answer: no.** Adds complexity. If a player needs to revisit, the GM can manually reset.

5. **Should the wizard auto-advance steps that have nothing to do (empty pending changes, no monologue available)?** **Tentative answer: yes, with a 1-second pause and a small "skipping..." message.** Prevents empty steps from feeling like dead time.

6. **Should the GM Roster View remain visible after Upkeep advances?** Currently no — it closes when the phase advances out of Upkeep. **Tentative answer: closes.** It's a phase-bounded tool.

7. **Step 4 (Desire) — should it be optional based on whether an arc wrapped?** Per the source material, you only change desire when an arc wraps. **Tentative answer: always show the step, but it defaults to "keep" with one click.** Forcing the player to think about it for a beat is the point.

## Visual proof

The wizard at step 5 (Reputation review) themed in Rose's palette is rendered above (`good_society_upkeep_wizard_reputation_step_rose`). It validates: backdrop modal context, header with character name + step indicator ribbon (4 completed, 1 current, 1 future), themed step body with three pending change cards (two positive, one negative), summary line previewing the meter shifts, footer with back/skip/acknowledge actions.

When implementation begins, render at least one other step (suggested: step 2 Tokens — for the resolve refresh + monologue card pattern) and one other theme (suggested: Avril's dark theme — to validate the modal works on dark paper).

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Six-step wizard structure, GM Roster View, completion progression rules, theme behavior, edge cases all specified. Visual proof rendered for step 5 in Rose's theme. |
