# Good Society (Homebrew) — Foundry VTT System Plan

A planning document for building a custom Foundry VTT v13 system that replicates and partially automates the Good Society character sheet, the Public Info / Facilitator dashboard, and a scene-based ballroom view with hoverable NPC tokens.

---

## 1. Decisions locked in

- **Foundry version:** v13 (current). Use the modern APIs — `ApplicationV2`, `HandlebarsApplicationMixin`, `foundry.abstract.TypeDataModel` — and skip anything tagged "legacy."
- **Type:** Standalone System (not a module). The system owns the Actor and Item types, the dice config (none), and the sheets.
- **Automation tier:** "Sheets + token economy." Visuals replicate the paper sheet; resolve tokens / MT / monologue / cycle phase are real, clickable, and update across the world. Reputation tags hint at conditions but don't enforce them.
- **Scope:**
  - Major Character sheet (the Dixon-style sheet)
  - Connection sheet (resolve tokens, "I think [Major] is..." impressions), shared pool by default
  - Family actor (shared across multiple Majors)
  - NPC actor (GM-only ambient cast)
  - Personas — multiple identities per character with first-class support for swapping (see §11)
  - Public Info / Facilitator dashboard (cycle phase, all-character at-a-glance)
  - Scene-based settings (e.g., ballroom) with NPC tokens that show info on hover
  - On-screen VFX for Magic/Skills casting

---

## 2. Mapping Good Society onto Foundry primitives

| Good Society concept | Foundry primitive |
|---|---|
| Major Character | `Actor` of type `major-character` |
| Connection (PC-linked NPC, shared pool) | `Actor` of type `connection` |
| Background NPC (GM-only ambient cast) | `Actor` of type `npc` |
| Family (shared by multiple Majors) | `Actor` of type `family` |
| Reputation Tag | `Item` of type `reputation-tag` (lives on the actor) |
| Reputation Condition | `Item` of type `reputation-condition` |
| Inner Conflict pair | `Item` of type `inner-conflict` |
| Magic/Skill (homebrew) | `Item` of type `magic-skill` |
| Connection's impression of a Major | embedded data on the Connection actor |
| Cycle of Play phase (Novel / Reputation / Rumour & Scandal / Epistolary / Upkeep) | World-level `game.settings` value |
| Ballroom / drawing room / garden setting | `Scene` with a background image |
| NPCs placed in a setting | `Token` documents linked to Connection actors |
| NPC info card on hover | custom hook on `hoverToken` rendering a small panel |
| Public Info Sheet (tracker for whole table) | custom `ApplicationV2` dashboard window |
| Resolve token | numeric field with click-to-toggle UI (not a Foundry combat resource) |
| Monologue per cycle | boolean flag on the Major actor, reset on Upkeep |

The big shift from a normal system: no dice, no combat tracker, no initiative. You can leave Foundry's combat tracker enabled but you won't wire anything to it.

---

## 3. Actor types and DataModels

Use `foundry.abstract.TypeDataModel` schemas. These are sketches — refine field names as you go. All schemas should use `SchemaField`, `StringField`, `NumberField`, `BooleanField`, `ArrayField`, `EmbeddedDataField` from `foundry.data.fields`.

### 3.1 Major Character

```
bio:
  age: number
  peerage: enum["heir", "new-arrival", "foreign"]
  appearance: string                 // 2–4 adjectives
  temperamentGiven: number           // # given
  temperamentTaken: number           // # taken
  portraitUrl: string                // optional override; Foundry default works too
personas: array<{                    // see §11 — multiple identities per character
  id: string
  name: string                       // e.g. "Princess Adora", "Korra the Hawk"
  isPrimary: boolean                 // the "true" identity
  portraitUrl: string                // sheet portrait while this persona is active
  tokenImageUrl: string              // canvas token image
  tokenName: string                  // nameplate shown to other players
  hoverSummary: string               // hover-card blurb when this persona is active
  publicTags: array<string>
  visibility:                        // can override Major's visibility per-persona
    desire: enum["secret", "public", "redacted"] | "inherit"
    backstory: enum["secret", "public", "redacted"] | "inherit"
    magic: enum["secret", "public", "redacted"] | "inherit"
}>
activePersonaId: string              // currently shown identity
desire: string
desirePublic: boolean                // is the desire shown on the Public Info dashboard?
notesObjectives: string              // updated during Upkeep
backstory: string
adventurerSentiment: string          // homebrew
tokens:
  resolve:
    current: number (default 3)
    max: number (default 5)
  major: boolean                     // MT toggle
  monologuedThisCycle: boolean
reputation:
  positiveTags: array<string>        // tag item ids; or use embedded items + count
  negativeTags: array<string>
  activeConditions: array<string>    // condition item ids
  customCriteria: string             // unique negative reputation text from family bg
innerConflictsActiveIds: array<string>      // ids of inner-conflict items currently active
innerConflictsCompletedIds: array<string>
connections: array<string>           // linked Connection actor ids
familyId: string                     // ref to a Family actor (shared by multiple Majors)
visibility:                          // per-field visibility flags (locked-in choice)
  desire: enum["secret", "public", "redacted"]
  backstory: enum["secret", "public", "redacted"]
  magic: enum["secret", "public", "redacted"]
  adventurerSentiment: enum["secret", "public", "redacted"]
  notesObjectives: enum["secret", "public", "redacted"]
  innerConflicts: enum["secret", "public", "redacted"]
```

### 3.2 Connection

```
bio:
  pronouns: string
  relationshipLabel: string          // e.g. "Cousin", "Forced friend"
  description: string
  portraitUrl: string
linkedMajorId: string                // primary Major this Connection belongs to
impressions: array<{
  majorId: string
  text: string                       // "I think [Major] is..."
}>
resolve:
  current: number (default 1)
  max: number (default 5)
sceneInfo:
  hoverSummary: string               // 1–2 line blurb shown on hover in scenes
  publicTags: array<string>          // e.g. "Newcomer", "Eligible", "Scandal-prone"
ownership:                           // default: shared pool (everyone can read; GM can write)
  defaultLevel: "OBSERVER"           // permission constants from CONST.DOCUMENT_OWNERSHIP_LEVELS
```

Connection actors are a **shared pool** by default: any player can see them; the GM authors them; individual players can be promoted to `OWNER` of specific Connections that "belong" to their Major. This is the standard Foundry permission model — no extra plumbing needed.

### 3.3 Family (shared by multiple Majors)

```
familyName: string
origin: enum["heir", "new-arrival", "foreign"]
heirStatus: boolean
uniqueNegativeRepCriteria: string    // pulled into Major sheet as read-only Reputation Criteria
crest:
  imageUrl: string                   // optional family crest
  motto: string
notes: string                        // GM-only history
memberMajorIds: array<string>        // back-reference; populated when a Major sets familyId
visibility:
  uniqueNegativeRepCriteria: enum["secret", "public", "redacted"]
  notes: enum["secret", "public", "redacted"]
```

Why this is cleaner than a per-Major Family Background item: the Reputation Criteria, family motto, and shared notes live in **one** place. When you edit a family detail, every Major in that family sees it instantly. The Major sheet just renders a read-only panel sourced from `actor.system.familyId → familyActor.system`.

### 3.4 NPC (GM-only ambient cast)

For NPCs who aren't formal Connections to any Major — innkeepers, stable hands, the unnamed crowd at a ball. Foundry supports this naturally, but giving it a distinct Actor type means cleaner sheet UI (you don't need impressions or resolve tokens) and easy filtering in the directory.

```
bio:
  pronouns: string
  role: string                       // "Innkeeper", "Footman", "Anonymous gentleman"
  description: string
  portraitUrl: string
sceneInfo:
  hoverSummary: string
  publicTags: array<string>
ownership:
  defaultLevel: "NONE"               // GM-only by default
```

Mechanically minimal — same scene/hover plumbing as Connection, no resolve tokens, no impressions, locked to GM permissions by default. If an NPC becomes important enough to matter to a Major, you can convert it to a Connection later.

---

## 4. Item types

Items are sub-documents on actors. Easiest mental model: every "list of things" on the sheet is a list of items.

| Item type | Schema sketch |
|---|---|
| `reputation-tag` | `{ name, polarity: "positive"\|"negative", description, source }` |
| `reputation-condition` | `{ name, polarity, description, active: bool, sourceTagIds: string[] }` |
| `inner-conflict` | `{ leftLabel, rightLabel, leftBoxes: bool[5], rightBoxes: bool[5], completed: bool, completedSide: "left"\|"right"\|null }` |
| `magic-skill` | `{ name, description, referenceUrl, vfxKey: string, soundUrl: string, hidden: bool }` — `vfxKey` selects a canvas casting animation (see §10) |
| `backstory-action` | `{ name, description, expanded: bool, used: bool }` (earned via inner conflict completion) |

Reputation Tags and Conditions are likely worth seeding into a **compendium pack** (`packs/conditions.db`) so users can drag-drop the canonical ones from the rulebook (Unexpected Connection, Quite Indebted, Great Offence, Fracture, etc.) and you can hand-author homebrew ones alongside.

---

## 5. World-level settings

Registered in `Hooks.once("init", ...)` via `game.settings.register`.

- `cyclePhase` — enum: `pre-cycle | novel | reputation | rumour-scandal | epistolary | upkeep`. Stored at world scope. Drives the Public Info dashboard.
- `cycleNumber` — integer. Increments when phase wraps Upkeep → Novel.
- `autoRefreshOnUpkeep` — boolean. If true, advancing into Upkeep refreshes all Majors' resolve tokens to 3 and clears `monologuedThisCycle`.
- `promptOnThreeTags` — boolean. If true, the Major sheet shows a "Choose a Reputation Condition" callout when a third positive/negative tag is added.
- `defaultMaxResolve` — integer (default 5).
- `defaultStartingResolve` — integer (default 3).
- `homebrewMagicEnabled` — boolean. Lets you toggle the Magic/Skills section visibility per campaign.

---

## 6. Sheet UI strategy

All sheets use `ApplicationV2 + HandlebarsApplicationMixin` (v13's mandatory approach).

### 6.1 Major Character sheet — two tabs + persistent strip

1. **Public** (front of sheet, image 1)
   - Portrait side panel + main column header (name, theme, persona switcher)
   - Reputation Criteria (read-only from Family)
   - Reputation Tags grid (positive / negative)
   - Active Reputation Conditions
   - Pending Changes Log (conditional — only when `pendingChanges.length > 0`, per `docs/design/26-pending-changes-log.md`)
   - Inner Conflict pair, with the 5+5 boxes as clickable checkboxes
   - Completed Inner Conflicts list

2. **Private** (back of sheet, image 2)
   - Bio header (age, peerage, appearance, temperament given/taken)
   - Desire, Notes & Objectives, Backstory, Adventurer Sentiment (all with per-field visibility flags)
   - Connections list
   - Magic/Skills

3. **Tokens & Cycle persistent strip** (always visible, below the tab body)
   - Resolve tokens (clickable 5-pip row)
   - MT toggle
   - Monologue dot
   - Current cycle phase indicator (read-only)
   - "Take Monologue" button

Full per-section spec lives in `docs/design/04-character-sheet.md`. Sheet dimensions: 720px wide, height auto.

### 6.2 Connection sheet — single page

Portrait, name, pronouns, relationship label, impressions list (one per Major), resolve tokens row, hover summary, public tags.

### 6.3 Visual styling

Visual styling follows the locked design system. The house style (Inkwell & Wildflower) governs chrome, item sheets, the Family and NPC sheets, the Cycle HUD, the Public Info dashboard frame, and all GM tools. Major Character and Connection sheet bodies adopt the actor's character theme via a `.gs-actor[data-theme="..."]` selector on the sheet root, which rebinds CSS custom properties. The full palette and type tokens are in `docs/design/decisions.md`; the scope-boundary table is in `docs/design/02-theme-architecture.md`.

The eight implementation rules of the antique-but-clean principle (in `decisions.md`) constrain everything: hairlines not heavy borders; generous whitespace; period type at modern sizes; one ornament per surface; WCAG AA on all body text; no distressed textures; letterpress-style precision; sentence case for prose, small caps for labels.

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
- `28-foundry-chrome-theme.md` — opt-in CSS overrides re-theming Foundry's application chrome (Locked)

When implementing visual surfaces, link the relevant design doc in your Claude Code prompt rather than describing the design inline. This keeps the implementation grounded in the locked decisions and prevents drift.

---

## 7. Public Info / Facilitator dashboard

A **custom ApplicationV2 window** (not an actor sheet) that any player can open from a scene control button. It reads from all Major actors and renders:

- Current cycle phase, with **Advance Phase** button (GM-only)
- Cycle number
- One row per Major: portrait, name, MT, resolve tokens (read-only widget), monologue dot, public desire (if visibility = public)
- Bulk actions (GM-only):
  - "Refresh all resolve to 3"
  - "Clear all monologue flags"
  - "Reveal desires" (toggles all visibility.desire to public)
  - "Roll new Rumour & Scandal" — button that posts a Rumour card to chat (Phase 5+)

Implementation note: register a scene control button via `Hooks.on("getSceneControlButtons", ...)` so the dashboard is one click away.

---

## 8. Scene + NPC hover system

Foundry already does most of this work. The custom layer is light.

1. Build Scenes for your settings (ballroom, drawing room, garden) by uploading background art.
2. Place a Token on the scene for each Connection. Link the Token to the Connection Actor (Token Configuration → "Linked Actor").
3. Customize the **hover** behavior:
   - The default `hoverToken` hook fires when the cursor enters a token. Render a custom HTML panel positioned near the token showing: portrait, name, relationship label, and the `sceneInfo.hoverSummary` from the Connection's data model.
   - Click → opens the Connection sheet (Foundry default; double-click works out of the box for linked tokens).
4. Optional: a "Connections in this scene" sidebar that lists all Connection tokens currently placed.
5. For period flair, use `core.tokenRingSubject` rings or a custom token frame so NPCs visually read as Connections vs. PCs.

This is the area most likely to "just work" because Foundry's scene/token engine is mature. The custom code is maybe 100–200 lines for the hover card.

---

## 9. Token economy automation — what actually fires

| Event | Behavior |
|---|---|
| Click a resolve token box | Toggle that box on/off; update `tokens.resolve.current` |
| Right-click resolve box | Reset to default starting value (game setting) |
| Click MT button | Toggle `tokens.major` |
| Click "Take Monologue" | Set `monologuedThisCycle = true`, post a chat message announcing it |
| Drag a Reputation Tag onto sheet | Add it to positive/negative array; if 3rd of polarity and `promptOnThreeTags` enabled, show a non-blocking "pick a condition" callout |
| Click an inner conflict checkbox | Toggle; if 6 boxes filled on either side OR 5 on one side (per the sheet), mark `completed=true`, move id to `innerConflictsCompletedIds`, post chat: "[Major] earned an Expanded Backstory Action" |
| Advance cycle to Upkeep | If `autoRefreshOnUpkeep`, iterate all Majors: set resolve to default-start, clear monologue flag |

Note the inner-conflict completion rule on the sheet says "6 boxes or 5 on one side." That's slightly ambiguous (likely "5 on one side" is the trigger and "6" is a typo / means "across both sides totalling 6 with one side at majority"). **Confirm against rulebook p.98** before hard-coding the exact predicate.

---

## 10. Magic/Skills casting VFX

Your decision: clicking a Magic/Skill on the sheet should produce an **on-screen casting effect** on the actor's token — nothing else. No damage, no targeting, no roll. Just a brief visual.

There are two reasonable implementations. Pick one early because it dictates a system dependency.

### Option A — Sequencer + JB2A (recommended)

Sequencer is a free, widely-used Foundry module that plays scripted sequences of animations, sounds, and effects on the canvas. JB2A is a free animation library that ships with hundreds of pre-made spell effects (mage hand, alter self, etc.). The two together are basically the de-facto standard for VFX in Foundry.

Pros: dozens of pre-made effects already named for the spells you'll want; trivial API (`new Sequence().effect().atLocation(token).file("jb2a.mage_hand").play()`); large community of reference code.

Cons: introduces two module dependencies your players also need to install. Declare them in `system.json` under `relationships.requires`.

In this option, `magic-skill.vfxKey` is a Sequencer/JB2A asset path string. The "Cast" button on the magic-skill item just runs:

```js
new Sequence()
  .effect()
    .atLocation(token)
    .file(item.system.vfxKey)
    .scaleToObject(1.5)
  .sound()
    .file(item.system.soundUrl)
  .play();
```

### Option B — Roll your own with Foundry's CanvasAnimation / PIXI

Drop a sprite or particle effect at the token's position using Foundry's `CanvasAnimation` API (built on PIXI). No external dependencies; a few hundred lines of code per effect.

Pros: zero dependencies; full control; tighter integration with the system.

Cons: substantially more work; you'll be hand-crafting each effect (or buying/finding free PNG sprite sheets). Not advisable unless you really want to avoid module dependencies or want a stylized look.

### Recommendation

**Go with Option A.** Add Sequencer and JB2A as optional `relationships.requires` in `system.json` with `compatibility` ranges. Each `magic-skill` item stores a `vfxKey` (the JB2A path) and an optional `soundUrl`. The Magic/Skills section on the Major sheet renders each skill as a tile with a "Cast" button that fires the sequence. If the modules aren't installed, fall back gracefully to a chat message saying "[Major] casts Mage Hand" so the system still works.

**Important caveat — Dixon's secret.** Dixon Ticonderoga's backstory is that he's publicly anti-magic but secretly a magic user. Make sure the "Cast" button respects the per-field visibility flag for Magic — if `visibility.magic = "secret"`, casting should either be GM-only-visible or prompt a "Are you sure? This will reveal your magic publicly" confirm before firing the on-canvas effect (which other players would see). Worth a small UX flow.

---

## 11. Personas — multiple identities per character

A core feature: one character can have several **personas** (identities), each with its own portrait, token image, name, and hover info. The princess is "Princess Adora" in the castle and "Korra the Hawk" in the guild hall. The actor underneath is the same — same reputation, same resolve, same MT, same backstory — but the face other players (and the canvas) see depends on context.

This fits Dixon too: "publicly anti-magic Duke" and "secret magic user" are personas in everything but name.

### 11.1 Why this is its own feature, not a token swap

Foundry tokens are per-scene; you could just place different tokens of the same actor on different scenes and call it done. But that's brittle:
- Switching mid-scene (e.g., Alter Self mid-conversation) is painful
- The sheet portrait, hover card, and public-info dashboard all need to update too
- "Identity" is something the reputation system needs to know about (a tag earned as Korra shouldn't necessarily attach to Adora)

So personas are first-class: a list on the actor, with one currently active.

### 11.2 What switching a persona does

When the player clicks "Become [Persona]" on the sheet:

1. Set `activePersonaId` on the actor.
2. Update the actor's prototype token image and nameplate to the persona's values.
3. Find every Token of this actor on every Scene and update its image + nameplate to match (Foundry API: iterate `scene.tokens` filtering by `actorId`, then `token.update({ texture: { src: ... }, name: ... })`).
4. Update the Public Info dashboard row (it'll re-render automatically if listening to actor updates).
5. Optionally fire a small VFX on the active token (reuse the Sequencer pipeline from §10).
6. Post a chat message — GM-only or public depending on `visibility.magic` for this persona.

### 11.3 Per-scene default persona

This is where the "different identity in the castle vs. guild hall" UX lives. Two options:

**Option A — Scene flag.** Each Scene can store a flag `defaultPersonas: { [actorId]: personaId }`. When a token of this actor is dropped onto a scene, or when a player opens the scene with their token already on it, the system reads the flag and auto-switches the actor's active persona. Configured via a "Scene Personas" panel in the scene config dialog.

**Option B — Manual switch only.** Player chooses persona on the sheet. No auto-magic. Simpler, less surprising; can be added on top of A as a "lock current persona" toggle.

**Recommendation: build B first, add A in a follow-up.** Manual is simple and gets you 90% of the value; auto-switch is a nice quality-of-life upgrade once you've used the manual flow for a session or two.

### 11.4 Sheet UI for personas

A small persona switcher in the sheet's bio header (or its own tab if you have many):
- Shows current persona's portrait + name
- Dropdown or icon strip of other personas
- "+ New persona" button
- Per-persona quick-edit (image, name, hover summary, visibility overrides)

The Public Info dashboard always shows the **active** persona to non-GMs. The GM sees both real name and active persona.

### 11.5 Integration with Alter Self

The "Alter Self" magic-skill in Dixon's sheet is conceptually a persona-swap with VFX. Suggested setup:
- Each `magic-skill` item gets an optional `triggersPersonaSwap: { targetPersonaId }` field.
- Casting Alter Self runs the persona swap pipeline + the VFX sequence.
- This works for the assassin princess too: an "Assume Disguise" skill can flip her between Adora and Korra with a quick visual.

### 11.6 Connections and NPCs with personas

Same data model fits Connections and NPCs (an innkeeper who's secretly a spy). Implement on Major Character first; copy the schema to Connection and NPC in a later phase.

---

## 12. Quality of life features

These are features beyond the core mechanical replication of the sheet. Each one solves a specific friction point likely to come up in actual play. Grouped by what kind of moment they smooth over.

### 12.1 Multi-character ergonomics

**My Characters dock.** A pinned, compact `ApplicationV2` panel on the side of the screen showing only the actors *this user* owns — Majors, Connections they drive, NPCs if any. Each row: portrait (current persona), name, current persona name, resolve token count, MT indicator. Click to open that sheet. Updates live as state changes. Filters Foundry's actor sidebar from "everything" to "what's actually mine."

**Speaking-as chat switcher.** A small dropdown above the chat input listing the user's owned actors with portraits. The currently-selected one is whose portrait, name, and styling appear on chat cards by default. Lets a player rapidly bounce between voicing Dixon and his cousin Alfie in one scene without futzing with `/ooc` or impersonation menus. Implementation: hook `chatMessage` to inject `speaker` based on the dock selection.

**Persona-aware chat by default.** When you speak as Dixon while his active persona is "Anti-magic Duke," the chat card shows that persona's portrait and name — not his true identity. Magically prevents most accidental fiction-leaks. Pulls portrait/name from `actor.system.personas[activePersonaId]` instead of the actor's base values.

**Per-character chat styling.** Chat cards from a character render inside a `.gs-themed[data-theme="<theme-id>"]` wrapper, which locally rebinds the palette to that character's theme. The card's text color comes from the theme's `--gs-brand`; body type from `--gs-body`. Persona overrides apply via Persona.chatColor (overrides only the brand, not the type). System-emitted chat (token spends, phase changes) skips the wrapper and uses house style. See `docs/design/02-theme-architecture.md` for the wrapper mechanism.

### 12.2 Cycle of play / session flow

**Cycle phase HUD strip.** Always-visible bar at the top of the canvas: "Cycle 3 — Reputation Phase." For the GM, the right edge has an "Advance Phase →" button. For players, it's read-only. Removes the most common "wait, what phase are we in" question every session. Implementation: a small `Application` rendered into the `ui.nav` area, listening to the `cyclePhase` setting.

**Upkeep wizard.** When the GM advances into Upkeep, every player gets a modal that walks through, in order:
1. "Refresh resolve to 3" (with current value shown; click to confirm)
2. "Update your Notes & Objectives" (text editor inline)
3. "Take a monologue if you haven't yet this cycle" (skip allowed)
4. "Review reputation changes since last upkeep" (diff view — see §12.3)

Turns Upkeep from "did everyone remember to do the things" into a guided 60-second checklist. Single most impactful QoL feature for actual play.

**Session log auto-generator.** Click "End Session" (GM-only) and the system compiles a markdown summary of everything that happened mechanically: cycle phase changes, monologues taken (with text), reputation tags gained/lost, conditions added or cleared, inner-conflict boxes ticked, personas swapped, magic cast. Saved to a Journal entry in a "Session Logs" folder, dated. Excellent for absent players catching up and for end-of-campaign retrospectives.

### 12.3 Reputation & conditions UX

**Visual reputation meter.** Three-pip indicator next to each polarity's tag list on the sheet: ●●○ means "two positive tags, one more triggers a condition." Same for negative. Turns implicit counting into an at-a-glance signal for both player and GM. Pure CSS rendering off the existing tag arrays — no new state needed.

**Condition picker on threshold.** When the third tag of a polarity is added, a non-blocking lightbox appears listing canonical conditions (Unexpected Connection, Quite Indebted, Great Offence, Fracture) plus any homebrew conditions in the world's compendium, each with a description. Drag one onto the sheet to apply. The "Possible Reputation Conditions" section on the printed sheet becomes a live picker.

**Reputation pending changes log.** A small "Since last Upkeep" section on the sheet lists every reputation event in chronological order: "Gained ▲ Ambitious (Scene 4: declared ducal investment intent)," "Lost ▼ Flighty (Reputation phase: chose duty over desire)." Cleared on Upkeep. Pulled into the Upkeep wizard's review step.

### 12.4 Inner conflict / monologue UX

**Inner monologue journal flow.** Clicking "Take Monologue" on the sheet doesn't just toggle a flag — it opens a small editor for the monologue's content (1-3 sentences), saves the entry to a per-character journal in a "Monologues" folder, posts a stylized chat card with the persona's portrait and the text, and *then* sets `monologuedThisCycle = true`. Builds a beautiful play artifact for free; lots of groups end up reading these aloud at the end of campaigns.

**Inner conflict completion ceremony.** When a conflict completes (6 boxes total or 5 on one side), auto-post a chat card: "★ Dixon has resolved his Family vs. Business conflict — earn an Expanded Backstory Action." Auto-create a new `backstory-action` item on the Major's sheet with the conflict referenced, ready for the player to fill in. Move the conflict from `innerConflictsActiveIds` to `innerConflictsCompletedIds`.

### 12.5 GM tools

**Reveal control.** A small GM-only widget on each Major sheet (and on the Public Info dashboard) for flipping per-field visibility. Single-character: one click toggles `visibility.desire` from `secret` → `public`. Bulk: "Reveal all desires" on the dashboard for the moment a campaign-wide truth comes out. Should always confirm before flipping (these moments are dramatic and irreversible feels right).

**Bulk permissions panel.** A GM-only `ApplicationV2` window listing all actors in a grid against all users, with permission level dropdowns. Set who-owns-what across the world in one screen instead of 20 per-actor right-click menus. Particularly important since each player owns multiple Majors and Connections.

**Epistolary letter formatter.** During Epistolary phase, GMs and players get a "Send Letter" button that opens a composer (sender persona, recipient persona, subject, body, optional handwriting style). The composer chrome uses house style; the preview pane and the posted card use the *sender's* full character theme via the `.gs-themed[data-theme="..."]` wrapper. This is the canonical proof-point for portable theming — any sender's letter renders correctly with the same template. Optionally archives the letter to a journal folder dated by cycle.

Full composer spec in `docs/design/05-epistolary-ui.md` — covers the two-zone layout (house chrome + sender-themed preview), the seal-color picker, the send flow with chat flags, and the canonical `themedWrap` helper that powers all themed-content rendering across the system.

**NPC quick-create.** Right-click empty canvas → "Create NPC here." Tiny modal: name, role (Innkeeper/Footman/...), portrait (optional, uses generic if none). Drops an NPC actor token at the click location with sensible defaults. For when a player asks "what's the innkeeper's name?" mid-scene and you don't want to break flow.

**NPC organizer per scene.** A sidebar panel listing all Connection and NPC tokens currently placed on the active scene. Click to focus camera on their token. Hover to highlight. Right-click for quick actions (open sheet, change persona, remove). Solves "where did I put the gardener?" on busy ballroom maps.

### 12.6 Onboarding & setup

**Bundled sample world.** A compendium that ships with the system containing: Dixon Ticonderoga Cloudcandle as a fully-built Major (with personas), the Cloudcandle family as a Family actor, his existing Connections (Milo, Alfie, the Dowager Duchess, Pearlinda Von Opaland), a sample ballroom Scene with NPC tokens placed, a couple of Rumour & Scandal cards, sample Inner Conflicts. New users (and you while testing) can load a working game in 30 seconds.

**System welcome panel.** First time the system loads in a world, a friendly walkthrough modal: "Welcome to Good Society. Want to (a) Use the sample world, (b) Start blank, (c) Read the quick-start." Three big buttons, no hand-holding beyond that. Suppressible via a "Don't show again" checkbox saved to user settings.

**In-sheet rule tooltips.** Hover any section header on the sheet (Reputation Criteria, Inner Conflict, Resolve Tokens, etc.) → small tooltip with the rule paraphrased in 1-2 sentences plus a page reference to the rulebook. Cuts 90% of "what does this section do" questions for new players. Implementation: a `data-tooltip-key` attribute on each header, content stored in `lang/en.json` for easy editing.

### 12.7 Robustness

**One-click backup/export.** A GM-only button (in System Settings) that exports all actor data, all items, all journal entries created by the system, and all world settings to a single JSON file. Restorable via an import button. Foundry worlds can occasionally corrupt or get accidentally wiped; this is a five-minute feature that saves real grief.

**Edit-conflict warning.** When two users have the same Connection sheet open and both type into the same field, the second to commit gets a warning before silently clobbering the first's changes. Especially important since Connections default to a shared pool. Implementation: track open-sheet-by-user via a `flag.lockedBy` and warn on conflicts.

---

## 13. Repo structure

```
good-society-homebrew/
├── system.json                    # manifest (id, version, compatibility, esmodules, packs)
├── package.json
├── vite.config.js                 # or rollup, or none
├── README.md
├── CLAUDE.md                      # ← critical: see §16
├── module/
│   ├── good-society.js            # entrypoint, registers Document classes + sheets + settings
│   ├── data-models/
│   │   ├── major-character.js
│   │   ├── connection.js
│   │   ├── family.js
│   │   ├── npc.js
│   │   ├── reputation-tag.js
│   │   ├── reputation-condition.js
│   │   ├── inner-conflict.js
│   │   ├── magic-skill.js
│   │   └── backstory-action.js
│   ├── documents/
│   │   ├── good-society-actor.js
│   │   └── good-society-item.js
│   ├── sheets/
│   │   ├── major-character-sheet.js
│   │   └── connection-sheet.js
│   ├── apps/
│   │   ├── public-info-dashboard.js
│   │   └── npc-hover-card.js
│   ├── hooks/
│   │   ├── hover-token.js
│   │   ├── upkeep-cycle.js
│   │   └── scene-controls.js
│   ├── helpers/
│   │   ├── handlebars-helpers.js
│   │   └── reputation-rules.js
│   ├── settings.js
│   └── constants.js
├── templates/
│   ├── actors/
│   │   ├── major-character/
│   │   │   ├── sheet.hbs
│   │   │   ├── tab-public.hbs
│   │   │   ├── tab-private.hbs
│   │   │   └── tab-tokens.hbs
│   │   └── connection/
│   │       └── sheet.hbs
│   ├── apps/
│   │   ├── public-info-dashboard.hbs
│   │   └── npc-hover-card.hbs
│   └── partials/
│       ├── resolve-track.hbs
│       ├── reputation-tags.hbs
│       └── inner-conflict.hbs
├── styles/
│   ├── good-society.css
│   ├── _sheet.css
│   ├── _dashboard.css
│   └── _hover-card.css
├── lang/
│   └── en.json
├── packs/
│   ├── reputation-conditions/     # canonical conditions from rulebook
│   ├── inner-conflicts/           # archetype templates (Family vs Business, etc.)
│   └── sample-characters/         # the Dixon sheet as a starter
└── assets/
    ├── icons/
    ├── frames/
    └── ui/
```

---

## 14. Build phases

Roughly in dependency order. Each phase is a usable milestone. Time estimates are rough and assume a developer with basic-to-moderate coding experience working with Claude Code as a primary collaborator (see §16 for a note on what these estimates mean and how Claude Code shifts them).

**Phase 0 — Scaffolding (½–1 day)**
Create `system.json`, register one empty Major Character actor type, get the system loading in Foundry v13 with no console errors. Set up Vite, symlinks, and `CLAUDE.md`.

**Phase 1 — Major Character sheet, fillable** (split into three sub-sessions; 5–7 days total)

Phase 1a — DataModel batch (Session A) — 1–2 days. ✓ Done.

Phase 1.5 — Theme field backfill (Session A.5) — 30 min. Add `theme` enum to Major/Connection/NPC; remove `chatStyle` storage from Major; verify in Foundry that defaults populate correctly.

Phase 1b — CSS architecture (Session B-0) — 1–2 days. House CSS variables, font loading via `@fontsource`, one card primitive in house style, the `.gs-themed[data-theme="..."]` wrapper mechanism, and one character preset (`clayton`) implemented as full overrides to validate the pipeline. No sheet templates yet.

Phase 1c — Sheet templates batch (Session B-1) — 2–3 days. Build all Handlebars templates following `docs/design/04-character-sheet.md`, `docs/design/06-connection-sheet.md`, and the inventory order in `03-component-inventory.md`. The themedWrap helper from B-0 is consumed by chat-card and letter-card primitives built here. Persistent tokens & cycle strip on Major sheets (not a third tab — see §6.1).

Phase 1d — Remaining theme presets (Session B-2) — 1 day. Eleven presets implemented. Each is a CSS file with `.gs-actor[data-theme="..."]` and `.gs-themed[data-theme="..."]` selectors per `docs/design/decisions.md` §Theme registry.

**Session B-2.5 — Foundry chrome theme (½ day)**
A small standalone CSS session that re-themes Foundry's surrounding application chrome to match the house style. Eight surfaces in scope: window titlebars, sidebar, chat log surrounding chrome, scene navigation, default form controls, notification toasts, player list, macro hotbar. Out of scope: settings dialogs, file picker, compendium browser, Configure Token, User Configuration, Hotbar Macro editor (these stay default Foundry to limit maintenance burden).

Opt-in via the `applyFoundryChrome` user setting (default true). All rules namespaced under `body.gs-chrome-themed`; the setting toggles the body class on/off for instant runtime apply without page reload.

New file: `styles/foundry-chrome.css`. New setting registration in `module/settings.js`. New `Hooks.once("ready", ...)` and `Hooks.on("clientSettingChanged", ...)` handlers in `module/good-society.js` to manage the body class.

Per `docs/design/28-foundry-chrome-theme.md`. Independent of B-1 sheet work; can run any time after Session B-0 (which provides the house CSS variables this session consumes).

**Phase 2 — Item types & token mechanics (2–3 days)**
Reputation Tag, Reputation Condition, Inner Conflict, Magic/Skill, Backstory Action as item types. Resolve tokens click-to-toggle. MT toggle. Monologue toggle. **Visual reputation meter** (§12.3) on the sheet. Rules tracked but not enforced.

**Phase 3 — Cycle phase + automation hooks (2–3 days)**
World setting for cycle phase, advance button, auto-refresh on Upkeep, "earn Expanded Backstory" detection on inner-conflict completion (6 boxes total or 5 on one side). **Cycle phase HUD strip** (§12.2) always-visible at the top of the canvas.

The Cycle Phase HUD strip (`docs/design/08-cycle-phase-hud.md`) ships in this phase. It's a 40px persistent strip at the top of the canvas with cycle counter, six-phase track, and GM advance button.

**Phase 4 — Family + Connection + NPC actors (2–3 days)**
Family actor type (shared between Majors), Connection actor type with shared-pool default, NPC actor type with GM-only default. Link Family from each Major; render read-only family panel on the Major sheet. "I think [Major] is..." impressions on Connections.

**Phase 5 — Personas + multi-character ergonomics (3–4 days)**
Personas array on Major (and copy schema to Connection/NPC). Sheet UI for adding/editing personas and switching active persona. On switch, update prototype token + every placed token of this actor across scenes. **My Characters dock** (§12.1) pinned panel listing user-owned actors. No auto-switch on scenes yet.

The My Characters dock (`docs/design/09-my-characters-dock.md`) ships in this phase. It's a pinned per-user panel showing owned actors with full state for Majors and tighter rows for Connections. Footer hosts the Speaking-As switcher.

**Phase 6 — Custom apps batch (5–7 days)**
Build the persistent UI trinity and GM tools using the `themedWrap` helper from B-0:
- Public Info dashboard (per `docs/design/07-public-info-dashboard.md`)
- My Characters dock with Speaking-As switcher (per `docs/design/09-my-characters-dock.md`)
- Cycle Phase HUD strip (per `docs/design/08-cycle-phase-hud.md`)
- Welcome Panel (per `docs/design/15-welcome-panel.md`)
- GM tools: Reveal Control, NPC Quick-Create, NPC Organizer (per `docs/design/19-gm-tools.md`)
- Token Hover Card (per `docs/design/17-token-hover-card.md`)
- In-sheet Tooltip system (per `docs/design/20-rule-tooltips.md`)

**Phase 7 — Chat card system (3–4 days)**
Six card variants + Speaking-As switcher + Inner Monologue editor flow per `docs/design/10-chat-cards.md`. Centralized helpers in `module/helpers/chat-cards.js`. Templates under `templates/chat-cards/`. The Speaking-As switcher integrates with the My Characters dock's footer.

**Phase 8 — Personas + interactive flows (4–5 days)**
- Persona switcher (picker + popover + editor) per `docs/design/13-persona-switcher.md`
- Upkeep Wizard (per-Major) + GM Roster View per `docs/design/11-upkeep-wizard.md`
- Condition Picker modal per `docs/design/18-condition-picker.md`
- Magic/Skill VFX integration with Sequencer + JB2A per `docs/design/12-item-sheets.md` Cast pipeline

**Phase 9 — Polish & content (ongoing)**
Compendium packs (canonical conditions, sample characters, sample inner conflicts, sample personas), localization (the ~50 tooltip keys catalogued in `20-rule-tooltips.md`), settings UI, README for friends installing it.

**Phase 10 — Chat & flavor polish (2–3 days)**
**Speaking-as chat switcher** (§12.1) above the chat input. **Persona-aware chat** (§12.1) using active persona's portrait/name. **Per-character chat styling** (§12.1) via persona-stored colors and fonts. **Epistolary letter formatter** (§12.5) parchment-themed composer for the Epistolary phase.

**Phase 11 — Robustness + retrospective (4–5 days)**
A grouped session covering the features that catch problems and create archives:
- Edit Conflict Warning (per `docs/design/21-edit-conflict-warning.md`) — three-layer system: awareness banner, field-level presence indicator, save-time conflict warning toast with diff resolution.
- Bulk Permissions Panel (per `docs/design/22-bulk-permissions-panel.md`) — GM grid for setting actor ownership across all users in one screen.
- Session Log auto-generator (per `docs/design/24-session-log.md`) — event tracking via world flag, markdown generation, preview modal, dated journal entries.
- Backup & Export utility (per `docs/design/25-backup-export.md`) — single .json file export with version-checked import.
- Pending Changes Log section (per `docs/design/26-pending-changes-log.md`) — inline "Since last Upkeep" section on the Major sheet's Public tab. Conditional render based on `pendingChanges.length`.
- Token Frame canvas rendering (per `docs/design/27-token-frame.md`) — three variants (Major 3px solid + glow, Connection 2px solid, NPC 1px dashed). Uses Foundry's TokenRing API with custom PIXI overlay fallback.
- Bundled sample world — Dixon, the Cloudcandle family, his existing Connections, a sample ballroom scene. Expanded compendium content (canonical conditions, archetype inner conflicts, sample personas).

---

## 15. Locked-in design decisions

These are the decisions made during planning. Paste this section into `CLAUDE.md` so Claude Code applies them consistently.

> **Visual design decisions** — top-level design principle, theming architecture, house style palette/type, and the twelve-theme registry — live in the parallel design track at `docs/design/decisions.md`. Treat that file as the authoritative record for visual choices; the items below cover system-architecture decisions only. Cross-references are noted where they intersect.

1. **Family is an Actor type, not an Item.** Multiple Majors share a single Family actor, referenced by `familyId`. Family holds the unique negative reputation criteria, motto, crest, and notes. Editing once propagates everywhere.
2. **Connection actors default to a shared pool** (everyone reads, GM authors). Specific Connections may be promoted to player `OWNER` permissions when they "belong" to a Major. There is also a separate **NPC actor type**, GM-only by default, for ambient cast who aren't formal Connections (innkeepers, footmen, anonymous gentlemen). NPCs can be promoted to Connection later if they become important.
3. **Visibility is per-field**, not per-sheet. Each sensitive field — Desire, Backstory, Magic, Adventurer Sentiment, Notes & Objectives, Inner Conflicts — has its own `secret | public | redacted` flag. Personas can override Major-level visibility per-identity (e.g., Magic might be `secret` for Dixon-the-Duke and `public` for an alter-ego).
4. **Inner conflict completes at 6 boxes total OR 5 on one side.** This is a homebrew rule (the printed sheet's exact phrasing is intentional). Hard-code this predicate in `helpers/reputation-rules.js`.
5. **Magic/Skills produce on-screen casting VFX, nothing else.** No rolls, no targets, no damage. Implementation via Sequencer + JB2A modules, with a chat-message fallback if those modules aren't installed (see §10). Some Magic/Skills (notably Alter Self) trigger a **persona swap** in addition to the VFX.
6. **Adventurer Sentiment is pure flavor text.** Single `string` field. No mechanics, no extra schema, no compendium content needed.
7. **Foundry v13 only.** No backwards compatibility with v12 — use `ApplicationV2`, `HandlebarsApplicationMixin`, `TypeDataModel`, the v13 token texture API. Anything tagged "legacy" or v11 in tutorials is irrelevant.
8. **Personas are first-class.** Each Major (and optionally Connection/NPC) has a list of personas with their own portraits, token images, names, and visibility overrides. Switching persona updates every placed token of that actor across all scenes. See §11.
9. **Visual design follows the antique-but-clean principle and a two-layer theming model.** House style (Inkwell & Wildflower) owns chrome, item sheets, Family, NPC, system-emitted chat, and the Cycle HUD. Character themes own Major/Connection sheet bodies, in-character chat, letters, monologues, and character-themed entries on shared boards. Twelve theme presets are locked (six Major, five Connection, one NPC). Source of truth: `docs/design/decisions.md` and `docs/design/02-theme-architecture.md`.
10. **Per-character chat styling is derived from the active theme**, not stored on the actor. The Major actor schema carries a `theme` enum field; chat cards resolve the theme's `--gs-brand` (color) and `--gs-body` (font) at render time. Personas may override the brand color via their existing `chatColor` field.
11. **Chat card system uses the `themedWrap` helper for all character-bound variants.** Six variants are locked: system-emitted (house), in-character (themed), monologue (themed, expanded), completion ceremony (themed), persona-switch (new persona's theme), letter (sender's theme). Theme id stored on the chat message flag at post time so historic cards survive theme changes. Source of truth: `docs/design/10-chat-cards.md`.
12. **The Token Hover Card serves all three actor types** (Majors, Connections, NPCs) via the wrapper mechanism. Inventory entry #23 renamed from "NPC hover card" to "Token hover card." Source: `docs/design/17-token-hover-card.md`.
13. **The Inner Conflict box grid is a shared primitive** rendered identically on the Major sheet's Public tab and the Inner Conflict item sheet. Single Handlebars partial at `templates/components/inner-conflict-grid.hbs`. Per `docs/design/12-item-sheets.md`.
14. **Tooltips are system-wide and house-styled.** Triggered by `data-tooltip-key` attribute on section headers. ~50 tooltip keys catalogued in `docs/design/20-rule-tooltips.md`. Authored in `lang/en.json` under `GOODSOCIETY.tooltips.*`.
15. **Token frames are canvas-side identity markers.** Per `docs/design/27-token-frame.md`, three variants distinguish Major / Connection / NPC tokens. Implemented via Foundry's TokenRing API. Persona-aware: ring color shifts with persona swaps if `chatColor` override is set. Phase 11 work.
16. **Pending changes log is a conditional inline section** on the Major sheet's Public tab. Per `docs/design/26-pending-changes-log.md`, renders only when `actor.system.reputation.pendingChanges.length > 0`. Sits between Active Conditions and Inner Conflict. Cleared on Upkeep acknowledge.
17. **The session log is event-driven, not snapshot-based.** Per `docs/design/24-session-log.md`, events are appended to `flags["good-society-homebrew"].sessionEvents` (world-level flag) as they fire. Markdown is generated from the events array on "End Session" click. The flag clears on save.
18. **Backups are full-world JSON exports.** Per `docs/design/25-backup-export.md`, single .json file format with metadata envelope (format/version/exportedAt/exportedBy/world/data). Merge-or-replace import. GM-only.
19. **Edit conflict prevention is three layers, escalating in intrusiveness.** Per `docs/design/21-edit-conflict-warning.md`, awareness banner (passive), field-level presence (subtle), save-time conflict warning toast (action-required). The system's robustness for shared Connections.
20. **Bulk Permissions Panel lifted from stub to full spec.** Per `docs/design/22-bulk-permissions-panel.md`, GM grid for setting actor ownership in one screen. Inventory entry #19 was a placeholder; this is its detailed spec.
21. **Foundry chrome re-theming is opt-in, body-class–scoped.** Per `docs/design/28-foundry-chrome-theme.md`, the system overrides ~8 Foundry surfaces (titlebars, sidebar, chat log, scene nav, form controls, notifications, player list, hotbar). All rules namespaced under `body.gs-chrome-themed`; toggled by `applyFoundryChrome` user setting (default true). House style only — character themes don't apply to chrome. Settings dialogs, file picker, compendium browser, and other deep-internal Foundry UIs are explicitly out of scope.

---

## 16. Tooling for working with Claude Code

This project is well-suited to Claude Code, but you'll get much better results with a small upfront setup.

- **Use TypeScript or JSDoc + foundry-vtt-types.** The `@league-of-foundry-developers/foundry-vtt-types` package gives Claude Code real autocomplete and type info when generating code against Foundry's API. It's the single biggest quality-of-life improvement for AI-assisted Foundry development.
- **Vite as bundler.** Fastest dev loop; hot reload is OK for templates.
- **Symlink for live development.** Symlink `good-society-homebrew/` into Foundry's `Data/systems/` directory so saves are picked up immediately.
- **Write a `CLAUDE.md` at the repo root** that tells Claude Code:
  - The Foundry v13 ApplicationV2 + DataModel patterns this project uses (paste a small example)
  - File-naming conventions and where to put new code
  - Data model summaries (copy the sketches from §3 and §4)
  - Locked-in decisions from §14 (paste verbatim)
  - Coding style (e.g. "use `await actor.update()`, never mutate fields directly")
- **Reference systems to read.** When Claude Code needs to figure out a pattern, point it to:
  - **Boilerplate** (Asacolips, github.com/asacolips-projects/boilerplate) — best minimal v13 system template
  - **Dragonbane** — official Free League system, excellent DataModel use
  - **Cyberpunk RED Core** — well-engineered ApplicationV2 sheets, non-d20 logic
  - **Year Zero Engine** — narrative/non-d20 reference
- **Don't auto-build; preview each step.** Foundry surfaces silent failures (sheets that just don't open). Reload the world after every meaningful change and check the dev console.

### A note on the time estimates in §14

The day estimates assume a developer with basic-to-moderate coding experience working *with* Claude Code as the primary collaborator — i.e. they reflect a realistic mixed pace, not pure typing speed.

What Claude Code compresses meaningfully:
- Boilerplate scaffolding (system.json, DataModel schemas, ApplicationV2 wrappers, Handlebars templates) — usually minutes instead of hours
- API recall (which Foundry method does what, what the v13 token texture API looks like) — Claude Code knows this if `CLAUDE.md` and reference systems are pointed at properly
- Repetitive variations (each new sheet section, each new persona override field)

What Claude Code does *not* compress:
- Visual iteration — getting the sheet to actually feel like the printed paper sheet is dozens of small tweaks the human has to see and judge
- Foundry-specific debugging — silent sheet-render failures, timing issues with hooks, permission edge cases. Each one is its own small detective puzzle
- The persona-swap-across-scenes pipeline (Phase 5/8) and the Upkeep wizard (Phase 9) — these are the trickiest parts of the system and will need real iteration regardless of who writes the code
- Decisions you haven't made yet (open art questions, content authoring for the sample world)

A pure-human estimate at the same skill level would roughly be 1.5×–2× longer. A pure-AI estimate (no human verification) would be unreliable — Foundry has enough surface area that "looks right" isn't enough; you need to test in-world. So the numbers in §14 are deliberately middle-ground: human-driven, AI-assisted, sanity-checked at every step.

---

## 17. Acceleration tactics

Four committed tactics for getting this built faster without cutting quality. Apply all of them.

### 17.1 Start from a boilerplate, not a blank page

Fork [Asacolips' Boilerplate System](https://github.com/asacolips-projects/boilerplate) instead of building Phase 0 from scratch. It's the de-facto starter template for v13 systems and gives you, out of the box: one Actor type, one Item type, ApplicationV2 sheets, Vite, the right `system.json` config, language file scaffolding, and the build pipeline already wired up.

This saves Phase 0 entirely and roughly half of Phase 1's plumbing — call it 1–2 days of work avoided. Your first real task becomes "rename the boilerplate's Actor type to `major-character` and make its DataModel match §3.1," not "figure out what `system.json` even wants."

Practical setup steps:
1. Fork or clone the boilerplate to `good-society-homebrew/`.
2. Update `system.json`: id, title, description, author, version `0.1.0`, `compatibility.minimum: "13"`, `compatibility.verified: "13"`.
3. Symlink the project into Foundry's `Data/systems/` directory so saves preview live.
4. Verify it loads in v13 with no console errors before changing anything else.
5. Rename the boilerplate's Actor type to `major-character`, delete its placeholder data model, and replace with §3.1.

### 17.2 Front-load the CLAUDE.md investment

Spend an entire afternoon making `CLAUDE.md` thorough before you write any feature code. It should contain:

- The locked-in decisions from §15 of the plan (paste verbatim)
- All DataModel sketches from §3 and Item schemas from §4 (paste verbatim)
- File and code conventions (where new code goes, naming, immutability rules)
- A complete worked example: one full DataModel + sheet + template, top to bottom, that Claude Code can pattern-match against
- "When adding X do Y" recipes (new actor type, new item type, new sheet section, new automation hook)
- The current build phase and what's next
- A running log of decisions made *during* the build

This is a living document. Update it after every meaningful change. Claude Code's output quality is dominated by the context it sees on each call, and a strong `CLAUDE.md` is the cheapest way to keep that context high. Two hours up front saves days across the project.

A starter draft is provided as a separate file alongside this plan.

### 17.3 Build in batches, not features

Resist the natural urge to build one feature end-to-end before starting the next. Instead, batch by *layer*:

- **Session A — All DataModels.** Design and implement every DataModel from §3 and §4 in one sitting before any sheet work. This forces consistent decisions about field naming, default values, and validation, and it surfaces cross-schema dependencies (like `familyId` referencing the Family actor) early.
- **Session B — All sheet templates.** Build every Handlebars template at once, sharing partials aggressively (resolve track, reputation tags, inner conflict — all reusable).
- **Session C — All automation hooks.** Wire cycle-phase advance, Upkeep refresh, inner-conflict completion detection, monologue tracker, persona-swap pipeline together.
- **Session D — All polish.** Tooltips, chat-card styling, period CSS, all in one pass.

Context-batching means Claude Code keeps the same patterns in working memory across the batch, you make consistent design decisions instead of drifting, and you avoid the "wait, the schema I built three days ago doesn't match the sheet I'm building now" moment.

This re-shapes the build phases in §14: the *features* still ship in the order listed, but you'll often dip across phases when batching layers. That's fine.

### 17.4 Use TypeScript + `@league-of-foundry-developers/foundry-vtt-types`

The single biggest dev-quality multiplier for AI-assisted Foundry work. Real autocomplete and inline docs mean Claude Code generates correct API calls on the first try instead of hallucinating method names that don't exist (a frequent failure mode for Foundry, which has a sprawling and inconsistently-documented API surface).

Setup:
1. `npm install --save-dev typescript @league-of-foundry-developers/foundry-vtt-types`
2. Add a `tsconfig.json` configured for Foundry's globals (the boilerplate ships with a workable starter; otherwise reference Dragonbane's).
3. Convert source files to `.ts` incrementally — start with DataModels (where types help most), keep templates and CSS as-is.
4. Configure Vite to compile TS on save.

The TypeScript investment is half a day of setup. It pays back immediately on every DataModel definition (proper field-type inference) and every Foundry API call (`actor.update`, `Token.update`, `game.user.character` — all properly typed). You don't need to be a TypeScript expert; treat it like Python with type hints.

If TypeScript feels like too much: at minimum install `foundry-vtt-types` and use it via JSDoc type annotations in `.js` files. You get most of the autocomplete benefit without language switching.

---

## 18. References

- Foundry VTT System Development KB: https://foundryvtt.com/article/system-development/
- ApplicationV2: https://foundryvtt.com/article/application-v2/
- DataModel API: https://foundryvtt.com/api/classes/foundry.abstract.DataModel.html
- Foundry Community Wiki: https://foundryvtt.wiki/
- League of Foundry Developers: https://github.com/League-of-Foundry-Developers
- Foundry community Discord — `#system-development` channel
- Good Society rulebook (this repo): rules of play, p.67; cycles of play, p.111; reputation, p.89; inner conflicts, p.98; inner monologues, p.103.

---

## 19. Suggested next steps

1. **Fork [Asacolips' Boilerplate System](https://github.com/asacolips-projects/boilerplate)** to `good-society-homebrew/`. Update `system.json` (id, title, version `0.1.0`, v13 compatibility). Symlink into Foundry's `Data/systems/` directory. Confirm it loads in v13 with no console errors before touching anything else.
2. **Build out `CLAUDE.md`** using the starter draft. Paste §15 (Locked-in decisions) and §3/§4 (data models) verbatim. Add a complete worked example pattern. This is your highest-leverage hour of the whole project.
3. **Install TypeScript and `@league-of-foundry-developers/foundry-vtt-types`** (or use them via JSDoc if TS feels heavy). Half a day, pays back daily.
4. **Session A — DataModels in batch.** Implement *every* DataModel from §3 and §4 in one session before any sheet work. Get the data right; the sheet is a view on top.
5. **Session B — Sheet templates in batch.** Build every Handlebars template, sharing partials aggressively.
6. **Set a Session 1 deadline** with your group — even tentative — to ruthlessly scope to "what's needed to play" (Phases 0–4 + one ballroom scene).
7. **When you reach Phase 5 (Personas), test the persona-swap pipeline against Dixon** (Duke ↔ private magic-user persona) before generalizing — it'll surface every quirk in the visibility-override logic.
