# Patch: Persona switcher primitive

> **Status:** drafting. Lands as part of the post-MVP patch.
>
> **Companion docs:** [`13-persona-switcher.md`](./13-persona-switcher.md) (locked v1 — owns the persona *editor* modal for creating/editing personas; this doc owns the *quick-switch* pill that lives on multiple surfaces), [`post-mvp-design-patch.md`](./post-mvp-design-patch.md) (master spec, §4.5b dossier instance).
>
> **Repo target:** `templates/partials/persona-switcher.hbs` (new — single Handlebars partial used by every consumer), `styles/components/_persona-switcher.css` (visual contract), `module/apps/persona-switcher-popover.js` (already exists as vanilla DOM popover from Session B-5a-i — extend, don't replace).

---

## 1. What this patch does

The persona switcher is a small UI primitive — a pill that shows the active persona's name, opens a dropdown of available personas, and triggers `switchPersona(actor, personaId)` on selection. The primitive currently exists per-surface with visual drift between instances. This patch defines a single contract and lists every surface that must adopt it.

This patch covers:

- The pill's visual contract (typography, color, shape, chevron, dimensions).
- The dropdown's geometry (per-item token swatch, name, active-state indicator).
- The four surfaces where the primitive must appear.
- Theme behavior (adopts host actor's theme; honors persona `chatColor` overrides).
- Relationship to v1 §13 (the persona editor modal for creating/editing).

This patch does NOT cover:

- The persona editor modal itself (that stays in v1 §13).
- The `switchPersona()` swap pipeline (locked in `module/helpers/persona-swap.js` per Session B-5a-ii Option B).
- Persona data shape (locked in CLAUDE.md §6.5).

---

## 2. The visual contract

### 2.1 Pill (closed state)

- Family: `--gs-display` italic (Lora italic in the current pair).
- Size: 13 px.
- Case: sentence (display the persona name as authored).
- Color: `--gs-ink` on the label; `--gs-accent-3` (gilt) on the chevron `▾`.
- Border: 1 px hairline in `--gs-accent-2` (sage on house; per-theme on themed surfaces).
- Background: `--gs-paper-warm`.
- Shape: pill (rounded rectangle, ~24 px tall, 10 px horizontal padding).
- Cursor: pointer.
- Hover: background lifts to `--gs-paper`, no border change.

### 2.2 Two states for the closed pill

The pill renders one of two labels depending on whether an explicit persona is active:

- **No explicit persona** — `actor.system.activePersonaId === ''`. Label reads `true identity ▾` in italic. The dossier's cameo name renders the actor's canonical name in this state.
- **Persona active** — label reads `{persona.name} ▾`. The cameo name renders the persona name.

This distinction matters for the dossier (where `activePersona` falls back to the primary persona via the data-model getter) but the *pill* always reflects `activePersonaId` directly so the user sees what they explicitly selected.

### 2.3 Dropdown (open state)

- Container: `--gs-paper` background, 1 px hairline border in `--gs-accent-2`, 4 px corner radius, 0.5 px gilt accent border on themed surfaces (matching `.gs-themed`'s wrapper accent).
- Width: matches pill width or 200 px minimum, whichever is wider.
- Shadow: subtle 0 2px 6px rgba(0,0,0,.08) — the only place this primitive uses a shadow, justified by being a layered overlay over a sheet.
- Position: anchored bottom-left of the pill, opens downward by default; flips upward if the pill is in the bottom 30% of the viewport.
- z-index: 500 (per the CLAUDE.md §16 anti-pattern — sheet-anchored overlays must beat the active ApplicationV2's window-manager z-index).

### 2.4 Dropdown items

Each item is a row in the dropdown:

- Height: 32 px.
- Layout: 18 px token swatch (left) + 8 px gap + persona name (Lora italic 13 px) + flex spacer + active marker (right, when active).
- Token swatch: a circular 18 px disc; `background-image: url(persona.tokenImageUrl)` (resolved per master spec §8.5 profile-pic resolution); falls back to a sage-tinted disc with the persona's first initial in Lora 11 px when no token is set.
- Name color: `--gs-ink`.
- Active marker: a 4 px gilt dot in `--gs-accent-3` aligned to the right edge.
- Hover: background `--gs-paper-warm`.
- The first item is always **"true identity"** (no persona) — `actor.prototypeToken.texture.src` token swatch + the actor's canonical name. Selecting this item clears `activePersonaId`.
- The final item is always **"+ new persona"** in subdued sage (`--gs-accent-2`), no token swatch. Clicking opens the v1 §13 persona editor modal.

### 2.5 Empty state

If the actor has zero personas defined, the pill collapses to a non-interactive `true identity` label (italic, no chevron, no border) inline with surrounding text. Clicking it does nothing. (Use the standard empty-state primitive from §8.2 in the persona EDITOR's list view, not here — the pill itself just goes quiet.)

---

## 3. Surfaces

### 3.1 Dossier cameo (Major sheet header)

Already specified in master spec §4.5b. The pill sits in a small controls row directly under the cameo bio chips, above the theme switcher row. This is the canonical instance — every other surface follows its visual treatment.

### 3.2 Connection sheet header

Connection actors with personas defined (per CLAUDE.md §6.2) get the pill in the same position relative to the cameo as on the dossier. House-styled (Connection sheets don't carry a theme cascade — see CLAUDE.md §12 scope boundaries) so the pill renders against the Connection sheet's own variant palette via the `connection-{variant}` theme.

NPCs may have personas (CLAUDE.md §6.4). When they do, the pill appears on the NPC sheet as well, in the same relative position. NPCs use the house theme so the pill is fully house-styled.

### 3.3 Speaking-As bar (above chat input)

The Speaking-As bar already includes a popover-backed actor + persona picker (Session B-3). The patch reskins that popover to match this primitive:

- The bar's pill button (currently `gs-speaking-as__pill`) adopts the visual contract above.
- The dropdown matches §2.3 / §2.4.
- Indented persona items under each actor use the same 18 px token swatch (per §8.5).

The Speaking-As bar carries no theme cascade itself (it's house-styled chrome), so the pill renders in house style. The dropdown's per-item rows render the actor's theme as a 4 px accent stripe on the left edge of the row, matching the dashboard's themed-accent-stripe language.

### 3.4 My Characters Dock (footer "speaking as" pill)

Per master spec §10 (dock parity), the dock's footer carries the same pill. House-styled. Selecting a persona swaps the active persona for the actor that owns the dock row above the footer.

---

## 4. Theme behavior

### 4.1 The pill itself

On the dossier and Connection sheet, the pill is rendered inside the actor's theme cascade — `--gs-brand`, `--gs-accent-2`, `--gs-paper-warm` resolve per-actor. On the Speaking-As bar and the dock, the pill is house-styled.

### 4.2 Persona `chatColor` override

Personas can override the actor's theme brand color via `persona.chatColor` (CLAUDE.md §6.5). This override:

- **Does NOT** apply to the pill (which always uses the host surface's brand).
- **DOES** apply to the chevron `▾` when that persona is the active one — providing a tiny brand-color cue that this persona is using a custom color elsewhere (chat cards, letters).

This keeps the pill's identity stable across persona switches while still surfacing that a persona has a non-default color.

### 4.3 Active marker on dropdown items

The active marker is gilt (`--gs-accent-3`), not brand. This is intentional — a brand-color marker would conflict with personas that have `chatColor` overrides (the marker would appear in the persona's override color, which is misleading because the marker indicates "currently active" not "this persona's color").

---

## 5. Click delegation

A single delegated click handler at `document` level (capture phase) handles all popover open/close behavior, matching the existing speaking-as pattern from `module/hooks/speaking-as.js`. Each pill carries `data-action="openPersonaSwitcher"` and `data-actor-id` attributes; the delegated listener resolves the actor and opens the popover anchored to the clicked element.

This avoids per-element handlers going stale across Foundry's frequent re-renders (the dock and the Speaking-As bar both re-render often). One handler covers every pill on every surface.

---

## 6. Relationship to v1 §13

v1 §13 specifies the **persona editor** — a framed `ApplicationV2` modal for creating, editing, deleting, and reordering personas. That doc remains authoritative for editor surface, schema, and CRUD flows.

This patch specifies the **quick-switcher pill** — the inline picker used to swap which persona is active. The two are complementary:

- The "+ new persona" item in this primitive's dropdown opens the v1 §13 editor in `create` mode.
- The "edit persona" affordance lives in the v1 §13 editor itself, not in this primitive's dropdown — quick-switching and editing are different gestures.

v1 §13 doesn't need any changes from this patch. The editor's chrome and behavior stay exactly as locked.

---

## 7. File-by-file plan

| File | Action |
|---|---|
| `templates/partials/persona-switcher.hbs` | **NEW.** Single partial used by all four surfaces. Renders the pill + (when expanded) the dropdown. Receives `actor` + `expanded` flag. |
| `styles/components/_persona-switcher.css` | **NEW.** Implements §2 visual contract. House + theme cascade respected via `--gs-brand` etc. |
| `module/apps/persona-switcher-popover.js` | **EDIT.** Already exists from B-5a-i. Adopt the new partial; keep the vanilla DOM popover machinery; add z-index 500 if not already. |
| `templates/actors/major-character/header.hbs` | **EDIT.** Replace inline persona pill with `{{> partials/persona-switcher actor=actor}}`. |
| `templates/actors/connection/header.hbs` | **EDIT.** Same. |
| `templates/actors/npc/header.hbs` | **EDIT.** Same (only when actor has personas). |
| `templates/apps/speaking-as.hbs` | **EDIT.** Replace existing pill markup. |
| `templates/apps/my-characters-dock.hbs` | **EDIT.** Add footer pill row (introduced as part of dock parity, master spec §10). |
| `lang/en.json` | **EDIT.** Add `persona.switcher.trueIdentity`, `persona.switcher.newPersona`, `persona.switcher.activeMarker` keys. |

---

## 8. Implementation order

1. Build `_persona-switcher.css` against the dossier's existing pill (§3.1) so the visual contract lands first on the canonical instance.
2. Extract the dossier's inline markup into `partials/persona-switcher.hbs`.
3. Migrate the dossier to consume the partial. Verify visual + behavioral parity.
4. Add the partial to the Connection sheet header.
5. Add the partial to the NPC sheet header (only renders when `actor.system.personas.length > 0`).
6. Migrate the Speaking-As bar to consume the partial.
7. Migrate the dock footer (concurrent with master spec §10 dock parity work).
8. Verify all four surfaces behave identically — same hover, same dropdown geometry, same z-index, same click-delegation behavior.

---

## 9. Edge cases

- **Many personas.** No hard cap, but the dropdown caps at 360 px tall with internal scroll. Eight personas fit without scrolling at 32 px row height; nine and up scroll.
- **Long persona names.** Truncate with `text-overflow: ellipsis` at the dropdown's content width. Full name shown in tooltip on hover (use the rule-tooltip primitive from v1 §20).
- **Persona with no portrait set.** Falls back to the sage-tinted disc with the persona's first initial. Same fallback the existing dock-row-major / dashboard-row use.
- **Actor with one persona.** Pill still renders. The dropdown shows "true identity" + that single persona + "+ new persona". Single-item dropdowns are intentional — they preserve the gesture and allow returning to true identity.
- **GM viewing player-owned actor.** GM sees the pill and can switch personas (per the existing `OWNER` permission flow). No special chrome.
- **Persona with redacted visibility.** The dropdown still lists the persona. Redaction applies to the persona's *fields* in the host surface, not to the persona's existence in the switcher.

---

## 10. Open questions

- **§3.4** — Does the dock footer pill apply to ALL dock rows simultaneously (one pill that affects whichever character is currently "speaking as") or per-row (each dock row has its own pill)? Lean: one pill in the footer that mirrors the Speaking-As bar above chat — they're the same control with two visual placements. Defer the per-row variant unless a usability issue surfaces.
- **§4.2** — Should `persona.chatColor` ALSO subtly tint the dropdown row's left accent bar (instead of just the chevron when active)? Lean: no — the chevron tint is sufficient signal, and a colored row stripe would muddle with the per-actor theme stripe on the Speaking-As dropdown. Revisit if the chevron tint goes unnoticed in usage.
- **§6** — Should the "+ new persona" item also appear when the GM is viewing a player-owned actor? Lean: yes — GMs can author personas on player actors per existing permission flows. The v1 §13 editor handles permission gating itself.

---

## 11. Decisions log

- **2026-05-08 — Persona switcher pill is a single primitive across four surfaces.** Dossier cameo, Connection sheet, NPC sheet, Speaking-As bar, and dock footer all consume `templates/partials/persona-switcher.hbs`. Visual drift between instances is forbidden going forward.
- **2026-05-08 — Pill label honors `activePersonaId` directly, not the data-model getter.** The `activePersona` getter falls back to the primary persona when no explicit selection exists; the *pill* shows the user's explicit state ("true identity ▾" when nothing is selected). This distinction lets the user see what they picked vs. what the system fell back to.
- **2026-05-08 — Active marker is gilt, not brand.** A brand-color marker would conflict with personas that override `chatColor`. Gilt is theme-stable.
- **2026-05-08 — `chatColor` override tints the chevron only.** It does NOT tint the pill body (which would conflict with the host surface's brand) or the active marker (see above). The chevron tint is a small, stable signal.
- **2026-05-08 — z-index 500.** Same as other sheet-anchored overlays in the system (per CLAUDE.md §16 anti-pattern).
- **2026-05-08 — One delegated click handler at document level.** Same pattern as Speaking-As. One handler, one popover instance, one source of truth for open/close lifecycle. No per-pill handlers; no inline `onclick`.
- **2026-05-08 — v1 §13 persona editor stays untouched.** The editor surface, its schema, and its CRUD flows are out of scope for this patch. Only the quick-switcher pill is in scope.
