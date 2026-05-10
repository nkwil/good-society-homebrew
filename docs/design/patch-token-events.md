# Patch: token spend events

> **Status:** drafting. New module — turns the click-to-spend gesture for resolve tokens and monologue tokens into immersive, theatrical events that match the rulebook's prescribed table rituals.
>
> **Companion docs:** [`post-mvp-design-patch.md`](./post-mvp-design-patch.md) §12 (master summary), [`patch-world-identity.md`](./patch-world-identity.md) (the monologue overlay shares the world-identity visual register), [`patch-persona-switcher.md`](./patch-persona-switcher.md) (persona-aware portrait resolution), `04-character-sheet.md` v1 (dossier tokens section), `10-chat-cards.md` v1 (existing `postMonologueCard` helper).
>
> **Repo target:** `module/apps/monologue-overlay.js` (new), `module/helpers/spend-resolve.js` (new), `module/helpers/spend-monologue.js` (new), `templates/apps/monologue-overlay.hbs` (new), `templates/dialogs/resolve-spend.hbs` (new), `templates/dialogs/resolve-handoff.hbs` (new), `styles/apps/_monologue-overlay.css` (new), small touches in `module/sheets/major-character-sheet.js` to wire the click handlers, `module/helpers/chat-cards.js` to upgrade the monologue card variant.

---

## 1. Goals

1. **Match the rulebook's prescribed rituals.** Resolve has a *negotiation handoff* where the token is physically passed (p.70). Monologue has a *scene freeze* — "we pause the action and focus on the major character's inner world" (p.103). The UI should make these feel like events, not just dimming a pip.
2. **Stay faithful to the antique-but-clean register.** No bombastic effects. Period-illustrative restraint. Animations are slow and deliberate (~400 ms–1.2 s), not snappy.
3. **Reuse the world-identity visual register for the monologue overlay.** Shared backdrop, shared mote tokens, shared corner ornaments. The monologue is a fourth member of the world-identity surface family (Arrival, pause overlay, monologue overlay, future cycle-end transition).
4. **Degrade gracefully without Sequencer.** The system already lists Sequencer as recommended-not-required (CLAUDE.md §3). Both events ship with CSS-only animation paths; Sequencer adds polish in heavy variants only.
5. **Respect the rulebook's player permissions.** A player spends *their own* monologue token on *another* character. The token's spender authorizes; the target performs. Two distinct flags update on completion (spender's `tokens.major` → false; target's `tokens.monologuedThisCycle` → true).

---

## 2. Relationship to existing surfaces

| Existing surface | This patch's relationship |
|---|---|
| Dossier tokens section (master spec §4.5) | Click handlers on the resolve track and monologue dot now route through these new spend pipelines instead of toggling state directly. The visual treatment of pips/dot is unchanged — still brand-on/brand-off per §5. The animation extends what the click triggers. |
| `postMonologueCard` helper (B-3 wiring, `module/helpers/chat-cards.js`) | Upgraded to a heavier weight for the post-overlay archive. Wider container, faint motes pattern, drop-cap on first letter. Existing call sites continue working — the upgrade is internal. |
| World-identity register (`patch-world-identity.md`) | The monologue overlay consumes `styles/_world-identity-shared.css` (gradient backdrop, mote tokens, corner ornaments). z-index sits at 35 — above the Arrival's 30, below the pause overlay's 40. |
| Persona system (CLAUDE.md §6.5, `patch-persona-switcher.md`) | The cameo and chat-card profile pics resolve via §8.5 of the master spec (`profilePic(actor)` → `activePersona?.tokenImageUrl || actor.prototypeToken.texture.src`). If a target's active persona has a `chatColor` override, the chat card's brand tints accordingly. |

---

## 3. Surface 1 — Resolve token spend events

### 3.1 Trigger

A player clicks an *available* (filled) resolve pip on their own Major's dossier or on a Connection sheet they control. The click handler routes to `spendResolve(actor)` rather than directly toggling state. No spend can begin from a pip that's already in spent state — the click is inert there.

The Facilitator's resolve pool (per rulebook p.70 — three tokens) is rendered separately. **[FILL IN]** — currently no GM resolve UI exists; Facilitator pool work is reserved for a separate patch. This document covers player-side resolve only.

### 3.2 Spend modal

A `foundry.applications.api.DialogV2` opens with the message:

> **{Actor name} commits to a meaningful turn.**
> Discard the resolve token, or hand it to another player or connection they control?

Two buttons:

- **Discard** — primary path. Most spends are discards. One click, no further confirmation.
- **Hand to another →** — opens the handoff picker (§3.4). Triggered by negotiation per rulebook p.70.

Cancel button (or Esc) — closes without spending.

### 3.3 Discard path

1. The pip on the dossier flips state with a 400 ms animation (§3.6).
2. Actor update: `tokens.resolve.current` decrements by one.
3. Chat card posts via `postSystemCard` → themed system variant per `10-chat-cards.md`. Carries spender's cameo, theme stripe, eyebrow tagline, and a single-line italic body: "*{Actor name} spends a resolve token.*" Footer line: "*{N} resolve remaining.*"
4. Modal closes.

### 3.4 Handoff path

1. The handoff picker opens (`templates/dialogs/resolve-handoff.hbs`). It's a `DialogV2` listing valid recipients:
   - All other connected players' Majors.
   - All Connections currently owned by other players (per the v1 ownership model).
   - GM-controlled Connections in the shared pool (rulebook p.74 — connections have their own resolve pools, so the token can land there).
2. User selects a recipient and clicks "Hand it over →".
3. The handoff animation runs (§3.6).
4. Two actor updates atomically (or as close as Foundry serializes them): spender's `tokens.resolve.current` decrements; recipient's `tokens.resolve.current` increments (capped at `tokens.resolve.max`, default 5).
5. Chat card posts via `postSystemCard` with both cameos shown side-by-side and a small `→` between them, eyebrow "*A resolve token, handed across the table.*" Body: "*{Spender} hands a resolve token to {Recipient}.*" Footer line shows updated counts for both: "*Lady Rose: 2 resolve. Margaret Halloway: 3 resolve.*"
6. Picker dismisses.

If the recipient's pool is already at max, the picker disables that option with a tooltip: "*Their pool is full ({max}/{max}).*" The token can't land there. The spender chooses a different recipient or cancels.

### 3.5 Animation timings

**Discard pip animation** (~400 ms total).

```
0 ms     pip is filled --gs-brand
0–80 ms   pip emits a 12 px gilt particle puff (3–5 small dots fading outward)
80–250 ms pip color cross-fades from --gs-brand fill to outline
250–400 ms outline at 45% opacity settles to spent state
```

CSS keyframe handles this with no JS animation code — JS just toggles a `.is-spending` class for 400 ms, then removes it once the actor.update lands.

**Handoff animation** (~1.2 s total).

```
0 ms      A pip-shaped clone (position: fixed) appears at the source pip's
          getBoundingClientRect coordinates, in --gs-brand fill.
0–200 ms  Clone scales to 1.4× and emits a brief gilt halo.
200–1000 ms Clone tweens across the screen along a slight arc (eased) to the
            destination's getBoundingClientRect — the recipient's resolve track
            on their dossier (if open), their dock row pip area, or their
            dashboard row's resolve column. Falls back to the dashboard row
            if no other surface is visible to the spender.
1000–1200 ms At destination: gilt halo flashes, clone scales to 0.6× and fades.
            Real pip on the destination dossier flips outline → fill (recipient's
            new resolve count is reflected via the actor.update that fires at
            the start of the animation).
1200 ms   Clone removed from DOM. Both rows now show the new state.
```

If multiple users have the recipient's surface open, each instance runs the animation independently (the actor.update is the source of truth; the clone is a per-client visual reaction).

### 3.6 Edge cases

- **Spender already at 0.** Pip click is inert (the pip in question is in spent state, no available pip exists). The spend modal never opens.
- **Spender disconnects mid-handoff.** The actor.update has already landed (it fires at the start of the animation). Even if the visual clone is interrupted, the data is consistent. Other clients see the recipient pool increment without the visual ceremony.
- **Spender on multiple surfaces.** If the spender has both the dossier and the dock open, only the dossier instance runs the animation — pip clicks are routed via single delegation and the spend modal is a singleton.
- **Recipient's dossier is closed for the spender's view.** The animation lands at the recipient's dock-row resolve area (always visible to the spender) or at the dashboard row. The animation never targets an off-screen element.

---

## 4. Surface 2 — Monologue token spend events

### 4.1 Trigger

A player clicks the **monologue dot** on their own Major's dossier — the dot in the §4.5 tokens section of the master spec (filled when `tokens.major === true` and `tokens.monologuedThisCycle === false` for any cycle target). Clicking opens the **target & question modal** (§4.2).

The dot is *only* clickable when the spender holds an unspent monologue token. If `tokens.major === false`, the dot is rendered as outline (already spent) and the click is inert.

The rulebook also notes the Facilitator may signal which monologue to "go ahead" (p.103) when multiple players want one simultaneously. The system enforces a singleton: only one monologue overlay can be open globally at a time. If a second player tries to trigger one while the overlay is up, their attempt is rejected with a chat warning: "*Another monologue is in progress.*"

### 4.2 Target & question modal

A `DialogV2` titled **"Play your monologue token"** with two fields:

- **Target Major** — a select listing every Major in the world *except* the spender's own (the spender's monologue token is played on someone else, per p.103). Disabled options for any Major whose `tokens.monologuedThisCycle` is already true with a tooltip "*This character has already monologued this cycle.*"
- **Question (optional)** — an italic-Crimson text input, ~60 characters, with placeholder "*e.g., 'Who does Henry really love?'*" If left empty, the overlay shows no question prompt; the target performs an open monologue.

Buttons: **Trigger the monologue ↗** (primary), **Cancel** (secondary).

On confirmation, the helper `spendMonologue(spender, targetActor, question)` fires and emits a Foundry socket message `gs.monologueStart` with `{ spenderActorId, targetActorId, question }`. All connected clients receive it; their `module/apps/monologue-overlay.js` instances render in response.

### 4.3 The overlay app

`MonologueOverlay extends ApplicationV2` — frameless, full-viewport, world-identity-themed.

- `id`: `gs-monologue-overlay`
- `classes`: `["good-society", "gs-monologue-overlay", "gs-world-identity"]`
- `window: { frame: false, positioned: true }`, `position: { width: "100%", height: "100%", left: 0, top: 0 }`
- z-index: **35**. Above the Arrival's 30, below the pause overlay's 40. (If the GM pauses during a monologue, pause dominates — also fitting; the table is paused regardless.)
- `pointer-events: auto` on the overlay (the target's textarea must be reachable). The backdrop layer has `pointer-events: none`.

The template composes shared world-identity classes from `styles/_world-identity-shared.css`:

- `.gs-wi-stage` — the gradient backdrop (~55% opacity over the canvas).
- `.gs-wi-motes` with **3 motes at half drift speed** (~25–35 s duration) — reads as the rulebook's "scene freezes" rather than a stopped clock.
- `.gs-wi-corners` — the same corner ornaments as the Arrival, scaled to 64 px.

Above the gradient, three stacked elements:

1. **Eyebrow** — "AN INNER MONOLOGUE." using §8.1 standalone primitive. Color tuned to honey-gold for dark-backdrop legibility (matching the pause overlay's eyebrow treatment from `patch-world-identity.md` §5.2).
2. **Cameo** — a 380 px circular display of the target's token (resolved via `profilePic(target)` per §8.5 of the master spec). The token's own design provides whatever framing the character has — Natalie's custom illustrated tokens carry their visual identity baked in. CSS adds at most a thin sage hairline around the circle. Below the cameo, the target's display name in italic Lora 22 px (persona-aware), and below that, the target's role/peerage in subdued sage 12 px.
3. **Question or empty band** — if a question was posed, it appears in italic Lora 22 px in quotes, centered, paper-cream color, with 0.6 opacity. If no question, this band is omitted and the cameo + textarea are spaced closer together.
4. **Textarea or read-only view** — see §4.4.

### 4.4 Per-user view

The overlay renders three different views depending on who's viewing:

**Target's view.** The textarea is interactive — large parchment-textured area, italic Crimson 16 px, paper-warm fill, gilt hairline border, ~520 px wide, auto-grows. Placeholder italicizes the question if posed: "*{question}*" — or simply "*The character's innermost thoughts...*" if no question. Submit pill in the bottom-right of the overlay: **"End the monologue ↗"**. Cancel is hidden — the target is committed once the overlay opens. (GM has cancel.)

**Spender's view.** Read-only view of the textarea — what the target is typing renders live (debounced ~250 ms via socket update on textarea input). At the bottom, a small subdued line: "*You played your monologue token — {Target name} is responding.*" No Submit button visible.

**Other players' view.** Same as spender's — read-only, live-updating. Bottom line: "*{Spender name} played a monologue token on {Target name}.*" Adds to the audience-experience feel.

**GM's view.** Same as others, plus a small **"Cancel monologue"** pill in the bottom-left for emergency exit. Cancellation refunds the spender's `tokens.major` to true and dismisses without posting a chat card.

### 4.5 Submit flow

1. Target clicks "End the monologue ↗" (or GM clicks "Cancel monologue" — that path skips to step 4 with a no-op chat card).
2. Server-of-record (the target's client, GM-fallback if target is offline) runs the actor updates atomically:
   - Spender's `tokens.major` → false.
   - Target's `tokens.monologuedThisCycle` → true.
3. `postMonologueCard()` posts the heavier monologue chat card (§4.6). The card carries: spender cameo + theme stripe (the *spender* is the speaker for credit purposes), target cameo as the "subject," the question if posed, and the full monologue body.
4. Socket emit `gs.monologueEnd`. All clients receive → overlay fades out over 1.0 s and removes itself.
5. Optionally archive to JournalEntry (per the existing letter-composer pattern from B-9). Default ON; toggleable per `archiveMonologuesToJournal` setting.

While the overlay is open, the in-system chat input shows a banner above the input: "*An inner monologue is in progress.*" Players can still type, but messages send normally (no gating, no queuing — a hard gate would be intrusive and the rulebook doesn't actually demand silence). The banner is informational only.

### 4.6 Chat card upgrade

The existing `postMonologueCard` helper from B-3 already produces a themed monologue card. The patch upgrades the template (`templates/chat-cards/monologue.hbs`) and CSS (`styles/components/_chat-card-monologue.css`):

- **Wider container** — 380 px in the chat log (vs 320 px for other chat cards).
- **Faint mote pattern in the background** — the same mote tokens from `_world-identity-shared.css` rendered at 8% opacity, no animation. Reads as a "moment held in time."
- **Drop cap on the first letter of the body** — `--gs-display` 36 px, `--gs-brand`, weight 500. The chat card is a separate surface from the dossier, so the patch's "no drop caps" rule (§4.2) doesn't apply here. The drop cap is a deliberate ornament for this specific weight of card.
- **"On {date}, in answer to '{question}'..."** lead line in italic 11 px subdued sage, when a question was posed. Otherwise a single italic 11 px line: "*On {date}, an inner monologue.*"
- **Both cameos** — spender (left, smaller, 28 px) with a small note "*played the token*" and target (center, larger, 48 px) above the body.

Existing call sites of `postMonologueCard` continue working; only the rendered HTML changes.

---

## 5. Settings

```js
// module/settings.js
monologueOverlayEnabled: { default: true, scope: "client" }
archiveMonologuesToJournal: { default: true, scope: "world" }
resolveHandoffAnimationEnabled: { default: true, scope: "client" }
```

`monologueOverlayEnabled=false` falls back to the chat-card-only flow — clicking the monologue dot prompts target+question, then posts the chat card directly with no overlay. (This is the "Light tier" from the brainstorm in case a user finds the overlay disruptive.)

`resolveHandoffAnimationEnabled=false` skips the cross-screen animation; the actor updates and chat card still fire. Useful for users on slower hardware.

---

## 6. `gs-world-identity` body class behavior

The monologue overlay only renders when `gs-world-identity` is on the body (per `patch-world-identity.md` §8). If a user disables `applyWorldIdentity`, the overlay falls back to the Light tier path described above — the rulebook ritual still fires (target picker, question, chat card) but without the dramatic overlay. The system surfaces a small console.warn the first time a monologue is triggered with world identity disabled, suggesting the user re-enable it for the full experience.

---

## 7. Localization

```json
{
  "GOODSOCIETY.tokenEvents.resolve.modalTitle": "Spend a resolve token",
  "GOODSOCIETY.tokenEvents.resolve.modalBody": "{name} commits to a meaningful turn. Discard the resolve token, or hand it to another player or connection they control?",
  "GOODSOCIETY.tokenEvents.resolve.discard": "Discard",
  "GOODSOCIETY.tokenEvents.resolve.handoff": "Hand to another →",
  "GOODSOCIETY.tokenEvents.resolve.handoffTitle": "Hand the resolve token",
  "GOODSOCIETY.tokenEvents.resolve.handoffConfirm": "Hand it over →",
  "GOODSOCIETY.tokenEvents.resolve.poolFull": "Their pool is full ({current}/{max}).",
  "GOODSOCIETY.tokenEvents.resolve.cardEyebrowDiscard": "A resolve token, spent.",
  "GOODSOCIETY.tokenEvents.resolve.cardEyebrowHandoff": "A resolve token, handed across the table.",
  "GOODSOCIETY.tokenEvents.resolve.cardBodyDiscard": "{name} spends a resolve token.",
  "GOODSOCIETY.tokenEvents.resolve.cardBodyHandoff": "{spender} hands a resolve token to {recipient}.",
  "GOODSOCIETY.tokenEvents.resolve.remaining": "{n} resolve remaining.",

  "GOODSOCIETY.tokenEvents.monologue.modalTitle": "Play your monologue token",
  "GOODSOCIETY.tokenEvents.monologue.targetLabel": "Target",
  "GOODSOCIETY.tokenEvents.monologue.questionLabel": "Question (optional)",
  "GOODSOCIETY.tokenEvents.monologue.questionPlaceholder": "e.g., 'Who does Henry really love?'",
  "GOODSOCIETY.tokenEvents.monologue.alreadyMonologued": "This character has already monologued this cycle.",
  "GOODSOCIETY.tokenEvents.monologue.trigger": "Trigger the monologue ↗",
  "GOODSOCIETY.tokenEvents.monologue.eyebrow": "AN INNER MONOLOGUE.",
  "GOODSOCIETY.tokenEvents.monologue.bannerInProgress": "An inner monologue is in progress.",
  "GOODSOCIETY.tokenEvents.monologue.targetPlaceholder": "The character's innermost thoughts...",
  "GOODSOCIETY.tokenEvents.monologue.spenderWatching": "You played your monologue token — {target} is responding.",
  "GOODSOCIETY.tokenEvents.monologue.audienceWatching": "{spender} played a monologue token on {target}.",
  "GOODSOCIETY.tokenEvents.monologue.submit": "End the monologue ↗",
  "GOODSOCIETY.tokenEvents.monologue.cancel": "Cancel monologue",
  "GOODSOCIETY.tokenEvents.monologue.alreadyInProgress": "Another monologue is in progress.",
  "GOODSOCIETY.tokenEvents.monologue.cardLeadWithQ": "On {date}, in answer to \"{question}\"...",
  "GOODSOCIETY.tokenEvents.monologue.cardLeadNoQ": "On {date}, an inner monologue."
}
```

---

## 8. File-by-file plan

| File | Action |
|---|---|
| `module/helpers/spend-resolve.js` | **NEW.** Exports `spendResolve(actor)`. Opens the spend modal; routes to discard or handoff helpers. |
| `module/helpers/spend-monologue.js` | **NEW.** Exports `spendMonologue(spender, target, question)`. Opens the target+question modal; emits the start socket; awaits the end socket. |
| `module/apps/monologue-overlay.js` | **NEW.** ApplicationV2 frameless singleton. Listens for `gs.monologueStart` / `gs.monologueEnd` sockets. Per-user view rendering. |
| `module/hooks/monologue-sockets.js` | **NEW.** Registers socket listeners on init. Routes start/end events to the overlay app. |
| `templates/dialogs/resolve-spend.hbs` | **NEW.** DialogV2 markup. |
| `templates/dialogs/resolve-handoff.hbs` | **NEW.** Recipient picker. |
| `templates/dialogs/monologue-trigger.hbs` | **NEW.** Target + question form. |
| `templates/apps/monologue-overlay.hbs` | **NEW.** Eyebrow + cameo + question band + textarea/read-only view + submit. |
| `styles/apps/_monologue-overlay.css` | **NEW.** Overlay-specific rules. Consumes `_world-identity-shared.css`. |
| `styles/dialogs/_resolve-spend.css` | **NEW.** DialogV2 styling for spend + handoff modals. |
| `styles/components/_chat-card-monologue.css` | **EDIT.** Wider container, mote-pattern background, drop-cap, both-cameos layout. |
| `templates/chat-cards/monologue.hbs` | **EDIT.** Add lead line with question, both-cameos block, body wrapped in drop-cap span. |
| `module/helpers/chat-cards.js` | **EDIT.** `postMonologueCard` accepts `spenderActor`, `targetActor`, `question`, `body` — same call signature plus optional new fields. |
| `module/sheets/major-character-sheet.js` | **EDIT.** Wire `data-action="spendResolve"` on resolve pip clicks → `spendResolve(actor)`. Wire `data-action="spendMonologue"` on monologue dot → `spendMonologue(actor)`. |
| `module/settings.js` | **EDIT.** Register the three new settings. |
| `lang/en.json` | **EDIT.** Add the §7 keys. |

---

## 9. Implementation order

1. Build `spendResolve()` discard path end-to-end (modal → actor update → chat card). No animation yet, no handoff. Verify the rulebook-faithful behavior with a real spend.
2. Add the discard-pip 400 ms animation.
3. Build the handoff path: picker, recipient validation (max-pool guard), the cross-screen animation, both-actor updates, both-cameo chat card.
4. Build `spendMonologue()` modal-only path (target picker + question + chat card; no overlay yet). This is the "Light tier" fallback path for `monologueOverlayEnabled=false`.
5. Build the monologue overlay app + sockets + per-user views. Test with two browser windows simulating spender + target.
6. Add the GM cancel path. Verify spender's MT refunds correctly on cancel.
7. Upgrade the monologue chat card (wider, mote pattern, drop-cap, both cameos).
8. Add JournalEntry archive on submit (mirror the letter-composer's `_archiveToJournal()` pattern from B-9).
9. Add settings. Test all three with toggles.
10. Polish — animation easing curves, mote drift speeds on the overlay, eyebrow color tuning for dark backdrop.

---

## 10. Edge cases

- **Spender's `tokens.major` already false when they click the monologue dot.** Click is inert (the dot is in spent state, no action). Modal never opens.
- **Target offline.** The overlay opens for connected users, but no one is the "target's view" (the editable textarea). If GM is connected, GM can pick up the textarea on the target's behalf (same way GM handles offline-player letters in B-9). If GM is also offline, the spender or anyone can take the typing role — the system doesn't enforce that the typer is the target's player. (The rulebook itself doesn't strictly prohibit this; it's a table-norm question.)
- **All targets have already monologued this cycle.** The target picker shows everyone disabled. A small note appears: "*Every Major has already monologued this cycle. The pool refreshes during Upkeep.*" Spender can't trigger.
- **Spender's cycle just advanced and refreshed everyone's flags between modal open and submit.** Edge case where actor updates are out of date. The submit re-validates and aborts with a chat warning if the target's flag has flipped to `true` between trigger and submit. Rare; documented for completeness.
- **Multiple monologue triggers near-simultaneously.** Socket ordering: whichever start event lands first wins. Other clients reject subsequent starts with the "Another monologue is in progress" warning. The losing spender's MT is NOT consumed (they got the rejection before the actor update fired).
- **GM disconnects mid-monologue.** Target's submission still works (the spender or any client can be the server-of-record for the actor updates and the chat card post). GM cancel is unavailable, but Esc + a console command provides a manual override path for the rare case.
- **Target's textarea content lost on disconnect.** The textarea content syncs via socket every ~250 ms. If a target disconnects, last-known text is preserved on other clients — GM can copy and submit on their behalf, or cancel and let target retry.
- **Theatrically-inappropriate spend.** A player tries to play their MT on themselves — UI prevents this (target picker excludes the spender's own Major). If the rulebook ever changes to allow self-monologue, the exclusion is the only line that needs to relax.

---

## 11. Open questions

- **§3.1** — Facilitator resolve pool UI. Currently no GM-side resolve track exists; the GM has three tokens per rulebook p.70 but the system has no surface for them. Lean: defer to a separate patch — needs its own design pass for GM-pool surfaces. This patch covers player-side resolve only.
- **§3.4** — Should the handoff picker include a free-text field for "negotiate the terms" (the rulebook describes the negotiation as conversational)? Lean: no, the negotiation happens at the table verbally; the picker just records the outcome. Free-text would conflate two different things.
- **§4.2** — Should the question field support full HTML / TextEditor (for italic, bold inline) or stay plain-text? Lean: plain-text for v1 — keep the modal lightweight. The chat card renders the question with whatever formatting is supplied.
- **§4.4** — Live textarea sync between clients via socket — debounce timing. Currently 250 ms. Could be 500 ms if it feels chatty over the wire. Verify with a real session.
- **§4.6** — Drop cap on the chat card breaks the "no drop caps" rule from §4.2 of the master spec. Per §4.2 the rule applies to *the dossier specifically*, and the patch already permits ornament-face exceptions in deliberately-scoped places (the dossier name initial). Treat the chat-card drop cap as a second deliberate exception. Lean: keep it; document the rationale.
- **§5** — Should `monologueOverlayEnabled` default world or client? Currently client. World would give the GM a single switch for "this group plays with the overlay" or not. Lean: client — players have different hardware tolerance for overlays.
- **§10** — Empty state when "Every Major has already monologued this cycle." The spender's monologue dot is filled (they have an MT) but the target picker is empty. Should the dot dim until Upkeep? Lean: no — the dot reflects the spender's pool, not target availability. The picker handles the empty case.

---

## 12. Decisions log

- **2026-05-08 — Resolve and Monologue spends are events, not just state toggles.** Both routes lift past pure click-to-decrement into deliberate moments: a discard with pip animation + chat card; a handoff with cross-screen animation + dual-cameo card; a monologue with full scene-freeze overlay + textarea + heavier chat-card archive. Matches rulebook ritual (p.70 negotiation handoff, p.103 scene-freeze).
- **2026-05-08 — Monologue overlay is a fourth world-identity surface.** Reuses `gs-world-identity` body class, `_world-identity-shared.css`, mote tokens, corner ornaments. z-index 35 — between Arrival (30) and pause (40). The world-identity register pays off three times now (Arrival, pause, monologue) and remains extensible for cycle-end transitions.
- **2026-05-08 — Two distinct flag updates on monologue submit.** Spender's `tokens.major` → false (their MT spent); target's `tokens.monologuedThisCycle` → true (they've performed this cycle). Server-of-record is the target's client, GM-fallback if target offline.
- **2026-05-08 — Singleton overlay; subsequent triggers reject.** Only one monologue can be open globally at a time. Matches rulebook's "the Facilitator will indicate the right time" — the system enforces sequential ceremony rather than concurrent ones. Rejected spenders keep their MT.
- **2026-05-08 — Live textarea sync via socket.** The spender, audience, and GM see the target's typing in real time, debounced to ~250 ms. Reads as the table watching someone compose. Heavier than text-after-submit but mirrors the table's silent attention while a player thinks.
- **2026-05-08 — Drop cap on the monologue chat card is a deliberate exception to §4.2.** §4.2 forbids drop caps on the dossier specifically. The chat card is a different surface; the drop cap reads as ceremony for this card weight. Same scope-justified exception that allows Lavishly Yours on the cameo's name initial.
- **2026-05-08 — Both cameos on the handoff chat card.** Visual record of the negotiation outcome — spender's cameo on the left, recipient's on the right, `→` arrow between. Mirrors the table act of physically passing the token.
- **2026-05-08 — Facilitator-pool spends deferred.** The GM holds three resolve tokens per rulebook p.70 but no current UI exposes that pool. Out of scope for this patch; a future patch will add a GM resolve surface and route GM spends through `spendResolve()` with the GM as actor-of-record.
- **2026-05-08 — Sequencer is optional polish only.** Both events ship with CSS-only animations. The "heavy tier" Sequencer additions (cameo zoom, sepia canvas filter, audio cues) are reserved for v1.1 and gated on `game.modules.get("sequencer")?.active`.
