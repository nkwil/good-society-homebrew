# 17 — Token Hover Card

**Status:** Locked — three variants specified (Major, Connection, NPC), position-aware behavior specified, persona-and-visibility-aware rendering specified
**Date opened:** 2026-05-05
**Covers inventory entry:** #23 NPC hover card (renamed during design — the same component serves all three actor types, not just NPCs)

## Goal

Specify the small floating card that appears when a user hovers over an actor token on a canvas scene (Plan §8). Despite its inventory name, this component handles tokens for *all* actor types — Majors, Connections, NPCs, and any of their personas. It's the single most-seen UI surface during scene play: every glance at a populated ballroom or drawing room triggers it.

The card has three jobs at once:
1. Identify who the token represents at a glance (portrait + name + role).
2. Provide enough context to ground the player in the moment (hover summary, public tags).
3. Stay out of the way (transient, non-blocking, dismisses on hover-out).

The "antique but clean and legible" principle is at its tightest constraint here — the card is small, transient, and can't afford ornament that doesn't earn its keep.

## Renaming

The inventory calls this "NPC hover card" because the original Plan §8 wrote it that way. In design, the same component serves every actor type. The doc and CSS class names use "token hover card" to reflect the broader scope. Update the inventory accordingly when integrating.

## Where it lives

The card attaches to the canvas, anchored to the hovered token, via `Hooks.on("hoverToken", ...)`. It's a transient DOM element rendered into a layer above the canvas (Foundry's HUD layer) and removed on `hoverToken` deactivation.

Implementation choice: a single `Application` instance reused for every hover, repositioned and re-rendered on each token entry. This avoids constant DOM tear-down/rebuild and keeps the visual smooth.

## Sheet dimensions

```
width: 210px (compact, prioritizes visibility on a busy canvas)
height: auto (depends on description length and tag count)
max-height: 200px (very long descriptions truncate; click-through opens the actor sheet for full content)
```

210px is narrow enough that a populated scene with several tokens can show a hover card without occluding adjacent tokens, wide enough to comfortably fit the portrait + name + 1–2 line summary.

## Layout

```
┌──────────────────────────────────┐
│ [P] Character name                │ ← header (portrait + name + role)
│     Role / type label              │
│ ──────────────────────────────── │
│ Hover summary text wrapping over   │ ← summary
│ a line or two.                     │
│ ──────────────────────────────── │
│ tag · tag · tag                   │ ← public tags
└──────────────────────────────────┘
```

CSS class root: `.gs-token-hover-card`

The card is wrapped in `.gs-themed[data-theme="{theme-id}"]` to apply the actor's theme. For Connections, this renders in the connection's variant. For Majors, in the Major's character theme. For NPCs (whose theme is `npc`), it inherits house style.

### Common structure across variants

- Background: `var(--gs-paper)` (resolves per theme).
- Border: 0.5px `var(--gs-accent-2)` (right + top + bottom).
- **Left edge accent stripe**: 2.5px solid `var(--gs-brand)` (theme primary). For NPCs whose `--gs-brand` resolves to forest green from the house style, the stripe still appears but reads as quietly thematic — same color as the house chrome. Connections and Majors get their bright theme color stripe.
- `border-radius: 8px`.
- Padding: 12px 14px.
- A subtle drop shadow (0.5px hairline isn't quite enough on a busy canvas — a 2px shadow at low opacity, `box-shadow: 0 2px 8px rgba(20, 12, 14, 0.3)`, gives the card lift). This is the *one* place in the system where a shadow is allowed; the canvas needs the depth cue, sheets and modals don't.

### Header row

`display: flex; align-items: center; gap: 8px; margin-bottom: 8px;`

- **Portrait**: 28×32px oval. Theme paper background, 1px border in `var(--gs-brand)`. The active persona's `portraitUrl` if set, falling back to actor portrait, then to character initial in display type 14px.
- **Name + role stack**:
  - Top: actor (or active persona) name in display type 14px, color `var(--gs-brand)`. Truncated with ellipsis if too long for the 210px card.
  - Bottom: italic body type 10px, color depends on actor type:
    - **Major**: italic role/title in `var(--gs-brand)` (theme primary). Format: "The Heir" or "The Maid" — short, recognizable role only.
    - **Connection**: italic "Connection · {role}" in `var(--gs-brand)` (theme variant primary). The "Connection" prefix is the type cue.
    - **NPC**: italic "NPC · {role}" in `var(--gs-accent-2)` (sage — house). The "NPC" prefix is the type cue.

The role line's leading word ("Connection" / "NPC" / role title) is the at-a-glance signal of what kind of actor this is. Combined with the left-edge stripe color, the user can identify actor type in a quarter-second.

### Hover summary

`border-top: 0.5px solid var(--gs-accent-2); padding-top: 8px; font-family: var(--gs-italic); font-size: 11px; color: var(--gs-ink); line-height: 1.55; margin-bottom: 8px;`

Italic body prose, 1–2 sentences. Pulled from `actor.system.sceneInfo.hoverSummary` (or the active persona's `hoverSummary` override if set — see Persona-aware rendering below).

If the summary is empty, the card omits this section entirely (no empty placeholder — keeps the card compact).

### Public tags

`display: flex; flex-wrap: wrap; gap: 3px;`

Each tag is a small pill: `background: var(--gs-paper); border: 0.5px solid var(--gs-accent-2); padding: 1px 6px; border-radius: 100px; font-family: var(--gs-body); font-size: 9px; color: var(--gs-brand);`.

Pulled from `actor.system.sceneInfo.publicTags` (or the active persona's override).

If no public tags, omit this section.

### Major-specific addition: reputation tags

For Major characters, the public tags row may also include the character's *reputation tags* (if any are public). Reputation tags carry a polarity arrow prefix (▲/▼) and are rendered in the same pill style.

Example for Lady Rose: `▲ dutiful · ▲ restrained · ▼ naïve`.

This is the only Major-specific deviation from the common template; the rest is identical.

If a Major has many reputation tags, only the most recent 3–4 render in the hover card to keep the card compact. The full list lives on their sheet.

## Per-actor-type variants

The card structure is identical across types. The differences:

| Aspect | Major | Connection | NPC |
|--------|-------|------------|-----|
| Theme | Character theme | Connection variant | NPC (house) |
| Left stripe color | Character `--gs-brand` (theme primary) | Connection variant primary | Forest green (house) |
| Role label format | "The Heir" | "Connection · hatter" | "NPC · dressmaker" |
| Role label color | Theme `--gs-brand` | Theme `--gs-brand` | House `--gs-accent-2` (sage) |
| Includes reputation tags | Yes (up to 3–4) | No | No |
| Includes public tags | Yes | Yes | Yes |
| Hover summary source | `system.sceneInfo.hoverSummary` (or persona override) | Same | Same |

The visual proof (rendered above) shows all three side by side.

## Persona-aware rendering

When a token has an active persona, the hover card pulls its content from the persona, not the actor:

- **Portrait**: persona's `portraitUrl`.
- **Name**: persona's `name` (e.g. "The Black Hound" instead of "Avril Eclair").
- **Hover summary**: persona's `hoverSummary` (e.g. "An anonymous figure in dark dress" instead of "A reliable lady's maid").
- **Public tags**: persona's `publicTags`.
- **Theme color**: actor's character theme, possibly overridden per-persona if `chatColor` is set (which then overrides `--gs-brand` inline — same mechanism as chat cards per `10-chat-cards.md`).

This is what lets Avril's hover card read as "The Maid" in the drawing room and "The Black Hound" in the assassin's guild without changing the underlying actor.

The persona-aware rendering is the wrapper mechanism's most visible payoff in scene play — players can mouse over a token and see *who that character is being right now*, not just who the actor is.

## Visibility-respecting rendering

The hover card is shown to whoever is hovering. Different viewers see different content depending on permissions and visibility flags:

### Full info (GM)
GMs always see everything. The hover card shows the actor's true name (not the active persona's, if those differ) and the full hover summary.

GM-only badge: when a GM hovers a token whose active persona differs from the actor's primary, a small `(secret persona)` italic note appears below the role line in muted color, so the GM remembers the player sees a different identity.

### Owner (the player who owns the actor)
Owners see exactly what the GM sees, minus the GM-only persona-divergence note.

### Non-owners (other players, viewing this token)
Non-owners see the hover card filtered through visibility flags:

- **Active persona's `visibility.desire / backstory / magic` set to `secret`**: those fields are not shown. The hover summary, name, and public tags are still shown (those aren't behind visibility flags).
- **The actor has secret personas the viewer hasn't seen**: those personas don't appear anywhere; the active one does.

The hover card never reveals the actor's "true" name to a non-owner if a different persona is active. This is the persona system's most consequential safeguard: a player hovering Dixon's secret-magic-user token doesn't see "Dixon Cloudcandle" — they see the alter persona's name.

### Implementation note

The visibility filtering happens server-side in the `_prepareContext` of the Application. Don't filter on the client — the client receives only the data it should be allowed to see, so even browser-level inspection can't reveal what shouldn't be revealed.

## Position-aware behavior

The card is anchored to the hovered token but adjusts to viewport edges:

### Default position

Above and to the right of the token, with a 12px gap between the token's edge and the card's edge.

```
       ┌─────────────┐
       │ hover card  │
       └─────┬───────┘
             │
       ┌─────▼─┐
       │ token │
       └───────┘
```

### Edge handling

When the default position would clip outside the viewport:
- **Above clip** (token near top edge): position the card *below* the token instead.
- **Right clip** (token near right edge): align the card's *right* edge to the token rather than the left edge.
- **Both top and right clip** (corner case): position the card *below and left*.

The repositioning happens silently on a single-frame layout pass. The card never appears "snapping" — it lands in the right place on first paint.

### Bottom clip

Less common, but if the card would extend below the viewport, the card grows upward from the token's top edge (mirror of the above-clip case).

## Dismiss behavior

The card dismisses on:
- Pointer leaving the token (default Foundry behavior — cursor exits the token's hover region).
- Pointer entering the card (no — the card is non-interactive and shouldn't receive focus). **Wait — read carefully.**

Actually, the card *should* be interactive in some senses (the user might want to click into it for more detail). The dismiss rules:
- Pointer leaves both the token and the card → dismiss.
- Pointer enters the card → keep open, allow tag clicks (filter by tag) or open-sheet click.
- Click anywhere on the card → opens the actor sheet (default Foundry behavior for double-click on tokens, but single-click on the hover card is convenient).

Implementation: track pointer over both elements as a combined "hover region." Dismiss only when pointer leaves both.

### Click-through

A single click on the card opens the actor sheet (or the active persona's view of it for non-owners). This is the secondary CTA — the card is for awareness, the sheet is for engagement.

## Theme behavior summary

The hover card uses the same `.gs-themed[data-theme="..."]` wrapper as all other themed-content surfaces. Theme variables resolve per actor:

- Majors → character theme (e.g. `rose`, `avril`, `dixon`).
- Connections → connection variant (e.g. `connection-green`, `connection-purple`).
- NPCs → `npc` (which inherits house style).

The wrapper mechanism guarantees correctness across all three types from a single template.

## Edge cases

### Token not linked to an actor
Foundry's loose tokens (placed without an actor link) don't have actor data. The hover card shows minimal info: the token's name and a placeholder "(unlinked token)" italic. No portrait, no tags. Click does nothing (no actor sheet to open).

### Actor's data is malformed (missing required fields)
The card renders what it can. Missing portrait → initial fallback. Missing name → token nameplate fallback. Missing hover summary → summary section omits. The card never throws a render error.

### Multiple tokens of the same actor on the scene
Each token gets its own hover card on hover (the active persona is the same for all tokens of one actor; they all show the same content). No special handling.

### Persona switched mid-hover
If a persona switch happens while the card is shown (e.g. GM switches Avril's persona via the dock), the card re-renders with the new persona's content on the next pointer event. No live update during the same hover (intentional — re-rendering mid-hover is jarring).

### Visibility flag changes mid-hover
Same as persona switch — re-renders on next pointer event.

### Many public tags
If `publicTags` has more than ~5 entries, the tag row wraps to multiple lines. The card grows vertically (still capped by `max-height: 200px`).

### Long hover summary
If the summary is more than ~3 lines, it truncates with an ellipsis. The full text is on the actor sheet — clicking the card opens it.

### Actor with no portrait, no description, no tags, no summary
The card renders just the name + role row. Compact and tasteful — the card never looks "broken" even when the actor is barely populated.

## Accessibility considerations

- Each hover card has an `aria-label` summarizing its content for screen readers: "Lady Rose Willowood, The Heir. Heir apparent. Composed under scrutiny. Watching everything. Tags: dutiful, restrained, naïve."
- Keyboard users can navigate via Tab — focusing a token surfaces the same hover card.
- The card itself doesn't trap focus; Tab continues to the next element.

## Implementation notes for Claude Code

When prompted to build this card, the recommended order:

1. Build the `Application` skeleton — opens, closes, renders empty content. Verify the `hoverToken` hook subscription works.
2. Build the common card template (`templates/components/token-hover-card.hbs`). Use CSS variables only — no theme-specific styles in the template.
3. Wire `_prepareContext` to pull the actor's data (or active persona's overrides) and apply visibility filtering.
4. Wire the `.gs-themed[data-theme="..."]` wrapper. Test with a Major (themed), a Connection (variant), and an NPC (house). Verify all three render correctly with the same template.
5. Implement position-aware behavior. Start with the default above-right position. Add edge-handling for top, right, top+right, and bottom clips.
6. Wire dismiss behavior. Test that pointer-on-card keeps the card open and pointer-leaving-both dismisses it.
7. Wire click-through to open the actor sheet.

CSS organization:
- `styles/components/_token-hover-card.css` — full card styling. Uses CSS variables from the wrapper.
- `styles/components/_polarity-arrow.css` — reusable for the reputation tag prefix arrows (also used in inline reputation tags on Major sheets).

### Test path

1. Place a Major token (Lady Rose) on a scene. Hover. Verify: themed pink card, "Lady Rose Willowood / The Heir" header, italic summary, three tag pills with polarity arrows.
2. Place a Connection token (Hats McHats) on the same scene. Hover. Verify: Connection Green card, "Mr. Hats McHats / Connection · hatter" header.
3. Place an NPC token (Madame Lacroix). Hover. Verify: house style card, sage stripe, "Madame Lacroix / NPC · dressmaker" header.
4. Switch Avril's persona to The Black Hound via her sheet's persona switcher. Place her token. Hover. Verify: card shows "The Black Hound / The Maid" with the alter portrait and persona-overridden hover summary.
5. As a non-owner player, hover Dixon's token (Dixon's secret-magic-user persona is active). Verify: the hover card shows the alter persona's name and summary, NOT Dixon's true identity.
6. Move a token near the right edge of the canvas. Hover. Verify: card flips to align right edge to the token rather than left.
7. Click a hover card. Verify: actor sheet opens.

If 1–7 pass, the hover card is production-ready.

## Open questions

1. **Should the card support quick actions (e.g. a small "switch persona" button for owners)?** Adds power but clutters the card. **Tentative answer: no for v1.** Hover cards are for awareness, not action. Power-user gestures live on the sheet.

2. **Should the card show resolve track for Majors?** Resolve is on the dock and dashboard already. **Tentative answer: no.** Keep the card focused on identity + scene context, not state.

3. **Should the card animate in/out?** A 100ms fade-in could feel polished, or it could feel sluggish. **Tentative answer: minimal — instant appear, 100ms fade-out only.** No fade-in (snappy is better than smooth at this scale).

4. **Should hovering an unowned shared-pool Connection show different info than hovering one promoted to a player?** **Tentative answer: no, same card.** Ownership is a permission concern, not a display concern.

5. **Should the card include the persona switcher inline for owners?** Quick-switch from a token. **Tentative answer: no for v1, defer to v1.1.** The dock and sheet are the canonical persona-switch surfaces; adding a third one risks fragmenting the workflow.

6. **Should NPC quick-actions (rename, edit description) be available on the hover card for GMs?** **Tentative answer: no for v1.** GM tools live in the NPC Organizer sidebar (#22) and the NPC sheet, not on transient hover.

7. **Should the card show distance / "across the room" indicators in scenes with placement?** A useful flavor element ("she's by the window"). **Tentative answer: defer indefinitely.** Out of scope for v1.

## Visual proof

Three hover card variants are rendered above (`good_society_token_hover_cards_three_variants`) on a darkened canvas-suggesting backdrop:

1. **Major (Lady Rose Willowood)** in Rose theme — pink-and-gold card with "The Heir" role and reputation tag pills with polarity arrows.
2. **Connection (Mr. Hats McHats)** in Connection Green — green card with "Connection · hatter" role and public tags.
3. **NPC (Madame Lacroix)** in house style — sage card with "NPC · dressmaker" role and public tags.

All three share the same structural template; the variations come from the theme variables. Same component renders three different experiences. The wrapper mechanism's most visible win in actual play.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Token hover card specified for all three actor types via the wrapper mechanism. Persona-aware and visibility-aware rendering specified. Position-aware behavior specified. Visual proof rendered with all three variants on a canvas-like backdrop. Component renamed from "NPC hover card" (its inventory name) to "Token hover card" since it serves all actor types. |
