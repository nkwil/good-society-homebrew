# 05 — Epistolary UI (Letter Composer + Letter Card)

**Status:** Open — composer and letter card locked in spec; `.gs-themed` wrapper mechanism specified end-to-end; visual proofs rendered for both
**Date opened:** 2026-05-05
**Covers inventory entries:** #30 Epistolary letter composer, #31 Epistolary letter card

## Goal

Specify the UI for the Epistolary phase — the dedicated round of letter-writing in each cycle (game plan §6.1, Plan §12.5). This is the most theme-expressive component in the system. It also serves as the canonical proof of the `.gs-themed` wrapper mechanism (`02-theme-architecture.md`): chrome stays house-styled, but content carrying a sender's voice fully adopts that sender's character theme, regardless of where the content is rendered (composer preview, chat log, journal entry).

If the wrapper mechanism works here, it works everywhere.

## The two-zone composition

The composer is a two-zone component:

1. **Chrome zone** (Inkwell house style) — the composer's own UI: title bar, form fields, action buttons, status text. Sits in the system's visual world ("you are using a tool").
2. **Preview zone** (sender-themed via `.gs-themed`) — a live render of the letter card as it will appear when sent. Adopts the sender's full character theme: paper color, ink color, display type, body type, accent palette. Sits in the *sender's* visual world ("this is what your letter will look like").

The transition between zones is intentional. A 0.5px hairline rule + a small "PREVIEW" eyebrow label make it clear the user has crossed from "tool" to "letter." The contrast is the point — players should feel a small thrill seeing their letter materialize in their character's voice.

This mechanism generalizes:
- Inner Monologue editor → chat card uses the same wrapper.
- Persona switch announcement card uses the same wrapper.
- In-character chat messages use the same wrapper.
- Public Info dashboard rows use a smaller version (just an accent on the row).

## Composer layout spec

CSS class root: `.gs-letter-composer`

Width: 680px (the standard app width). Height: auto — grows with the body field.

```
┌──────────────────────────────────────────────────────────────────┐
│ Compose a letter                          epistolary · cycle 3    │ ← title bar (house)
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│ FROM      [ Avril Eclair · as The Maid · theme · avril    ▾ ]    │
│ TO        [ Stanislov Eclair · connection · uncle · green  ▾ ]    │
│ SUBJECT   [ On a matter of debt                              ]    │
│                                                                    │
│ BODY      [ {textarea}                                       ]    │
│                                                                    │
│ SEAL      [○][●][○][○]  oxblood · burn after reading              │
│                                                                    │ ← form (house)
├──────────────────────────────────────────────────────────────────┤
│ PREVIEW · how the letter will appear in chat                      │ ← preview eyebrow (house)
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│   ╔════════════════════════════════════════════════════════════╗  │
│   ║  {full letter card, in sender's theme}                     ║  │
│   ║                                                            ║  │
│   ║  [themed paper, themed type, themed seal]                  ║  │
│   ║                                                            ║  │
│   ╚════════════════════════════════════════════════════════════╝  │ ← preview content (themed)
│                                                                    │
├──────────────────────────────────────────────────────────────────┤
│  drafts save automatically · last saved 12s ago                    │
│                              [cancel] [save draft] [send ↗]       │ ← action bar (house)
└──────────────────────────────────────────────────────────────────┘
```

## Title bar

- Background: `var(--gs-paper)`.
- 0.5px bottom border in `var(--gs-accent-2)`.
- Padding: 22px 28px.
- Left: "Compose a letter" in display type, 22px, color `var(--gs-brand)`.
- Right: italic body type at 12px, "epistolary · cycle {n}" — pulls the cycle number from world settings.

## Form section

Padding: 24px 28px. Each field is a `display: grid; grid-template-columns: 90px 1fr; gap: 14px; align-items: center;` row with the label on the left and the control on the right.

Field labels: small caps, 12px, letter-spacing 0.16em, color `var(--gs-brand)`. Sentence case alternative: skip the small caps and use sentence case at 12px italic. Either works for the antique-but-clean principle. Locked: small caps, since this is a tool surface and small caps is the period idiom for form labels.

### FROM field

```
┌─────────────────────────────────────────────────────────────────┐
│ [portrait] Avril Eclair                                       ▾ │
│            as The Maid · theme · avril                          │
└─────────────────────────────────────────────────────────────────┘
```

- Single styled selector (not a native `<select>`).
- Background: `var(--gs-paper-warm)`.
- 0.5px border in `var(--gs-accent-2)`.
- `border-radius: 8px`.
- Inside, three columns: portrait (28×32px circular, themed to the persona), name + subtitle stack, ▾ chevron.
- Name in display type, 14px.
- Subtitle: italic body type, 11px, `var(--gs-accent-2)`. Reads "as {persona name} · theme · {theme-id}". Theme id is a debug aid that can be hidden in a "minimal" preference.
- On click: opens a popup listing the user's owned actors (Majors, Connections they own, optionally NPCs if GM). Each list entry shows portrait, name, and theme badge.
- The selected actor + persona drives the preview's `data-theme` attribute.

### TO field

Same control as FROM. Lists actors visible to the speaker (per Foundry permissions). Includes Connections from the shared pool.

For multi-recipient letters: extend this field to a chip-list pattern (multiple recipients, each as a small dismissible chip). Anticipated for the Marquess sending an open letter to all of Swan's Crossing. **Not in v1**; design but defer implementation.

### SUBJECT field

Plain text input. House-styled (matches the FROM/TO field background and border). Body type, 14px. Optional — letters can be subject-less, in which case the preview omits the subject line.

### BODY field

Plain `<textarea>` with the same paper-warm bg and border. Body type, 14px, line-height 1.6. Resizes vertically with content; `min-height: 92px`. No formatting toolbar in v1 — the body is plain text. Period letters were not formatted; ours don't need to be.

If a future version wants light formatting (italics, line breaks preserved, em-dashes auto-converted), wire it through Foundry's `editor` helper with a stripped-down formatter.

### SEAL field

A row of clickable color circles representing wax seal options. Each circle is 24px diameter:

- Default options: oxblood (`#8B2A2A`), sage (`#708060`), candlelight gold (`#E8C988` or per-theme equivalent), midnight (`#16100E`).
- Selected seal carries a thicker (1.5px) border in `var(--gs-brand)`.
- A small italic caption next to the row describes the selected seal: "oxblood · burn after reading". Captions can be customized per seal — purely flavor, no mechanic.

The seal renders in the letter card footer ("sealed in {color}"). It's pure flavor; doesn't gate visibility or trigger anything.

## Preview eyebrow

A thin band between the form and the preview, full-width.

- Background: `var(--gs-paper-warm)`.
- 0.5px top and bottom borders in `var(--gs-accent-2)`.
- Padding: 16px 28px.
- Single line: "PREVIEW · how the letter will appear in chat" in 12px small-caps body type, letter-spacing 0.16em, color `var(--gs-accent-2)`.

## Preview content (themed zone)

Padding: 24px 28px. Background: `var(--gs-paper)` (still house — the bg around the preview card). Inside, a `.gs-themed` wrapper carrying the sender's theme renders the full letter card.

The letter card is the same component used in chat and journal entries — a single source of truth (see "Letter card spec" below). The composer's preview is not a separate render; it's the live letter card rendered with the current form state.

If the form state is incomplete (no body, no recipient), the preview shows placeholder text in muted italic ("…awaiting recipient", "…awaiting body") in the sender's theme. Don't hide the preview — its presence is reassuring and gives the player a moving target to compose toward.

## Action bar

- Background: `var(--gs-paper)`.
- Padding: 18px 28px.
- Left: status text in italic 12px `var(--gs-accent-2)`. Reads "drafts save automatically · last saved {n}s ago" or "drafts save automatically · saving…" or "draft restored from earlier session".
- Right: three buttons:
  - **Cancel** — secondary outline button. Confirms before discarding if the body has changed since the last save.
  - **Save draft** — secondary outline button. Saves to a per-user "Drafts" journal folder; closes the composer. Drafts auto-save every 10s while composing.
  - **Send ↗** — primary filled button (`var(--gs-brand)` bg, paper text). Posts the letter card to chat (and optionally journals it; see send flow below). Disabled state when no body, no recipient, or no sender.

## Send flow

When the player clicks Send:

1. The letter card is rendered with the sender's theme applied via `.gs-themed`.
2. The card posts to chat as a `ChatMessage` with `flags["good-society-homebrew"].letter = true` and `flags["good-society-homebrew"].senderActorId = "{id}"`. The `flags["good-society-homebrew"].senderTheme` field holds the theme id at the time of send (so themes can change later without breaking historic letters).
3. Whisper recipients: by default, the chat message whispers only the sender, recipient, and GM. The GM can configure (via game settings) whether epistolary letters are public-by-default or whispered-by-default.
4. Optionally, the letter is also archived as a JournalEntry under `Letters / Cycle {n} / {sender} → {recipient}`. GM-configurable; default true.
5. The composer closes.
6. The Drafts entry (if any) is deleted.
7. Any subscribers to the `epistolary-sent` hook fire — for example, the session log auto-generator (Plan §12.2) appends the letter to the session log.

## Letter card spec

CSS class root: `.gs-letter-card` (or `.gs-themed .gs-letter-card` when wrapped).

This is the rendered letter — what you see in chat, in the composer's preview, and in the journal archive. Already proven visually in widget `good_society_per_character_theming_letters_demo` (rendered for Rose, Avril, Pearlinda) and in the composer preview.

### Structure

```
┌────────────────────────────────────────────────────────┐
│ epistolary · cycle 3      from avril · to uncle · sealed │ ← header strip
├────────────────────────────────────────────────────────┤
│                                                          │
│ On a matter of debt                                      │ ← optional subject (display type)
│                                                          │
│ Uncle —                                                  │
│                                                          │ ← body
│ The Marquess held court last evening. I watched the     │
│ whole room from a corner I am not supposed to occupy... │
│                                                          │
│ — A.                                                     │ ← signoff
├────────────────────────────────────────────────────────┤
│ theme · candlelight & crimson      sealed in oxblood    │ ← footer strip
└────────────────────────────────────────────────────────┘
```

- Outer card: `border-radius: 12px`, padding 24px 30px, background `var(--gs-paper)`, 0.5px border in `var(--gs-accent-3)` (or `--gs-accent-2`, theme dependent). The wrapper carries `data-theme="{theme-id}"`, so the variables resolve to the sender's palette.
- Header strip: 0.5px bottom border `var(--gs-accent-2)`, padding-bottom 12px. Two text spans, justified:
  - Left: display type, 13px, color `var(--gs-accent-2)`, letter-spacing 0.12em — "epistolary · cycle {n}".
  - Right: italic body type, 11px, color `var(--gs-accent-2)` — "from {sender-persona} · to {recipient} · sealed".
- Subject (optional): display type, 18px italic, color `var(--gs-brand)`, margin-bottom 12px.
- Body: body type, 15px, line-height 1.7, color `var(--gs-ink)`. Plain paragraphs separated by 12px margin-bottom each. Italic spans preserved if present.
- Signoff: typically italic, often single-character ("— A.") or formal ("Yours, Lady Rose Willowood"). Renders inside the body block.
- Footer strip: 0.5px top border `var(--gs-accent-2)`, padding-top 12px. Two text spans, justified:
  - Left: italic body type, 11px, color `var(--gs-accent-2)` — "theme · {theme display name}".
  - Right: italic body type, 11px, color `var(--gs-accent-2)` — "sealed in {seal color}".

### Theme expression

Each theme produces a different letter feel without a single theme-specific CSS rule:

- Cashmere/Rose: cream paper, gold rules, dusty-rose display, calligraphic Cormorant. Reads gentle, formal.
- Candlelight/Avril: midnight paper, candlelight-gold accent, oxblood seal, Didot display. Reads dangerous, secretive.
- Inkwell-style/Clayton: cream paper, sage rules, forest-green display, Lora type. Reads grounded, sincere.
- Mags: deep midnight paper, cold steel display, blood seal, DM Serif. Reads merciless.
- Dixon: warm parchment, heraldic gold rules, Cinzel display, deep red. Reads dignified, ceremonial.
- Roger: cool cream paper, slate-blue display, gold rules. Reads charming, restless (and visually paired with Rose's letter — twins).

The single component, six (eventually twelve) experiences. This is the wrapper mechanism's payoff.

### Truncation in chat

If the body is long (>4 paragraphs or ~600 chars), the chat-rendered card truncates and shows "— continues —" in italic muted at the bottom. Clicking opens the journaled letter in full. The composer preview shows the same truncation behavior so the player knows what their recipients will see in the chat log.

### Whispered indicator

If the letter was sent whispered (default), the card carries a small lock glyph next to the "sealed" text in the footer. Public letters omit it.

## The `.gs-themed` wrapper mechanism — full spec

This is the implementation pattern that makes per-character theming portable.

### The pattern

```html
<div class="gs-themed gs-letter-card" data-theme="avril">
  <!-- letter card content here -->
  <!-- all CSS inside this div uses var(--gs-paper), var(--gs-ink), etc. -->
  <!-- those variables resolve to Avril's palette because of the data-theme attribute -->
</div>
```

### CSS

Each theme's stylesheet (`styles/themes/_theme-{id}.css`) declares:

```css
.gs-themed[data-theme="avril"],
.gs-actor[data-theme="avril"],
.gs-connection[data-theme="connection-blue"] {
  --gs-paper:       #16100E;
  --gs-paper-warm:  #2C1F2A;
  --gs-ink:         #E8DDC8;
  /* ... full theme palette ... */
}
```

The `.gs-themed[data-theme="..."]` selector handles portable themed content (chat cards, letter cards, dashboard accent rows). The `.gs-actor[data-theme="..."]` selector handles full-sheet theming (Major Character sheet root). Both selectors apply the same CSS variables — they're peers, not parent-child.

### Render-time wrapping

Whenever themed content is generated in JS — from a chat-card helper, a journal-entry constructor, or the dashboard renderer — the wrapping happens in one place. Suggested helper:

```js
// module/helpers/themed-wrap.js

/**
 * Wrap content in a .gs-themed div using the given actor's theme.
 * @param {Actor} actor — the speaker/sender/originator
 * @param {string} content — HTML string to wrap
 * @param {string[]} extraClasses — optional additional classes
 * @returns {string} HTML string with wrapper applied
 */
export function themedWrap(actor, content, extraClasses = []) {
  const themeId = actor?.system?.theme || "npc";
  const classList = ["gs-themed", ...extraClasses].join(" ");
  return `<div class="${classList}" data-theme="${themeId}">${content}</div>`;
}
```

Used in:
- `module/helpers/chat-cards.js` — wraps in-character chat content.
- `module/helpers/letter-cards.js` — wraps letter card renders.
- `module/apps/public-info-dashboard.js` — wraps each Major's row.
- `module/apps/my-characters-dock.js` — wraps each owned-actor row.

By centralizing the wrapper, all themed content stays in sync if the wrapper class names ever change.

### Theme falls back gracefully

If `actor.system.theme` is missing or unknown, the wrapper still applies but no theme overrides match — the content renders in the house style. This is the desired behavior for unthemed actors and old data.

## Edge cases

### Sender is a Persona override

If the active persona's `chatColor` is set (overrides actor's default), the letter card's `var(--gs-brand)` is overridden by that color:

```js
// when wrapping:
const overrideColor = persona?.chatColor;
const styleAttr = overrideColor ? `style="--gs-brand: ${overrideColor};"` : "";
return `<div class="gs-themed" data-theme="${themeId}" ${styleAttr}>${content}</div>`;
```

The persona's chatColor only overrides the brand color, not the full palette. This is intentional — personas are identity variations within an actor's theme, not new themes. Larger overrides would dilute the theme system.

### Letter from an NPC

NPCs use the `npc` theme, which inherits the house style. A letter from an unnamed innkeeper should look "of the world" rather than have a strong personal voice — so this falls out correctly. If an NPC becomes important enough to have a real letter-writing voice, promote them to a Connection and assign a connection theme.

### Multi-recipient letter

V1 supports single recipient. The header strip's "to {recipient}" becomes "to multiple" or lists names truncated with a count if multi-recipient is enabled later.

### Long letters / journal archival

Journal entries hold the full letter, untruncated. The chat card is the abbreviated form. Both use the same `.gs-letter-card` template; the journal version omits the truncation behavior.

### Sender deleted before letter is read

If the sender actor is deleted between send and read, the historic letter still renders correctly because the theme id was stored on the message at send time (`flags.senderTheme`). The footer attribution may show the deleted actor's name in muted italic — Foundry's `ChatMessage.alias` survives actor deletion.

## Implementation notes for Claude Code

When prompted to build this component, the recommended order:

1. Build the `.gs-letter-card` template (Handlebars, `templates/components/letter-card.hbs`) and the corresponding `letter-cards.js` helper. Verify it renders correctly when given a hardcoded theme.
2. Build the `themedWrap` helper. Verify it produces the right HTML for sample actors of various themes.
3. Build the composer ApplicationV2 (`module/apps/letter-composer.js`, template `templates/apps/letter-composer.hbs`). Use the form spec above.
4. Wire up live preview: bind the form fields to a state object, re-render the preview on every input event (debounced to ~150ms).
5. Wire send: post the chat message with the right flags, archive to journal, fire the `epistolary-sent` hook.
6. Wire drafts: auto-save every 10s while body is non-empty.
7. Wire seal-color picker — pure UI, no mechanic.

CSS organization:
- `styles/components/_letter-card.css` — the card itself; uses CSS variables only, no theme-specific styles.
- `styles/apps/_letter-composer.css` — the composer chrome; uses house-style variables.
- `styles/themes/_theme-{id}.css` — the theme files defined in `decisions.md` registry; each adds a `.gs-themed[data-theme="{id}"]` selector alongside the existing `.gs-actor[data-theme="{id}"]` selector.

Testing path:
1. Send a letter as Rose. Verify cream/gold/wine colors and Cormorant display in the chat card.
2. Send the same letter (different actor) as Avril. Verify the card changes completely without any code changes.
3. Switch Avril's persona to one with a `chatColor` override. Send another letter. Verify only the brand color shifts; the rest of Avril's palette holds.
4. Open the journal archive. Verify the letter renders the same as in chat.
5. Reload Foundry. Verify the historic letter renders correctly even after a session boundary.

If all five pass, the wrapper mechanism is sound and we can build the rest of the themed-content pipeline (chat cards, dashboard rows, monologue cards) using the same primitives.

## Open questions

1. **Should letters trigger Sequencer effects on send?** A small VFX (envelope sealing, paper folding) would be charming but feels excessive for a turn-by-turn mechanic. **Tentative answer: no.** Save Sequencer for magic and persona swaps where the visual is the point.

2. **Should the seal color affect anything mechanically?** Currently no. **Tentative answer: keep it pure flavor.** Mechanical meaning would dilute the freedom to use seal as a pure aesthetic choice.

3. **Should drafts be GM-visible?** No — drafts are private to the author. **Locked.**

4. **Should the composer be a dedicated app or a chat-input mode?** Currently designed as a dedicated `ApplicationV2` window. Alternative: a "compose letter" mode that takes over the chat input. **Tentative answer: dedicated window** — letters deserve a dedicated writing surface, and the live themed preview is the killer feature, which the chat input can't host.

5. **Multi-recipient support timeline.** Not in v1. **Tentative answer: defer to v1.1**, unblocked by the chip-list pattern in the TO field.

6. **Handwriting variation.** Plan §12.5 mentions an "optional handwriting style." This could mean: a slight italic-shifted display family, a rougher serif for "informal" letters. **Tentative answer: defer.** Theme already carries voice; adding handwriting variation risks diluting it. Revisit if players ask.

## Visual proof

The composer in Avril's theme is rendered above (`good_society_epistolary_letter_composer_avril`). It demonstrates: house-styled chrome (form, fields, action bar), the preview eyebrow transition, and the themed letter card preview adopting Avril's full palette without any chrome bleeding in. The earlier widget (`good_society_per_character_theming_letters_demo`) shows the same letter card in three different sender themes (Rose, Avril, Pearlinda) — proof that the single template handles multiple themes correctly.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Composer layout, letter card spec, `.gs-themed` wrapper mechanism, send flow, edge cases all specified. Visual proof in Avril theme rendered. |
