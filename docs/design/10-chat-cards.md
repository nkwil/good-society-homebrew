# 10 — Chat Cards

**Status:** Locked — six chat card variants specified, Speaking-As switcher specified, Inner Monologue editor flow specified
**Date opened:** 2026-05-05
**Covers inventory entries:** #25 system-emitted chat card, #26 in-character chat card, #27 Speaking-As switcher, #28 Inner Monologue editor + journal + chat card, #29 Inner Conflict completion ceremony card, #32 Persona switch announcement card

## Goal

Specify the full chat card system — every variant of message that posts to Foundry's chat log, plus the Speaking-As switcher above the chat input. Chat is where most of Good Society's voice lives. The chat log is, functionally, the running narrative of the session.

The themed-content pipeline introduced in `05-epistolary-ui.md` (the `.gs-themed[data-theme="..."]` wrapper) is the foundation. This doc applies it across six card variants and one input-side component.

## Chat card taxonomy

| Variant | Theme scope | Posted by | Frequency in play |
|---------|-------------|-----------|--------------------|
| **System-emitted** | House | The system itself | Per phase change, bulk action, etc. |
| **In-character chat** | Character (speaker's theme) | Player typing in chat input | Constant |
| **Inner Monologue** | Character (speaker's theme) | "Take Monologue" button on Major sheet | 0–1 per character per cycle |
| **Inner Conflict completion ceremony** | Character (resolver's theme) | Auto-fired when conflict completes | 0–2 per character per arc |
| **Persona switch announcement** | Character (post-switch persona's theme) | `switchPersona` helper | Whenever a swap occurs |
| **Letter card** | Character (sender's theme) | Letter composer's send action | Per letter sent |

Letter cards are already specified in `05-epistolary-ui.md` and will not be re-specified here. The other five share a common card primitive defined below.

## Common card primitive

CSS class root: `.gs-chat-card`

Every chat card (themed or house) follows the same structural template, parameterized by content slots.

### Structure

```
┌────────────────────────────────────────┐
│ [speaker context]    [card-type label] │  ← header strip (optional separator below)
│                                          │
│   {body content varies by variant}      │  ← body
│                                          │
│ [footnote · timestamp · etc.]            │  ← footer strip (optional)
└────────────────────────────────────────┘
```

- Outer card: `border-radius: 8–12px` depending on weight, padding 10–22px depending on weight, background `var(--gs-paper)`, 0.5px border in `var(--gs-accent-2)` (or `--gs-accent-1` for special variants like the completion ceremony).
- Header strip: speaker context on the left (portrait + name + persona role), card-type metadata on the right (eyebrow label, timestamp).
- Body: variant-specific content.
- Footer strip: variant-specific metadata (monologue spent, letter sealed, conflict resolved-side, etc.).

### Themed wrapper

For character-themed variants:

```html
<div class="gs-themed gs-chat-card" data-theme="{theme-id}">
  <!-- card content using var(--gs-paper), var(--gs-brand), etc. -->
</div>
```

The wrapper rebinds CSS variables to the speaker's theme. For house-styled variants (system-emitted), no wrapper — the card uses house variables natively.

### Theme-id source

The theme id is determined at *post time* and stored on the chat message:

```js
ChatMessage.create({
  content: cardHtml,
  flags: {
    "good-society-homebrew": {
      cardType: "monologue",
      speakerActorId: actor.id,
      speakerTheme: actor.system.theme || "npc",
      speakerPersonaId: actor.system.activePersonaId
    }
  }
});
```

Storing the theme on the message preserves historic cards across theme changes (same pattern as letters; see `05-epistolary-ui.md`). When the chat log re-renders, each card pulls its theme from its own flags, not from the actor's current state.

## Card variants in detail

### Variant 1 — System-emitted (house style)

CSS class: `.gs-chat-card--system`

For system-generated messages: phase changes, bulk action notifications, "X joined the world", reputation tag added, monologue taken (the announcement, not the monologue itself), backstory action earned (the announcement, not the ceremony).

#### Layout

```
┌────────────────────────────────────────┐
│ [⚙] SYSTEM · cycle 3        just now   │
│ ────────────────────────────────────── │
│ The GM advanced the cycle to            │
│ Reputation Phase. Players, please       │
│ assess your reputation since...         │
└────────────────────────────────────────┘
```

- Background: `var(--gs-paper-warm)` (slightly raised from default chat bg).
- Border: 0.5px `var(--gs-accent-2)` (sage).
- Padding: 10px 14px (compact).
- Header row: small system glyph (a 16px circle with a paper dot inside, in `--gs-accent-2`) + small caps label "SYSTEM · {context}" + timestamp on the right in muted italic.
- 0.5px hairline separator below the header.
- Body: italic body type, 13px, line-height 1.55, `var(--gs-ink)`.

System cards stay subtle. They're informational, not dramatic.

#### Examples

- "The GM advanced the cycle to Reputation Phase."
- "Lady Rose Willowood took her monologue this cycle."
- "Mr. Hats McHats was promoted to Natalie's ownership."
- "Reputation tag 'Naïve' added to Lady Rose Willowood."

These are the "stage directions" of play.

### Variant 2 — In-character chat (themed)

CSS class: `.gs-chat-card--in-character`

The most common chat card. Posted whenever a player speaks in chat with their owned actor selected as speaker.

#### Layout

```
┌────────────────────────────────────────┐
│ [R] Lady Rose Willowood   in character │
│      "I shall consider it, Mr.         │
│       Trotwood. You are very kind."    │
└────────────────────────────────────────┘
```

- Background: theme `var(--gs-paper)`.
- 2.5px left-edge accent stripe in `var(--gs-brand)`.
- Padding: 12px 14px.
- Two-column grid: 36px portrait + flex content.
- Portrait: 32×38px oval, theme palette, initial in display type at 16px.
- Header row: speaker name in display type 15px `var(--gs-brand)` on the left, "in character · {timestamp}" in italic 10px on the right.
- Body: chat message in italic body type, 14px, line-height 1.6, `var(--gs-ink)`.

#### Speaker disambiguation

The speaker is whoever's currently active in the Speaking-As switcher (see below). If a player has multiple owned actors and they don't switch, the system uses the most recently used owned actor. On first chat as a new actor, the system reminds: "Speaking as {actor name}. Switch via the panel above the chat input."

#### Persona-aware

If the actor's active persona has a `chatColor` override, the card's `--gs-brand` is overridden inline:

```html
<div class="gs-themed gs-chat-card--in-character"
     data-theme="dixon"
     style="--gs-brand: #4A6B3F;">
  …
</div>
```

This lets Dixon's "anti-magic Duke" persona use the standard heraldic red while his "secret magic-user" persona could use a quieter forest-green chatColor — same actor, two voices.

#### Body formatting

Plain text by default. Optional: italic spans preserved if the player wraps text in `*asterisks*` (Markdown convention). No other formatting in v1.

### Variant 3 — Inner Monologue (themed, expanded)

CSS class: `.gs-chat-card--monologue`

The most theme-expressive card after letters. Posted from the "Take Monologue" button on the Major sheet (see `04-character-sheet.md` persistent strip). Triggered via a small editor modal — see "Inner Monologue editor flow" below.

#### Layout

```
┌────────────────────────────────────────┐
│ [A] Avril Eclair          INNER MONOLOGUE
│      as The Maid                        │
│ ──────────────────────────────────────  │
│                                          │
│ He thinks I do not see him watching     │
│ her. He is wrong. I see everything I    │
│ am paid to see, and a great many...     │
│                                          │
│ ──────────────────────────────────────  │
│ monologue spent · cycle 3   archived ↗  │
└────────────────────────────────────────┘
```

- Background: theme `var(--gs-paper)`.
- Padding: 22px 28px (expanded — this is a moment).
- Border: 0.5px `var(--gs-accent-2)`.
- Header row: portrait + name + persona role on the left, "INNER MONOLOGUE" eyebrow on the right (display type small caps, 12px, letter-spacing 0.18em, color `var(--gs-accent-2)`).
- 0.5px hairline below the header.
- Body: monologue text in body type, 14px, line-height 1.7. Multiple paragraphs supported. The text the player wrote in the editor.
- 0.5px hairline above the footer.
- Footer: "monologue spent · cycle {n}" on the left, "archived ↗" link on the right (clicking opens the journal entry where the monologue is stored).

The expanded padding and clear bracketing give the monologue weight. It's a story moment.

#### Visibility

By default, monologues post publicly to all players (chat is shared). If the player wants the monologue to be GM-only or whispered, they tick a checkbox in the editor before sending. The card carries a small `🔒` glyph next to "monologue spent" if whispered.

### Variant 4 — Inner Conflict completion ceremony (themed)

CSS class: `.gs-chat-card--completion`

Auto-posted when an inner conflict completes (6 boxes total OR 5 on one side, per CLAUDE.md §4 #4). The ceremonial reward card.

#### Layout

```
┌────────────────────────────────────────┐
│ [D] DIXON CLOUDCANDLE              ★   │
│      has resolved his inner conflict    │
│ ──────────────────────────────────────  │
│                                          │
│       FAMILY  vs.  INDEPENDENCE          │
│       resolved on the side of Family     │
│                                          │
│ ──────────────────────────────────────  │
│              EARNED                      │
│      an Expanded Backstory Action        │
└────────────────────────────────────────┘
```

- Background: theme `var(--gs-paper)`.
- Border: 0.5px `var(--gs-accent-3)` (the honey/gold accent rather than the muted sage — this card carries reward weight).
- Padding: 18px 24px.
- Header row: portrait + name (in 14px display type) + "has resolved his/her/their inner conflict" subtitle on the left; large `★` glyph on the right (22px, color `var(--gs-accent-3)` — celebratory).
- 0.5px hairline below header.
- Center body, text-aligned center: "FAMILY vs. INDEPENDENCE" with the conflict labels in display type at 16px (or 14px for Dixon's heavier Cinzel), `var(--gs-brand)`. Below: "resolved on the side of {Family/Independence}" in italic, 13px, `var(--gs-accent-2)`.
- 0.5px hairline above footer.
- Center footer: "EARNED" eyebrow in small caps + "an Expanded Backstory Action" in body type. The backstory action is auto-created on the actor and linked from this card (click the text to open it).

The pronoun in the subtitle ("his/her/their") pulls from the actor's pronouns field. If unset, defaults to "their" — the system never assumes pronouns.

#### Why ceremony

Inner conflict completion is one of the highest-stakes mechanical moments in Good Society. The card has to *feel* like a moment. The centered text, the star, the explicit "EARNED" footer — these are cues the player should pause, reflect, and (per Plan §12.4) frame a short reflective scene before continuing.

#### Whispering

Conflicts are typically resolved publicly. But the player can opt in to a whispered completion (rare — usually you want the table to celebrate). Same `🔒` glyph applies.

### Variant 5 — Persona switch announcement (themed)

CSS class: `.gs-chat-card--persona-switch`

Posted via the `switchPersona` helper (CLAUDE.md §11). Announces a character has changed identity.

#### Layout

```
┌────────────────────────────────────────┐
│ [A]  AVRIL ECLAIR has become            │
│      The Black Hound                     │
│      [whispered to GM and Avril only]    │
└────────────────────────────────────────┘
```

- Background: theme `var(--gs-paper)`.
- Border: 0.5px `var(--gs-accent-1)` (terracotta — transitional/special).
- Padding: 12px 16px.
- Single-row layout: portrait on the left, two-line stack on the right.
  - Top: "{ACTOR NAME} has become" in display type small caps, 13px, `var(--gs-brand)`.
  - Bottom: "{New persona name}" in display type 16px italic, `var(--gs-brand)`.
- Optional third line in italic muted: visibility note if whispered.

The card uses the *post-switch* persona's theme, not the pre-switch. Visually, you see the actor "arrive" in their new identity.

#### Visibility based on persona's `visibility.magic`

If the persona's magic visibility is "secret" (this is Avril's assassin form, Dixon's secret magic-user form), the card whispers to the GM and the player only. Otherwise, public.

The whisper note ("[whispered to GM and Avril only]") only appears for whispered cards — public ones omit it.

#### Sequencer integration

Per Plan §10, optionally fires a Sequencer VFX on the active token at the moment of switch (e.g. JB2A's misty-step animation). The chat card and the VFX are independent — the card always posts; the VFX only fires if Sequencer is installed.

### Variant 6 — Letter card

Already specified in `05-epistolary-ui.md`. Reference for completeness:
- Wrapper class: `.gs-letter-card`
- Theme: sender's
- Layout: header strip (cycle + from/to) + optional subject + body + footer (theme + seal)

The letter card is intentionally taller and more elaborate than the in-character card — letters are slower, more deliberate writing than in-the-moment chat.

## Speaking-As chat switcher

CSS class root: `.gs-speaking-as`

Lives in the chat input area, above the text input (Plan §12.1, inventory #27). Replaces or augments Foundry's default speaker controls.

### Layout

```
┌────────────────────────────────────────┐
│ SPEAKING AS · [A] Avril (as The Maid)▾ │ ← speaker selector + mode label
│                                          │
│ [type your message...]            [send]│ ← text input
└────────────────────────────────────────┘
```

- Background: `var(--gs-paper)`.
- 0.5px border in `var(--gs-accent-2)`.
- `border-radius: 8px`.
- Padding: 12px 14px.

### Speaker selector

- "SPEAKING AS" small caps label.
- Active speaker pill: portrait dot + actor name in display type + persona name in italic + dropdown chevron.
- Click → opens a popover listing the user's owned actors. Each entry shows portrait + name + theme badge + persona name. Click an entry to set as active speaker.
- Persona switching: each actor entry expands to show its personas. Selecting a persona (rather than the parent actor) sets the actor active *and* switches them to that persona.

### Mode label

To the right of the speaker selector:
- "in-character" by default — chat will post as themed in-character cards.
- Alternative modes (selectable via a small dropdown): "out-of-character" (chat posts as plain Foundry text from the user account, not the actor), "whisper" (next message whispered to selected user(s)).

### Synced with My Characters Dock

The dock's footer Speaking-As switcher (per `09-my-characters-dock.md`) is a compact mirror of this control. Selecting in either updates both. Implementation: a single user setting `activeSpeakerActorId` + `activeSpeakerPersonaId` that both surfaces read from and write to.

### Why it lives in two places

The switcher is in the dock for awareness ("who am I speaking as right now?") and in the chat input for action ("change who I'm speaking as before sending"). One source of truth, two views.

## Inner Monologue editor flow

The Inner Monologue chat card (Variant 3) is generated by a small editor modal opened from the "Take Monologue" button on the Major sheet's persistent strip (see `04-character-sheet.md`).

CSS class root: `.gs-monologue-editor`

### Editor layout

```
┌────────────────────────────────────────┐
│ A monologue, for Avril Eclair (cycle 3)│ ← title (themed)
├────────────────────────────────────────┤
│ Write your character's inner thoughts   │ ← prompt (italic, themed)
│ — what are they feeling right now that  │
│ they cannot say aloud?                  │
│                                          │
│ [textarea, 6 lines tall, themed paper]  │ ← body input
│                                          │
│ [ ] whisper to GM only                  │ ← visibility toggle
│                                          │
│              [cancel]  [post monologue ↗]│ ← actions
└────────────────────────────────────────┘
```

The editor is themed — using the actor's full theme. Writing the monologue happens *in the actor's voice already*, which puts the player in the right headspace.

### Flow

1. Player clicks "take monologue" on their sheet's persistent strip.
2. Editor opens modally, themed to the actor.
3. Player types their monologue (1–3 sentences, but no enforced limit).
4. Optional: tick "whisper to GM only" (rare).
5. Click "post monologue ↗".
6. The system:
   - Saves a JournalEntry to the per-character "Monologues" folder (`Monologues / {Character Name} / Cycle {n} — {timestamp}`).
   - Posts the chat card (Variant 3, themed).
   - Sets `tokens.monologuedThisCycle = true` on the actor.
   - Closes the editor.

### If "Take Monologue" is clicked when already monologued

Disabled state — button is non-interactive. Tooltip: "Already monologued this cycle. Available again on Upkeep." (See `11-upkeep-wizard.md` when written for the refresh flow.)

## Multi-theme chat log feel

When multiple players chat in character within a single scene, the log becomes a multi-theme conversation. The visual proof above shows three character themes (Rose, Avril, Dixon) intermixed with one system card.

This is the chat log doing what the dashboard does: holding multiple themes in one shared surface without becoming chaotic. Same hybrid pattern: chat log chrome (Foundry's default) is house-equivalent; each card is a self-contained themed island.

The vertical spacing between cards (8–12px gap, hairline separator on house cards) gives the eye breathing room. Type variation (Cormorant for Rose, Didot for Avril, Cinzel for Dixon) creates rhythm rather than monotony.

## Implementation notes for Claude Code

### Module helpers

Centralize chat card construction in helpers:

```
module/helpers/chat-cards.js
  - postSystemCard({content, context})
  - postInCharacterCard({actor, persona, message, mode})
  - postMonologueCard({actor, persona, monologueText, whisper})
  - postCompletionCard({actor, conflict, resolvedSide})
  - postPersonaSwitchCard({actor, fromPersona, toPersona})
```

Each helper:
1. Resolves the theme id from the actor (or "npc"/"system" for non-character cards).
2. Wraps content in `.gs-themed[data-theme="..."]` (or no wrapper for system cards).
3. Stores card type and theme on the chat message flags.
4. Calls `ChatMessage.create({...})`.

### Templates

```
templates/chat-cards/
  ├── system.hbs
  ├── in-character.hbs
  ├── monologue.hbs
  ├── completion.hbs
  ├── persona-switch.hbs
  └── letter.hbs (already exists per 05-epistolary-ui.md)
```

Each template uses CSS variables only, no hardcoded colors. The wrapper provides the theme context.

### CSS organization

```
styles/components/
  ├── _chat-card-base.css (shared structure, header, footer)
  ├── _chat-card-system.css
  ├── _chat-card-in-character.css
  ├── _chat-card-monologue.css
  ├── _chat-card-completion.css
  ├── _chat-card-persona-switch.css
  └── _speaking-as.css
```

Reuse the `.gs-themed` selector rules from the theme files — no per-card theme overrides needed.

### Order of build

1. `chat-cards.js` helpers + system card (validates the helper pattern with the simplest variant).
2. In-character card (validates the wrapper for the most common variant).
3. Speaking-As switcher (lets you actually post in-character cards through normal play).
4. Persona switch announcement (proves persona-aware theming).
5. Inner Monologue editor + card (the highest-emotional-stakes variant).
6. Conflict completion ceremony card (auto-fired from the inner-conflict completion logic, see `04-character-sheet.md` and the future `12-inner-conflict-grid.md`).

### Test path

1. Send a chat as Rose. Verify her card uses Cormorant + wine + cream.
2. Switch to Avril (via Speaking-As switcher). Send a chat. Verify her card uses Didot + candlelight + midnight.
3. Open Avril's sheet. Click "take monologue". Write text. Post. Verify the monologue card renders themed, the journal entry is created, and `monologuedThisCycle` flips to true.
4. On Dixon's sheet, fill enough boxes on his Family side to complete (6 total). Verify the completion ceremony card auto-posts in Dixon's theme with the right resolved-side.
5. Switch a persona. Verify the announcement card posts using the new persona's theme.
6. As GM, advance the cycle phase. Verify the system card posts in house style.

If 1–6 pass, the chat card system is production-ready and the themed-content pipeline is fully validated.

## Edge cases

### Speaker actor deleted between send and read
Same handling as letters: the historic card uses the speaker theme stored on the message flag. The portrait may show as a placeholder if the actor was the source of the image.

### Speaker has no theme assigned
Falls back to house style. The card looks like a "system from {actor name}" card — uniform Inkwell.

### Persona override `chatColor` set but theme has accent that doesn't match
The `chatColor` only overrides `--gs-brand`. Other theme variables (paper, ink, accent-1, accent-2, accent-3) hold. This is intentional — the persona is a variation within the theme, not a new theme.

### Conflict completion fires while editor is open
Editor closes if the conflict was being edited via the Inner Conflict item sheet. Otherwise the completion card posts and the player sees both the editor and the new card simultaneously — fine, no special handling.

### Player sends a chat without selecting a speaker
Foundry default behavior: posts as the user account, not as an actor. The system *doesn't* force speaker selection — players occasionally need to speak as themselves (logistics, table-talk). The dock and the switcher make speaker selection easy without making it mandatory.

## Open questions

1. **Should the Speaking-As switcher remember the last persona used per actor?** E.g. if Avril last spoke as "The Black Hound" and the player switches away then back, do they resume as Black Hound or default to The Maid? **Tentative answer: yes, remember the last persona per actor.** Stored in user settings.

2. **Should the in-character card show a small clickable "open sheet" link in the header?** Convenient but adds visual noise. **Tentative answer: no, but click on the speaker name itself opens the sheet (no visual change).**

3. **Should monologue cards collapse by default after some time?** The expanded card stays in the chat log forever, taking vertical space. **Tentative answer: no, don't auto-collapse.** Monologues are part of the narrative — they earn their space. Players can scroll.

4. **Should the completion ceremony show the *new* inner conflict prompt?** "What's next?" Could push the player toward setting up a new conflict immediately. **Tentative answer: no, separate moment.** The completion is the celebration; setting up the next conflict happens at Upkeep.

5. **Should persona switch cards include a preview of the new persona's portrait?** Currently just the portrait dot uses the new persona's image. Could expand to a 80px portrait inline. **Tentative answer: yes, on a deferred v1.1.** Smaller portrait works for v1.

6. **System cards: should they be themable per system/world?** A future GM might want their world's system cards to look slightly different from another world's. **Tentative answer: no, keep them house-locked for now.** Cross-world consistency is more valuable than per-world flair.

## Visual proof

The chat log mockup is rendered above (`good_society_chat_log_with_card_variants`). Shows: system card (house, sage), in-character chat from Rose (themed pink/wine), inner monologue from Avril (full Avril theme — dark paper, candlelight gold, expanded layout), inner conflict completion ceremony for Dixon (parchment, heraldic red, gold star, centered "EARNED" footer), and the Speaking-As + chat input area with Avril as active speaker.

Validates: card variant consistency, theme expressiveness across multiple senders in one log, the monologue's expanded weight, the completion ceremony's celebratory feel, the speaker switcher form factor.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Six chat card variants specified, Speaking-As switcher specified, Inner Monologue editor flow specified, theme-id-on-flag pattern documented. Visual proof rendered showing four card types in a single chat log. |
