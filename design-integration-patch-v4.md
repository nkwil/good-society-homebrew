# Design Integration Patch v4

This patch integrates the fourth wave of design work — eight new docs (`00-system-overview.md`, `21-edit-conflict-warning.md` through `27-token-frame.md`) — into `PLAN.md`, `CLAUDE.md`, and the design inventory.

**B-1 is paused mid-build. A.6 (Family schema revision) is in progress.** This patch is sequenced so neither is disrupted: nothing in here touches components Claude Code has already built. The patch is doc-only updates plus a few flagged-for-later schema additions.

Apply via Claude Code with this prompt:

> Read the new design docs in `docs/design/`: `00-system-overview.md`, `21-edit-conflict-warning.md`, `22-bulk-permissions-panel.md`, `23-primitives-batch.md`, `24-session-log.md`, `25-backup-export.md`, `26-pending-changes-log.md`, `27-token-frame.md`. Then apply the patches in `design-integration-patch-v4.md` to `PLAN.md` and `CLAUDE.md`. Show me a unified diff for each before saving. **Don't apply any DataModel changes** — flagged items are noted separately for the next schema review (Session A.7 if needed).

---

## What's in this wave

| Doc | Covers | Affects current B-1? |
|---|---|---|
| `00-system-overview.md` | Folder index + architectural pillars + cross-doc reference | No — it's a meta-doc |
| `21-edit-conflict-warning.md` | Three-layer conflict prevention for shared Connections | No — Phase 11 robustness |
| `22-bulk-permissions-panel.md` | GM grid for setting actor ownership in one screen (#19 was placeholder) | No — Phase 6 GM tools |
| `23-primitives-batch.md` | Canonical reference for 13 primitives + GM pill | **Spec for already-built primitives** — review existing CSS against this |
| `24-session-log.md` | Auto-generated end-of-session journal entry | No — Phase 11 robustness |
| `25-backup-export.md` | GM-only utility for full world JSON export/import | No — Phase 11 robustness |
| `26-pending-changes-log.md` | Inline "Since last Upkeep" section on Major sheet Public tab | **Public tab section ordering** — Public tab is currently a stub in B-1, so update the spec, no rework |
| `27-token-frame.md` | Canvas-side ring/border distinguishing Major / Connection / NPC tokens | No — Phase 6 scene work |

**Net effect on B-1's remaining work:** small. One Public tab section ordering update (insert "Pending Changes Log" between Active Conditions and Inner Conflict, conditional render) — and that section is currently a stub anyway. Resume B-1 after applying patch v4 with no rework.

**A.6 status:** unchanged. Family schema revision (`heirStatus` enum + optional `establishedYear` and `heirStatusFlavor`) is still the right scope. Patch v4 does NOT add more A.6 work; it flags a few additional schema fields for a future Session A.7 (after B-1 lands) but doesn't touch them now.

---

## Headline structural changes

Five things matter most:

1. **Primitives spec is now canonical** in `23-primitives-batch.md`. The repo already has primitives built in `styles/components/`; the doc proposes `styles/primitives/` as a separate folder for the smallest atoms with `styles/components/` reserved for composed components built from primitives. **Recommendation: keep current `styles/components/` location** — rebranding mid-build creates churn without functional benefit. Note the convention difference in CLAUDE.md but don't move files. Future complex components (e.g. `_impression-card.css`, `_chat-card-base.css`) go in `styles/components/`; primitives stay where they are.

2. **The Major sheet's Public tab gets a new conditional section** — Pending Changes Log (#26). Renders only when `actor.system.reputation.pendingChanges.length > 0`. Sits between Active Conditions and Inner Conflict in the section order. Update `04-character-sheet.md`'s Public tab spec to reflect the new ordering. Public tab is currently a stub in B-1, so this is a no-op for the current state.

3. **New canvas-side feature: token frames** (#27). Three variants: 3px solid + glow for Majors, 2px solid for Connections, 1px dashed for NPCs. Implemented via Foundry's TokenRing API (Option A) with custom PIXI overlay fallback (Option B). Adds a new `module/canvas/` directory. Phase 6 scope.

4. **Schema fields flagged for future review:**
   - `flags["good-society-homebrew"].sessionEvents` (world-level flag, not actor schema) — for Session Log auto-generator (#24)
   - `flags["good-society-homebrew"].lockedBy`, `flags.lockedAt` (actor-level, conflict warning fallback) — for Edit Conflict Warning (#21)
   - `flags["good-society-homebrew"].lastExportTimestamp` (world-level) — for Backup Export (#25)
   - These are Foundry document flags, not schema-defined fields — no DataModel change required. Just add note in CLAUDE.md.

5. **`00-system-overview.md` is a living index doc.** Treat it as the single starting point when onboarding to the design folder. Reference from PLAN.md §6.4 design-system list as the recommended entry point.

---

## Patch 1 — `CLAUDE.md`

### 1.1 Add §5 file structure note about primitives vs components

**Find** the §5 file structure block (the `styles/` tree) and **add** a short note above it:

```markdown
> **Primitives vs. components.** `docs/design/23-primitives-batch.md` proposes a `styles/primitives/` folder for the smallest atomic components (card, button, hairline, etc.) with `styles/components/` reserved for composed components (e.g. `_impression-card.css`, `_chat-card-base.css`, `_dashboard-row.css`). The current build keeps primitives in `styles/components/` for simplicity — both folders coexist in the repo layout shown below, but in practice everything currently sits under `styles/components/`. Keep the existing primitives there; put new composed components there too. Don't create `styles/primitives/` unless a meaningful split emerges later.
```

### 1.2 Add to §11 — chat card recipe should reference 23-primitives

**Find** the recipe sub-section "Adding a chat card or themed surface" and **append**:

```markdown
The chat card variants compose from primitives in `docs/design/23-primitives-batch.md` (card surface #1, section header #2, hairline divider #3, GM pill #12). Don't redefine these inside chat-card stylesheets; reuse the existing primitive CSS files via `@import` in `styles/good-society.css`'s entry point.
```

### 1.3 Add to §15 anti-patterns

**Append** to the §15 bullet list:

```markdown
- ❌ Don't store session-event tracking in actor flags. Per `docs/design/24-session-log.md`, the event log lives at `flags["good-society-homebrew"].sessionEvents` on the world (game), not per-actor. Per-actor would fragment the log and complicate retrieval.
- ❌ Don't paint custom token graphics directly onto the Token document's image. Per `docs/design/27-token-frame.md`, ring frames use Foundry's TokenRing API (or a PIXI overlay fallback) — modifying the token's image baked-in would lose persona-aware swap behavior.
- ❌ Don't render the Pending Changes Log section when `actor.system.reputation.pendingChanges` is empty. Per `docs/design/26-pending-changes-log.md`, the section is conditional — empty state collapses entirely. Don't ship an empty placeholder card.
- ❌ Don't move existing primitives from `styles/components/` to `styles/primitives/`. The folder split proposed in `23-primitives-batch.md` is conventional; the repo's current organization works. Adding a `styles/primitives/` folder mid-build would cause every sheet's import to need updating — defer the rebrand or skip it entirely.
```

### 1.4 Update §13 Build phase status

**Replace** the "Currently in" / "Done" / "Next" block with:

```markdown
**Currently in:** Phase 1c — Sheet templates batch (Session B-1 paused mid-build)

**Done:**
- Phase 0: fork, rename, verify load
- Session A: all 10 DataModels defined and registered
- Session A.5: theme field backfilled on Major/Connection/NPC; chatStyle removed from Major
- Design integration v1 + v2 + v3: theming architecture, registry, antique-but-clean principle, per-component design docs (04–20) integrated
- Design integration v4: per-component design docs 21–27 + meta-overview 00 integrated; primitives spec captured; pending changes log section ordering noted; token frame canvas spec captured for Phase 6
- Session B-0: CSS architecture
  - House variables (palette, type, scale)
  - @fontsource imports for all twelve themes
  - House base styling
  - .gs-themed wrapper mechanism (with 0.5px accent border)
  - Three foundational primitives: card, section header, hairline
  - themedWrap helper at module/helpers/themed-wrap.js (canonical wrapping for all themed content)
  - Clayton theme implemented as override on both .gs-actor and .gs-themed selectors
  - Validated: Clayton cards render distinctly from house cards, themedWrap returns expected HTML
- Session B-1 (in progress):
  - Component primitives: buttons (#40–42), form inputs (#36–38)
  - Token economy primitives: resolve track (#45), MT toggle (#46), monologue dot (#47)
  - Major Character sheet header (#1), tab nav (#2), persistent strip (#5)

**Next:**
- Session A.6 (small schema revision) — Family `heirStatus` enum + optional `establishedYear` and `heirStatusFlavor` fields. ~15 minutes.
- Session B-1 (continuing) — remaining components, Major full layout, Connection, Family, NPC, item sheets, in-sheet persona picker (per docs/design/04, 06, 12, 14, 16)
- Session B-2 — remaining eleven theme presets
- Session B-3 — chat card system (per docs/design/10) — six variants + Speaking-As switcher + Inner Monologue editor flow
- Session B-4 — custom apps batch — Welcome Panel, Public Info Dashboard, My Characters Dock, Cycle HUD, GM Tools, Token Hover Card, Tooltip system
- Session B-5 — Persona switcher + Upkeep Wizard + Condition Picker (per docs/design/13, 11, 18)
- Session B-6 — robustness + retrospective: Edit Conflict Warning, Bulk Permissions Panel, Session Log, Backup Export, Pending Changes Log section, Token Frame (per docs/design/21, 22, 24, 25, 26, 27)
```

### 1.5 Add to §14 — running decisions log

**Append** to the §14 list:

```markdown
- **B-1 (2026-05-05): Public tab section ordering updated.** Per `docs/design/26-pending-changes-log.md`, the Major sheet's Public tab now renders the Pending Changes Log between Active Conditions and Inner Conflict (conditional — only when `pendingChanges.length > 0`). Public tab section ordering is now: Reputation Criteria → Reputation Tags grid → Active Conditions → Pending Changes Log (conditional) → Inner Conflict → Completed Conflicts. Update when filling in the Public tab body in B-1; currently the tab is a stub.
- **B-1 (2026-05-05): Token frame implementation deferred to Phase 6.** Per `docs/design/27-token-frame.md`, canvas-side ring frames are not in B-1 scope. Inventory entry #51 stays as Phase 6 work.
- **B-1 (2026-05-05): Edit Conflict Warning, Session Log, Backup Export deferred to Session B-6.** Per `21`, `24`, `25` — these are robustness features that don't block any other phase. Group them at the end as a single robustness session.
- **B-1 (2026-05-05): Bulk Permissions Panel slotted into Session B-4 (custom apps batch).** Per `docs/design/22-bulk-permissions-panel.md`. It's a GM tool comparable to the dashboard in surface complexity.
```

---

## Patch 2 — `PLAN.md`

### 2.1 Update §6.4 Reference: design system

**Replace** the §6.4 file list with:

```markdown
### 6.4 Reference: design system

A full design-system documentation tree lives in `docs/design/`. Start with `00-system-overview.md` — the meta-index that orients you to the whole folder.

- `00-system-overview.md` — folder index + architectural pillars + reading order (Living)
- `README.md` — folder readme with workflow notes
- `decisions.md` — authoritative locked palette, type tokens, twelve-theme registry, antique-but-clean principle (Locked)
- `01-mood-exploration.md` — mood directions explored (Closed)
- `02-theme-architecture.md` — two-layer model, scope boundaries, wrapper mechanism (Locked)
- `03-component-inventory.md` — components mapped to theme scope and design status (Open)
- `04-character-sheet.md` — Major Character sheet (Locked)
- `05-epistolary-ui.md` — Letter composer + letter card + `themedWrap` helper (Locked)
- `06-connection-sheet.md` — Connection sheet (Locked)
- `07-public-info-dashboard.md` — Public Info dashboard (Locked)
- `08-cycle-phase-hud.md` — Cycle Phase HUD strip (Locked)
- `09-my-characters-dock.md` — My Characters dock (Locked)
- `10-chat-cards.md` — six chat card variants + Speaking-As switcher + Inner Monologue editor flow (Locked)
- `11-upkeep-wizard.md` — six-step Upkeep wizard + GM Roster (Locked)
- `12-item-sheets.md` — all five item sheets + inner-conflict box grid (Locked)
- `13-persona-switcher.md` — picker + popover + editor (Locked)
- `14-family-sheet.md` — Family sheet + crest medallion (Locked)
- `15-welcome-panel.md` — first-load modal (Locked)
- `16-npc-sheet.md` — NPC sheet + promote-to-Connection (Locked)
- `17-token-hover-card.md` — canvas hover card for all actor types (Locked)
- `18-condition-picker.md` — reputation threshold modal (Locked)
- `19-gm-tools.md` — Reveal Control + NPC Quick-Create + NPC Organizer (Locked)
- `20-rule-tooltips.md` — tooltip primitive + ~50-key content catalog (Locked)
- `21-edit-conflict-warning.md` — three-layer conflict prevention for shared Connections (Locked)
- `22-bulk-permissions-panel.md` — GM grid for setting actor ownership across all users (Locked)
- `23-primitives-batch.md` — canonical reference for 13 primitives + GM pill (Locked)
- `24-session-log.md` — auto-generated end-of-session journal entry (Locked)
- `25-backup-export.md` — GM-only utility for full world JSON export/import (Locked)
- `26-pending-changes-log.md` — inline "Since last Upkeep" section on Major sheet (Locked)
- `27-token-frame.md` — canvas-side ring distinguishing Major / Connection / NPC (Locked)

When implementing visual surfaces, link the relevant design doc in your Claude Code prompt rather than describing the design inline. This keeps the implementation grounded in the locked decisions and prevents drift.
```

### 2.2 Add new Phase 11 — Robustness + retrospective

**Find** Phase 9 (Polish) in §13 and **insert** before it:

```markdown
**Phase 11 — Robustness + retrospective (4–5 days)**
A grouped session covering the features that catch problems and create archives:
- Edit Conflict Warning (per `docs/design/21-edit-conflict-warning.md`) — three-layer system: awareness banner, field-level presence indicator, save-time conflict warning toast with diff resolution.
- Bulk Permissions Panel (per `docs/design/22-bulk-permissions-panel.md`) — GM grid for setting actor ownership across all users in one screen. Lifted from the original §12.5 stub to a full spec.
- Session Log auto-generator (per `docs/design/24-session-log.md`) — event tracking via world flag, markdown generation, preview modal, dated journal entries.
- Backup & Export utility (per `docs/design/25-backup-export.md`) — single .json file export with version-checked import.
- Pending Changes Log section (per `docs/design/26-pending-changes-log.md`) — inline "Since last Upkeep" section on the Major sheet's Public tab. Conditional render based on `pendingChanges.length`.
- Token Frame canvas rendering (per `docs/design/27-token-frame.md`) — three variants (Major 3px solid + glow, Connection 2px solid, NPC 1px dashed). Uses Foundry's TokenRing API with custom PIXI overlay fallback.
```

(Renumber the existing Phase 9 to Phase 12 if needed, or accept the gap.)

### 2.3 Update §6.1 Major sheet Public tab section ordering

**Find** the "Public" sub-section in §6.1 and **replace** the bullet list with:

```markdown
1. **Public** (front of sheet, image 1)
   - Portrait side panel + main column header (name, theme, persona switcher)
   - Reputation Criteria (read-only from Family)
   - Reputation Tags grid (positive / negative)
   - Active Reputation Conditions
   - Pending Changes Log (conditional — only when `pendingChanges.length > 0`, per `docs/design/26-pending-changes-log.md`)
   - Inner Conflict pair, with the 5+5 boxes as clickable checkboxes
   - Completed Inner Conflicts list
```

### 2.4 Update §15 locked-in decisions

**Append** to the numbered list in §15:

```markdown
15. **Token frames are canvas-side identity markers.** Per `docs/design/27-token-frame.md`, three variants distinguish Major / Connection / NPC tokens. Implemented via Foundry's TokenRing API. Persona-aware: ring color shifts with persona swaps if `chatColor` override is set. Phase 6 work.
16. **Pending changes log is a conditional inline section** on the Major sheet's Public tab. Per `docs/design/26-pending-changes-log.md`, renders only when `actor.system.reputation.pendingChanges.length > 0`. Sits between Active Conditions and Inner Conflict. Cleared on Upkeep acknowledge.
17. **The session log is event-driven, not snapshot-based.** Per `docs/design/24-session-log.md`, events are appended to `flags["good-society-homebrew"].sessionEvents` (world-level flag) as they fire. Markdown is generated from the events array on "End Session" click. The flag clears on save.
18. **Backups are full-world JSON exports.** Per `docs/design/25-backup-export.md`, single .json file format with metadata envelope (format/version/exportedAt/exportedBy/world/data). Merge-or-replace import. GM-only.
19. **Edit conflict prevention is three layers, escalating in intrusiveness.** Per `docs/design/21-edit-conflict-warning.md`, awareness banner (passive), field-level presence (subtle), save-time conflict warning toast (action-required). The system's robustness for shared Connections.
20. **Bulk Permissions Panel lifted from stub to full spec.** Per `docs/design/22-bulk-permissions-panel.md`, GM grid for setting actor ownership in one screen. Inventory entry #19 was a placeholder; this is its detailed spec.
```

---

## Patch 3 — Inventory updates

The repo's `docs/design/03-component-inventory.md` was last updated to mark 30 designed entries plus #20a Condition Picker, #60 GM pill, #61 Polarity arrow as new entries. The following updates reflect the v4 wave:

**No file edit needed in patch v4 itself** — Natalie's source folder has its own version of `03-component-inventory.md`. The repo's version is more comprehensive and already includes most of these.

But the inventory should track:
- Inventory entry #19 (Bulk Permissions Panel) — flip from "Not started" to "Designed" → references `docs/design/22-bulk-permissions-panel.md`.
- Inventory entry #51 (Token frame) — flip from "Not started" to "Designed" → references `docs/design/27-token-frame.md`.
- New inventory entry: Pending Changes Log section (component on Major sheet's Public tab, no inventory # yet) → references `docs/design/26-pending-changes-log.md`.
- New inventory entry: Edit Conflict system (component spans multiple sub-components: banner, presence indicator, toast, diff modal) → references `docs/design/21-edit-conflict-warning.md`.
- New inventory entry: Session Log preview modal → references `docs/design/24-session-log.md`.
- New inventory entry: Backup & Export utility → references `docs/design/25-backup-export.md`.
- Inventory entry #24 (Edit-Conflict Warning) — already exists; flip to "Designed" → references `docs/design/21-edit-conflict-warning.md`.

Apply these inventory updates as part of Claude Code's run on patch v4. Use the existing inventory's format and changelog style.

---

## Patch 4 — Out-of-band notes

Notes for Natalie:

1. **Resume B-1 with no rework.** All v4 docs are downstream of where Claude Code is currently paused. Apply the patch, then resume. The Public tab section-ordering update affects only currently-stub work.

2. **A.6 still works as flagged.** Family schema revision unchanged. After A.6 lands, B-1 continues.

3. **Don't create `styles/primitives/` folder.** The 23-primitives-batch.md doc proposes that organization, but the repo already has primitives in `styles/components/`. Folder rebrand mid-build creates churn without functional benefit. Note in CLAUDE.md and move on.

4. **Token frame work is Phase 6 (canvas + scenes).** Don't try to wire it during B-1.

5. **Schema additions flagged for future review.** None are urgent. After B-1 + B-2 + B-3 + B-4 land, review the schema additions list in `00-system-overview.md` §"Schema additions to track" and decide which to integrate. None of them affect current built code.

6. **`00-system-overview.md` is the new canonical entry point** for the design folder. When briefing Claude Code on a new component, reference `00-system-overview.md` first — it has the architectural pillars, then the specific component doc.

7. **Phase numbering reconciliation.** `00-system-overview.md` proposes Phases A-J (alphabetical). PLAN.md uses Phases 0-11 (numeric). They cover the same scope. Keep both — the alphabetical phases are design-implementation-flow; the numeric phases are system-build-flow. They're parallel views of the same work.

---

## How to apply this patch

1. The file is at the repo root (`design-integration-patch-v4.md`).
2. The eight new design docs are already in `docs/design/`.
3. Open Claude Code in the repo. Run the prompt at the top of this file.
4. Review the diffs Claude Code presents for `PLAN.md` and `CLAUDE.md`. Commit if they match.
5. Once committed, finish A.6 (Family schema), then **resume B-1 from where it paused** — no rework needed.
