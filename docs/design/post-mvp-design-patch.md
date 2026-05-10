# Post-MVP design patch — specification

> **Status:** drafting. Lands after v1 MVP ships.
>
> **Companion preview:** [`patch-preview-post-mvp.html`](./patch-preview-post-mvp.html) — visual reference for everything in this doc.
>
> **Not to be confused with:**
> - v1 (the MVP) — locked in `docs/design/` files 00–29. Don't touch.
> - v2 (the reimagination) — `explorations/v2-walkthrough.html`. Lives in its own folder, not for implementation.
>
> Open questions are marked **[FILL IN]** so they're easy to grep for.

---

## 1. Scope

### In scope

- §2. **World identity surfaces** — the Arrival (empty-canvas state), pause overlay, and reconciliation with v1 §29's splash and toolbar icons. Single shared visual register. (Spec: `patch-world-identity.md`. Supersedes `patch-arrival.md`.)
- §3. **Public Info Dashboard** — visual upgrade only, function & layout intact.
- §4. **The Dossier** — Major character sheet, significant rework. Includes new navigation (clickable connections, multi-page backstory). (Spec: `patch-dossier-refactor.md`.)
- §5. **Indicator unification** — one rule applied across every indicator component.
- §6. **Theme color slots** — expanded from v1's 10 to 12.
- §7. **Font rules** — a contract, not specific fonts. Designed to make font swaps cheap.
- §8. **Primitive components** — eyebrow heading, empty-state pattern, seal-vs-rep color carve-out, persona switcher pill, profile picture resolution. Cross-cutting rules used on every surface. (Persona switcher spec: `patch-persona-switcher.md`.)
- §9. **Player Module Menu** — "the Cabinet" — for collapsing third-party modules. (Spec: `patch-cabinet.md`.)
- §10. **Cosmetic facelift** for v1 surfaces (token hover, cycle HUD, functional modules) — light pass only, no behavior change.
- §11. **The Epistolary Wizard** — phase environment wrapping the locked v1 composer. Inbox / compose / outbox tabs, GM roster, typed seal registry with mechanical meanings, burn-after-reading mechanic. (Spec: `patch-epistolary-wizard.md`. Preview: `patch-epistolary-wizard-preview.html`.)
- §12. **Token spend events** — turns resolve and monologue token spends into theatrical moments. Animated discard, cross-screen handoff for resolve negotiation; full scene-freeze overlay (a fourth world-identity surface) for monologues. Matches rulebook rituals (p.70 handoff, p.103 scene freeze). (Spec: `patch-token-events.md`.)
- §13. **The Journal — "The Novel"** — organizes letters, monologues, session logs, and new cycle reflections into a cohesive archive presented as the rulebook's collaboratively-written Jane Austen novel (p.115). Folder hierarchy fixes, journal sheet styling, a dedicated Novel Reader app with cover page and chronological reading flow, auto-generated cycle dividers, end-of-game "title your novel" ritual. (Spec: `patch-journal-elevation.md`.)
- §14. **Foundry chrome icons** — custom illustrated icons replacing Foundry's default Font Awesome glyphs across scene controls, sidebar tabs, and the Cabinet rail. Extends v1 §28 (color re-theme) with an icon re-theme on top. (Spec: `patch-foundry-chrome-icons.md`.)

### Out of scope

- IA changes to any v1 surface that's working (e.g., the cycle HUD's structure).
- Sample world content.
- Any new actor or item types beyond what v1 §6 / §7 already define.
- The v2 walkthrough's Drawing Room replacement, Letter envelope-break, or full cinematic Arrival.
- Re-implementing indicators with three colors per state.

---

## 2. World identity surfaces

Three world-level identity surfaces that share a single visual register: the Arrival (empty-canvas state), the pause overlay, and the reconciliation with v1 §29's splash and toolbar icons. All three are house-styled — no per-actor theme cascade, uniform across users.

Full spec: [`patch-world-identity.md`](./patch-world-identity.md).

### 2.1 The Arrival

Triggered when no scene is active or the user logs in before any scene has been activated. Replaced as soon as a scene becomes active.

- Centered title in `--gs-display`, ~42 px, weight 500. Default `arrivalTitle` is **"Welcome to Good Society"** for fresh installs; GMs override to their world name (e.g., "Welcome to Swan's Crossing") via the `arrivalTitle` setting.
- Floating motes — six total, slow upward drift, ~12–20 s duration each, staggered.
- Dark cinematic backdrop with optional background image (`arrivalBackgroundUrl` setting).
- Four corner ornaments — single asset, mirrored per corner via CSS transforms (`arrivalCornerOrnamentUrl` setting).
- Frameless `ApplicationV2`, z-index 30, `pointer-events: none` so clicks pass through to canvas/sidebar.

If no assets are provided, the system falls back to an unornamented dark gradient. Nothing breaks.

### 2.2 Pause overlay

Replaces Foundry's default orange D20 + "GAME PAUSED". Reskin of v1 §29 surface 2, now bound to the shared world-identity register.

- Backdrop: 65% opacity ink-tone darkening using the same gradient stops as the Arrival.
- Half-density motes (3 instead of 6) — reads as a quieter version of the Arrival.
- Same corner ornament asset, scaled to 64 px.
- Centered cameo — 72 px circle, honey-gold border, configurable monogram or asset (`pauseCameoImageUrl` setting).
- Eyebrow above the cameo: "A MOMENT'S PAUSE" using the §8.1 standalone primitive, color tuned to honey-gold for dark-backdrop legibility.
- Title below the cameo: "The cycle is suspended." in italic Lora, paper color.
- z-index 40 — sits above the Arrival when both are present (pause-during-empty-canvas).

### 2.3 v1 §29 supersession map

v1 §29 specifies three world-identity surfaces. This patch reconciles them as follows:

- **Surface 1 — "Good Society" splash:** Superseded by the Arrival (§2.1). The "Good Society" wordmark is preserved as the default `arrivalTitle` so fresh installs identify the system.
- **Surface 2 — Pause overlay:** Kept and refined (§2.2). Same cameo + eyebrow + title structure; new visual register and §8.1 eyebrow primitive.
- **Surface 3 — Toolbar icons:** Superseded by `patch-foundry-chrome-icons.md` (§14). Scene controls are governed by the chrome-icons registry pattern.

v1 §29 should be amended in-place with supersession notes pointing here. See `patch-world-identity.md` §3 for the full map.

### 2.4 Shared visual register

Both Arrival and pause overlay consume `styles/_world-identity-shared.css` — shared CSS variables (gradient backdrop, mote tokens) and shared classes (`.gs-wi-stage`, `.gs-wi-motes`, `.gs-wi-corners`). New world-identity surfaces added in future patches inherit the same primitives.

A new body class `gs-world-identity` toggles all of this on/off via the `applyWorldIdentity` client setting. Independent of `gs-chrome-themed` — they layer freely. See §17 body class registry.

---

## 3. Public Info Dashboard, enhanced

**Layout, dimensions, function: unchanged from v1 §07.** This is a visual pass only.

### 3.1 What changes

- **Outer frame:** thin paper-warm + sage hairline frame so the panel reads as one object on a busy canvas. No new content.
- **Indicator unification:** every indicator on the dashboard (resolve pips, MT pill, monologue dot) follows the §5 rule — `--gs-brand` filled vs. `--gs-brand` outline. No more terracotta vs. gilt vs. green chaos.
- **Conditions sub-rail:** active conditions move from a separate section to a row-bottom hairline strip on each Major's row. Hidden when a Major has no active conditions. Geometry detailed in §3.3 below.
- **Offline rows** dimmed at 55% opacity, no other treatment.

### 3.2 What does NOT change

- 720 px wide × auto height.
- Vertical stack of Major rows.
- 6-column grid per row (portrait | name+role | resolve | MT | monologue | desire).
- GM bulk-actions bar at top.
- Footer with refresh time.
- Click target = whole row → opens that Major's dossier.

### 3.3 Conditions sub-rail geometry

When at least one active condition is present on a Major, a hairline strip renders directly below the 6-column grid, inside the row's outer frame. The strip is conditional — empty conditions hide the strip entirely (no placeholder, no zero-height ghost row).

**Strip dimensions.**

- Height: 28 px (matches the dashboard's footer-row spacing and gives condition pills 22 px of usable height with 3 px top/bottom padding).
- Horizontal padding: 14 px left and right, matching the row's existing inner padding so condition pills align flush-left under the portrait column.
- Top hairline: 0.5 px in `--gs-accent-2` (sage), full row width.
- The strip itself uses no fill — it inherits the row's background. This avoids double-lining with the row's outer hairline frame.

**Pill rendering inside the strip.**

- Each active condition renders as a small pill: 22 px tall, ~8 px horizontal padding, paper-warm fill, 1 px hairline border in the polarity color (sage for positive, terracotta for negative).
- Label: Lora italic 11.5 px, sentence case.
- Polarity glyph: small `▲` or `▼` at the leading edge in the polarity color.
- Click target: whole pill — opens the underlying `reputation-condition` item sheet.
- Spacing between pills: 6 px gap.

**Wrap and overflow behavior.**

- Pills wrap to a second line if the row width is exceeded. The strip's height grows in 28 px increments to accommodate wrap (so 1 line = 28 px, 2 lines = 56 px, etc.).
- Hard cap at 2 lines visible. If a Major has more conditions than fit in 2 lines, the strip ends with a small "+ N more" pill in subdued sage. Clicking it expands the strip to show all conditions (in-place, pushing the next row down). A second click collapses back to 2 lines.
- Horizontal scroll is NOT used here — wrap is preferred because dashboard rows are width-constrained, and horizontal scroll would hide content on narrow viewports.

**Dark-theme handling.**

The polarity colors on condition pills follow the same dark-theme override as rep tags (per §6.4). The three dark Majors — Avril, Pearlinda, Secret — substitute the `#77c477` mint and `#dd4242` clear-red variants. Cream-paper themes use the standard verdant + oxblood.

**Vertical rhythm with the 6-column grid.**

The 6-column grid above the strip keeps its existing height. The strip adds height to the row without changing the grid's vertical rhythm. The next row in the dashboard's stack starts immediately below the strip's bottom hairline (no extra spacing).

---

## 4. The Dossier

The Major character sheet, reimagined as a leather-bound two-page spread.

### 4.1 Visual base

**Shell from v2-walkthrough.html, paint job from the Inkwell & Wildflower dashboard.** The structural elements (leather book, marginalia, bookmark, cameo, multi-spread layout) are the v2 dossier; the palette, typography, and container styling all match the Public Info Dashboard from §3.

Kept from v2:

- **Leather binding** with the desk-photograph backdrop, vignette, gilt corner ornaments, raised spine.
- **Aged-cream paper** texture on each page, with corner aging and a noise filter overlay.
- **Marginalia SVGs** at all four corners of each page (small acanthus / scrollwork ornaments).
- **Cameo** at top-left of the public page — the character's token image (resolved per §8.5), rendered in a circular display at the cameo's existing dimensions. The token's own design provides the visual framing; CSS adds a thin sage hairline only.

Dropped from v2:

- ~~Bookmark strap~~ — token state lives on the public page now (§4.5).
- ~~Wax-seal pendants on ribbons~~ — replaced by hairline pill chips below.
- ~~Backstory drop cap~~ — removed. The first letter of each backstory paragraph is plain Lora 400, no oversized initial. The only "accented" first letter on the dossier is the **name initial** (see §4.2).

Re-skinned to Inkwell & Wildflower:

- **Palette:** cream paper (`--gs-paper`), forest-green brand (`--gs-brand`), sage hairlines (`--gs-accent-2`), terracotta for negative (`--gs-accent-1`), gilt for metallic accents (`--gs-accent-3`). The dossier-local variables (`--dossier-rose`, etc.) remap onto these — variable names kept rose-flavored for diff sanity, but values are all Inkwell.
- **Reputation tags are hairline pill chips** matching the dashboard's condition pills. Sage outline + sage text + light sage background for positive (with `▲` mark). Terracotta outline + terracotta text + light terracotta background for negative (with `▼` mark). Empty slots = dashed-sage outline + "open slot" label.
- **Active reputation pill is compact.** Laurel icon at 18 px, italic body label at 13 px, gilt hairline outline, single capsule shape. Sized to read as a chip rather than a card. **No-active-condition state:** the pill collapses entirely when no condition is active — no placeholder slot, no dashed outline, no "no active condition" label. The eyebrow above stays; the pill area is replaced by ~6 px of vertical breathing room before the next section. (This is the per-component empty styling per §8.2's "when NOT to use" rule — an absent condition is the intended state, not a genuine empty list.)
- **Reputation criteria block** uses paper-warm fill + a 2.5 px forest-green left stripe (matches dashboard rows). The crest SVG uses sage-tinted shield + forest-green family initial.
- **Inner conflict ledger** uses paper-warm fill + sage hairline border. Filled boxes are forest green; empty boxes are forest-green outline.
- **Connection chips kept.** They were already pill-shaped in v2; just re-tinted from rose to sage. The portrait disc inside each chip keeps a per-connection custom color (Margaret = wine, Thomas = tobacco, Lady V = plum) so the chip strip still has visual variety.

### 4.1.b Section headings

Each section on the dossier (Reputation criteria, Reputation tags, Active reputation, Inner conflict, Tokens, Her present desire, Notes & objectives, Adventurer sentiment, Magic & skills, Connections, Backstory) is introduced by an **eyebrow** heading. The eyebrow has weight; it's the load-bearing scanning device for the page.

- **Standalone eyebrow** (most uses): Lora 600, 11.5 px, 0.18 em letter-spacing, uppercase, brand color, with a 1 px sage hairline divider directly below and a small gilt diamond `◆` punctuating the right edge of the divider.
- **Subdued eyebrow** — used inside contained blocks (rep-criteria, conflict-title, tokens) to avoid double-lining with the container's own border. Same Lora 500 11px uppercase, sage color, no divider, no diamond.
- The diamond's background is paper-cream so it visually cuts through the divider.

### 4.2 Fonts

**Two body faces, plus one ornament face for the single accented capital.**

- `--gs-display` — Lora (or whatever final display face Natalie picks). Used for character names, the Desire line, condition names, magic-skill names, MT medal letters, page-turn arrows, eyebrow headings.
- `--gs-body` — Crimson Text (or final body face). Used for paragraph text, italic body, bio chips, meta lines, small italic asides.
- `--gs-ornament` — **Lavishly Yours** (Google Fonts). Used in exactly one place: the **first letter of the character name** (Rose's "R", Margaret's "M", Thomas's "T", Lady Verriere's "L"). Sized at 56 px with a `vertical-align: -8px` offset so the script's flowing strokes nest cleanly against the upright Lora "ose Whitcombe" / "argaret Halloway" that follows.

**Where the ornament face does NOT go:**

- Backstory paragraphs — no drop cap. Plain Lora 400 first letter, same as the rest of the paragraph. (v1 of the patch removed it; the previous Lora 700 dropcap is gone.)
- Connection portrait letters in chips — those are tiny 11 px Lora; the script wouldn't be legible.
- MT medal letters in the tokens grid — the pill's letterforms need the geometry of Lora display, not a script.
- Section headings — Lora 600.

**Replacing fonts:** any of the three slots can swap to a different Google Font. Two-face contract still holds: don't add a *fourth* face for any other purpose without scope-expansion. The ornament face is a single, deliberate exception scoped to one place on the page.
- `--gs-ui` — sans-serif (system stack). Used for any small UI labels that need to stay legible at 10–11 px.

The Desire line specifically — formerly Pinyon Script in v2 — uses italic display at ~26 px, weight 500. Loses the handwritten look but keeps the visual hierarchy and is legible.

### 4.3 Major-sheet fields

Per `CLAUDE.md` §6.1, every Major sheet field has a place:

| Field | Lives on |
|---|---|
| `bio.age`, `bio.peerage` | Public left page — cameo header bio chips |
| Token image (`actor.prototypeToken.texture.src` with persona override) | Public left page — cameo, per §8.5 profile-pic resolution. `bio.portraitUrl` is no longer rendered; field retained in schema for forward compatibility. |
| `familyId` → reputation criteria, motto, crest | Public left page — quoted block under cameo |
| `reputation.positiveTags` | Public left page — wax pendants, positive row |
| `reputation.negativeTags` | Public left page — wax pendants, negative row |
| `reputation.activeConditions` | Public left page — laurel-wreath chip |
| `innerConflictsActiveIds` | Public left page — ledger at bottom |
| `desire` | Private right page — italic display, prominent |
| `notesObjectives` | Private right page — bulleted list |
| `adventurerSentiment` | Private right page — single italic line |
| Magic/Skills (item type) | Private right page — list with cast button per skill |
| `connections` | Private right page — clickable chip strip (see §4.3.1) |
| `backstory` | Its own multi-page spread (see §4.3.2) |
| `tokens.resolve.current` / `.max` | Bookmark strap — wax-disc tokens |
| `tokens.major` (MT toggle) | Tokens section — MT pill (labelled "Monologue Token" in the UI) |
| `tokens.monologuedThisCycle` | Bookmark strap — quill icon + "take a monologue" button |
| `chatStyle.color` / `.font` | Not visible on dossier; applies to chat cards (§10) |
| `personas` / `activePersonaId` | Persona switcher (separate component, v1 §13) |

### 4.4 Navigation — the click requirements

This is the part that distinguishes the patch's dossier from v2's static spread. **Every behavior in this section is required.**

#### 4.4.1 Spreads

The dossier consists of multiple **spreads**. Each spread is a complete two-page view (left page + spine + right page). At any moment, exactly one spread is the **active spread**.

Initial spreads, by `data-spread` attribute:

- `character` — the default. Public reputation on the left, private inner life on the right.
- `backstory-1` … `backstory-N` — the expanded backstory, one spread per page-pair. v1 ships with two; the system supports any N.
- `conn-{id}` — one spread per connection that has been promoted to player-visible. Stub spreads exist for every connection in the Major's `connections` array; full content is filled from the Connection actor's public-info fields.

#### 4.4.2 Click → connection page

**Behavior.** Clicking a connection chip on the character spread navigates the dossier to that connection's public-info spread.

**Source data.** A connection's public-info spread shows fields from the Connection actor (per `CLAUDE.md` §6.2):

- Left page:
  - Cameo with the connection's token image (per §8.5 profile-pic resolution), `bio.pronouns`, `relationshipLabel`.
  - Public reputation tags (positive + negative) — same wax-pendant treatment as the Major.
  - Public description (`bio.description`).
- Right page:
  - **Public Impressions** — entries from the Connection's `impressions` array, filtered to those marked public (or all of them, if visibility on impressions is not yet implemented). Each impression renders as an eyebrow line "From {majorName}" + an italic quote.
  - **Tied To** — list of other Majors who hold a connection to this same Connection. Each is a clickable chip that navigates to that Major's connection page (recursive use of the same component).

**Affordance.** The chip itself is the affordance. Hovering raises by 1 px and tints the background; clicking transitions.

**Return.** A "← back to dossier" button at the top-left of every alt spread returns to `character`. **Locked: single-step.** No back-stack — clicking the button always returns to `character`, regardless of how the user arrived at the current spread (direct chip click from character, or recursive chip click from another connection's "Tied To" list). If a back-stack proves valuable later (multiple recursive hops becoming common), the simplest extension is a depth-1 history that remembers only the immediately previous spread; the button label flips between "← back to dossier" and "← back to {previous}" depending on context. Defer until usage warrants.

**Permissions.** This is a navigation, not a permission elevation. The player still has whatever permissions they had on the Connection actor before the click. If the Connection is in the shared GM-authored pool, the player sees what the GM has chosen to publish; nothing changes about that.

**No flip to private.** Clicking a connection chip does **not** open the connection's private fields, even for the GM. The GM gets to those by opening the Connection actor sheet via the sidebar — the dossier shows only the public face.

#### 4.4.3 Click → expanded backstory

**Behavior.** The character spread shows a one-line teaser of the backstory followed by a "continue reading ↗" button. Clicking the button navigates the dossier to `backstory-1`.

**Backstory layout.** Each backstory spread:

- Left page top-left: "← back to dossier" button.
- Left page header: "The backstory of {name}" + "page N of M" indicator.
- Both pages: paragraph text in `--gs-body`. No drop cap — the first letter of each paragraph is plain.
- Right page bottom: a navigation row with previous/next buttons + page indicator. Previous button absent on `backstory-1`; next button absent on `backstory-N`.

**Multi-page support.** The backstory text is split into N pages purely by length — no semantic chapter markers. Splitting is implementation-defined; for v1 of the patch a manual `backstoryPages: string[]` array on the Major works fine. **[FILL IN]** — auto-paginate from a single rich-text field, or keep it manual? Manual is simpler and lets writers control page breaks deliberately.

**Length growth.** Adding more backstory text grows N (more spreads), never crowds the character spread. The character spread's backstory teaser stays at a fixed length regardless.

#### 4.4.4 Page-turn animation

**The animation is a real page-turn — one page rotating around the spine — not a card-flip of the whole book.**

Required behavior:

- The transition is on a single rotating element with `transform-origin: left center` and `transform: rotateY(-180deg)` as the target.
- Duration ~0.8–1.0 s, eased.
- Forward navigation (e.g., `character` → `backstory-1`, or `character` → `conn-margaret`): the right page lifts and rotates leftward to land on top of the destination spread's left page. The user sees the next spread's right page revealed underneath.
- Reverse navigation: the inverse — the left page rotates rightward.
- The leather binding, spine, bookmark strap, marginalia, and corner ornaments **do not move** during the animation. Only the turning page moves.
- Bookmark stays attached to the binding through every navigation; it does not flip.
- During the animation, click handlers on the destination spread are inert until the animation completes (no double-trigger).

**Implementation note.** The patch-preview-post-mvp.html currently uses a cross-fade as a placeholder. Replacing it with the page-turn rotation is a CSS-only change once the spread architecture is wired correctly:

```css
.dossier-spread.is-turning-out .dossier-page-right {
  transform-origin: left center;
  animation: pageTurnOut 0.9s cubic-bezier(.7,.05,.3,1) forwards;
  z-index: 5;
}
```

The animation needs to coordinate with the JS that swaps `.is-active` after the rotation completes (`animationend` listener).

#### 4.4.5 Click delegation

A single delegated click handler at `.dossier-book` level catches every navigation:

```js
book.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-goto]');
  if (!trigger) return;
  showSpread(trigger.dataset.goto);
});
```

Any element that should navigate gets `data-goto="<spread-name>"`. That includes connection chips, "continue reading", "next page", "previous page", and "back to dossier" buttons. No per-button handlers, no inline `onclick`.

#### 4.4.6 Esc-to-character keyboard shortcut

Pressing `Esc` while the dossier has focus and is on any non-`character` spread navigates to `character`. Same gesture as Cabinet's Esc-to-close (§9.3) — the user dismisses the current alt spread without reaching for the back button.

Behavior:

- Listener is registered on the dossier root element (`.dossier-book`) at the `keydown` capture phase.
- Triggers only when `currentSpread !== "character"` AND the dossier currently holds focus (`document.activeElement` is inside `.dossier-book`).
- Calls the same `showSpread("character")` path as the back button — animation, click delegation, all consistent.
- **Does NOT** intercept Esc inside text editors, dropdowns, or other components that capture Esc internally. The capture-phase listener checks `e.target.closest('[data-allow-esc]')` and bails if present, OR checks for known editor selectors (TinyMCE, ProseMirror) and respects those.
- **Does NOT** intercept Esc on the `character` spread itself — pressing Esc there does nothing (the dossier sheet's Foundry-default Esc-to-close behavior is preserved).

#### 4.4.7 Drop-state visual for reputation tag drag-drop

When a `reputation-tag` Item is dragged over the dossier's public page (per the existing B-7 drag-drop pipeline that auto-routes by polarity), the destination row receives drop-state styling:

- The destination row (positive or negative, predicted from the dragged tag's `polarity` field) shows a 1.5 px dashed gilt outline and a soft `--gs-paper-warm` background tint at 60% opacity. Reads as "drop here."
- A 2 px gilt insertion line appears between existing pills at the cursor's nearest gap, indicating where the new pill will land.
- The non-destination row (the *other* polarity) dims to 70% opacity to make the active drop target visually obvious.
- The empty-slot placeholder pills in the destination row brighten slightly (full sage outline rather than dashed) to signal "an open slot is here."
- On drop, the ghost line and outlines clear; the new pill animates in with a 200 ms fade.
- On drag-leave or Esc-during-drag, all drop-state styling clears immediately and the row returns to default.

The polarity prediction is read from `dataTransfer.getData("text/plain")` parsing — the dragged Item's polarity is available before drop. If polarity can't be read (e.g., a multi-item drag from another system), the visual falls back to a neutral state — both rows dim to 80% with no insertion line, and the drop is rejected with a small chat warning.

### 4.5 Tokens section (on the public page, not the bookmark)

The bookmark strap is gone. Token state lives on the public page directly, in a paper-warm container under the inner-conflict ledger. Three cells in a horizontal grid, all using the unified-indicator language from §5:

- **Resolve** — 5 small `--gs-brand` pips. Filled = available; outline 45% = spent. Meta line below shows "{current} of {max}".
- **Monologue Token** — pill stamped "MT". Filled `--gs-brand` when the actor holds an unspent token (per `tokens.major`); outline `--gs-brand` when spent. Meta below: "unspent" / "spent this novel". The "MT" abbreviation is preserved on the pill — the v1 data field stays `tokens.major` for backwards-compatibility, but the *user-visible label* is "Monologue Token".
- **Monologue** — single `--gs-brand` dot. Filled when `tokens.monologuedThisCycle` is false; outline 45% when spent. Meta below: "available" / "spent this cycle". A small **"take a monologue ↗"** pill button sits beneath the meta — primary action, triggers the monologue chat-card flow per v1 §10.

**Why this changed.** The bookmark was visually charming but it broke the indicator-unification rule (§5) — wax discs and gold medals are color-driven, not fill-state-driven. Moving tokens onto the page lets them use the same brand-on/brand-off language as everything else, and puts character state next to the rest of character data instead of on a decorative attachment.

**Bookmark fate.** Removed from the dossier. The leather strap is preserved in the v2 walkthrough as historical reference; it doesn't ship in v1 of the patch.

### 4.5b Persona switcher + theme switcher

Both live in a small controls row directly under the cameo bio chips, on the public page.

#### Persona switcher

- Pill button in italic Lora, sage outline, label = active persona's name + a `▾` chevron in gilt.
- Click → dropdown of all personas defined on this Major (per `CLAUDE.md` §6.5). Each item shows the persona's name + a small portrait swatch.
- Selecting → triggers the `switchPersona(actor, newPersonaId)` flow from `CLAUDE.md` §11. That update fans out to: actor portrait, prototype token, every placed token across all scenes, optional VFX, and a chat announcement card respecting visibility.
- A "+ new persona" item at the bottom of the dropdown opens the persona editor (separate v1 §13 component).
- The visible name on the cameo (e.g., "Lady Rose Whitcombe") is the active persona's name, not the actor's underlying name. If the active persona has visibility overrides set to `redact`, the dossier's right-page fields render redacted accordingly.

#### Theme switcher

- A short row of color-swatch discs, one per available theme. Currently visible: 7 swatches for the 7 Majors (Rose, Roger, Clayton, Dixon, Avril, Pearlinda, Secret). Connection variants and house style are not in this row by default — they're available via a "more" button in the dropdown when the row is clicked. **[FILL IN]** — exact swatch row vs. dropdown semantics.
- Each swatch is a 14 px disc filled with that theme's `--gs-brand` color, hairline-bordered.
- The active theme has a 2 px gilt ring around the swatch (separated from the swatch by a paper-color gap to prevent visual collision).
- Click → applies that theme to this actor. Implementation: writes to `actor.flags["good-society-homebrew"].theme` and the `.gs-themed[data-theme="..."]` wrapper picks it up automatically per v1 §02.
- Hover → tooltip with theme name (Rose, Roger, etc.).
- This is per-actor, not per-user. The same actor renders in the same theme for every user that opens its dossier.

### 4.6 Theme integration

Each Major's theme overrides the dossier palette. The dossier's local palette is defined as `--dossier-paper`, `--dossier-rose`, etc., and bound to the active theme via `.gs-themed[data-theme="rose"]` etc. (per v1 `02-theme-architecture.md`).

**Per-theme frame graphics — superseded.** The patch originally introduced a `--gs-frame-asset` CSS variable so each theme could supply a custom frame asset. That approach is dropped. Natalie is producing custom character tokens whose own designs carry whatever framing each character has — see §8.5 (profile picture resolution). The token IS the visual; CSS provides at most a thin sage hairline around it. No per-theme frame assets are required.

### 4.7 Asset hunt

Reputation seal icons should come from a single coherent pack rather than the placeholder shapes in the preview. Search Etsy for, in descending order of fit:

- "wax seal png botanical"
- "regency wax seal clipart set"
- "victorian heraldic badge svg"
- "vintage monogram wax seal"
- "jane austen seal stamp digital"

Format requirements: SVG or transparent PNG, 24×24 to 64×64, on-color or two-color flat (not photographic). One pack of 12–20 motifs covers most of the system's tags; a default fallback (current ▲ / ▼ shapes) handles unmapped tags.

Implementation: add an `icon: string` field to the `reputation-tag` data model pointing at an asset path under `assets/seals/`. Render at 24 px in pendants.

**Cross-reference: shared art direction with Epistolary seals.** The reputation-tag wax pack and the Epistolary seal-disc art (per §11.2) come from the same illustrator / art family. Both vocabularies use period-illustrative line work, hairline 0.5–1 px strokes, two-color or on-color flat fills (not photographic), and consistent silhouette weight. They will appear on screen simultaneously during epistolary phase (Major's dossier on the left, Epistolary panel on the right) — visual coherence between the two seal vocabularies prevents the screen reading as two different products. The §8.3 carve-out (shape + border weight differentiator) keeps them functionally distinct; this cross-reference keeps them stylistically unified.

---

## 5. Indicator unification

**One rule.** Every indicator in the system follows the same on/off treatment. Color is semantic background only (positive / negative wax seals, danger states); function and "available vs. spent" state are carried by **fill vs. outline of `--gs-brand`**, not by color.

### 5.1 The rule

- **Available / active state:** filled `--gs-brand`.
- **Spent / unavailable state:** outline `--gs-brand`, ~45% opacity.
- **Shape carries semantics:** pill = MT, dot = monologue, pip = resolve, square = inner-conflict box. Color does not change between states.

### 5.2 Components affected

- Resolve pips (Major and Connection).
- MT pill (dashboard, dossier, anywhere it appears).
- Monologue dot (dashboard, dossier).
- Inner-conflict ledger boxes — filled `--gs-brand`, empty = outline. Currently mixes left/right tints in v1.
- Persona switcher — active persona's frame in `--gs-brand`, dormant in `--gs-muted` outline.
- Cycle-phase HUD pips — past = filled, current = filled solid + halo, future = outline.
- Connection ownership badges (shared / promoted to OWNER) — outline vs. filled.
- Pending-changes log entries — resolved = filled, unresolved = outline. Severity carried by icon shape, not color.
- Reputation tag count chips on token-hover — same.

### 5.3 Reserved exceptions

The following components keep semantic color because color carries meaning, not state:

- Wax-seal reputation pendants — green for positive, red for negative. The seal itself is colored; the surrounding chip is not state-coded.
- Active-condition laurel — gilt always. Not bivalent.
- Reputation criteria block — paper-warm always.

---

## 6. Theme color slots

**Updated 2026-05-08.** Theme registry overhauled. Mags is renamed to Secret (palette refined). Pearlinda added as a seventh Major theme. Slot model standardized at 9 slots per theme. The new color values come from Natalie's `GS Build Colors.pdf` and are canonical.

Every theme — house, the seven Majors, the five Connection variants, NPC — defines the same 9 slots. The patch keeps connection variants and NPC inheritance unchanged from v1; the changes here apply to House and the Major themes.

### 6.1 Surfaces (2)

| Variable | Role |
|---|---|
| `--gs-paper` | Primary paper background ("Surface" in the color spec). |
| `--gs-paper-warm` | Secondary surface for raised panels, row backgrounds, modal interiors ("Raised Surface" in the color spec). |

### 6.2 Text (1)

| Variable | Role |
|---|---|
| `--gs-ink` | Body text. Per-theme value tuned for 7:1 contrast on that theme's `--gs-paper`. |

Muted text (timestamps, metadata, secondary labels) is derived in CSS via `color-mix(in srgb, var(--gs-ink) 65%, transparent)` rather than maintained as a separate slot. Tertiary surface (book inner page, secret-state backgrounds) is similarly derived from `--gs-paper-warm` at the component level — no `--gs-paper-aged` slot.

### 6.3 Brand & accents (4)

| Variable | Color spec name | Role |
|---|---|---|
| `--gs-brand` | Brand | Theme's identifying color. Indicator fills, primary buttons, theme accent stripes, persona switcher swatch outlines. |
| `--gs-accent-1` | Headers & Eyebrows | Section headers, eyebrow labels, drop-caps. Distinct hue from `--gs-brand`. |
| `--gs-accent-2` | Hairlines (Dividers on House) | Hairline borders, subtle dividers, italic role text. Low contrast intentional. |
| `--gs-accent-3` | Metallic | Gilt highlight. Cycle-phase italics, asset corners, indicator wax-seal dots. Universal `#C9A55C` on every theme except Secret (`#AAA9AD` — silver to fit the dark-paper register). |

### 6.4 Semantic — light + dark variants

| Variable | Light value | Dark value | Role |
|---|---|---|---|
| `--gs-positive` | `#4A7A4A` (verdant) | `#77c477` (mint-bright) | Positive-reputation tags, success states. |
| `--gs-danger` | `#8B2A2A` (oxblood) | `#dd4242` (clear red) | Negative-reputation tags, scandals, destructive actions. |
| `--rep-positive-bg` | `rgba(74,122,74,.08)` | `rgba(119,196,119,.12)` | Background fill behind positive rep-tag pills. |
| `--rep-negative-bg` | `rgba(139,42,42,.08)` | `rgba(221,66,66,.12)` | Background fill behind negative rep-tag pills. |
| `--rep-empty-fg` | `rgba(112,128,96,.4)` | per-theme | Color/border for empty rep-tag slots ("open slot"). |

**The rule.** Reputation tags use these functional colors directly — *never* a per-theme accent. Green is positive on every Major's dossier (Rose, Roger, Clayton, Dixon, Avril, Pearlinda, Secret); red is negative on every Major's dossier. The rep-tag styling does not theme-shift with the rest of the page. This is a load-bearing affordance — the player needs to read positive vs. negative at-a-glance regardless of which character they're looking at.

**Dark themes opt in.** The three dark Majors (Avril, Pearlinda, Secret) override `--gs-positive`, `--gs-danger`, `--rep-positive-bg`, `--rep-negative-bg`, and `--rep-empty-fg` to the dark-mode values. Light themes (House, Rose, Roger, Clayton, Dixon) inherit the light values from `:root`. New dark themes added later must do the same.

### 6.5 Theme registry — palette assignments

Per `GS Build Colors.pdf` (2026-05-08). Every Major theme provides explicit values for all 9 slots; this table is the canonical source until further notice.

#### House (revised)

| Slot | Value |
|---|---|
| `--gs-paper` | `#EFE6D2` |
| `--gs-paper-warm` | `#F4ECD8` |
| `--gs-ink` | `#3D2F26` |
| `--gs-brand` | `#2A3A2D` (forest green) |
| `--gs-accent-1` | `#B85C3F` (terracotta) |
| `--gs-accent-2` | `#708060` (sage) |
| `--gs-accent-3` | `#C9A55C` (gilt) |
| `--gs-positive` | `#4A7A4A` |
| `--gs-danger` | `#8B2A2A` |

#### Major character themes — full per-theme palettes

| Theme | Paper | Raised | Ink | Brand | Accent-1 (Headers) | Accent-2 (Hairlines) | Accent-3 (Metallic) | Cream-surface accent |
|---|---|---|---|---|---|---|---|---|
| `rose` | `#FAF1ED` | `#FAF1ED` | `#4A2030` | `#B85B6F` | `#ad4865` | `#708060` | `#C9A55C` | `#B85B6F` (brand) |
| `roger` | `#F1F0F8` | `#FAF1ED` | `#1F2A4A` | `#4A6B8B` | `#144c82` | `#C5D5E8` | `#C9A55C` | `#4A6B8B` (brand) |
| `clayton` | `#F1F0F8` | `#FAF1ED` | `#1F2A4A` | `#4a6b3f` | `#1d65ab` | `#C5D5E8` | `#C9A55C` | `#4a6b3f` (brand) |
| `dixon` | `#fadbcf` | `#FAF1ED` | `#2A1812` | `#8B2A22` | `#a66f00` | `#5C3A28` | `#C9A55C` | `#8B2A22` (brand) |
| `avril` ⚑ | `#2f1734` | `#2E3340` | `#E8DDC8` | `#8f6692` | `#7cdfd0` | `#2f1734` | `#C9A55C` | `#8f6692` (brand) |
| `pearlinda` ⚑ | `#74195d` | `#9b3782` | `#fde1f6` | `#8f6692` | `#ffbde4` | `#e8abd9` | `#C9A55C` | `#8f6692` (brand) |
| `secret` ⚑ | `#0F1014` | `#2E3340` | `#C8C5C0` | `#8E96A8` | `#8da5af` | `#485468` | `#AAA9AD` | `#485468` (substituted — see exception) |

⚑ **Dark themes** — Avril, Pearlinda, Secret. They opt into the dark-mode `--gs-positive` / `--gs-danger` / rep-tag-bg variants per §6.4.

⚑ **Cross-surface exception (Secret only).** Secret's brand `#8E96A8` (cool grey) lacks contrast on cream surfaces (~3:1, below WCAG AA). On shared cream surfaces — dashboard accent stripes, dossier theme swatches, persona-switcher swatches, themed dashboard rows — Secret substitutes its `--gs-accent-2` value `#485468` (dark steel) so it has visible identifying color. On Secret's own sheet body (where the surface is `#0F1014`), the cool grey brand is calibrated and used as designed.

Avril and Pearlinda both use brand `#8f6692` (mauve) — a deliberate shared identifier across the patch's two purple-leaning themes. The mauve at ~3.4:1 contrast on cream is acceptable for chip-stripe accents (decorative, not body text). No substitution needed for these two.

#### Theme renames and additions

- **Mags → Secret.** The dark-paper grey-brand theme is renamed. Same conceptual register; refined palette per the PDF. Existing actors with `theme: "mags"` need migration on data load — a one-time hook in `Hooks.once("ready", ...)` rewrites any `theme === "mags"` to `theme === "secret"` for GM clients only.
- **Pearlinda — new.** Saturated dark-magenta theme, mauve brand, light-pink eyebrows. Joins the dark-theme group with Avril and Secret.
- **Six → seven Majors.** Theme enum becomes `["rose", "roger", "clayton", "dixon", "avril", "pearlinda", "secret"]`. Update `module/data-models/major-character.js` schema and `lang/en.json` theme labels accordingly.

The full per-theme files live at `styles/themes/_theme-{id}.css`. Implementation: rename `_theme-mags.css` → `_theme-secret.css` (with palette refresh), create `_theme-pearlinda.css`, and refresh the existing `_theme-rose.css` / `_theme-roger.css` / `_theme-clayton.css` / `_theme-dixon.css` / `_theme-avril.css` with the new values.

#### Connection variants

Five locked variants from v1, each with a 3-color palette (ink / brand / accent-1):

| Variant | Brand (used as `--connection-color`) | Ink | Accent-1 | Source |
|---|---|---|---|---|
| `connection-green` | `#6B8A4F` | `#2A4A2D` | `#B8C99A` | `decisions.md` :251–254 |
| `connection-purple` | `#6B4A7A` | `#3A2A4A` | `#C0A8C9` | `decisions.md` :257–260 |
| `connection-blue` | `#2D4A75` | `#15244A` | `#A0B5D0` | `decisions.md` :263–266 |
| `connection-yellow` | `#B88B33` | `#6B4A1A` | `#E8D4A0` | `decisions.md` :269–272 |
| `connection-grey` | `#5C6068` | `#2A2D32` | `#B8BCC0` | `decisions.md` :275–278 |

All five variants share the house style's paper, paper-warm, and font stacks (Lora + Crimson Text) — only the ink/brand/accent-1 trio changes per variant.

**Connection chip and connection-cameo gradient mapping.** When a Connection actor is assigned a variant, the dossier wires:

- The connection chip's `--connection-color` to the variant's brand.
- The connection portrait disc background to the variant's brand.
- The cameo gradient on the connection's spread to a 3-stop linear gradient: `accent-1 → brand → ink` (light to dark, top-left to bottom-right).
- The connection's right-page eyebrows (Public description, Public impressions, Tied to) to the variant's brand color.

#### Worked example — Rose's three current Connections

| Connection | Assigned variant | Cameo gradient |
|---|---|---|
| Margaret Halloway | `connection-purple` | `#C0A8C9 → #6B4A7A → #3A2A4A` |
| Thomas Wren | `connection-yellow` | `#E8D4A0 → #B88B33 → #6B4A1A` |
| Lady Verriere | `connection-grey` | `#B8BCC0 → #5C6068 → #2A2D32` |

The remaining two variants (`connection-green`, `connection-blue`) are unused by Rose's current connection set; they're available for future Connections.

#### NPC theme

NPCs use the house style as their personal theme. No separate palette. (`decisions.md` :282–290.)

#### House style

See §6.1–6.5 above. v1 root values: `decisions.md` :73–83.

---

## 7. Font rules

A contract, not specific fonts. The patch deliberately doesn't pick final fonts.

### 7.1 Slots

- `--gs-display` — headings, character names, indicator text, eyebrows. Serif display face.
- `--gs-body` — paragraphs, italic body, sentence-cased UI. Serif body face.
- `--gs-ui` — small-caps labels, button text, timestamps. Sans-serif. **Required to be sans-serif** for legibility at 10–11 px; serif faces collapse at that size.
- `--gs-ornament` — single decorative face used in **exactly one place**: the first letter of the character name on the dossier cameo. Currently set to **Lavishly Yours** (Google Fonts). May be empty / unset on themes that don't want an accented capital, in which case the slot falls back to `--gs-display`.

### 7.2 Sourcing

- Any Google Font is fair game for `--gs-display`, `--gs-body`, and `--gs-ornament`. Add each to `system.json`'s `styles` array.
- `--gs-ui` stays as a system stack; no Google Font.

### 7.3 Two body faces, one ornament — the contract

The dossier and every other surface should use exactly two non-UI faces — one display, one body. **Lavishly Yours (or whatever fills `--gs-ornament`) is a deliberate exception, scoped to exactly one place: the first letter of the character name in the cameo.** It must not appear in headings, paragraph drop-caps, button text, or anywhere else. The v2 walkthrough used eight faces sprinkled across the page; the patch keeps a hard ceiling.

### 7.4 Pairing guidance

Pair one serif display with one serif body face from a similar era. Working pairs:

- Lora (display) + Crimson Text (body) — current default.
- Cormorant + EB Garamond — more elegant, slightly less legible.
- Playfair Display + Lora — bigger contrast.
- Cardo (single face used for both) — very Pentiment.

**[FILL IN]** — Natalie picking final pair.

---

## 8. Primitive components

Three primitives that the patch introduces or supersedes. Each is a system-wide rule, applicable to every themed and house-styled surface. Treat them as cross-cutting — when implementing a new sheet, modal, app, or chat surface, expect to use these unmodified.

### 8.1 Eyebrow heading

The eyebrow is the primary section-header device on every surface — dossier sections, dashboard panels, Cabinet group labels, Epistolary tabs, item sheets, modals. The patch supersedes v1 §23's eyebrow primitive.

**Standalone variant.** Default for top-level section labels.

- Family: `--gs-display` (Lora 600 in the current pair).
- Size: 11.5 px.
- Letter-spacing: 0.18 em.
- Case: uppercase.
- Color: `--gs-brand`. On themed surfaces this resolves per-actor; on house-styled surfaces this is forest green.
- Below: 1 px hairline divider in `--gs-accent-2` (sage on the house; per-theme on themed surfaces).
- On the right edge of the divider: a small gilt diamond `◆` in `--gs-accent-3`, generated via `::after` pseudo-element with a paper-cream background cutout so it visually breaks the line.
- Rhythm: 9 px margin-top on the content below; 5 px padding-bottom under the divider.

**Subdued variant.** For eyebrows nested inside a contained block (rep-criteria, conflict-title, tokens cell, item-sheet field group) so they don't double-line with the container's outer hairline.

- Family: `--gs-display` (Lora 500).
- Size: 11 px.
- Case: uppercase.
- Color: `--gs-accent-2` (sage).
- No divider, no diamond.

**CSS class names.** `.gs-eyebrow` for standalone; `.gs-eyebrow--subdued` for nested. The diamond is a `::after` pseudo, not inline text — it's invisible to copy-paste and to screen readers.

**Where it replaces the v1 §23 eyebrow.** Every surface in the system. v1 §23's smaller Crimson italic 11 px at 0.85 opacity is superseded; v1 §23 should be amended to point here once the patch lands.

**Edge cases.**

- Long labels (3+ words) wrap to a second line. The diamond stays anchored to the right edge of the (now wider) divider; the divider extends to the wrapped width.
- Narrow columns (≤ 280 px) — prefer the subdued variant even at top level so the divider doesn't dominate.
- Two eyebrows back-to-back with no content between them — collapse to a single eyebrow with the more specific label; never stack.

### 8.2 Empty-state primitive

Used wherever a list, container, or surface can be empty by user action or by config: empty Cabinet (everything hidden), empty Epistolary inbox, empty outbox, empty connections list on a Major's dossier, empty pending-changes log, empty session log, etc.

**Composition.**

- Body: italic `--gs-body` (Crimson Text Italic) at 14 px, color `--gs-ink-soft`. One short sentence, sentence case, no period.
- Optional pill: standard primary pill in `--gs-brand` outline (not filled), label in sentence case, ends with `↗` if the action navigates.
- Centered horizontally. Top/bottom padding scales with the container — 24 px in small panels, 48 px in full-page surfaces.

**When to use.**

- Empty container with a meaningful next action: include the pill. Example — empty inbox → *"No letters this cycle yet"* + a `Compose a letter ↗` pill.
- Empty container with no action or where the action is implicit: body line only. Example — empty connections list on a dossier → *"No connections yet"*.

**When NOT to use.**

- A surface whose intended state *is* "nothing here right now" — for example the dossier's active-condition slot when no condition is active. That's not an empty state; it's a different display mode. Use the per-component empty styling defined in the host section (§4.1 for the active-condition slot, etc.).
- Loading states. Loaders get a separate spec; this primitive is for genuine empty data, not transitional states.

**CSS class names.** `.gs-empty-state` (wrapping container), `.gs-empty-state__body` (italic line), `.gs-empty-state__action` (optional pill).

**Worked example.**

```html
<div class="gs-empty-state">
  <p class="gs-empty-state__body">No letters this cycle yet</p>
  <button class="gs-empty-state__action">Compose a letter ↗</button>
</div>
```

### 8.3 Seal vs rep-color carve-out

Rep tag pills (§6.4) and Epistolary seal discs (§11.2) both use color semantically. They will appear adjacent on screen — a Major's dossier on the left, the Epistolary panel on the right — during epistolary phase. Without a visual differentiator, a green seal will read as a positive rep tag and a red seal as a negative one. This carve-out locks the differentiator so the two vocabularies stay readable.

**The rule (locked).**

- **Shape.** Rep tags are pills (rounded rectangles, ~18 px tall, full hairline border). Seals are discs (perfect circles, ~28 px diameter, gilt border).
- **Border.** Rep tags carry a 1 px hairline in their functional color (sage / terracotta, or the dark-theme variants on Avril, Pearlinda, Secret). Seals carry a 2 px gilt border in `--gs-accent-3`, regardless of seal color.
- **Position.** Rep tags appear in horizontal rows on the dossier's public page. Seals appear at the leading edge of inbox/outbox letter rows in the Epistolary panel. They are never co-located in the same row.

**Future seal types.** Any seal added to `SEAL_TYPES` keeps the disc shape and the gilt border. New seal colors that drift into rep-color territory (e.g. a "verdant treaty" seal in green) remain visually distinct via shape + border, not color.

**Future rep colors.** None planned. The functional rep palette is locked to verdant + oxblood (with dark-theme variants on Avril, Pearlinda, Secret). If new functional colors land for a different purpose (e.g. a "tracked" status in mint), they must avoid the seal palette and use a different shape primitive.

### 8.4 Persona switcher pill

A small inline picker that swaps which persona is active on an actor. Lives on four surfaces — dossier cameo (canonical instance, §4.5b), Connection sheet header, NPC sheet header (when the actor has personas), Speaking-As bar above chat, and the My Characters Dock footer. Same primitive on every surface; visual drift between instances is forbidden.

Full spec: [`patch-persona-switcher.md`](./patch-persona-switcher.md).

**The contract in brief.**

- Pill: italic Lora 13 px label + gilt `▾` chevron, sage hairline border, paper-warm background, ~24 px tall.
- Two states: "true identity ▾" when no explicit persona is selected; "{persona.name} ▾" when one is active.
- Dropdown: opens downward by default (flips upward in the bottom 30% of viewport), z-index 500. Each item is a 32 px row with 18 px portrait swatch + persona name; first item is always "true identity," last is always "+ new persona" (which opens the v1 §13 editor in create mode).
- Theme behavior: pill body uses the host surface's brand color (per-actor on dossier and Connection sheet, house style elsewhere). Persona `chatColor` overrides tint the chevron only when that persona is active.
- Active marker on dropdown items is gilt, not brand — keeps it stable across personas with `chatColor` overrides.
- One delegated click handler at `document` level (capture phase), matching the Speaking-As pattern. No per-pill handlers.

v1 §13 (persona editor modal) stays untouched. This primitive owns the *quick-switcher*; v1 §13 owns the *editor*.

### 8.5 Profile picture resolution

A single rule for resolving the visual that represents a character anywhere in the system — sheets, dashboard, dock, hover cards, chat cards, letter cards, monologue overlay, persona switcher dropdowns, journal sidebar entry-type rows, the Novel Reader's entries, and any future surface that shows "a character's face."

**The rule.** Every profile pic resolves from the actor's *token* image, not a portrait image. With persona override:

```
profilePicUrl = activePersona?.tokenImageUrl || actor.prototypeToken.texture.src
```

**Why tokens, not portraits.** Natalie is producing custom illustrated tokens for every character — designed with each character's visual identity baked in (period-illustrative, on-theme, framing as desired). The token IS the cameo. The previous design assumed a separate `--gs-frame-asset` overlaid on a portrait — that asset slot is gone (see §6 below); the token's own design provides whatever framing each character has.

**Display shape stays per-context.** The token image is the source; CSS still controls the surrounding shape — circular for cameos and dock portraits, smaller circular for chat cards and persona switcher swatches, square or full-bleed circular for the monologue overlay's large cameo (~380 px). Surrounding chrome (hairlines, color stripes, theme accents) is per-surface; this rule only governs the *image source*.

**Helper.** A new pure helper `module/helpers/profile-pic.js` exports `profilePic(actor)` returning the resolved URL. Every render path uses the helper rather than reaching into the persona resolution inline. Single source of truth; trivial to update if Foundry's token API changes.

**Persona switcher dropdown swatches (§8.4).** Each dropdown item's 18 px swatch shows the persona's `tokenImageUrl`. The "true identity" item shows `actor.prototypeToken.texture.src`. The "+ new persona" item shows no swatch.

**Migration / data model.** No migration needed. The patch only changes which field is read at render time. Existing `actor.img` and `persona.portraitUrl` fields stay in the schema for forward compatibility — nothing in the patch reads them, but they're harmless if populated. A future cleanup may consolidate fields if Natalie confirms portrait fields aren't needed at all; for now they're inert.

**Anti-pattern (logged in CLAUDE.md §16 once the patch ships).** Don't inline `activePersona?.portraitUrl || actor.img` in render code. Always go through `profilePic(actor)`. Inline portrait resolution will silently miss the token-based source, and the surface will show stale or empty portraits when actors lack `actor.img` (which can happen — `actor.img` is editable but optional).

---

## 9. Player Module Menu — the Cabinet

An on-theme drawer for collapsing every module at once.

### 9.1 Default state (rail)

A vertical strip on the right edge of the screen. Each glyph is a single letter representing a module (P = Public Info Dashboard, D = My Characters Dock, etc.). A small dot in the upper-right of each disc indicates whether the module is currently visible.

### 9.2 Expanded state (drawer)

Click the `≡` toggle at the bottom of the rail. A drawer slides out to the left, covering the rail. Three groups:

- **Good Society — System** (our surfaces): Public Info Dashboard, My Characters Dock, Cycle-Phase HUD, Session Log.
- **Player modules** (third-party): Sequencer, Combat Tracker, Token Mold, Dice Tray, etc.
- **Foundry chrome** (the native app): Players list, sidebar.

Each row has a label, a location hint ("dock · bottom"), and an on/off toggle. Header in `--gs-accent-1` small caps; row text in `--gs-body`.

### 9.3 Bulk actions

- "hide all" / "show all" at the foot of the drawer.
- ESC closes the drawer.

### 9.4 State

Persisted per-user in `game.user.flags["good-society-homebrew"].cabinetVisibility` as `Record<moduleId, boolean>`.

### 9.5 Implementation

Custom `ApplicationV2` window. Inherits the system's `.gs-themed` wrapper so theme swaps apply automatically. Lives in `module/apps/cabinet.js`.

### 9.6 What stays out of the rail

The Cycle-Phase HUD is listed in the cabinet (so players *can* hide it) but its default is "always visible at top, not in the rail." Otherwise it stays a fixed UI component per v1 §08.

---

## 10. Cosmetic facelift for v1 surfaces

Light pass only. **No behavior or function changes** to any of the following.

### 10.1 Cycle-Phase HUD

Adopts the indicator unification from §5 (filled vs. outline pips). May get a faint paper-warm + hairline backing if it ends up adjacent to the cabinet. Otherwise unchanged from v1 §08.

### 10.2 Token hover card — configurable, per actor type

Beyond a cosmetic pass, the hover card gains real configuration so each actor type produces a meaningful summary on canvas hover. v1 §17 designed the hover card as a shared component pulling `sceneInfo.hoverSummary`, but the Major data model never defined that field — so today Major hover cards are mostly empty (per the B-4 decision: "Major hover card falls back to `activePersona.hoverSummary` (if set) or empty"). This patch fixes that and gives each actor type a fit-for-purpose configuration.

**Three resolution paths** depending on actor type:

#### Major (PC) — auto-derived public summary

The hover card auto-renders an abridged version of the Major's public dossier data. No `sceneInfo.hoverSummary` field on Majors — the card composes from existing fields:

- **Header:** display name (persona-aware per §8.5) + role / peerage subtitle.
- **Active condition:** if `reputation.activeConditions` is non-empty, render the laurel chip from §4.1 (compact pill — laurel icon + condition label).
- **Reputation snapshot:** up to 3 tags total, prioritized in this order: (a) the highest-pinned positive tag, (b) the highest-pinned negative tag, (c) one more of either polarity. Pills render in their functional sage/terracotta colors per §6.4 (with dark-theme variants on Avril/Pearlinda/Secret).
- **Family criteria:** one line — `Family.uniqueNegativeRepCriteria` if it would resolve to OBSERVER for the viewing player; omitted otherwise.
- **Footer:** small italic Crimson "Open dossier ↗" link (clicking opens the actor sheet — same gesture as a left-click on the token, but the affordance is explicit on the card).

The Major hover card is purely derived. There's no separate hover-text field on the actor; the GM doesn't author it. If the underlying public data changes, the next hover reflects it. Privacy is enforced by the same per-field visibility logic that governs the dossier itself — nothing on the hover card is information the viewing player couldn't see by opening the dossier.

#### NPC — GM-authored rich text

NPCs get a real configuration surface. The `sceneInfo.hoverSummary` field upgrades from plain string to **rich HTML** (Foundry TextEditor). The NPC sheet (per v1 §16) gains a new **Hover card** section with:

- **Subtitle line** — short single-line input, ~50 chars, italic Crimson rendering (e.g., "*Lady Hetherington's lady's maid*").
- **Body** — HTML TextEditor, rendered as the card's main descriptive text. Supports italic, bold, links, and inline images. ~200 char soft-recommended length; nothing enforces a hard cap.
- **Public tags** — the existing `sceneInfo.publicTags` array, rendered as small subdued pills below the body.
- **Visibility** — the body and subtitle render as authored on hover; no per-field visibility controls (NPCs are GM-authored content, and what the GM writes is what shows). The ENTIRE hover card can be hidden via existing NPC ownership permissions — if a player can't see the NPC actor at all, no hover card appears.

This makes NPCs the most-configurable actor type for hover. Suitable for "the bartender's bartender" or "Mr. Crowley, who has a dark history with Lady V" — whatever the GM wants players to know on first glance.

#### Connection — GM-authored (same as NPC)

Connections use the same authoring surface as NPCs — rich-text body, subtitle line, public tags. The Connection sheet (per v1 §6.2) already has `sceneInfo.hoverSummary` and `publicTags`; this patch just upgrades the field type to HTML and adds the subtitle.

The result reads similarly to an NPC hover, but the Connection's theme variant accent stripes the card (whereas NPCs are house-styled).

#### Visual contract — shared across all three types

- Width: ~280 px.
- Background: `--gs-paper`. Theme-aware per actor (`.gs-themed[data-theme="..."]` wrapper for Connections; house style for NPCs; per-actor theme cascade for Majors).
- 4 px left-edge accent stripe in the actor's theme `--gs-brand` (per §6.5 cream-surface registry).
- Token image at the upper-left (~36 px circle), per §8.5 profile-pic resolution.
- Eyebrow above the body — display name (Lora 600, 13 px, brand color). Role/peerage subtitle below in subdued sage italic 11.5 px.
- Body text in `--gs-body` 12.5 px.
- Tag pills along the bottom in their respective styling (rep tags for Majors; subdued sage pills for Connections/NPCs).
- Indicator unification per §5 — any indicators inside the card (a Major's resolve count, for example) follow the brand-on / brand-off rule.

#### Schema additions

| Actor type | Field | Type |
|---|---|---|
| Connection | `system.sceneInfo.subtitle` (new) | StringField |
| Connection | `system.sceneInfo.hoverSummary` | type changes from `StringField` to `HTMLField` |
| NPC | `system.sceneInfo.subtitle` (new) | StringField |
| NPC | `system.sceneInfo.hoverSummary` | type changes from `StringField` to `HTMLField` |
| Major | (none) | derived only |

Migration on load: any existing `sceneInfo.hoverSummary` strings stay valid as HTML (plain text is valid HTML). No data conversion needed; just the field type upgrade.

#### Settings

- `hoverCardEnabled` (client, default `true`) — disables the entire system hover card; falls back to Foundry's default token tooltip.
- `hoverCardMajorAutoSummary` (world, default `true`) — when off, the Major hover card renders only the header (name + subtitle) without the auto-derived snapshot. Useful for tables that prefer a minimal hover.

Implementation: `module/apps/token-hover-card.js` (existing per v1 §17 / B-4 vanilla DOM popover) gains type-dispatch in `_buildContent()`. Three render paths, one for each actor type, all sharing the same outer container CSS in `styles/components/_token-hover-card.css`.

### 10.3 Functional modules

Same data, same wiring, lighter visual touch consistent with the dashboard pass: a thin outer hairline frame, paper-warm backgrounds where they help separation, indicators unified.

Surfaces affected, all from v1: Chat Cards (§10), Upkeep Wizard (§11), Item Sheets (§12), Persona Switcher (§13 — editor only; the quick-switch pill is governed by patch §8.4 / `patch-persona-switcher.md`), Family Sheet (§14), NPC Sheet (§16), Condition Picker (§18), GM Tools (§19), Bulk Permissions Panel (§22), Session Log (§24), Pending Changes Log (§26), Token Frame (§27), Foundry Chrome Theme (§28).

### 10.4 My Characters Dock — full parity with the dashboard

The dock (v1 §09) is the most-clicked surface in the system. The patch brings it to full visual parity with the Public Info Dashboard (§3) rather than the lighter touch §10.3 specifies for the rest of v1.

**Adopted from §3 (dashboard):**

- **Outer frame:** thin paper-warm + sage hairline, matching the dashboard's outer container language. Reads as one object on the canvas.
- **Indicator unification:** every indicator (resolve pips, MT pill, monologue dot, persona switcher chevron) follows the §5 rule — `--gs-brand` filled vs. `--gs-brand` outline, no semantic-color states.
- **Theme accent stripe:** each Major's row carries a 4 px left-edge accent stripe in the actor's theme `--gs-brand` (per the cream-surface registry in §6.5). Secret substitutes its hairline value `#485468` per the dark-theme cross-surface exception; Avril and Pearlinda use their brand directly (mauve at acceptable contrast for chip stripes).
- **Conditions sub-rail (per §3.3):** active conditions render as a hairline strip below each row's main grid. Strip is hidden when no conditions are active. Same 28 px height, same pill geometry, same wrap rules — but the dock's narrower row width means wrap will trigger sooner. The "+ N more" pill is the same.

**Specific to the dock:**

- **Footer persona switcher:** a single Speaking-As pill in the dock footer (per `patch-persona-switcher.md` §3.4). House-styled. Mirrors the Speaking-As bar above chat — they're the same control, two visual placements.
- **Drag handles:** rows remain reorderable per v1 §09. Drag affordance stays as the existing 6 px gripper at the right edge; no visual change from v1.

**Not adopted from the dashboard:**

- The dashboard's GM bulk-actions bar at the top — dock has no equivalent.
- The dashboard's footer with refresh time — dock has the persona-switcher footer instead.
- The dashboard's 6-column wide grid — dock rows are denser; columns may collapse or stack on narrow dock widths per v1 §09.

**Why parity rather than light pass.** The dock and dashboard share their row vocabulary (themed accent + portrait disc + indicators + name). Pure asymmetry — dashboard gets the new outer frame + sub-rail, dock doesn't — would make adjacent surfaces look like different products. The increment in scope is small (CSS-only — the dock's data shape and click handlers are unchanged) and worth doing.

---

## 11. The Epistolary Wizard

A phase environment built around the locked v1 composer + letter card. The composer (`05-epistolary-ui.md`) handles writing one letter; the wizard wraps that with the rest of the experience — what you've received, what you've sent, when you're done writing for the cycle, and a small typed seal registry that gives wax colors mechanical meaning.

Full spec: [`patch-epistolary-wizard.md`](./patch-epistolary-wizard.md). Visual reference: [`patch-epistolary-wizard-preview.html`](./patch-epistolary-wizard-preview.html).

### 11.1 Three-tab structure

- **Inbox** — letters received this cycle (or all cycles, via toggle), with seal-color filter chips, unread badges, click-through to full letter card detail.
- **Compose** — embeds the existing `LetterComposer`. The composer's chrome (title bar + footer) hides when embedded; the wizard's footer adopts cancel / save / send.
- **Outbox** — letters this actor has sent, with status (delivered / read / burned / unread by recipient).

Tab badges show unread count (Inbox) and sent count (Outbox). Letter rows use the dashboard's row language — accent stripe, themed cameo, subject + snippet, status pill.

### 11.2 Seal-type registry

`05-epistolary-ui.md` left seal color as "pure flavor; doesn't gate visibility or trigger anything." This patch supersedes that decision: seal types are a typed registry in `module/constants.js`, each with id, label, color, custom illustration asset, optional behavior, and description.

Three seed seals ship:

| ID | Label | Color | Behavior |
|---|---|---|---|
| `yellow-casual` | Casual | gold (#C9A33C) | none |
| `red-invitation` | Invitation | sealing-wax red (#8B2A2A) | fires `invitation-sent` hook (session log subscriber writes "X invited Y") |
| `green-burn` | Burn after reading | verdant (#4A7A4A) | letter destroys itself once opened (see §11.3) |

The registry is extensible. Future seal types (mourning, ceremonial, secret, contract) get added to the array; the composer's seal picker, the inbox row's disc, and the filter pills auto-update. Custom illustration assets live at `assets/seals/{seal-id}.png` — GM-supplied, expected as 64×64 transparent PNG/SVG.

**Cross-reference: shared art direction with reputation-tag wax pack.** The Epistolary seal discs and the dossier's reputation-tag wax pack (per §4.7) come from the same illustrator / art family — period-illustrative line work, hairline 0.5–1 px strokes, two-color or on-color flat fills, consistent silhouette weight. They appear on screen simultaneously during epistolary phase, so stylistic coherence matters. The §8.3 carve-out keeps them functionally distinct (shape + border weight); this cross-reference keeps them stylistically unified.

### 11.3 Burn-after-reading mechanic

When a green-seal letter is opened in the recipient's wizard:

- A small green-positive eyebrow at the top of the detail view warns "This letter burns when you close this view."
- The recipient reads. They may take notes / screenshot.
- On close (or auto-burn after 30s away), the chat message's `content` is replaced with "(Burned. The letter is destroyed.)"; the inbox row vanishes for the recipient; the outbox row for the sender shows status "Burned · cycle N."
- A 1.5s CSS keyframe (no Sequencer) animates the card's destruction — fade + a small flame.
- Original content is preserved in `flags.burnedContent` for GM forensics, configurable per-world via `epistolaryBurnsRespectGM` setting.
- A "Burn now ↗" action lets the player burn deliberately rather than waiting.

### 11.4 GM Roster

Companion app (parallel to the existing Upkeep Roster). Auto-opens when `cyclePhase` becomes `epistolary`. Shows:

- Each Major's row with theme stripe, sent / received counts, ✓ done or ⏳ pending.
- "3 of 6 done" summary at the foot.
- Poke laggers (whisper to the not-done players), Unlock all (clears done flags), Advance phase ↗ (calls `cycleAdvance()`).

Auto-closes when the phase advances past epistolary.

### 11.5 Mark-done flow

Each player marks their actor done with the cycle's epistolary phase via a footer button. Sets `flags.epistolaryDone[cycleNumber] = true`. The compose tab disables; reply buttons disable. They can still read inbox, browse outbox. GM can unlock if needed.

### 11.6 Reuses from `05-epistolary-ui.md`

Composer, letter card, `themedWrap()`, send flow (chat post + journal archive), `epistolary-sent` hook, drafts auto-save, persona `chatColor` override on letter card brand. None of these are touched. The wizard hosts them.

---

## 12. Token spend events

Resolve token and monologue token spends become deliberate moments rather than silent state toggles. The patch matches two rulebook rituals: the *negotiation handoff* described on p.70 ("give the token to that player or a connection they control upon successful negotiation") and the *scene freeze* prescribed on p.103 ("we pause the action and focus on the major character's inner world").

Full spec: [`patch-token-events.md`](./patch-token-events.md).

### 12.1 Resolve token spend

Click an available pip on the dossier → a `DialogV2` opens with two paths:

- **Discard** — primary, most spends. Pip flips state with a 400 ms animation (gilt particle puff → cross-fade to outline). Themed system chat card posts: spender cameo + "*{Actor} spends a resolve token.*" + remaining count.
- **Hand to another →** — for negotiation. Picker lists all valid recipients (other players' Majors, other-owned Connections, GM-controlled Connections). On confirm, the pip clones to position-fixed and tweens across the screen along an eased arc (~1.2 s) to the recipient's resolve track — wherever it's currently visible (their dossier, dock row, or dashboard row). Both pools update atomically. Chat card shows both cameos with a `→` arrow between, eyebrow "*A resolve token, handed across the table.*"

Pool-full check: if a recipient is at `tokens.resolve.max`, the picker disables that option with a tooltip.

### 12.2 Monologue token spend

A new full-viewport overlay — the **fourth world-identity surface**, alongside Arrival, pause, and (future) cycle-end. Same shared `_world-identity-shared.css`, same `gs-world-identity` body class, same mote vocabulary at half drift speed (the rulebook's "scene freezes" rather than "scene stops").

Flow:

1. Player clicks the monologue dot on their dossier → target & question modal opens (select another Major, optional question prompt).
2. On confirm, a Foundry socket emits `gs.monologueStart`. All connected clients render the overlay simultaneously.
3. Overlay composition: dimmed canvas (~55% ink-tone), 3 motes drifting slowly, corner ornaments at 64 px, eyebrow **"AN INNER MONOLOGUE."** (§8.1 standalone primitive in honey-gold), a 380 px circular display of the *target's* token (per §8.5; the token's own design provides framing), the spender's question rendered in italic Lora 22 px (if posed), and a parchment-textured textarea below.
4. Per-user views: target gets the editable textarea + Submit pill; spender / audience / GM see read-only with live-syncing typing (debounced ~250 ms via socket); GM additionally sees a Cancel pill.
5. Submit posts the upgraded monologue chat card (wider, mote-pattern background, drop-cap on first letter, both cameos, lead line "*On {date}, in answer to '{question}'…*") and optionally archives to JournalEntry. Two atomic actor updates: spender's `tokens.major` → false, target's `tokens.monologuedThisCycle` → true.
6. Socket `gs.monologueEnd` fires; overlay fades out over 1 s on every client.

Singleton enforced — only one monologue overlay can be open globally. Subsequent triggers reject with a chat warning. Matches the rulebook's "the Facilitator will indicate the right time" — sequential ceremony rather than concurrent.

### 12.3 Drop cap on the monologue chat card — deliberate exception

§4.2 of the master spec forbids drop caps on the dossier specifically. The monologue chat card is a different surface, and the drop cap reads as ceremony for this card weight. Treat it as a second deliberate exception (alongside the Lavishly Yours name initial on the dossier cameo). Both exceptions are scoped, both are documented, neither leaks into the broader system.

### 12.4 Settings

- `monologueOverlayEnabled` (client, default `true`) — falls back to chat-card-only flow when off.
- `archiveMonologuesToJournal` (world, default `true`) — JournalEntry archive on submit.
- `resolveHandoffAnimationEnabled` (client, default `true`) — skips the cross-screen animation; actor updates and chat card still fire.

### 12.5 Sequencer is optional polish

Both events ship with CSS-only animations. The full "heavy tier" (Sequencer cameo zoom, sepia canvas filter during the freeze, audio cues) is reserved for v1.1 and gated on `game.modules.get("sequencer")?.active` so the system never hard-depends.

### 12.6 Facilitator pool — deferred

The GM holds three resolve tokens per rulebook p.70 but no current UI surfaces them. A future patch will add a GM resolve track and route GM-pool spends through the same `spendResolve()` helper. Out of scope here.

---

## 13. The Journal — "The Novel"

The journal exists in v1 but is unstyled, partially organized, and not discoverable. Letters, monologues, and session logs each have their own write paths but only letters and session logs ship into folders; monologues land at the sidebar root. The journal sheet body has no system styling, so themed cards inside an entry sit awkwardly inside Foundry's default white-page chrome. There's no in-system "open the archive" entry point — discovery is by browsing the Foundry sidebar.

This section elevates the journal into an organized archive presented as the rulebook's "Jane Austen novel you have written together" (p.115).

Full spec: [`patch-journal-elevation.md`](./patch-journal-elevation.md).

### 13.1 Organization & permissions plumbing

Every existing journal write path consumes a centralized `module/helpers/journal-folders.js` helper. Folder hierarchy locked:

| Type | Folder path | Color |
|---|---|---|
| Letter | `Letters / {Recipient}'s Inbox / …` | forest green |
| Monologue | `Monologues / Cycle N / …` | terracotta |
| Session log | `Session Logs / {year} / Session N` | subdued sage |
| Cycle reflection | `Cycle Reflections / …` | gilt |

Default permissions land sane: letters keep their B-9 per-user map; monologues become OBSERVER (consistent with the chat broadcast); session logs and cycle reflections are OBSERVER. A one-time GM-only migration backfills the `entryType` flag onto pre-patch entries based on conservative name-pattern matching.

### 13.2 Journal sheet visual elevation

`styles/journal-sheet.css` (new) extends `body.gs-chrome-themed` to a ninth surface — the journal sheet body. Cream paper background replaces white, sage hairline frame replaces Foundry's default border, Lora display headings, Crimson body, §8.1 eyebrow primitive for `h3`/`h4`, sage-bullet lists, terracotta-stripe blockquotes, paper-warm table headers.

`styles/journal-sidebar.css` (new) polishes the sidebar list — folder rows get a 4 px color stripe and uppercase brand-color labels; entry rows get a 14 px entry-type glyph at the leading edge, dispatched via `data-entry-type` attribute injected by a `renderJournalDirectory` hook handler. Glyph asset slots: `journalEntries.{letter, monologue, sessionLog, cycleDivider}`, four new entries in `CHROME_ICONS` (extending §14.2's registry).

### 13.3 The Novel Reader

A dedicated framed `ApplicationV2` window (920 × 780, singleton, all users) opened via a new `gs-novel-reader` scene-control button. Three PARTs compose horizontally:

- **Cover page** — full-window title page. Novel title in Lora 56 px with a Lavishly Yours ornament-face first letter (the deliberately-scoped exception from §4.2). Italic subhead "*A novel in {N} cycles, in progress.*" Author byline. Gilt-fade rule. "Begin reading ↗" pill primary. "Title your novel ↗" pill conditionally visible at game end (per rulebook p.115).
- **Left rail (~180 px)** — collapsible cycle navigation with per-cycle entry counts ("12 entries · 3 letters · 4 monologues · 1 session"). Active cycle gets a 4 px gilt left-edge accent.
- **Reader pane** — chronological reading flow. Entries rendered inline with their archived HTML bodies, grouped by cycle, with cycle dividers as chapter breaks. 640 px max-width reading column on `--gs-paper`. Each entry has a 14 px entry-type glyph at the upper-left, an eyebrow above the body, and an "[open in journal ↗]" subdued link at the foot.

Per-user state — last scroll position, last cycle viewed, collapsed cycle list — stored in `game.user.flags["good-society-homebrew"].novelReader`. Reader joins `COWORK_SURFACES` so the Cabinet's rail can hide the scene-control button per user.

### 13.4 Cycle dividers & game-end ritual

`module/helpers/cycle-divider.js` auto-creates a `Cycle N — Reflections` journal entry on first transition into upkeep per cycle (idempotent, GM-client-only writer). The entry body is template-driven from session-event data — letters this cycle, monologues taken, rep-tag changes, heir-status shifts, scandals broken. Auto-summary is a starting point; the GM is encouraged to edit afterward.

The Reader renders `entryType === "cycleDivider"` entries as chapter breaks (display-type 28 px, double gilt rule, paper-warm fill, 48 px vertical padding). They become natural section breaks in the chronological flow.

At game end (`isFinalCycle && cyclePosition === 9`), a new `goodSociety.gameEnded` hook fires from `cycle-advance.js`. The Reader auto-opens for every connected user, scrolled to the cover, with the "Title your novel ↗" pill prominent. Saving writes to a new `novelTitle` world setting. The cover re-renders with the new title.

### 13.5 Settings

- `novelTitle` (world, default empty — falls back to `game.world.title`).
- `novelReaderEnabled` (client, default `true`).
- `autoCreateCycleDividers` (world, default `true`).

### 13.6 No new body class

This section extends `gs-chrome-themed` to a ninth surface. The §17 body class registry's row for `gs-chrome-themed` should be amended to enumerate the ninth surface (journal sheet body) once the patch ships.

---

## 14. Foundry chrome icons

Custom illustrated icons replacing Foundry's default Font Awesome glyphs across the surfaces players look at constantly. Extends v1's locked `28-foundry-chrome-theme.md` (which handles color and typography overrides for Foundry's surrounding application chrome) with an icon re-theme on top.

Full spec: [`patch-foundry-chrome-icons.md`](./patch-foundry-chrome-icons.md).

### 14.1 Surfaces affected

- **Scene controls** (left vertical strip): `token`, `measure`, `tiles`, `drawings`, `walls`, `lighting`, `sounds`, `regions`, `notes` — all Foundry-shipped tools — plus our system-injected controls `gs-dashboard`, `gs-organizer`, `gs-permissions`, `gs-session-log`.
- **Sidebar tabs** (right vertical column): `chat`, `combat`, `scenes`, `actors`, `items`, `journal`, `tables`, `cards`, `playlists`, `compendium`, `settings`.
- **Cabinet rail** (`patch-cabinet.md` §3): each `COWORK_SURFACES` entry gets an `iconAsset` field that the rail renders in place of the current single-letter glyphs (P, D, C, L, …).

Out of scope: macro hotbar slots (user content), players list (no FA glyphs to swap), window titlebar gear/close (already styled-text per v1 §28).

### 14.2 `CHROME_ICONS` registry

Lives in `module/constants.js` as a single object with three sub-objects keyed by surface ID:

```js
export const CHROME_ICONS = {
  sceneControls: {
    token:           { asset: "assets/chrome-icons/scene-token.svg",      label: "Tokens" },
    measure:         { asset: "assets/chrome-icons/scene-measure.svg",    label: "Measure" },
    // …
    "gs-dashboard":  { asset: "assets/chrome-icons/scene-gs-dashboard.svg", label: "Public Info Dashboard" },
    // …
  },
  sidebarTabs: {
    chat:            { asset: "assets/chrome-icons/tab-chat.svg",         label: "Chat" },
    journal:         { asset: "assets/chrome-icons/tab-journal.svg",      label: "Journals" },
    // …
  },
  cabinetRail: {
    // mirrors COWORK_SURFACES IDs; the Cabinet's rail consumes from here
  },
};
```

Same shape as `SEAL_TYPES` (§11.2) — id-keyed registry, GM-supplied custom illustrations dropped into a known asset directory (`assets/chrome-icons/`), graceful fallback when an asset is missing.

### 14.3 CSS swap pattern

Icons swap via pseudo-elements gated on `body.gs-chrome-themed` (the same body class v1 §28 already toggles). The pattern hides the original `<i class="fas fa-…">` and replaces it with a `::before` carrying a CSS-variable URL:

```css
body.gs-chrome-themed [data-icon-asset] > i.fas { display: none; }

body.gs-chrome-themed [data-icon-asset]::before {
  content: '';
  display: inline-block;
  width: 100%;
  height: 100%;
  background-image: var(--icon-asset-url);
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}
```

Each themed control element gets `data-icon-asset` (a marker attribute) and an inline `--icon-asset-url` CSS variable pointing at its asset. JS (in `module/hooks/chrome-icons.js`) sets these on `renderSceneControls` and `renderSidebarTab` — looking up each control's surface ID against `CHROME_ICONS` and applying the attribute + variable to matching DOM nodes.

### 14.4 Asset spec

- Format: SVG preferred (uses `currentColor` so the icon picks up the chrome's text color), PNG acceptable as fallback.
- Size: 24–64 px square; renders at the surface's native size (scene controls ~36 px, sidebar tabs ~28 px, Cabinet rail ~32 px).
- Style: period-illustrative — line-drawn, restrained, on the same stylistic axis as the wax seal motifs and dossier marginalia. Not photographic, not heraldic-overwrought.
- Location: `assets/chrome-icons/{surface-id}.svg`.

GM supplies the assets. The system ships with no default custom illustrations — when `applyChromeIcons` is on but no asset exists for a given surface, the original FA glyph still renders. Each icon is opt-in per surface.

### 14.5 Setting

New client-scope setting:

```js
applyChromeIcons: { default: true }
```

Gates on top of `applyFoundryChrome` from v1 §28. Behavior:

- `applyFoundryChrome=false`: no chrome theming at all (default Foundry). `applyChromeIcons` has no effect.
- `applyFoundryChrome=true`, `applyChromeIcons=false`: v1 §28's color re-theme applies, but Font Awesome glyphs stay.
- Both `true`: full chrome re-theme — colors AND custom icons.

Toggleable at runtime (no page reload) by adding/removing a `gs-chrome-icons-on` body class on `clientSettingChanged`. Same mechanism v1 §28 uses for its body-class toggle.

### 14.6 Don't break Foundry on update

If Foundry changes a control's class name in a future version, the worst case is the original FA glyph showing through unchanged — no broken functionality, no JS errors. The pattern degrades gracefully because the icon swap is purely additive: we add an attribute + variable, we don't remove anything Foundry depends on.

### 14.7 Cabinet rail × chrome icons — day-one default state

Both `patch-cabinet.md` and this section reach the same DOM nodes (the Cabinet's rail buttons), and ship simultaneously. Without an explicit decision, the rail's appearance on day one is ambiguous. The patch resolves it as follows:

- **Default state on first install.** Every rail button renders its single-letter glyph (P, D, C, L, …) per `patch-cabinet.md` §3.4. The chrome-icons feature is enabled by default (`applyChromeIcons=true`) but `CHROME_ICONS.cabinetRail` ships empty — no asset paths registered yet.
- **As assets land.** Natalie populates `CHROME_ICONS.cabinetRail` surface-by-surface as illustrations are produced. Each entry takes effect immediately on next render (or after `clientSettingChanged` if toggled at runtime). The rail button for that surface swaps from letter glyph to custom illustration.
- **Mixed state is allowed.** Some rail buttons rendering custom illustrations while others still show letters is the expected intermediate state during asset rollout. The visual hierarchy stays intact because both presentations are sized to fill the same rail-button bounding box.
- **Disabling the feature.** When `applyChromeIcons=false` (or `applyFoundryChrome=false`), all rail buttons fall back to letter glyphs regardless of which entries exist in `CHROME_ICONS.cabinetRail`. Same fallback applies to scene controls and sidebar tabs — when the chrome icons feature is off, the rail behaves exactly as `patch-cabinet.md` specs it.

This mirrors the surface-by-surface opt-in pattern from §14.4 (asset spec) and avoids a "blank rail" failure mode where a registered asset path 404s and leaves an empty rail button.

---

## 15. Open questions log

Things to resolve before implementation. Search this doc for `[FILL IN]` to find them inline; this is a flat index.

- **§2.1** — Arrival background image asset (`arrivalBackgroundUrl`). Natalie sourcing. See `patch-world-identity.md` §4.3.
- **§2.1** — Arrival corner ornament asset (`arrivalCornerOrnamentUrl`). Natalie sourcing. See `patch-world-identity.md` §4.3.
- **§2.2** — Pause overlay cameo image (`pauseCameoImageUrl`). Optional GM customization. Falls back to the inline "W" monogram. See `patch-world-identity.md` §5.2.
- **§2.2** — Per-cycle-phase pause eyebrow variants (e.g. "An interlude between letters" during epistolary phase). Deferred to v1.1.
- ~~**§4.4.2** — Connection back-stack vs. single-step return.~~ Resolved 2026-05-08: single-step. Depth-1 history is the deferred extension if usage warrants.
- **§4.4.6** — Esc-to-character interactions with text editors and other Esc-capturing components. Capture-phase listener checks `[data-allow-esc]` and known editor selectors before navigating. Verify in-build that TinyMCE / ProseMirror don't capture Esc unexpectedly.
- **§4.4.7** — Drop-state behavior when polarity isn't readable from `dataTransfer` (multi-item drag, cross-system drag). Lean: reject the drop with a small chat warning rather than guess polarity.
- **§4.4.3** — Backstory pagination: manual `backstoryPages: string[]` on the Major, vs. auto-paginate from a single rich-text field. Lean manual.
- ~~**§4.6** — Frame graphics per theme.~~ Resolved 2026-05-08: dropped from scope. Natalie is producing custom character tokens that carry their own framing; the token IS the cameo. See §8.5 profile picture resolution.
- ~~**§6.6** — Hex values per theme.~~ Resolved 2026-05-07: reconciled to v1 `decisions.md` palette. New themes will be appended to the registry as they're created.
- **§7.4** — Final font pair. Natalie picking.
- **§11.2** — Custom seal illustration assets. Natalie supplying. Three placeholders ship at `assets/seals/{seal-id}.png`; replace with real artwork as it arrives.
- **§11.2** — Future seal types (mourning, ceremonial, secret, contract) — labels and behaviors TBD. Add to `SEAL_TYPES` array as defined.
- **§11.3** — Burn timing: 30s-away auto-burn vs. immediate-on-close. Tradeoff: immediate is cleaner UX but doesn't give a re-read pause. Default to 30s for v1 of the patch.
- **§11.3** — GM-side seal forensics UI: where does a GM view a burned letter's preserved content? Probably a small "view burned" affordance on the chat-log message; possibly a dedicated GM panel.
- **§11.4** — Roster realtime updates: when a player marks done, the GM's roster needs to refresh. Foundry socket vs. polling vs. hook-based. Default to a custom socket message.
- **§14.4** — Custom chrome icon illustrations. Natalie supplying. Per-surface SVGs at `assets/chrome-icons/{surface-id}.svg`; system ships with no defaults, so individual icons opt in as their assets land.
- **§14.1** — Whether to ship icons for *every* sidebar tab or only the high-traffic ones (chat, journal, actors). Lean: register all of them in `CHROME_ICONS` so the slot exists; let assets land as Natalie produces them. Missing asset = original FA glyph still renders.
- **§14.5** — Whether `applyChromeIcons` should be world scope (one decision per game) or client scope (each user opts in). Default: client scope, mirroring `applyFoundryChrome` from v1 §28. Revisit if it produces inconsistent screenshots in shared sessions.
- **§8.1** — Should v1 §23 be amended in-place to point at the new eyebrow primitive, or stay as a historical record with the new primitive holding sole authority? Lean: amend with a "superseded by patch §8.1" footnote so future readers don't misuse it.
- **§8.2** — Whether to spec a loading-state primitive in this same section, since it's a frequent peer of empty-state. Lean: defer to a later patch — loading states have different timing and semantics, and the current scope doesn't surface them prominently.
- **§8.3** — Whether the gilt seal border is universal across light AND dark themes, or whether dark themes (Avril, Pearlinda, Secret) need a brighter ring color. Lean: keep gilt universal — `--gs-accent-3` is already calibrated to read on both paper colors and the contrast is strong enough.
- **§17** — Should the body class registry live in this master spec or move to a top-level reference doc once the patch lands? Lean: stays here while the patch is drafting; promote to its own doc only if the registry grows past ~10 classes.
- **§3.3** — Should the conditions sub-rail's "+ N more" expand affordance be persistent (clicking once expands and stays expanded for the session) or per-click (click expands, click collapses)? Lean: per-click — keeps the dashboard's compact default state but lets users expand on demand.
- **§8.4** — Whether the persona-switcher pill on the dock footer applies to all dock rows (one global "speaking as" affecting which actor is active) or per-row (each dock row carries its own pill). Lean: one global pill in the dock footer mirroring the Speaking-As bar above chat — they're the same control, two visual placements. See `patch-persona-switcher.md` §10.
- **§10.4** — Should the dock's conditions sub-rail also wrap to two lines, or cap at one line and rely on horizontal scroll instead? Lean: one-line cap with horizontal scroll. Dock rows are denser than dashboard rows and a 2-line wrap would crowd the vertical stack. Revisit if scroll feels awkward.
- **§14.7** — Whether `CHROME_ICONS.cabinetRail` should ship with even one or two seed entries (e.g. for the Public Info Dashboard's `gs-dashboard` surface) so the rail isn't all-letters on a fresh install, or stay fully empty until Natalie supplies first assets. Lean: stay empty — letters are a coherent default and avoid mixing the system's own art with placeholder Font Awesome.
- **§12.1** — Facilitator resolve pool UI. The GM holds three resolve tokens per rulebook p.70 but no surface exposes them. Lean: defer to a separate patch; `spendResolve()` will route GM-pool spends through the same helper once that surface lands.
- **§12.2** — Live textarea sync debounce timing. Currently 250 ms via socket. Could be 500 ms if it feels chatty over the wire. Verify with a real session.
- **§12.2** — Should the question field on the monologue trigger modal support inline TextEditor markup (italic, bold) or stay plain-text? Lean: plain-text for v1; the chat card renders whatever formatting is supplied.
- **§12.2** — When the target's player is offline, who picks up the textarea — GM, spender, or anyone? Currently anyone (the system doesn't enforce that the typer is the target's player); table-norm question. Verify with a real session.
- **§12.2** — Whether the in-system chat-input "An inner monologue is in progress" banner should also gate sending (queue messages until overlay closes), or stay informational. Lean: informational only — hard gating would be intrusive and the rulebook doesn't actually demand silence.
- **§12.4** — Whether `monologueOverlayEnabled` should default world or client. Currently client. World would give the GM a single switch for the whole table. Lean: client — players have different hardware tolerance for full-viewport overlays.
- **§13.2** — Whether the entry-type glyphs in the sidebar should appear when `applyChromeIcons=false`. Lean: gate on `applyChromeIcons` for consistency. When chrome icons are off, the sidebar shows raw entry names with no glyph.
- **§13.3** — Reader's "scroll position on re-open" behavior — restore exact position vs. jump to latest cycle. Lean: restore exact, with a "Jump to latest ↗" pill in the rail's footer for the away-for-a-while case.
- **§13.3** — Whether the cover page's first-letter ornament face (Lavishly Yours) is fitting for a "novel cover" weight, or if it deserves a different display effect. Lean: stay with Lavishly Yours; consistency with the dossier name initial is the right move.
- **§13.4** — Should cycle dividers be created on transition INTO upkeep (current) or OUT (i.e., when upkeep finishes)? Lean: into — gives the GM an editing sandbox while the cycle is still warm.
- **§13.4** — Should the "Title your novel" affordance also appear during the final cycle (before completion), so the GM can pre-set the title? Lean: no — the rulebook ritual is end-of-game; preserving the moment matters. Setting is editable from System Settings if needed.
- **§13.4** — Game-end hook auto-opening the reader for every connected user — too aggressive? Lean: yes but with an obvious close affordance; the moment is the rulebook's prescribed ritual.
- **§13.1** — Migration backfill name-pattern matcher conservatism. Currently exact-match only. Lean: stay conservative — anything ambiguous stays untyped, GM re-flags manually.

---

## 16. Decisions captured during drafting

A running log of decisions made *while writing this spec*, so future sessions don't re-litigate them.

- **2026-05-06 — Two-font contract is the rule.** Cormorant Garamond, EB Garamond, Cinzel Decorative, and Pinyon Script are all out. Lora + Crimson Text is the current pair; the slot system makes swapping cheap. (Rolled forward from v1 §decisions.)
- **2026-05-06 — Connection chips are clickable.** Chips on the dossier's character spread navigate to a connection's public-info spread. v2 walkthrough's chips were not clickable; the patch adds the behavior on top of the v2 visual base.
- **2026-05-06 — Backstory lives on its own multi-page spread.** Not on the character spread. Character spread shows only a one-line teaser + "continue reading" button. Adding more backstory text grows page count, never crowds the rest of the sheet.
- **2026-05-06 — Page-turn animation is single-page rotation, not card-flip.** Whole-book rotation is explicitly forbidden. The right page rotates around the spine; binding, spine, bookmark, ornaments stay put.
- **2026-05-06 — Click delegation, not inline handlers.** One listener at the `.dossier-book` level catches every `data-goto` element. No per-button JS, no inline `onclick`.
- **2026-05-06 — Indicators are brand-on or brand-off, never color-swapped.** Carries through §5 across every component.
- **2026-05-06 — Cabinet default state is rail-only.** The drawer expands on click, doesn't hover-expand. State is per-user.
- **2026-05-07 — Dossier shell is v2; paint is Inkwell & Wildflower.** Take the v2 walkthrough's structural shell (leather book, marginalia, bookmark, cameo, multi-spread) but apply the dashboard's palette and pill-and-hairline container language. Wax-seal pendants are out; pill chips are in. Connection chips stay (the user explicitly loves them). The dossier inherits the same indicator-unification rule from §5 — brand-on / brand-off, no color swap.
- **2026-05-07 — Tokens off the bookmark, onto the page.** Resolve, MT, and Monologue indicators move from the leather strap into a dedicated tokens section under the inner-conflict ledger. Bookmark removed entirely. Reason: the strap's wax discs and gold medal couldn't honour the brand-on / brand-off indicator unification — putting tokens on the page lets them use the same fill-vs-outline language as every other indicator in the system.
- **2026-05-07 — Persona switcher and theme switcher live in the cameo header.** Persona = pill dropdown showing active persona's name. Theme = swatch row of 6 colored discs (one per Major), gilt-ring on the active one. Both are inline on the dossier rather than separate ApplicationV2 windows; v1 §13 still owns the persona-editor surface for creating/editing personas, but quick-switching happens here.
- **2026-05-07 — Section eyebrows get real visual weight.** Lora 600, 11.5 px, sage hairline divider directly below, gilt diamond `◆` punctuating the right edge. The previous Crimson italic 11 px at 0.85 opacity wasn't doing enough hierarchical work — sections bled into each other. Subdued variant (no divider, sage Lora 500) for eyebrows nested inside contained blocks (rep-criteria, conflict-title, tokens) so they don't double-line.
- **2026-05-07 — Lavishly Yours for the name initial; nothing else.** Single ornament face, scoped to the first letter of the character name on the dossier cameo only. New CSS variable `--gs-ornament` introduced to formalize the slot. Backstory drop-cap removed entirely — paragraphs start with plain Lora.
- **2026-05-07 — "Major Token" relabelled "Monologue Token" in the UI.** The data field stays `tokens.major` for backwards compatibility with v1 §6.1; only the user-visible label changes. The MT pill abbreviation is preserved (works for either expansion).
- **2026-05-07 — Active reputation pill is a chip, not a card.** Laurel 18 px, italic Lora label 13 px, gilt hairline outline, capsule shape. Sized to read at-a-glance alongside the other tag pills, not to dominate the page.
- **2026-05-07 — Page spacing rationalized.** Page-content padding 40/48 → 30/38. Header gap 28 → 18, portrait 90×110 → 78×96, name 36 → 30 px, name initial 68 → 56 px. Conflict ledger boxes 18 → 15 px, side label 18 → 15 px. Eyebrow margin 12 → 9 px, padding-bottom 7 → 5 px. Tokens grid gap 18 → 14 px. Net reclaim: ~50–60 px of vertical space, enough to keep the tokens section inside the leather frame.
- **2026-05-07 — v1 palette wins on theme reconciliation.** The patch preview's dashboard rows, dossier swatches, and connection chips were using arbitrary preview-only hex values that didn't match v1 `decisions.md`. All of them now bind to v1 brand colors. Connection chips and connection-cameo gradients now map to the five locked v1 connection variants (`connection-green/purple/blue/yellow/grey`) instead of borrowing Major theme colors. Margaret = purple, Thomas = yellow, Lady V = grey.
- **2026-05-07 — Dark-theme cross-surface exception.** Mags and Avril are dark-paper themes; their v1 `--gs-brand` (grey, gold) is calibrated for near-black backgrounds and washes out on cream. On shared cream surfaces (dashboard rows, dossier swatches, board entries) they substitute their v1 `--gs-accent-1` (deep blood `#6B0F1A`, oxblood `#8B2A2A`). On their own sheet body, the v1 brand still applies. This is a per-theme metadata decision, not a system-wide rule.
- **2026-05-07 — Reputation tags use functional colors, not theme accents.** Earlier the rep-tag pills bound to `--dossier-sage` and `--dossier-terracotta`, which meant Mags's negative tags rendered in deep blood on near-black (muddy, hard to scan) and her positive tags rendered in mid-grey (washed out). Now they bind to `--gs-positive` and `--gs-danger`, which are functional roles — green is positive everywhere, red is negative everywhere, regardless of which Major's dossier they appear on. Dark themes (Mags, Avril) override the functional colors to brighter variants (`#7AB87A` mint, `#D85959` clear red) for legibility on near-black paper. New dark themes must follow the same override pattern.
- **2026-05-08 — Epistolary phase gets a wizard.** v1's `05-epistolary-ui.md` covers the composer + letter card; the wizard wraps that in an inbox / compose / outbox tabbed environment with a GM roster (parallel to the Upkeep Roster). Per-actor "mark done" flow drives phase advancement.
- **2026-05-08 — Seal types upgraded from "pure flavor" to typed registry.** Supersedes `05-epistolary-ui.md` Open Question §2 ("Should the seal color affect anything mechanically?" — answer flips from "no" to "yes"). The registry lives in `module/constants.js` as `SEAL_TYPES`, each entry carries id / label / color / iconAsset / behavior / description. Three seed types ship: `yellow-casual` (no behavior), `red-invitation` (fires `invitation-sent` hook), `green-burn` (burn-after-reading mechanic). Custom illustration assets supplied by the GM at `assets/seals/{seal-id}.png`.
- **2026-05-08 — Burn-after-reading is a real mechanic, not a metaphor.** Green-seal letters destroy themselves on close (or after 30s away from the wizard). Chat message content is replaced with "(Burned. The letter is destroyed.)"; original preserved in `flags.burnedContent` for GM forensics; CSS keyframe animation handles the destruction visual (no Sequencer dependency).
- **2026-05-08 — Foundry chrome gets custom icons on top of v1 §28's color re-theme.** v1 §28 (locked) handles colors and typography for window titlebars, sidebar background, sidebar tabs, scene navigation, chat surroundings, default form controls, notifications, players list, and hotbar background. The patch adds an *icon* re-theme: scene controls, sidebar tabs, and the Cabinet rail get GM-supplied custom illustrations replacing the default Font Awesome glyphs.
- **2026-05-08 — `CHROME_ICONS` follows the seal-type pattern.** ID-keyed registry in `module/constants.js` with three sub-objects (`sceneControls`, `sidebarTabs`, `cabinetRail`). Assets dropped at `assets/chrome-icons/{surface-id}.svg`. Same shape as `SEAL_TYPES` (§11.2) — one extensibility pattern, used in two places. New surfaces only need a registry entry + an asset.
- **2026-05-08 — Icon swap via CSS pseudo-elements + `[data-icon-asset]` marker.** A small JS hook (`module/hooks/chrome-icons.js`) on `renderSceneControls` and `renderSidebarTab` adds `data-icon-asset` and an inline `--icon-asset-url` CSS variable to matching DOM nodes. CSS in `styles/foundry-chrome.css` hides the original `<i class="fas">` and renders the asset via `::before`. Pattern is purely additive — if Foundry renames a class in a future version, the worst case is the original FA glyph still shows. No broken functionality.
- **2026-05-08 — `applyChromeIcons` is a separate setting from `applyFoundryChrome`.** Both client scope, default `true`. Stacked gating: `applyFoundryChrome=false` disables everything; `applyFoundryChrome=true` + `applyChromeIcons=false` enables v1 §28's color re-theme but keeps FA glyphs; both `true` enables full chrome re-theme. Toggleable at runtime via body class (`gs-chrome-icons-on`) — same mechanism v1 §28 uses for its `gs-chrome-themed` toggle. No page reload needed.
- **2026-05-08 — Eyebrow heading is a system-wide primitive; v1 §23's eyebrow is superseded.** The Lora 600 / 11.5 px / sage hairline / gilt diamond style first specified in §4.1.b is now §8.1 — used on every surface (dossier, dashboard, Cabinet, Epistolary, item sheets, modals). Subdued variant (Lora 500 sage, no divider, no diamond) for nested eyebrows so they don't double-line with their container's outer hairline. Class names: `.gs-eyebrow` / `.gs-eyebrow--subdued`. The diamond is a `::after` pseudo so it doesn't appear in copy-paste or screen readers.
- **2026-05-08 — Empty-state primitive locked: italic Crimson body + optional outline pill.** §8.2. Italic `--gs-body` 14 px in `--gs-ink-soft` for the body line; optional `--gs-brand`-outline pill when there's a meaningful next-step action. NOT used for surfaces whose intended state is "nothing here right now" (e.g. dossier active-condition slot when no condition is active) — those use per-component empty styling defined in their host section.
- **2026-05-08 — Seal vs rep-color carve-out: shape + border weight, not color.** §8.3. Rep tags = ~18 px pills with 1 px hairline borders in functional colors (sage / terracotta or dark-theme variants). Seals = ~28 px discs with 2 px gilt borders in `--gs-accent-3` regardless of seal color. They are never co-located in the same row — rep tags live on the dossier's public page, seal discs live at the leading edge of inbox/outbox letter rows. Future seal types must keep disc + gilt border; future functional colors must avoid the seal palette and use a different shape primitive.
- **2026-05-08 — Body class registry is canonical; §17 is the source of truth.** Adding a body class without updating the §17 table is forbidden going forward. Layering rules and timing of toggle (page-load vs. runtime via `clientSettingChanged`) documented per class.
- **2026-05-08 — Persona switcher is a single primitive across five surfaces.** Dossier cameo, Connection sheet header, NPC sheet header (when actor has personas), Speaking-As bar above chat, and the My Characters Dock footer all consume `templates/partials/persona-switcher.hbs`. Visual drift between instances is forbidden. Pill body uses host surface's brand; persona `chatColor` overrides tint the chevron only when active; active marker on dropdown items is gilt for theme stability. v1 §13 (persona editor modal) stays untouched. Full spec: `patch-persona-switcher.md`.
- **2026-05-08 — Conditions sub-rail geometry locked.** §3.3. 28 px hairline strip below each Major's row when at least one active condition is present. Strip hidden when empty (no placeholder). Pills wrap to 2 lines max; "+ N more" affordance for overflow. Polarity colors follow the §6.4 functional palette with Avril / Pearlinda / Secret dark-theme overrides. Strip uses no fill — relies on the row's outer hairline frame, no double-lining.
- **2026-05-08 — Dock gets full parity with the dashboard.** §10.4. Outer hairline frame, indicator unification, theme accent stripe per row, conditions sub-rail (one-line cap with horizontal scroll vs the dashboard's 2-line wrap, since dock rows are denser), and a Speaking-As pill in the footer per `patch-persona-switcher.md` §3.4. The dashboard's GM bulk-actions bar and 6-column wide grid are not adopted — those are dashboard-specific. Increment in scope is CSS-only; data shape and click handlers unchanged.
- **2026-05-08 — Cabinet rail × chrome icons day-one default: letter glyphs.** §14.7. `CHROME_ICONS.cabinetRail` ships empty; rail buttons render their single-letter glyphs from `patch-cabinet.md` §3.4. As Natalie populates registry entries surface-by-surface, the rail swaps each button from letter to custom illustration. Mixed state (some illustrations, some letters) is the expected intermediate during asset rollout. Disabling chrome icons via setting reverts everything to letters.
- **2026-05-08 — Subsection numbering reconciled.** When §8 (primitives) was inserted in Batch 1, the §9 / §10 / §11 / §12 parent headers bumped but their `### X.N` subsection headers were left at the old numbers. Batch 2 fixes them: Cabinet's subsections are now §9.1–§9.6, Cosmetic facelift's are §10.1–§10.4 (new §10.4 for dock parity), Epistolary's are §11.1–§11.6, Foundry chrome icons' are §12.1–§12.7 (new §12.7 for cabinet × chrome icons day-one default). No content was lost — only header text changed.
- **2026-05-08 — `patch-arrival.md` absorbed into `patch-world-identity.md`.** The world-identity patch is the single source of truth for the Arrival, the pause overlay, and the v1 §29 reconciliation. `patch-arrival.md` is preserved with a top-of-file pointer for back-compat with any references that already cite it.
- **2026-05-08 — v1 §29 supersession map.** v1 §29 surface 1 (Good Society splash) is superseded by the Arrival (§2.1); v1 §29 surface 2 (pause overlay) is kept and refined under the shared world-identity register (§2.2); v1 §29 surface 3 (toolbar icons) is superseded by `patch-foundry-chrome-icons.md` (§14). v1 §29 should be amended in-place with three "superseded by patch §X" notes — same pattern as the v1 §23 eyebrow supersession.
- **2026-05-08 — Default `arrivalTitle` is "Welcome to Good Society", not "Welcome to Swan's Crossing".** Swan's Crossing is Natalie's specific test world. The system default is the system name; GMs personalize via the `arrivalTitle` setting on first run.
- **2026-05-08 — Pause overlay z-index sits above Arrival (40 vs 30).** The "empty canvas, paused" composition is intentional — pause is the dominant state when both surfaces are present.
- **2026-05-08 — `gs-world-identity` body class added to the §17 registry.** Independent of `gs-chrome-themed` and `gs-chrome-icons-on`. World-identity surfaces work whether or not chrome theming is active.
- **2026-05-08 — Connection back-stack: single-step return.** §4.4.2 FILL-IN resolved. Clicking "← back to dossier" always returns to `character` regardless of how the user got to the current spread. Depth-1 history is the deferred extension if recursive hops become common.
- **2026-05-08 — No-active-condition slot collapses entirely.** §4.1. Per the §8.2 "when NOT to use" rule, an absent condition is the intended state, not a genuine empty list. The pill area is replaced by ~6 px of vertical breathing room — no placeholder, no dashed outline, no "no active condition" label.
- **2026-05-08 — Esc-to-character keyboard shortcut on the dossier.** §4.4.6. Pressing Esc on any non-`character` spread navigates to `character` via `showSpread("character")`. Capture-phase listener bails on `[data-allow-esc]` or known editor selectors so it doesn't intercept Esc inside text editors. Esc on the `character` spread itself preserves Foundry's default sheet-close behavior.
- **2026-05-08 — Drop-state visual for reputation tag drag.** §4.4.7. Destination row (predicted from polarity) gets a 1.5 px dashed gilt outline + 60% paper-warm tint; insertion line shows the cursor's nearest gap; non-destination row dims to 70%. On unreadable polarity, drop is rejected with a chat warning rather than guessed.
- **2026-05-08 — Reputation-tag wax pack and Epistolary seal discs share art direction.** Cross-references added in §4.7 and §11.2. Period-illustrative line work, hairline 0.5–1 px strokes, two-color or on-color flat fills, consistent silhouette weight. The §8.3 carve-out keeps them functionally distinct (shape + border weight); shared art direction keeps them stylistically unified.
- **2026-05-08 — Resolve and Monologue spends are events, not just state toggles.** §12. Resolve discard gets a 400 ms pip animation + chat card; resolve handoff gets a cross-screen pip-clone animation + dual-cameo chat card; monologue gets a full scene-freeze overlay + textarea + heavier chat-card archive. Matches rulebook ritual (p.70 negotiation handoff, p.103 scene freeze). Full spec: `patch-token-events.md`.
- **2026-05-08 — Monologue overlay is the fourth world-identity surface.** §12.2. Reuses `gs-world-identity` body class, `_world-identity-shared.css`, mote tokens, corner ornaments. z-index 35 — between Arrival (30) and pause (40). The world-identity register pays off four times now (Arrival, pause, monologue, future cycle-end transition).
- **2026-05-08 — Two distinct flag updates on monologue submit.** Spender's `tokens.major` → false (their MT spent); target's `tokens.monologuedThisCycle` → true (they've performed this cycle). Server-of-record is the target's client, GM-fallback if target offline.
- **2026-05-08 — Singleton monologue overlay; subsequent triggers reject.** Only one monologue can be open globally at a time. Matches rulebook's "the Facilitator will indicate the right time" — sequential ceremony rather than concurrent ones. Rejected spenders keep their MT.
- **2026-05-08 — Live textarea sync via socket.** Spender, audience, and GM see the target's typing in real time, debounced to ~250 ms. Reads as the table watching someone compose. Heavier than text-after-submit but mirrors the table's silent attention while a player thinks.
- **2026-05-08 — Drop cap on the monologue chat card is a deliberate exception to §4.2.** §4.2 forbids drop caps on the dossier specifically. The chat card is a different surface and the drop cap reads as ceremony for this card weight. Same scope-justified exception that allows Lavishly Yours on the cameo's name initial. Two scoped exceptions total; neither leaks into the broader system.
- **2026-05-08 — Both cameos on the resolve handoff chat card.** Visual record of the negotiation outcome — spender's cameo on the left, recipient's on the right, `→` arrow between. Mirrors the table act of physically passing the token.
- **2026-05-08 — Sequencer is optional polish only for token events.** Both events ship with CSS-only animations. The "heavy tier" Sequencer additions (cameo zoom transition, sepia canvas filter during freeze, audio cues) are reserved for v1.1 and gated on `game.modules.get("sequencer")?.active`.
- **2026-05-08 — Facilitator-pool spends deferred.** GM holds three resolve tokens per rulebook p.70 but no UI surfaces them. Out of scope for this patch; a future patch will add a GM resolve track and route GM-pool spends through `spendResolve()` with the GM as actor-of-record.
- **2026-05-08 — Journal elevation leans into the rulebook's "novel" framing.** §13. The campaign IS the Jane Austen novel per p.115 ("the Jane Austen novel you have written together"). The Novel Reader's cover page is the assertive expression of the metaphor; the sidebar and journal sheet styling are the neutral expression. Players who don't care about the framing get a polished archive; players who do care get a reading experience.
- **2026-05-08 — Three journal write paths consolidate via `journalFolders` helper.** §13.1. Letters, monologues, and session logs (and the new cycle dividers) all consume the same get-or-create folder helper. Entry-type flag set on every entry for downstream rendering. Conservative migration backfills the flag on pre-patch entries.
- **2026-05-08 — Default monologue permission is OBSERVER, not inherited NONE.** §13.1. Inherited NONE was broken — players couldn't see monologue entries that had already broadcast in chat. OBSERVER is consistent with the chat broadcast.
- **2026-05-08 — Journal sheet body becomes the ninth surface under `gs-chrome-themed`.** §13.2. Extends v1 §28 chrome theme. No new body class; the existing toggle covers it. The §17 body class registry's `gs-chrome-themed` row is amended.
- **2026-05-08 — `CHROME_ICONS` extended with a fourth sub-object: `journalEntries`.** §13.2. Four glyph slots (letter, monologue, sessionLog, cycleDivider) plus one new `sceneControls.gs-novel-reader` slot. Same registry pattern as v1 §29 supersession + §14.
- **2026-05-08 — The Novel Reader is a singleton ApplicationV2.** §13.3. Three PARTs (cover, rail, reader). 920 × 780. Per-user state on `game.user.flags`. Reader is the curated experience; the Foundry sidebar is the raw filesystem. Both work — the Reader is additive.
- **2026-05-08 — Cycle dividers ARE journal entries (not just UI inside the Reader).** §13.4. Two reasons: (1) the auto-summary content deserves persistence and editability; (2) browsing direct in the Foundry sidebar gets chronological context. The Reader treats them as chapter breaks visually; the underlying data is uniform.
- **2026-05-08 — Auto-cycle-divider creation on transition INTO upkeep.** §13.4. GM-client-only single writer. Idempotent. Toggleable via `autoCreateCycleDividers` setting.
- **2026-05-08 — "Title your novel" affordance only at game end.** §13.4. Honors the rulebook p.115 ritual. Setting is editable via System Settings if a GM wants to skip the ritual.
- **2026-05-08 — Reader auto-opens for all users on game-end hook.** §13.4. New `goodSociety.gameEnded` hook. The moment is rulebook-canonical; small obvious close affordance for users who want to dismiss.
- **2026-05-08 — `gs-novel-reader` joins `COWORK_SURFACES`.** §13.3. Players can hide the scene-control button via the Cabinet rail like any other system surface.
- **2026-05-08 — Reader cover ornament-face on the title's first letter.** §13.3. Same Lavishly Yours exception as the dossier name initial (§4.2). Two scoped exceptions total — both deliberately ceremonial, neither leaks into the broader system.
- **2026-05-08 — Theme registry overhauled per `GS Build Colors.pdf`.** Mags renamed to Secret (palette refined: same dark surface and cool-grey brand, refreshed accent colors). Pearlinda added as a seventh Major theme — saturated dark-magenta surface, mauve brand, light-pink accents. Slot model standardized at 9 slots per theme: Surface, Raised Surface, Text, Brand, Headers & Eyebrows, Hairlines/Dividers, Metallic, Light/Dark Danger, Light/Dark Positive. Dropped from earlier patch drafts: `--gs-paper-aged` (tertiary surface — derive at component level via `color-mix` instead), `--gs-ink-soft` (muted text — derive via opacity instead), and the Muted Accent slot (cut at user direction). Dark-mode functional color values updated: `--gs-positive` dark `#7AB87A → #77c477`, `--gs-danger` dark `#D85959 → #dd4242`. Cross-surface exception now applies only to Secret (cool grey brand fails contrast on cream — substitutes `--gs-accent-2` `#485468` dark steel); Avril and Pearlinda's mauve brand `#8f6692` is borderline-acceptable for chip stripes and uses brand directly. Migration: one-time GM-client hook on `Hooks.once("ready", ...)` rewrites `theme === "mags"` to `theme === "secret"` on all actors. The major-character DataModel theme enum bumps to `["rose", "roger", "clayton", "dixon", "avril", "pearlinda", "secret"]`. NPC and Connection variants unchanged.
- **2026-05-08 — Token hover card gains real per-actor-type configuration.** §10.2. Was: shared component pulling `sceneInfo.hoverSummary`, but Major data model never had that field — Major hover cards mostly empty. Now: Major hover auto-derives a public-info snapshot (name, role, active condition, top 3 rep tags, family criteria, "open dossier ↗" footer); NPC and Connection hover upgrades to GM-authored rich text (subtitle line + HTMLField body + public tags) with a dedicated Hover card section on the sheet. Two new schema fields on Connection and NPC: `sceneInfo.subtitle` (string), and `sceneInfo.hoverSummary` upgrades from string to HTMLField. No data migration needed — plain-text strings are valid HTML. Two new settings: `hoverCardEnabled` (client, default true), `hoverCardMajorAutoSummary` (world, default true).
- **2026-05-08 — Custom character tokens replace per-theme frame assets.** Significant scope simplification. The original design committed to per-theme frame graphics (one PNG/SVG per Major theme + a default for Connections/NPCs) overlaid on portrait images. Dropped: Natalie is producing custom illustrated tokens for every character, with each token's own design carrying whatever framing identity that character has. Cascades: (a) `--gs-frame-asset` removed from §6 theme color slots; (b) §4.1 dossier cameo description updated to "token in a circular display, not portrait inside a gilt oval frame"; (c) new primitive §8.5 "Profile picture resolution" defines a single rule for the whole system: every profile pic resolves from `activePersona?.tokenImageUrl || actor.prototypeToken.texture.src`; (d) new `module/helpers/profile-pic.js` helper centralizes the resolution; (e) confirmed asset commitments shrink by one (no more per-theme frame graphics); (f) `actor.img` and `persona.portraitUrl` schema fields stay for forward compatibility but become inert. All affected sub-docs (`patch-persona-switcher.md`, `patch-token-events.md`, `patch-journal-elevation.md`) updated to reference §8.5.
- **2026-05-09 — Cabinet rotated from vertical right-edge to horizontal bottom-center.** Per Natalie's design call during visual QA. The rail now sits directly above Foundry's macro hotbar, centered on the viewport's horizontal axis (`bottom: 64px; left: 50%; transform: translateX(-50%)`). The drawer stacks ABOVE the rail (toward the canvas) rather than to the side; the template's existing DOM order (drawer first, rail second) lays out correctly under `flex-direction: column` with no markup change. Rail flipped from `flex-direction: column` to `row`; rail divider flipped from horizontal hairline to vertical. Drawer's `margin-right: 8px` became `margin-bottom: 8px` for the new gap direction; `max-height` tightened from `80vh` to `70vh` to leave breathing room above the hotbar. Pure CSS in `styles/apps/_cabinet.css` — no JS, no template, no settings change. Supersedes `patch-cabinet.md` §3's right-edge layout; `patch-cabinet.md` amended in-place to match.
- **2026-05-09 — Chrome-icons feature: per-asset existence check, FA fallback.** The original `module/hooks/chrome-icons.js` always set `data-icon-asset` + `--icon-asset` on every registry-matched button, so when the GM hadn't supplied SVG art yet (the day-one default per §14.7) every scene-control button rendered empty — FA glyph hidden, replacement asset 404'd silently. The promised "graceful failure" (post-MVP-7 entry) was actually hostile UX: a fresh install lost every scene-control icon. Fix: each registry asset URL is now probed once via `fetch HEAD` (cached for the session); if the SVG 200s, the attribute is stamped and the FA glyph hides; if it 404s, the attribute is NOT stamped and Foundry's default icon stays visible. Same probe applied to `_markJournalEntries`. Result: any subset of icons with art supplied get the upgrade; the rest stay legible. The chrome-icons feature can now be left on permanently with no visual cost. Hook callbacks became `async`; Foundry awaits returned promises so this is safe.
- **2026-05-09 — Foundry sidebar narrows to a player allowlist.** Companion change to the Cabinet rotation. New client setting `playerSidebarFilter` (default `true`) hides Combat, Scenes, Journal, Tables, Cards, Compendium, and Settings tabs from non-GM users. Players keep chat, actors, items, macros, and playlists. GMs always see the full sidebar. Implementation: `module/hooks/sidebar-filter.js` adds the `gs-sidebar-filtered` body class on ready (and on setting change) when the user is a player and the setting is on; `styles/components/_sidebar-filter.css` does the hiding via `body.gs-sidebar-filtered #sidebar [data-tab="..."]` rules. The Journal tab is on the hide list because the Novel Reader (§13.3, shipped) is now the player-facing archive surface for letters / monologues / session logs / cycle reflections — keeping the Foundry journal directory visible to players would just duplicate what the Reader already provides in a tighter, on-theme reading flow. New entry in §17 body class registry. New lang keys under `GOODSOCIETY.settings.playerSidebarFilter`.

---

## 17. Appendix — body class registry

The patch introduces several `<body>`-level classes that gate large CSS rule sets. This table is the canonical reference. Update it whenever a new class is introduced; any class shipping without an entry here is a bug.

| Class | Scope | Toggled by | When applied | What it does |
|---|---|---|---|---|
| `gs-chrome-themed` | `body` | `applyFoundryChrome` setting (v1 §28) | Page load + runtime via `clientSettingChanged` | Applies all Foundry chrome color/typography overrides per v1 §28 — titlebars, sidebar background, sidebar tabs, scene navigation, chat surrounding chrome, default form controls, notifications, players list, hotbar background. Patch §13 extends this to a ninth surface — the journal sheet body (cream paper, sage hairline frame, Lora display headings, Crimson body) — and to the journal sidebar list (folder color stripes, entry-type glyphs). |
| `gs-chrome-icons-on` | `body` | `applyChromeIcons` setting (patch §14.5) | Page load + runtime via `clientSettingChanged` | Activates the icon swap from FA glyphs to custom illustrations on scene controls, sidebar tabs, and the Cabinet rail. Stacks on top of `gs-chrome-themed` — has no effect if `gs-chrome-themed` is absent. |
| `gs-world-identity` | `body` | `applyWorldIdentity` setting (patch §2.4) | Page load + runtime via `clientSettingChanged` | Activates the Arrival, pause overlay, and any future world-identity surfaces. Independent of `gs-chrome-themed` — they layer freely. When absent, Arrival doesn't render and Foundry's default pause overlay shows. |
| `gs-hide-{surface}` | `body` | Per-user Cabinet flag (patch §9.4) | Runtime via Cabinet drawer toggle | One class per surface in `COWORK_SURFACES`. Each class hides the corresponding surface element via `display: none !important`. Multiple classes can be present simultaneously (any combination of surfaces hidden). |
| `gs-sidebar-filtered` | `body` | `playerSidebarFilter` setting (client, default `true`) | Page load + runtime via setting `onChange` | Narrows Foundry's right-edge sidebar to the player allowlist (chat / actors / items / macros / playlists). Hides Combat, Scenes, Journal, Tables, Cards, Compendium, and Settings. GM users never carry the class regardless of the setting. The Novel Reader (§13.3) is the player-facing archive that replaces the Journal tab. CSS lives in `styles/components/_sidebar-filter.css`. |
| `gs-themed` | wrapping element (NOT `body`) | n/a — applied per-surface by `themedWrap()` from `module/helpers/themed-wrap.js` | Render time | Applies `data-theme` cascade for portable themed content (chat cards, letter cards, themed dashboard rows). Carries an inline `style="--gs-brand: ..."` override when a persona's `chatColor` is set. *Listed here for completeness; not a body class.* |

**Layering rules.**

- `gs-chrome-themed` and `gs-chrome-icons-on` stack additively: chrome theme can be on without icons (color-only), but icons require chrome theme to be on (the body-class ancestor selector chain assumes it).
- `gs-hide-{surface}` is independent of all the others. Cabinet visibility toggling works whether or not chrome theming or world identity is active.
- `gs-world-identity` is independent of `gs-chrome-themed` and `gs-chrome-icons-on`. The Arrival and pause overlay can render with or without chrome theming applied.
- Future classes will be added to this table when their sections land.

**Adding a new body class.**

1. Add a row to this table with class name, scope, toggle source, when-applied timing, and what it does.
2. Document interactions with existing classes in the layering rules section.
3. If toggleable at runtime, hook `clientSettingChanged` (or whatever event source applies) to add/remove the class without page reload.
4. Cross-reference the class from the host section that introduces it.
