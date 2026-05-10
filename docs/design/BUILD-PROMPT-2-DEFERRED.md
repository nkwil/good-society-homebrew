# Build prompt #2 — deferred items from the post-MVP patch

> Paste the block below into a fresh Claude Code conversation. This is the follow-up to `BUILD-PROMPT.md` — that round shipped foundation work but explicitly deferred several major surfaces. This round picks them up, starting with a small UX fix that's blocking testing.

---

```
You're continuing implementation of the post-MVP design patch for the Good Society Foundry VTT system. A previous round shipped the foundation — themes, primitives, world-identity surfaces, Cabinet, chrome-icons hook, journal organization plumbing, helpers — but several major visual surfaces were deferred. This round picks them up.

# Where things live

- **Repo:** `/Users/nataliewilson/Code/foundry-systems/good-society-homebrew/`
- **Patch design docs:** `<repo>/docs/design/` (alongside `CLAUDE.md` and the v1 design docs 00–31). Look for `post-mvp-design-patch.md` (master spec) and `patch-*.md` (sub-docs).

# Read first

1. **`<repo>/CLAUDE.md`** — entire file.
2. **`<repo>/docs/design/post-mvp-design-patch.md`** — master spec. Pay attention to the running log at the bottom for what already shipped vs. what's deferred.
3. The patch sub-doc(s) for whichever item you're tackling — all live at `<repo>/docs/design/patch-*.md`.

# Current build state

Per a debug audit:

**Already shipped (don't redo):**
- Theme registry overhaul — Mags renamed to Secret, Pearlinda 7th theme added, Mags→Secret migration hook in `Hooks.once("ready", ...)`. New theme stylesheets at `styles/themes/`.
- §8 primitives — `_eyebrow.css`, `_empty-state.css`, `_persona-switcher.css` in `styles/components/`.
- `module/constants.js` exists — `SEAL_TYPES`, `COWORK_SURFACES`, `CHROME_ICONS` registries.
- `module/helpers/profile-pic.js` — token-based profile-pic resolver per §8.5.
- World-identity surfaces — Arrival app, pause overlay reskin, hooks, settings.
- Cabinet (Player Module Menu) — app + rail.
- Chrome-icons hook — body class `gs-chrome-icons-on`, asset registry.
- Journal organization — `module/helpers/journal-folders.js`, monologue/letter/session-log archive paths consume it.
- Cycle dividers — `module/helpers/cycle-divider.js`, auto-creates "Cycle N — Reflections" entries on transition into upkeep.
- Resolve/monologue spend helpers — basic chat-card pipelines.
- Letter seal-type registry hook + invitation/burn behaviors.
- All post-MVP settings registered.

**Deferred (these are this round's work, in priority order):**

## 1. URGENT — Arrival dismiss UX fix (small)

**Problem:** the Arrival splash assumes a scene is active. With no active scene, players have no way to dismiss it inside the Arrival itself — they have to find System Settings and toggle `applyWorldIdentity` off. This is a dead end and is currently blocking QA testing.

**Fix:**
- Add an `Esc` keydown handler that closes the Arrival for the current session (don't disable the setting — just close the singleton).
- Add a small inline hint pill at the bottom of the Arrival: **"Activate a scene to begin ↗"**. Clicking it focuses the Foundry scene-navigation sidebar. House-styled, minimal — doesn't compete with the title.
- The Arrival's existing scene-active dismiss path stays unchanged. The Esc handler and hint pill are additive.

Files: `module/apps/arrival.js`, `templates/apps/arrival.hbs`, `styles/apps/_arrival.css`. Add a localization key for the hint text.

## 2. §4 Dossier refactor (the big one)

**Problem:** the Major character sheet is untouched from v1 — players see no change despite the patch shipping. `module/sheets/major-character-sheet.js` lines 66–71 still declare PARTS as `header / public / private / strip` (v1 tabbed layout). The dossier shell, multi-spread navigation, page-turn animation, and new typography do not exist.

**Spec:** `docs/design/post-mvp-design-patch.md` §4 + the standalone `patch-dossier-refactor.md`. Read both end-to-end before writing code.

**Approach:** wrap the existing tabbed sheet in the leather-book shell rather than rebuilding from scratch — the v1 schema, click handlers, drag-drop pipelines, and TextEditor wiring all stay. The patch is a structural+visual reskin, not a data-model change. Build in this order:

1. Leather-book shell + paper texture + spine + marginalia + corner ornaments.
2. Cameo header + persona switcher (consume the existing `module/apps/persona-switcher-popover.js` — primitive lives in `templates/partials/persona-switcher.hbs` per §8.4).
3. Theme switcher row of swatches (7 Major themes — `rose / roger / clayton / dixon / avril / pearlinda / secret`).
4. Single-page rotation page-turn animation (`transform-origin: left center; rotateY(-180deg)`). NOT a card-flip of the whole book.
5. Click-delegation wiring at `.dossier-book` level for `data-goto` attributes.
6. The character spread (left page = public, right page = private — same content as today, just laid out as book pages instead of tabs).
7. Connection spreads (`conn-{id}`) — clicking a connection chip navigates here.
8. Backstory spreads (`backstory-1`...`backstory-N`) — multi-page expanded backstory.
9. Tokens section relocated to the public page (off the bookmark, per the master spec §4.5).
10. New persona/theme switcher in the cameo (per §4.5b).

Eyebrow primitive: every section header on the dossier uses §8.1's `.gs-eyebrow` class. No drop caps in the body (the only ornament-face exception is the cameo's name initial — Lavishly Yours).

Profile pic resolution: every cameo / chip portrait calls `profilePic(actor)` per §8.5. Tokens are the source, not portraits.

Drop-state visuals on the rep-tag rows during drag-drop per §4.4.7.

Esc-to-character on non-character spreads per §4.4.6.

This is a session or two of work. Pause for review at the milestone "character spread renders cleanly with persona/theme switcher and on-page tokens." That's the smallest end-to-end shippable cut.

## 3. Version bump + CHANGELOG

After completing items 1 and 2:

- Bump `system.json` from `0.1.1` to `0.1.2`.
- Add a `0.1.2` entry to `CHANGELOG.md` listing what shipped in the post-MVP sweep + this round, with explicit "deferred" notes for §11 Epistolary Wizard, §12.2 Monologue scene-freeze overlay, §13.3 Novel Reader, and §10.2 hover-card render-path dispatch.
- Update `CLAUDE.md` §14 "Build phase status" with what landed.

# Future rounds (don't tackle this conversation)

These remain deferred:

- **§11 Epistolary Wizard** — phase environment with three-tab inbox/compose/outbox + GM Roster. Spec: `patch-epistolary-wizard.md`. Schema for seal-type registry already shipped; the wizard surface itself didn't.
- **§12.2 Monologue scene-freeze overlay** — fourth world-identity surface. Spec: `patch-token-events.md`. Helpers exist; the full-viewport overlay app and socket sync do not.
- **§13.3 Novel Reader app** — framed ApplicationV2 with cover/rail/reader PARTs. Spec: `patch-journal-elevation.md`. Cycle dividers already auto-generate; the reader that consumes them doesn't.
- **§10.2 Hover-card v2 render-path dispatch** — schema fields landed (`sceneInfo.subtitle`, `sceneInfo.hoverSummary` upgraded to HTMLField). The `_buildContent()` dispatch on actor type still needs implementation.

Each one is its own batch. Schedule with Natalie before tackling.

# Working rules

- All new design decisions get logged in `post-mvp-design-patch.md` §15 (or §16 — the decisions log).
- All new body classes get an entry in §17 (the body class registry table).
- All new world / client settings get added to `CLAUDE.md` §8.
- Localization keys go in `lang/en.json` in the same commit as the code that uses them.
- Validate `lang/en.json` with `python3 -m json.tool` before committing.
- Per CLAUDE.md §16: never inline `activePersona?.portraitUrl || actor.img` — always go through `profilePic(actor)`. Same for display names — always `activePersona?.name || actor.name`.

# When you finish each item

Tell Natalie what you did. Pause. Do NOT auto-chain into the next item — these are review-shaped chunks. The Arrival dismiss fix should land first because it unblocks her testing.
```

---

# Notes for Natalie (don't paste these to the new agent)

- The Arrival fix is item #1 because it's blocking your testing. Quick win — should be ~30 minutes of Opal time.
- The dossier refactor is the big lift. Expect at least one session, possibly two. The "pause at first shippable cut" instruction is so you can verify the shell + cameo + on-page tokens look right before Opal builds out connection spreads / backstory spreads / page-turn animation.
- The remaining deferred items (Epistolary, monologue overlay, Novel Reader, hover card render) are each their own batch. I left them named in the prompt so the new agent knows what's still pending — but instructed it NOT to tackle them this round.
- If you want to reorder priority — e.g. you'd rather see the Novel Reader before the dossier — edit the "in priority order" block before pasting.
