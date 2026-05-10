# Build prompt — start of post-MVP patch implementation

> Paste the block below into a fresh Claude Code conversation to begin building the patch. The prompt is self-contained — the new agent doesn't need any of this conversation's history.

---

```
You're starting implementation of the post-MVP design patch for the Good Society Foundry VTT system.

# Where things live

- **Repo:** `/Users/nataliewilson/Code/foundry-systems/good-society-homebrew/`
- **Patch design docs:** `/Users/nataliewilson/Library/Application Support/Claude/local-agent-mode-sessions/3d4a0790-71ba-477d-8613-4093d651f005/3aa03580-4cf5-4d8e-99fe-315c65f4297e/local_5270e1e7-f096-4b2b-a462-a4239e09bd5b/outputs/foundry-good-society/docs/design/`

The patch docs are NOT in the repo — they live in the design session output folder above. Reference them in place; copy any you want to commit into `<repo>/docs/design/` as you go.

# Read first, before writing any code

1. **`<repo>/CLAUDE.md`** — entire file. Project conventions, locked decisions, anti-patterns, build phase status.
2. **`<patch-design-docs>/post-mvp-design-patch.md`** — the master spec. 17 sections. Read all of it.
3. **The patch sub-docs** as needed for the surface you're working on:
   - `patch-cabinet.md` — Player Module Menu (§9 of master)
   - `patch-dossier-refactor.md` — Major character sheet rebuild (§4)
   - `patch-epistolary-wizard.md` + `patch-epistolary-wizard-preview.html` — phase environment (§11)
   - `patch-foundry-chrome-icons.md` — custom illustrated icons (§14)
   - `patch-persona-switcher.md` — primitive contract for the quick-switcher pill (§8.4)
   - `patch-world-identity.md` — Arrival + pause overlay + v1 §29 reconciliation (§2)
   - `patch-token-events.md` — resolve handoff + monologue scene-freeze (§12)
   - `patch-journal-elevation.md` — folder organization + Novel Reader app (§13)
   - `patch-integration-checklist.md` — CSS-only audit covering 22 existing modules

# Repo state — drift since CLAUDE.md was last updated

- `system.json` is at `0.1.1` (CHANGELOG.md only documents `0.1.0`).
- A `gs-rumours` scene control exists in `module/hooks/scene-controls.js` (not in CLAUDE.md §14's scene-control list).
- A `reputationPhaseWizardEnabled` client setting is registered in `module/good-society.js` (not in CLAUDE.md §8).
- `module/constants.js` does NOT exist yet. The patch references `SEAL_TYPES`, `COWORK_SURFACES`, and `CHROME_ICONS` registries — you'll create the file.
- `styles/primitives/` does NOT exist. CLAUDE.md §5 explicitly says don't create it. Keep new primitives in `styles/components/`.
- No `_theme-secret.css` or `_theme-pearlinda.css` yet. The Mags→Secret rename and Pearlinda addition haven't landed.

# Suggested kickoff — Theme registry overhaul

Start here because every visual surface in the patch references the new color values:

1. Read `post-mvp-design-patch.md` §6 in full (theme color slots + new registry).
2. Update `module/data-models/major-character.js` theme enum from `["rose", "roger", "mags", "avril", "dixon", "clayton"]` to `["rose", "roger", "clayton", "dixon", "avril", "pearlinda", "secret"]`.
3. Add a one-time GM-client migration hook in `Hooks.once("ready", ...)` that rewrites `theme === "mags"` to `theme === "secret"` on all actors. Idempotent.
4. Rename `styles/themes/_theme-mags.css` → `_theme-secret.css`, refresh palette per the §6.5 table.
5. Create `styles/themes/_theme-pearlinda.css` per the §6.5 table.
6. Refresh existing `_theme-rose.css`, `_theme-roger.css`, `_theme-clayton.css`, `_theme-dixon.css`, `_theme-avril.css`, and `_house.css` with new color values.
7. Update the dark-theme functional color overrides: `--gs-positive` dark `#7AB87A → #77c477`, `--gs-danger` dark `#D85959 → #dd4242`, plus the rep-tag-bg variants.
8. Drop `--gs-paper-aged` and `--gs-ink-soft` slot definitions if present in CSS — they're no longer per-theme. Replace component-level usage with `color-mix()` or opacity derivations.
9. Test: open a Major sheet of each theme. Verify cream-surface accents on the dashboard, dock, and themed chat cards render with new colors.
10. Update CLAUDE.md §6.1 (theme enum), §12.4 (theme registry table), and add an entry to the running log in §15 noting the rename.

After theme overhaul, suggested order for remaining batches:

- **§8 Primitives first** (eyebrow, empty-state, seal carve-out, persona switcher, profile-pic resolution helper). They unblock everything else.
- **§3 Dashboard + §10.4 Dock parity** — light CSS work, visible payoff.
- **§13 Journal organization plumbing** — folder helpers + permissions fix on monologues. Discrete.
- **§4 Dossier refactor** — biggest single-surface lift. Schedule as its own session.
- **§2 World identity (Arrival + pause overlay)** — net-new code, no precedent to displace.
- **§11 Epistolary Wizard, §12 Token events, §13 Novel Reader, §14 Chrome icons** — bigger features.
- **§9 Cabinet** — depends on chrome icons being decided.
- **§10.2 Token hover card v2** — schema additions on Connection and NPC. Discrete.

# Working rules

- All new design decisions get logged in the patch's `post-mvp-design-patch.md` §15 "Decisions captured during drafting" — keep the log current.
- All schema additions follow CLAUDE.md §5 mutation rules (always `await actor.update(...)`, never inline mutation).
- All new body classes get an entry in §17 of the master spec (the body class registry table).
- All new world / client settings get added to CLAUDE.md §8.
- Localization keys go in `lang/en.json` in the same commit as the code that uses them.
- Validate `lang/en.json` with `python3 -m json.tool` before committing — per the CLAUDE.md anti-pattern, JSON parse errors break ALL localization globally.

# When you finish a batch

Tell Natalie what you did. Ask whether to continue with the next batch or pause for review. Don't auto-chain through every batch — these are review-shaped chunks.
```

---

# Notes for Natalie (don't paste these to the new agent)

- The audit found three minor drift items (`gs-rumours` scene control, `reputationPhaseWizardEnabled` setting, version 0.1.1) — none are conflicts, just things CLAUDE.md doesn't document yet. The build prompt flags them so the new agent updates CLAUDE.md as it works.
- Theme overhaul is suggested as the kickoff because: (a) it's discrete, (b) it affects every visual surface, (c) it's well-specified in the patch (full table of values per theme), (d) the migration is small (one hook, one rename, palette refreshes).
- The build prompt deliberately doesn't dictate exact code paths inside individual files — those are the new agent's call. It dictates ordering, conventions, and where to find things.
- If you want a different starting point than theme overhaul, edit the "Suggested kickoff" section before pasting.
