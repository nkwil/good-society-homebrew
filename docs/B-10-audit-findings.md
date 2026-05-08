# B-10 Audit Findings

**Date:** 2026-05-08
**Source:** Repo-wide audit (Cowork session)
**Purpose:** Punch list for Session B-10 (Release prep). Each item is rated by impact + effort. Roll into B-10 commits at Claude Code's discretion.

## High impact (user-visible / breakage)

### 1. Stub action: `stub-rumour` on dashboard
- **Where:** `module/apps/public-info-dashboard.js:202` (`#stubRumour`); `templates/apps/dashboard.hbs:39`; lang key `GOODSOCIETY.dashboard.bulk.rumourStub`.
- **Problem:** GM clicks "rumour ↗" → toast "The Rumour & Scandal generator is not yet implemented." Rumour & Scandal phase (rulebook p.126-128, cycle position 3) has no implementation.
- **Options:**
  - **(a) Remove the button + lang key** for v1 release. Players + GM use chat / shared docs to track rumours manually. Simplest.
  - **(b) Ship a minimal Rumour & Scandal Wizard** as Session B-12 (separate scope). Larger lift.
  - **(c) Replace the button with a link to the in-fiction Event Timeline** so the GM can record rumours as gm-only events.
- **Recommendation:** (a) for v0 release; document in CLAUDE.md §14 "Cut from scope" with a note that the Rumour Wizard is a v1.1 candidate.

### 2. Missing lang key: `GOODSOCIETY.gmPill`
- **Where:** `templates/apps/bulk-permissions-panel.hbs:9` references it; not defined in `lang/en.json`.
- **Effect:** the GM pill on the Bulk Permissions Panel renders the literal string `GOODSOCIETY.gmPill` instead of "GM".
- **Fix:** add `"gmPill": "GM"` at `GOODSOCIETY` top level of `lang/en.json`. One-line change.

### 3. Direct `ChatMessage.create` bypasses `postSystemCard`
- **Where:**
  - `module/apps/reveal-control.js:164`
  - `module/apps/public-info-dashboard.js:219` (`_postSystemCard`)
- **Problem:** Both create a `ChatMessage` directly without setting the `gs-cardType` flag. The speaking-as `preCreateChatMessage` hook checks for that flag (line 233 of `module/hooks/speaking-as.js`); without it, if any user has an active speaker selected, these system messages get rewritten to that speaker's name.
- **Fix:** route both through `postSystemCard()` from `module/helpers/chat-cards.js` (which sets the flag). The signature already supports the use case.
- **Anti-pattern logged:** §16 "Don't manually concatenate chat-card HTML."

## Medium impact

### 4. `actor.name` in chat-card content
- **Where:** Six chat-card emissions use `actor.name` directly instead of `activePersona?.name || actor.name`:
  - `module/apps/condition-picker.js:127` — "{name} gained the condition X"
  - `module/apps/reputation-phase-wizard.js:448` — "{name}'s X condition cleared"
  - `module/apps/reveal-control.js:165` — visibility-change announcements
  - `module/apps/upkeep-wizard.js:290` — desire archive card
  - `module/apps/upkeep-wizard.js:335` — upkeep completion card
  - `module/apps/player-reputation-phase-wizard.js:338, 360` — condition cleared / phase completed
- **Problem:** When an actor has an active persona, the canonical name leaks to chat. Per §16: "Don't use `actor.name` directly in display surfaces (sheets, dashboards, dock rows, hover cards, **chat-card aliases**, journal entries) when the actor has personas."
- **Fix:** wrap each in `actor.system?.activePersona?.name || actor.name`. Optionally extract a `displayNameOf(actor)` helper into `module/helpers/themed-wrap.js` (already exists) or a new `module/helpers/display-name.js`.

### 5. Bare `loadTemplates(...)` global
- **Where:** `module/good-society.js:279`.
- **Problem:** Per §16, the bare global is deprecated in v13 and removed in v15. Should be `foundry.applications.handlebars.loadTemplates(...)`.
- **Fix:** one-line rename.

### 6. `advanceCyclePhase` and `UpkeepRoster#advanceCycle` lack explicit GM-only guards
- **Where:**
  - `module/helpers/cycle-advance.js#advanceCyclePhase` (no guard; comment notes it relies on settings.set rejection)
  - `module/apps/upkeep-roster.js:157-158` (writes `cycleNumber` + `cyclePhase`)
- **Problem:** Both work in practice because the calling buttons are only rendered for GMs, but a non-GM caller hits a confusing settings-rejection error rather than a clean no-op.
- **Fix:** add `if (!game.user?.isGM) return;` at function entry. Defense-in-depth, ~3 lines total.

### 7. Connection/NPC sheet portrait initials don't account for personas
- **Where:**
  - `module/sheets/connection-sheet.js:45` — `(this.actor.name?.[0] ?? '?').toUpperCase()`
  - `module/sheets/npc-sheet.js:38` — same
- **Problem:** When a persona is active, the initial in the portrait still comes from the actor's canonical name. Inconsistent with how MajorCharacterSheet resolves displayName. Cosmetic.
- **Fix:** mirror MajorCharacterSheet's pattern: `((this.actor.system?.activePersona?.name) || this.actor.name)?.[0]?.toUpperCase()`.

## Low impact (technical debt)

### 8. `module/boilerplate.mjs` is leftover scaffolding
- **What it does:** Registers `BoilerplateActor` / `BoilerplateActorSheet` as defaults; sets a useless `CONFIG.Combat.initiative` formula; defines a `BOILERPLATE` constant; adds `hotbarDrop` macro creation.
- **Why it works anyway:** GS sheets re-register per-type in `good-society.js`, overriding the boilerplate defaults. The BoilerplateActor document class is what every GS actor instantiates as (the validation error showed "BoilerplateActor [id]") — that's fine because it's just a thin wrapper extending Foundry's Actor.
- **Cleanup options:**
  - **(a) Strip it to a minimum** — remove Combat.initiative, the BOILERPLATE constant, hotbar macros. Keep the document class registration.
  - **(b) Remove entirely + register BoilerplateActor → GoodSocietyActor rename** — risky; touches every actor's class wrapper.
  - **(c) Leave it** — code works; cleanup deferred.
- **Recommendation:** (a). Low effort, removes obviously-irrelevant code paths.

### 9. `system.json` placeholders
- **Replace:**
  - `url` → GitHub repo URL
  - `bugs` → GitHub issues URL
  - `manifest` → `https://github.com/.../releases/latest/download/system.json`
  - `download` → `https://github.com/.../releases/latest/download/system.zip`
- **Effort:** trivial once URLs are decided.

### 10. `system.json` references boilerplate asset paths
- **Where:**
  - `media[].url` and `media[].thumbnail` → `systems/boilerplate/assets/anvil-impact.png`
  - `background` → same
- **Problem:** When users install Good Society, the boilerplate paths don't exist; setup screen shows broken images.
- **Fix:** ship a real splash image at `assets/splash.png` (or similar) and update the three references.

### 11. `system.json` `primaryTokenAttribute` / `secondaryTokenAttribute`
- **Current:** `"health"` and `"power"` — these don't exist on any GS data model.
- **Problem:** Foundry uses these to populate the Token HUD's resource bars. Currently broken — the bars try to read non-existent fields and either render zero or hide.
- **Fix options:**
  - Set `primaryTokenAttribute: "tokens.resolve"` (Major Character has `system.tokens.resolve.current` + `.max`). Confirmed Foundry expects `"<group>.<attr>"` for compound bar attributes.
  - Or set both to `null` to disable the token bars (Good Society doesn't conceptually use HP-style bars).

### 12. `CHANGELOG.md` is the boilerplate's
- **What's there:** v1.2.0 entries from the boilerplate fork.
- **Fix:** rewrite as `0.1.0` initial Good Society release notes covering Sessions B-0 through B-11.1.

### 13. Theme field is `required: true` on Major/Connection/NPC; no `migrateData`
- **Same shape of bug as Family heirStatus** — pre-A.5 actors lack a `theme` field and would (in theory) fail validation.
- **In practice:** Foundry's `StringField.required` defaults to `initial` when the value is missing, so this is likely a non-issue.
- **Defensive fix:** add a `static migrateData(source)` to each of the three models that coerces missing/invalid theme into `initial`. ~10 lines per model. Worth doing if any pre-A.5 actor data exists in the wild; skip otherwise.

### 14. Console-log noise in `module/hooks/speaking-as.js`
- **Count:** 13 `console.log` calls, all prefixed `[good-society Speaking-As]`.
- **Helpful during development**, noisy in production worlds where players see them in DevTools.
- **Fix options:**
  - **(a) Gate on a `debugMode` client setting** — `if (game.settings.get(NS, 'debugMode')) console.log(...)`. Adds a setting.
  - **(b) Remove** the eight or so that aren't essential — keep only the `injected` and `rewrote speaker` ones for diagnostic value.
  - **(c) Leave** — they're prefixed and easy to filter; not breaking anything.
- **Recommendation:** (b) for B-10 release; the diagnostic value is mostly historical.

### 15. Settings UI pass
- **Per the original B-10 scope:** every `config: true` setting needs descriptive `name` and `hint` localization keys.
- **Current `config: true` settings:**
  - `tooltipsEnabled` ✓
  - `upkeepWizardEnabled` ✓
  - `reputationPhaseWizardEnabled` ✓
  - `applyFoundryChrome` ✓
  - `isFinalCycle` ✓
  - `autoRefreshOnUpkeep` ✓
  - `promptOnThreeTags` ✓
  - `defaultMaxResolve` ✓
  - `defaultStartingResolve` ✓
  - `homebrewMagicEnabled` ✓
  - `organizerPlayerVisible` ✓
- **Audit:** all have `name`/`hint` keys defined. Spot-check the wording in System Settings → Good Society for clarity in B-10.

## Observations (not bugs)

- ✅ All event handler patterns are correct: rep wizards' `_attachActorWatchers`/`_detachActorWatchers` properly detach in `_onClose`. No hook leaks.
- ✅ No bare `Application` (v1) usage — all apps are ApplicationV2.
- ✅ No bare `renderTemplate(...)` calls — all use `foundry.applications.handlebars.renderTemplate(...)`.
- ✅ All PART templates have a single root element (no whitespace at root).
- ✅ No direct `actor.system.x = y` mutations — all writes go through `actor.update(...)`.
- ✅ `pointer-events: auto` set on every sidebar/chrome-injected surface.
- ✅ Family `heirStatus` migrateData covers the pre-A.6 Boolean → enum migration.
- ✅ Stage-based event timeline migration (B-11.1) is idempotent and graceful.

## README rewrite checklist (per original B-10 scope)

When writing the README:

- [ ] Install steps (manifest URL, manual install, dev install via npm)
- [ ] Module dependencies — required vs. recommended (Sequencer + JB2A optional with graceful degrade)
- [ ] Foundry compatibility (v13 only)
- [ ] System overview — what's homebrewed vs. canonical Good Society (Personas, Magic/Skills, modified inner-conflict completion rule)
- [ ] Screenshots: dashboard, dock, character sheet, cycle HUD, event timeline, reputation phase wizard
- [ ] Link to design docs in `docs/design/`
- [ ] License (MIT)
- [ ] Credits to Storybrewers Roleplaying

## Suggested commit ordering for B-10

Atomic commits are easy here since most fixes are independent:

1. `B-10/1: Lang fix — add gmPill key` (item 2)
2. `B-10/2: Chat cards — route reveal-control + dashboard system cards through postSystemCard` (item 3)
3. `B-10/3: Display names — use active persona in chat-card content + Connection/NPC portrait initials` (items 4, 7)
4. `B-10/4: GM guards on cycle-advance + upkeep-roster advance` (item 6)
5. `B-10/5: Drop bare loadTemplates global` (item 5)
6. `B-10/6: Remove stub-rumour button` (item 1, option a)
7. `B-10/7: boilerplate.mjs cleanup — strip irrelevant Combat / hotbar / BOILERPLATE` (item 8)
8. `B-10/8: speaking-as.js — drop dev console.log noise` (item 14)
9. `B-10/9: Major/Connection/NPC theme migrateData (defensive)` (item 13, optional)
10. `B-10/10: system.json — fix asset paths + tokenAttributes; placeholder URLs marked TBD` (items 9, 10, 11)
11. `B-10/11: README + CHANGELOG rewrite` (items 12 + README checklist)
12. `B-10/12: Settings UI pass — verify hints render cleanly` (item 15)
13. `B-10/13: Tag 0.1.0 release` — final.
