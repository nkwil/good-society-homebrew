# Debug prompt — for the parallel cowork debugging task

> Paste the block below into a fresh cowork conversation. Run it alongside the build conversation — this side is for QA / diagnosis / writing up bugs Opal needs to fix; the build side actually writes the code.

---

```
You're helping me debug the post-MVP patch for the Good Society Foundry VTT system. Foundation work shipped; several major surfaces are still deferred. I'm doing visual QA and will report symptoms; your job is to read the relevant repo files, compare against the design specs, and tell me whether what I'm seeing is a bug or a known deferral.

# Where things live

- **Repo:** `/Users/nataliewilson/Code/foundry-systems/good-society-homebrew/`
- **Patch design docs:** `<repo>/docs/design/` (alongside `CLAUDE.md` and the v1 design docs 00–31). Look for `post-mvp-design-patch.md` (master spec) and `patch-*.md` (sub-docs).

# Read first, before answering anything

1. **`<repo>/CLAUDE.md`** — entire file. Project conventions, locked decisions, anti-patterns.
2. **`<repo>/docs/design/post-mvp-design-patch.md`** — master spec. The running log at the bottom (§15-§16) tells you what shipped vs. what's deferred.

# What's shipped (what I can test)

- Theme registry overhaul (Mags→Secret renamed; Pearlinda 7th theme added; Mags-tagged actors auto-migrate).
- §8 primitives — eyebrow, empty-state, persona-switcher CSS.
- `module/constants.js` — `SEAL_TYPES`, `COWORK_SURFACES`, `CHROME_ICONS` registries.
- `module/helpers/profile-pic.js` — token-based profile-pic resolver.
- World-identity surfaces — Arrival, pause overlay reskin.
- Cabinet (Player Module Menu) — right-edge rail.
- Chrome-icons hook + body class.
- Journal organization — letters / monologues / session logs in proper folders; cycle-divider entries auto-generate on transition into upkeep.
- Resolve / monologue spend chat-card pipelines.
- Letter seal-type registry hook + invitation/burn behaviors.
- All post-MVP settings registered.

# What's deferred (don't expect to see these — they're a known gap)

- §4 dossier refactor — Major sheet still uses v1 tabbed layout.
- §11 Epistolary Wizard — letter composer works, but the inbox/compose/outbox tabbed wizard and GM Roster surface don't exist.
- §12.2 monologue scene-freeze overlay — chat card posts, but the full-viewport scene freeze doesn't fire.
- §13.3 Novel Reader app — cycle dividers auto-generate but the reader window doesn't exist.
- §10.2 hover-card v2 render path — schema landed (`sceneInfo.subtitle`, `sceneInfo.hoverSummary` HTMLField) but the per-actor-type render dispatch doesn't.

If I report a symptom involving any of these, the answer is "deferred — Opal's working on it next batch."

# Critical files to read for common symptoms

| If I report... | Read these |
|---|---|
| Character sheet looks unchanged | `module/sheets/major-character-sheet.js`, `templates/actors/major-character/*.hbs`, `styles/sheets/_major-character.css`. Confirm whether dossier shell exists yet. |
| Theme colors wrong | `styles/themes/_theme-{id}.css`, `module/data-models/major-character.js` (theme enum), `styles/_variables.css` (root values). Compare to `post-mvp-design-patch.md` §6.5 table. |
| Arrival overlay stuck | `module/apps/arrival.js`, `module/hooks/arrival-sync.js`, `styles/apps/_arrival.css`. Check `pointer-events: none` on root, hooks bound to `canvasReady` / `canvasInit` / `updateScene` / `deleteScene`. |
| Pause overlay still shows Foundry default | `module/hooks/pause-overlay.js`, `templates/apps/pause-overlay.hbs`, `styles/apps/_pause-overlay.css`. Check `renderPause` hook fires. |
| Cabinet not rendering | `module/apps/cabinet.js`, `templates/apps/cabinet.hbs`, `styles/apps/_cabinet.css`. Check `position: fixed`, `z-index`, `pointer-events: auto` per CLAUDE.md §16 frameless-app anti-pattern. |
| Chrome icons not appearing | `module/hooks/chrome-icons.js`, `module/constants.js#CHROME_ICONS`. Confirm `applyChromeIcons` setting is on, asset files exist at `assets/chrome-icons/`. |
| Persona switcher broken | `module/apps/persona-switcher-popover.js`, `templates/partials/persona-switcher.hbs` (if exists), `styles/components/_persona-switcher.css`. |
| Letter / monologue / session log in wrong folder | `module/helpers/journal-folders.js`, `module/apps/letter-composer.js`, `module/apps/monologue-editor.js`, `module/apps/session-log-preview.js`. |
| Cycle divider didn't auto-create | `module/helpers/cycle-divider.js`, `module/helpers/cycle-advance.js`. Check it's gated on `autoCreateCycleDividers` setting and runs GM-only. |
| Spend resolve / monologue card not posting | `module/helpers/spend-resolve.js`, `module/helpers/spend-monologue.js`, `module/helpers/chat-cards.js`. |
| Settings not appearing in System Settings | `module/settings.js` registration block. Check `config: true`. Compare against `post-mvp-design-patch.md` settings sections. |
| Localization key showing literally | `lang/en.json` — first run `python3 -m json.tool lang/en.json > /dev/null` to verify validity. Per CLAUDE.md anti-pattern, JSON parse errors break ALL localization globally. Then check key nesting matches `GOODSOCIETY.<section>.<field>`. |

# Common debug entry points (paste into Foundry F12 console)

```js
// Force-close the Arrival overlay (testing escape):
document.getElementById('gs-arrival')?.remove();
document.body.classList.remove('gs-world-identity');

// Toggle world-identity surfaces off without disabling the setting:
document.body.classList.toggle('gs-world-identity');

// Inspect a Major's resolved theme + persona:
canvas.tokens.controlled[0]?.actor?.system

// Trigger a Mags→Secret migration manually (one-shot):
game.actors.filter(a => a.system?.theme === 'mags').forEach(a => a.update({'system.theme':'secret'}));

// Inspect what world settings are registered:
[...game.settings.settings.keys()].filter(k => k.startsWith('good-society-homebrew'))

// Verify localization keys are loading:
game.i18n.localize('GOODSOCIETY.novel.windowTitle')
// Should return "The Novel" — if it returns the literal key, lang/en.json has a parse error.

// Check what scene controls are registered:
ui.controls?.controls.map(c => c.name)
```

# How to report a symptom

Paste a screenshot if visual. Otherwise tell me:
1. What I did (clicked X, opened Y, etc.).
2. What I expected to see (per the patch design).
3. What actually happened.
4. Any console errors (F12 → Console tab).

I'll read the relevant files, compare against the spec, and tell you whether it's a bug, a known deferral, or working-as-designed-but-confusing. If it's a bug I'll write up a tight repro for Opal to fix in the build conversation.

# What I won't do

- Write code. The build conversation does that.
- Modify files in the repo. Diagnosis only — read access.
- Make architectural decisions. If a symptom reveals a design gap, I'll flag it for you to decide.
```

---

# Notes for Natalie (don't paste these to the new agent)

- The "Critical files to read" table is the heart of this prompt — it lets the debugger jump directly to the right code on each symptom rather than starting from scratch.
- The console one-liners are tested against the patch spec, not the actual implementation. If the implementation differs, they may need tweaking — that's information you can capture and feed back to Opal.
- The "won't do" section keeps the debugging conversation focused on diagnosis. Anything that requires writing code routes back to the build conversation.
- If Opal ships item #1 (Arrival dismiss UX), update this prompt's "What's shipped" list before reusing it.
