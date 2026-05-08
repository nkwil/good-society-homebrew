# CLAUDE.md — Good Society (Homebrew) Foundry VTT System

This file is the primary working context for Claude Code on this project. Read it first on every new session. Refer to the design plan (`good-society-foundry-system-plan.md`) for the why; this file is the how.

> **Items needing input from Natalie** (search for `[FILL IN]` to find them):
> 1. ~~Repo name~~ → `good-society-homebrew` ✓
> 2. ~~Author~~ → Opal ✓
> 3. ~~License~~ → MIT ✓
> 4. ~~Language~~ → JS + JSDoc, with `foundry-vtt-types` ✓
> 5. ~~Code style~~ → Prettier defaults (2-space indent, semicolons, single quotes) ✓
> 6. Repo URL — fill in once published to GitHub
>
> All other fill-ins resolved. The doc is ready to commit.

---

## 1. Project overview

**What this is.** A standalone Foundry VTT v13 system implementing a homebrew variant of the Good Society TTRPG (a Jane Austen-inspired narrative game by Storybrewers Roleplaying). The system replicates the printed character sheet, automates the token economy (resolve tokens, MT, monologues, cycle phases), and adds a Public Info / Facilitator dashboard plus interactive scene maps with NPC hover tooltips.

**Built on.** Forked from Asacolips' Boilerplate System (https://github.com/asacolips-projects/boilerplate). Foundry v13 only.

**Homebrew additions** beyond canonical Good Society: Magic/Skills system with on-screen casting VFX, Adventurer Sentiment as a flavor field, Personas system (multiple identities per character), modified inner-conflict completion rule (6 boxes total OR 5 on one side).

**Repo:** `[FILL IN: github URL once published]`
**Author:** Opal
**License:** MIT

---

## 2. How Claude Code should use this file

When starting any task on this project:

1. Read this entire file first. Don't skim.
2. Check the "Locked-in decisions" section (§4) — these are non-negotiable.
3. Check the "Build phase status" section (§14) for current scope.
4. Look at the worked examples (§9 and §10) as the canonical pattern. Match them when generating new code.
5. Apply the conventions in §5 — file naming, code style, import ordering.
6. When in doubt, prefer matching the boilerplate's style over inventing new patterns.

**When generating code:**
- Always use Foundry v13 APIs (`ApplicationV2`, `HandlebarsApplicationMixin`, `foundry.abstract.TypeDataModel`). Never use legacy v11/v12 patterns.
- Always `await actor.update({...})` to mutate state. Never reach into `actor.system.foo = ...` directly.
- Use the `foundry.data.fields` namespace for DataModel schemas.
- Localize user-facing strings via `game.i18n.localize(...)` and add the keys to `lang/en.json`.

**When you don't know something:**
- Don't guess at Foundry API signatures. Check `@league-of-foundry-developers/foundry-vtt-types` types first.
- If still unsure, ask before writing code that hits the API. A wrong API call wastes more time than a clarifying question.

---

## 3. Tech stack

- **Foundry VTT:** v13 only. No backwards compat.
- **Language:** JavaScript with JSDoc type annotations. `foundry-vtt-types` provides type info via JSDoc imports.
  - Conversion to TypeScript is easy later if desired; staying in JS+JSDoc keeps the build simple.
- **Bundler:** Vite (inherited from boilerplate).
- **Templates:** Handlebars.
- **Styles:** plain CSS, organized by component. No Sass/LESS.
- **Module dependencies (declared in `system.json`):**
  - `sequencer` — required for Magic/Skills VFX
  - `jb2a_patreon` or `JB2A_DnD5e` (free tier) — VFX asset library
  - The system should degrade gracefully if these aren't installed (fall back to chat messages instead of canvas effects).

---

## 4. Locked-in design decisions

These are non-negotiable. Don't second-guess them in generated code.

1. **Family is an Actor type, not an Item.** Multiple Majors share one Family actor, referenced by `familyId`. Family holds the unique negative reputation criteria, motto, crest, and notes.
2. **Connection actors default to a shared pool** (everyone reads, GM authors). Specific Connections may be promoted to player `OWNER` permissions. There is also a separate **NPC actor type**, GM-only by default.
3. **Visibility is per-field**, not per-sheet. Each sensitive field has its own `secret | public | redacted` flag. Personas can override Major-level visibility per-identity.
4. **Inner conflict completes at 6 boxes total OR 5 on one side.** Hard-coded in `module/helpers/reputation-rules.js`.
5. **Magic/Skills produce on-screen casting VFX, nothing else.** Implementation via Sequencer + JB2A. Some Magic/Skills (notably Alter Self) trigger a persona swap in addition to the VFX.
6. **Adventurer Sentiment is pure flavor text.** Single string field. No mechanics.
7. **Foundry v13 only.** Use `ApplicationV2`, `HandlebarsApplicationMixin`, `TypeDataModel`, the v13 token texture API.
8. **Personas are first-class.** Each Major (and optionally Connection/NPC) has a list of personas with their own portraits, token images, names, and visibility overrides. Switching persona updates every placed token of that actor across all scenes.

---

## 5. File and code conventions

> **Primitives vs. components.** `docs/design/23-primitives-batch.md` proposes a `styles/primitives/` folder for the smallest atomic components (card, button, hairline, etc.) with `styles/components/` reserved for composed components (e.g. `_impression-card.css`, `_chat-card-base.css`, `_dashboard-row.css`). The current build keeps primitives in `styles/components/` for simplicity — both folders coexist in the repo layout shown below, but in practice everything currently sits under `styles/components/`. Keep the existing primitives there; put new composed components there too. Don't create `styles/primitives/` unless a meaningful split emerges later.

### Repository layout

```
good-society-homebrew/
├── system.json
├── package.json
├── vite.config.js
├── README.md
├── CLAUDE.md                       # this file
├── module/
│   ├── good-society.js             # entry point
│   ├── data-models/                # one file per DataModel
│   ├── documents/                  # Actor and Item subclasses
│   ├── sheets/                     # ApplicationV2 sheets
│   ├── apps/                       # other ApplicationV2 windows (dashboard, dock, etc.)
│   ├── hooks/                      # Foundry hook handlers
│   ├── helpers/                    # pure functions, rule logic
│   ├── settings.js
│   └── constants.js
├── templates/
│   ├── actors/                     # one folder per actor type
│   ├── apps/
│   └── partials/                   # reusable Handlebars partials
├── styles/
│   ├── good-society.css            # entry point — imports everything in order
│   ├── _variables.css              # house CSS variables (palette, type, scale)
│   ├── _fonts.css                  # @fontsource imports
│   ├── _house.css                  # antique-but-clean base styling
│   ├── _themed-wrapper.css         # .gs-themed plumbing
│   ├── themes/                     # one file per registry theme
│   │   ├── _theme-clayton.css
│   │   ├── _theme-rose.css
│   │   └── ...                     # one per registry id
│   ├── components/                 # reusable primitives — see docs/design/03 inventory
│   │   ├── _card.css
│   │   ├── _section-header.css
│   │   ├── _hairline.css
│   │   ├── _resolve-track.css
│   │   ├── _mt-badge.css
│   │   ├── _monologue-dot.css
│   │   ├── _reputation-tag.css
│   │   ├── _reputation-meter.css
│   │   ├── _inner-conflict.css
│   │   ├── _visibility-flag.css
│   │   ├── _portrait-frame.css
│   │   ├── _persona-switcher.css
│   │   ├── _magic-skill-tile.css
│   │   ├── _letter-card.css        # used by composer + chat + journal
│   │   ├── _impression-card.css    # cross-theme accent stripe
│   │   ├── _dashboard-row.css      # hybrid-theming gotcha lives here
│   │   ├── _dock-row-major.css
│   │   ├── _dock-row-connection.css
│   │   └── _phase-marker.css
│   ├── sheets/                     # one file per actor sheet
│   │   ├── _major-character.css
│   │   ├── _connection.css
│   │   ├── _family.css
│   │   └── _npc.css
│   └── apps/                       # one file per custom app
│       ├── _dashboard.css
│       ├── _dock.css
│       ├── _letter-composer.css
│       └── _cycle-hud.css
├── foundry-chrome.css             # Foundry chrome overrides (per docs/design/28)
│                                  # All rules namespaced under body.gs-chrome-themed
│                                  # Loaded unconditionally; applied via body class toggle
├── lang/
│   └── en.json
├── packs/                          # compendium content
└── assets/
```

### Naming conventions

- **Files:** `kebab-case.js` (e.g. `major-character.js`, `inner-conflict.js`).
- **Classes:** `PascalCase` (e.g. `MajorCharacterDataModel`, `MajorCharacterSheet`).
- **Constants:** `SCREAMING_SNAKE_CASE` exported from `module/constants.js`.
- **Localization keys:** `GOODSOCIETY.section.field`, lowercase except for the namespace.
- **CSS classes:** `gs-{component}-{element}` (e.g. `gs-sheet-tab`, `gs-resolve-pip`).

### Code style

- 2-space indent, semicolons, single quotes (Prettier defaults).
- ES modules, no CommonJS.
- `import` ordering: third-party first, then `module/...`, then relative.
- One default export per file when the file's purpose is one class; otherwise named exports.

### Mutation rules

- All state mutation goes through Foundry's update APIs:
  - `await actor.update({ "system.field": value })`
  - `await actor.updateEmbeddedDocuments("Item", [{ _id, "system.field": value }])`
  - `await game.settings.set("good-society-homebrew", "key", value)`
- Never mutate `actor.system.x = y` directly. It will desync clients.
- Always `await` updates. Foundry serializes them; not awaiting causes race conditions.

### Localization

- Every user-facing string goes through `game.i18n.localize("GOODSOCIETY.foo.bar")`.
- Add the key to `lang/en.json` in the same commit.
- Section header tooltips (the in-sheet rule explanations) live under `GOODSOCIETY.tooltips.*`.

---

## 6. Data models — Actor types

These are the schemas. When implementing, use `foundry.data.fields.SchemaField`, `StringField`, etc.

### 6.1 Major Character (`major-character`)

```
bio:
  age: number
  peerage: enum["heir", "new-arrival", "foreign"]
  appearance: string                 // 2-4 adjectives
  temperamentGiven: number
  temperamentTaken: number
  portraitUrl: string
theme: enum                          // see docs/design/decisions.md theme registry
  ["rose", "roger", "mags", "avril", "dixon", "clayton"]
personas: array<Persona>             // see §6.5
activePersonaId: string
desire: string
notesObjectives: string
backstory: string
adventurerSentiment: string
tokens:
  resolve: { current: number, max: number }   // defaults: 3, 5
  major: boolean                              // MT toggle
  monologuedThisCycle: boolean
reputation:
  positiveTags: array<string>        // tag item ids
  negativeTags: array<string>
  activeConditions: array<string>
  pendingChanges: array<{ kind, value, scene, ts }>   // for the Upkeep wizard's review step
innerConflictsActiveIds: array<string>
innerConflictsCompletedIds: array<string>
connections: array<string>           // Connection actor ids
familyId: string                     // Family actor id
visibility:
  desire: enum["secret", "public", "redacted"]
  backstory: enum["secret", "public", "redacted"]
  magic: enum["secret", "public", "redacted"]
  adventurerSentiment: enum["secret", "public", "redacted"]
  notesObjectives: enum["secret", "public", "redacted"]
  innerConflicts: enum["secret", "public", "redacted"]
```

### 6.2 Connection (`connection`)

```
bio:
  pronouns: string
  relationshipLabel: string
  description: string
  portraitUrl: string
linkedMajorId: string
impressions: array<{ majorId, text }>
resolve: { current: number, max: number }    // defaults: 1, 5
sceneInfo:
  hoverSummary: string
  publicTags: array<string>
theme: enum                          // five connection variants
  ["connection-green", "connection-purple", "connection-blue", "connection-yellow", "connection-grey"]
personas: array<Persona>             // optional; same shape as Major's
activePersonaId: string
ownership:
  defaultLevel: "OBSERVER"           // shared pool default
```

### 6.3 Family (`family`)

```
familyName: string
origin: enum["heir", "new-arrival", "foreign"]
heirStatus: enum["named-son", "named-daughter", "named-foster", "vacant", "contested"]
                             // initial: "vacant"
establishedYear: number|null          // optional; nullable integer
heirStatusFlavor: string              // optional flavor text for heir status
uniqueNegativeRepCriteria: string    // shows up read-only on member Majors' sheets
crest: { imageUrl, motto }
notes: string                        // GM-only history
memberMajorIds: array<string>
visibility:
  uniqueNegativeRepCriteria: enum["secret", "public", "redacted"]
  notes: enum["secret", "public", "redacted"]
```

### 6.4 NPC (`npc`)

```
bio:
  pronouns: string
  role: string
  description: string
  portraitUrl: string
sceneInfo:
  hoverSummary: string
  publicTags: array<string>
theme: enum                          // currently single option; locked-in NPC inherits house
  ["npc"]
personas: array<Persona>             // optional
activePersonaId: string
ownership:
  defaultLevel: "NONE"
```

### 6.5 Persona (embedded data)

Used inside Major, Connection, NPC.

```
id: string                           // foundry.utils.randomID()
name: string
isPrimary: boolean
portraitUrl: string                  // shows on sheet while active
tokenImageUrl: string                // canvas token while active
tokenName: string                    // nameplate
hoverSummary: string
publicTags: array<string>
chatColor: string                    // overrides character theme's --gs-brand for this persona's chat cards (hex)
visibility:                          // each may be "inherit" to defer to actor's flag
  desire: enum["secret", "public", "redacted", "inherit"]
  backstory: enum["secret", "public", "redacted", "inherit"]
  magic: enum["secret", "public", "redacted", "inherit"]
```

---

## 7. Data models — Item types

| Type | Schema |
|---|---|
| `reputation-tag` | `{ name, polarity: "positive"\|"negative", description, source }` |
| `reputation-condition` | `{ name, polarity, description, active: boolean, sourceTagIds: string[] }` |
| `inner-conflict` | `{ leftLabel, rightLabel, leftBoxes: boolean[5], rightBoxes: boolean[5], completed: boolean, completedSide: "left"\|"right"\|null }` |
| `magic-skill` | `{ name, description, referenceUrl, vfxKey: string, soundUrl: string, hidden: boolean, triggersPersonaSwap: { targetPersonaId } \| null }` |
| `backstory-action` | `{ name, description, sourceConflictId: string, expanded: boolean, used: boolean }` |

---

## 8. World-level settings

Registered in `Hooks.once("init", ...)` via `game.settings.register("good-society-homebrew", ...)`.

- `cyclePhase` — enum: `pre-cycle | novel | reputation | rumour-scandal | epistolary | upkeep`. World scope.
- `cycleNumber` — integer. World scope.
- `autoRefreshOnUpkeep` — boolean. Default `true`.
- `promptOnThreeTags` — boolean. Default `true`.
- `defaultMaxResolve` — integer. Default `5`.
- `defaultStartingResolve` — integer. Default `3`.
- `homebrewMagicEnabled` — boolean. Default `true`.
- `tooltipsEnabled` — boolean. Default `true`. User scope. Hides tooltip `?` glyphs and suppresses hover when false (per `docs/design/20-rule-tooltips.md`).
- `upkeepWizardEnabled` — boolean. Default `true`. User scope. When false, Upkeep advances without opening the per-Major wizard (per `docs/design/11-upkeep-wizard.md`).
- `organizerPlayerVisible` — boolean. Default `false`. World scope. Whether non-GM users can open the NPC Organizer sidebar (per `docs/design/19-gm-tools.md`).
- `applyFoundryChrome` — boolean. Default `true`. User scope. When true, applies the `body.gs-chrome-themed` class that re-themes Foundry's surrounding application chrome via `styles/foundry-chrome.css` (per `docs/design/28-foundry-chrome-theme.md`). Toggleable at runtime without page reload — the body class is added/removed on `clientSettingChanged`.

---

## 9. Worked example — Item: Reputation Tag

This is a minimal but complete item type. Use it as the canonical pattern for new Item types.

### 9.1 Data model: `module/data-models/reputation-tag.js`

```js
/** @typedef {import("@league-of-foundry-developers/foundry-vtt-types").Item} Item */

const { StringField, HTMLField } = foundry.data.fields;

export class ReputationTagDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      polarity: new StringField({
        required: true,
        choices: ["positive", "negative"],
        initial: "positive",
      }),
      description: new HTMLField({ initial: "" }),
      source: new StringField({ initial: "" }),  // e.g. "Scene 4: declared ducal investment intent"
    };
  }
}
```

### 9.2 Sheet: `module/sheets/reputation-tag-sheet.js`

```js
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class ReputationTagSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["good-society", "sheet", "item", "reputation-tag"],
    position: { width: 360, height: "auto" },
    window: { contentClasses: ["gs-reputation-tag-sheet"] },
    actions: {
      // (action handlers wired here)
    },
  };

  static PARTS = {
    main: { template: "systems/good-society-homebrew/templates/items/reputation-tag.hbs" },
  };

  /** @inheritDoc */
  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    ctx.system = this.document.system;
    ctx.polarities = {
      positive: game.i18n.localize("GOODSOCIETY.polarity.positive"),
      negative: game.i18n.localize("GOODSOCIETY.polarity.negative"),
    };
    return ctx;
  }
}
```

### 9.3 Template: `templates/items/reputation-tag.hbs`

```hbs
<form class="gs-form">
  <header class="gs-sheet-header">
    <input type="text" name="name" value="{{document.name}}" placeholder="{{localize "GOODSOCIETY.tag.namePlaceholder"}}" />
  </header>

  <div class="gs-form-row">
    <label>{{localize "GOODSOCIETY.tag.polarity"}}</label>
    <select name="system.polarity">
      {{#each polarities as |label key|}}
        <option value="{{key}}" {{#if (eq ../system.polarity key)}}selected{{/if}}>{{label}}</option>
      {{/each}}
    </select>
  </div>

  <div class="gs-form-row">
    <label>{{localize "GOODSOCIETY.tag.description"}}</label>
    {{editor system.description target="system.description" button=true editable=true}}
  </div>

  <div class="gs-form-row">
    <label>{{localize "GOODSOCIETY.tag.source"}}</label>
    <input type="text" name="system.source" value="{{system.source}}" />
  </div>
</form>
```

### 9.4 Registration in `module/good-society.js`

```js
import { ReputationTagDataModel } from "./data-models/reputation-tag.js";
import { ReputationTagSheet } from "./sheets/reputation-tag-sheet.js";

Hooks.once("init", () => {
  // ... other registrations

  Object.assign(CONFIG.Item.dataModels, {
    "reputation-tag": ReputationTagDataModel,
  });

  foundry.documents.collections.Items.registerSheet("good-society-homebrew", ReputationTagSheet, {
    types: ["reputation-tag"],
    makeDefault: true,
    label: "GOODSOCIETY.sheets.reputationTag",
  });
});
```

### 9.5 Localization keys to add to `lang/en.json`

```json
{
  "GOODSOCIETY.polarity.positive": "Positive (▲)",
  "GOODSOCIETY.polarity.negative": "Negative (▼)",
  "GOODSOCIETY.tag.namePlaceholder": "Tag name (e.g. Ambitious)",
  "GOODSOCIETY.tag.polarity": "Polarity",
  "GOODSOCIETY.tag.description": "Description",
  "GOODSOCIETY.tag.source": "Source",
  "GOODSOCIETY.sheets.reputationTag": "Reputation Tag Sheet"
}
```

---

## 10. Worked example — Actor: Major Character (abridged)

Same structure as §9 but more involved. Skeleton outline; build it by sections, not all at once.

### 10.1 Data model file structure

```js
// module/data-models/major-character.js
const { SchemaField, StringField, NumberField, BooleanField,
        ArrayField, EmbeddedDataField, HTMLField } = foundry.data.fields;

export class PersonaModel extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      id: new StringField({ required: true }),
      name: new StringField({ required: true }),
      isPrimary: new BooleanField({ initial: false }),
      portraitUrl: new StringField({ initial: "" }),
      tokenImageUrl: new StringField({ initial: "" }),
      tokenName: new StringField({ initial: "" }),
      hoverSummary: new StringField({ initial: "" }),
      publicTags: new ArrayField(new StringField()),
      chatColor: new StringField({ initial: "" }),
      visibility: new SchemaField({
        desire: new StringField({
          choices: ["secret", "public", "redacted", "inherit"],
          initial: "inherit",
        }),
        backstory: new StringField({
          choices: ["secret", "public", "redacted", "inherit"],
          initial: "inherit",
        }),
        magic: new StringField({
          choices: ["secret", "public", "redacted", "inherit"],
          initial: "inherit",
        }),
      }),
    };
  }
}

export class MajorCharacterDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      bio: new SchemaField({
        age: new NumberField({ integer: true, min: 0, initial: 30 }),
        peerage: new StringField({
          choices: ["heir", "new-arrival", "foreign"],
          initial: "new-arrival",
        }),
        appearance: new StringField({ initial: "" }),
        temperamentGiven: new NumberField({ integer: true, initial: 0 }),
        temperamentTaken: new NumberField({ integer: true, initial: 0 }),
        portraitUrl: new StringField({ initial: "" }),
      }),
      theme: new StringField({
        required: true,
        choices: ["rose", "roger", "mags", "avril", "dixon", "clayton"],
        initial: "clayton",
      }),
      personas: new ArrayField(new EmbeddedDataField(PersonaModel)),
      activePersonaId: new StringField({ initial: "" }),
      desire: new HTMLField({ initial: "" }),
      notesObjectives: new HTMLField({ initial: "" }),
      backstory: new HTMLField({ initial: "" }),
      adventurerSentiment: new HTMLField({ initial: "" }),
      tokens: new SchemaField({
        resolve: new SchemaField({
          current: new NumberField({ integer: true, min: 0, initial: 3 }),
          max: new NumberField({ integer: true, min: 1, initial: 5 }),
        }),
        major: new BooleanField({ initial: false }),
        monologuedThisCycle: new BooleanField({ initial: false }),
      }),
      reputation: new SchemaField({
        positiveTags: new ArrayField(new StringField()),
        negativeTags: new ArrayField(new StringField()),
        activeConditions: new ArrayField(new StringField()),
        pendingChanges: new ArrayField(new SchemaField({
          kind: new StringField(),
          value: new StringField(),
          scene: new StringField(),
          ts: new NumberField({ integer: true }),
        })),
      }),
      innerConflictsActiveIds: new ArrayField(new StringField()),
      innerConflictsCompletedIds: new ArrayField(new StringField()),
      connections: new ArrayField(new StringField()),
      familyId: new StringField({ initial: "" }),
      visibility: new SchemaField({
        desire: new StringField({ choices: ["secret", "public", "redacted"], initial: "secret" }),
        backstory: new StringField({ choices: ["secret", "public", "redacted"], initial: "secret" }),
        magic: new StringField({ choices: ["secret", "public", "redacted"], initial: "secret" }),
        adventurerSentiment: new StringField({ choices: ["secret", "public", "redacted"], initial: "public" }),
        notesObjectives: new StringField({ choices: ["secret", "public", "redacted"], initial: "secret" }),
        innerConflicts: new StringField({ choices: ["secret", "public", "redacted"], initial: "secret" }),
      }),
    };
  }

  /** Convenience getter for active persona. */
  get activePersona() {
    return this.personas.find(p => p.id === this.activePersonaId)
      ?? this.personas.find(p => p.isPrimary)
      ?? this.personas[0];
  }
}
```

### 10.2 Sheet structure — two tabs + persistent strip

The Major Character sheet uses two tabs (Public, Private) plus a persistent tokens & cycle strip at the bottom. The strip stays rendered across tab switches so resolve, MT, and monologue state are always visible.

Sheet width: 720px. Height auto.

PARTS composition:

```js
static PARTS = {
  header: { template: "systems/good-society-homebrew/templates/actors/major-character/header.hbs" },
  tabs:   { template: "systems/good-society-homebrew/templates/actors/major-character/nav.hbs" },
  public: { template: "systems/good-society-homebrew/templates/actors/major-character/tab-public.hbs" },
  private:{ template: "systems/good-society-homebrew/templates/actors/major-character/tab-private.hbs" },
  strip:  { template: "systems/good-society-homebrew/templates/actors/major-character/strip-tokens.hbs" },
};
```

If implementation surfaces a reason this won't work in ApplicationV2 (e.g. composing three siblings around a tab body), fall back to a third tab. Default to the strip — full rationale in `docs/design/04-character-sheet.md` §"Structural recommendation."

Action handlers map button clicks (`data-action="..."`) to instance methods. See the boilerplate's example for the wiring pattern.

### 10.3 Build order

Don't build the whole sheet at once. Build it in this order — sourced from `docs/design/04-character-sheet.md` §"Implementation notes":

1. DataModel + empty sheet that opens without errors
2. Header partial — portrait side panel, name, role, theme attribute on the sheet root
3. Tab nav — Public / Private toggle
4. Persistent strip — resolve track + MT + monologue + cycle indicator. Get the resolve track click-to-toggle working first; it's the most-clicked element.
5. Public tab — section by section, top to bottom: Reputation Criteria (read-only from Family), Reputation Tags grid, Active Conditions, Inner Conflict, Completed Conflicts.
6. Private tab — section by section: Bio header, Desire, Notes & Objectives, Connections, Backstory, Magic/Skills, Adventurer Sentiment.

Test in Foundry after each step. Each step is small enough that if it breaks, you know which step.

For full per-section specs (layout, CSS classes, behavior, edge cases) refer to `docs/design/04-character-sheet.md`. Don't paraphrase from this file — link the design doc.

---

## 11. Patterns / "When adding X do Y" recipes

### Adding a new Actor type

1. Create `module/data-models/{kebab-name}.js` with a `TypeDataModel` subclass.
2. Create `module/sheets/{kebab-name}-sheet.js` extending `HandlebarsApplicationMixin(ActorSheetV2)`.
3. Create `templates/actors/{kebab-name}/sheet.hbs` (and partials as needed).
4. Register in `module/good-society.js` under `Hooks.once("init", ...)`:
   - `CONFIG.Actor.dataModels["{type}"] = MyDataModel;`
   - `Actors.registerSheet("good-society-homebrew", MySheet, { types: ["{type}"], makeDefault: true });`
5. Add the type to `system.json` under `documentTypes.Actor`.
6. Add localization keys for type label and any field labels.
7. Add a CSS scope `.gs-{kebab-name}-sheet { ... }` in `styles/`.

### Adding a new Item type

Same as above but `Item` instead of `Actor`, `ItemSheetV2` instead of `ActorSheetV2`, and `documentTypes.Item` in `system.json`.

### Adding a new sheet section

1. Create a Handlebars partial in `templates/partials/{name}.hbs` if reusable.
2. Add CSS in `styles/_sheet.css` scoped under the parent sheet class.
3. If the section needs interactive buttons, wire them via `static DEFAULT_OPTIONS.actions`.
4. Add a tooltip key in `lang/en.json` under `GOODSOCIETY.tooltips.{sectionName}`.

### Adding a new automation hook

1. Create `module/hooks/{kebab-name}.js` exporting a `register()` function.
2. Inside, call `Hooks.on("hookName", handler)`. Be specific about which `hookName`.
3. Import and call `register()` from `module/good-society.js` inside `Hooks.once("ready", ...)`.
4. If the hook responds to data changes, debounce or guard against re-entry.

### Adding a new world setting

1. Add to `module/settings.js` inside `registerSettings()`:
   ```js
   game.settings.register("good-society-homebrew", "myKey", {
     name: "GOODSOCIETY.settings.myKey.name",
     hint: "GOODSOCIETY.settings.myKey.hint",
     scope: "world",  // or "client"
     config: true,
     type: Boolean,   // or Number, String
     default: false,
   });
   ```
2. Add the localization keys.
3. Read it via `game.settings.get("good-society-homebrew", "myKey")`.

### Adding a chat card or themed surface

All chat cards go through `module/helpers/chat-cards.js`. Six post-card helpers exist:

```js
import { postSystemCard } from "../helpers/chat-cards.js";        // house style, mechanical updates
import { postInCharacterCard } from "../helpers/chat-cards.js";   // themed, normal chat
import { postMonologueCard } from "../helpers/chat-cards.js";     // themed, expanded weight
import { postCompletionCard } from "../helpers/chat-cards.js";    // themed, ceremony
import { postPersonaSwitchCard } from "../helpers/chat-cards.js"; // themed (new persona)
import { postLetterCard } from "../helpers/chat-cards.js";        // themed (sender)
```

Each helper:
1. Resolves the theme id from the actor (or "npc"/"system" for non-character cards).
2. Wraps content via `themedWrap()` from `module/helpers/themed-wrap.js`.
3. Stores `cardType`, `speakerActorId`, `speakerTheme`, `speakerPersonaId` on the chat message flags so historic cards survive theme changes.
4. Calls `ChatMessage.create({...})`.

Templates live under `templates/chat-cards/` (one per variant). Per-variant CSS lives under `styles/components/_chat-card-{variant}.css` plus a shared `_chat-card-base.css`.

Full spec in `docs/design/10-chat-cards.md`.

The chat card variants compose from primitives in `docs/design/23-primitives-batch.md` (card surface #1, section header #2, hairline divider #3, GM pill #12). Don't redefine these inside chat-card stylesheets; reuse the existing primitive CSS files via `@import` in `styles/good-society.css`'s entry point.

### Adding a frameless ApplicationV2 surface (dock, HUD, hover card, etc.)

Frameless apps need explicit positioning + z-index in CSS — ApplicationV2's
window manager strips that logic when `window: { frame: false }` is set. The
worked example is `module/apps/my-characters-dock.js` + `styles/apps/_dock.css`.
Three things you must do that you don't have to do for framed windows:

1. **Set `position: fixed` (or `absolute`) on the application wrapper in CSS.**
   Without this, the wrapper is `position: static` (the div default) and any
   inline `left`/`top` styles from `setPosition()` or `DEFAULT_OPTIONS.position`
   have no effect — the wrapper sits wherever document flow puts it (often
   wrong, e.g. squeezed into a flex slot in `<body>`).

   ```css
   .application.gs-my-frameless-app {
     position: fixed;
     z-index: 50;       /* see (2) */
     pointer-events: auto; /* see (3) */
   }
   ```

2. **Set z-index explicitly.** Frameless ApplicationV2 doesn't get
   z-index management. Default is `auto`, which renders below any positioned
   element with z-index > 0. Use `50` (above canvas/player-list defaults)
   unless you have a reason to layer differently.

3. **Set `pointer-events: auto`** on the wrapper AND its descendants. Same
   rule as the speaking-as anti-pattern — Foundry's UI chain often inherits
   `pointer-events: none`.

4. **Put the default position in `DEFAULT_OPTIONS.position`, not in
   `_onFirstRender + setPosition`.** ApplicationV2 applies `DEFAULT_OPTIONS.position`
   to inline styles automatically. Calling `setPosition` from `_onFirstRender`
   sometimes only lands a subset of keys (we observed `left:70` applying but
   `top:100` silently dropping when wrapper is static-positioned with
   `height: 'auto'`). Worked example:

   ```js
   static DEFAULT_OPTIONS = {
     window: { frame: false, positioned: true },
     position: { width: 290, height: 'auto', left: 70, top: 100 },
   };

   /** Read stored override at construction; merge over defaults. */
   constructor(options = {}) {
     const stored = (() => {
       try { return game.settings.get('good-society-homebrew', 'myAppPosition'); }
       catch { return null; }
     })();
     if (stored?.left != null && stored?.top != null) {
       options.position = { ...MyApp.DEFAULT_OPTIONS.position, ...stored };
     }
     super(options);
   }
   ```

5. **Mind the placement vs Foundry's chrome.** Foundry v13's default layout
   puts the chat sidebar on the right (anchored to viewport-right). If your
   default `left` puts the surface in that band, the surface will render
   visibly correct *but be hidden behind* the chat sidebar's parent stack.
   Either anchor to the left of the canvas (e.g. `left: 70` to clear the
   tools panel) or detect the chat-sidebar's left edge at construction time
   and place to its left. The dock chose the former for v0.

### Adding a tooltipped surface

Any element with `data-tooltip-key="someKey"` automatically gets:
- A `?` glyph (via CSS `::after`) that signals the tooltip exists.
- A hover tooltip populated from `GOODSOCIETY.tooltips.someKey.body` (required) and `GOODSOCIETY.tooltips.someKey.pageRef` (optional).

To add a tooltip to a section header:

1. **Add the attribute to the template** — `data-tooltip-key` must match a key in `lang/en.json`:
   ```hbs
   <header class="gs-section-header" data-tooltip-key="mySection">
     {{localize "GOODSOCIETY.myTab.mySection"}}
   </header>
   ```

2. **Add the tooltip body (required) and page ref (optional) to `lang/en.json`**:
   ```json
   "tooltips": {
     "mySection": {
       "body": "What this section does, in 1–2 plain sentences.",
       "pageRef": "Rulebook · p. 42"
     }
   }
   ```
   The `body` key is required — a missing key logs a `console.warn` and renders no tooltip. The `pageRef` key is optional; omit it for homebrew sections with no rulebook anchor.

3. No JS wiring needed — `initTooltipSystem()` in `good-society.js` picks up any `[data-tooltip-key]` element anywhere in the DOM via delegated capture-phase listeners.

4. The tooltip title is derived from the element's `textContent.trim()`. CSS `text-transform` doesn't affect `textContent`, so "REPUTATION TAGS" in the DOM renders as whatever the localized string actually is (e.g. "Reputation Tags" — no conversion needed).

5. The `?` glyph only appears on `.gs-section-header[data-tooltip-key]` — the CSS is scoped to avoid adding it to every tooltip-bearing element (e.g. inputs, buttons).

The `tooltipsEnabled` user setting (default `true`) suppresses both the glyph and the hover. Toggle in System Settings → Good Society.

### Switching a persona (the trickiest pattern)

```js
// IMPLEMENTATION NOTE (Option B — B-5a-ii): the real implementation lives in
// module/helpers/persona-swap.js. It differs from this worked example in one
// critical way: actor.img is NEVER overwritten. actor.img stays as the canonical
// base-identity portrait permanently. Only prototypeToken.texture.src and placed
// Token textures change on each swap. The "no persona / true identity" target for
// both is always actor.img. This removes the need for a flag to track the
// original portrait and keeps portrait resolution consistent with how sheet
// surfaces already resolve it: activePersona?.portraitUrl || actor.img.

async function switchPersona(actor, newPersonaId) {
  const persona = newPersonaId
    ? actor.system.personas.find(p => p.id === newPersonaId)
    : null;  // null = clear to true identity

  // Option B: tokenSrc and tokenName resolve from persona OR fall back to actor.
  const tokenSrc  = persona ? (persona.tokenImageUrl || actor.img) : actor.img;
  const tokenName = persona ? (persona.tokenName || persona.name || actor.name) : actor.name;

  // 1. Update the actor's active persona. Does NOT write actor.img (Option B).
  await actor.update({
    "system.activePersonaId":     newPersonaId,
    "prototypeToken.texture.src": tokenSrc,
    "prototypeToken.name":        tokenName,
  });

  // 2. Update every placed token of this actor across all scenes
  for (const scene of game.scenes) {
    const tokens = scene.tokens.filter(t => t.actorId === actor.id);
    if (tokens.length === 0) continue;
    await scene.updateEmbeddedDocuments("Token", tokens.map(t => ({
      _id: t.id,
      "texture.src": tokenSrc,
      name: tokenName,
    })));
  }

  // 3. Optional VFX (only when switching TO a persona, not when clearing)
  if (persona && game.modules.get("sequencer")?.active) {
    new Sequence().effect()
      .atLocation(canvas.tokens.placeables.find(t => t.actor?.id === actor.id))
      .file("jb2a.misty_step.01.blue")
      .play();
  }

  // 4. Chat announcement (respect visibility)
  postChatCard({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: "Persona Switch",
    content: `${actor.name} is now ${persona.name}.`,
    whisper: persona.visibility.magic === "secret" ? [game.user.id] : null,
  });
}
```

---

## 12. Theming

Visual styling for this system follows the locked design system in `docs/design/`. Key facts Claude Code needs at all times:

### 12.1 Top-level principle

**Antique but clean and legible.** Period type, parchment palette, restrained ornament — but at modern accessibility standards. Eight implementation rules in `docs/design/decisions.md` §"Design principle":

1. Generous whitespace (18–24px padding inside cards)
2. Hairlines (0.5px), not heavy borders
3. Period typography at modern sizes (20px+ display, 14px+ body)
4. One decorative flourish per surface
5. WCAG AA on all body text (4.5:1 minimum)
6. No worn/distressed textures
7. Letterpress-style precision (no shadows, no blur)
8. Sentence case for prose, small caps for labels

### 12.2 Two-layer theming model

- **House style** — Inkwell & Wildflower. Owns: chrome, item sheets, Family sheets, NPC sheets, system-emitted chat, Cycle HUD, Public Info dashboard frame, GM tools.
- **Character themes** — twelve presets, applied per-actor. Owns: Major and Connection sheet bodies, in-character chat, letters, monologues, persona-bound surfaces, character-themed entries on shared boards.

Full scope-boundary table in `docs/design/02-theme-architecture.md` §"Scope boundaries". Component-by-component assignments in `docs/design/03-component-inventory.md`.

### 12.3 House palette and type (locked)

CSS variables (full SCSS in `docs/design/decisions.md`):

```css
:root {
  --gs-paper:        #EFE6D2;
  --gs-paper-warm:   #F4ECD8;
  --gs-ink:          #3D2F26;
  --gs-brand:        #2A3A2D;
  --gs-accent-1:     #B85C3F;
  --gs-accent-2:     #708060;
  --gs-accent-3:     #C9A55C;
  --gs-muted:        rgba(112, 128, 96, 0.3);
  --gs-danger:       #8B2A2A;
  --gs-positive:     #4A7A4A;
  --gs-display:      'Lora', 'Palatino', 'Book Antiqua', Georgia, serif;
  --gs-body:         'Crimson Text', 'Palatino', Georgia, serif;
  --gs-italic:       'Crimson Text Italic', 'Palatino Italic', Georgia, serif;
  --gs-ui:           system-ui, 'Helvetica Neue', sans-serif;
}
```

### 12.4 Theme registry (locked)

Six Major themes, five Connection variants, one NPC theme. Each is a CSS file under `styles/themes/_theme-{id}.css` defining a `.gs-actor[data-theme="{id}"]` selector. Full per-theme overrides in `docs/design/decisions.md` §"Theme registry".

| ID | Layer | Notes |
|---|---|---|
| `rose` | Major | Soft pink. Cormorant Garamond + EB Garamond. |
| `roger` | Major | Mirror of rose, blue. Twin link via shared accent-3. |
| `mags` | Major | Dark, lethal. DM Serif Display + Crimson. |
| `avril` | Major | Candlelight & crimson. Didot + Crimson. |
| `dixon` | Major | Heraldic red & gold. Cinzel (names only) + Crimson. |
| `clayton` | Major | Green simple. Shares type with house — palette differs. Default for new Majors. |
| `connection-green` | Connection | Type matches house. |
| `connection-purple` | Connection | Type matches house. |
| `connection-blue` | Connection | Type matches house. |
| `connection-yellow` | Connection | Type matches house. |
| `connection-grey` | Connection | Type matches house. |
| `npc` | NPC | Inherits house. No overrides. |

### 12.5 Portable theme wrapper

For surfaces that aren't bound to a single actor (chat messages, letter cards, themed board entries), wrap rendered content in `.gs-themed[data-theme="<theme-id>"]`. CSS variables resolve inside that wrapper. The same primitive renders correctly for any sender.

```html
<div class="gs-themed" data-theme="dixon">
  <!-- letter content -->
</div>
```

A canonical helper centralizes the wrapping:

```js
// module/helpers/themed-wrap.js
export function themedWrap(actor, content, extraClasses = []) {
  const themeId = actor?.system?.theme || "npc";
  const persona = actor?.system?.activePersonaId
    ? actor.system.personas.find(p => p.id === actor.system.activePersonaId)
    : null;
  const overrideColor = persona?.chatColor;
  const styleAttr = overrideColor ? ` style="--gs-brand: ${overrideColor};"` : "";
  const classList = ["gs-themed", ...extraClasses].join(" ");
  return `<div class="${classList}" data-theme="${themeId}"${styleAttr}>${content}</div>`;
}
```

Used by every chat card, letter card, dashboard row, dock row. If the wrapper class names ever change, update one file.

### 12.6 Font loading

System loads font files for all registered themes at init time using `@fontsource` packages bundled with the system. Fallback stacks ensure missing fonts degrade gracefully. Declared in `system.json`'s `styles` array; loaded by base SCSS `@import` directives.

### 12.7 When adding themed content (recipe)

1. Determine scope from the table in `docs/design/02-theme-architecture.md` and `03-component-inventory.md`. If unsure, ask before coding.
2. If house-styled: use the root CSS variables directly.
3. If character-themed and the surface is bound to a sheet (e.g. Major sheet body): the sheet's root carries `.gs-actor[data-theme="..."]`; descendants inherit automatically.
4. If character-themed and the content travels (chat, letter, board entry): wrap the rendered content in `.gs-themed[data-theme="<theme-id>"]`.
5. Read the theme id from the actor: `actor.system.theme`. For personas, also resolve `persona.chatColor` and apply it as an inline style override on the chat-card brand.
6. Honor the eight antique-but-clean rules. If a layout decision violates them, flag it and ask.

---

## 13. Reference systems and resources

When stuck on a Foundry pattern, check these in order:

1. **Asacolips' Boilerplate** — the project's parent template. Always check there first for "how does this kind of thing work."
2. **Dragonbane** (official Free League system) — best DataModel and ApplicationV2 examples in the wild.
3. **Cyberpunk RED Core** — well-engineered ApplicationV2 sheets, lots of click handlers and tab patterns.
4. **DnD5e** — biggest community system, exhaustive patterns, but complex; use as last resort because patterns are heavy.

Foundry docs:
- System development: https://foundryvtt.com/article/system-development/
- ApplicationV2: https://foundryvtt.com/article/application-v2/
- DataModel API: https://foundryvtt.com/api/classes/foundry.abstract.DataModel.html
- Foundry community wiki: https://foundryvtt.wiki/

Discord: Foundry's official Discord, `#system-development` channel.

---

## 14. Build phase status

**Currently in:** Session B-9 complete — moving to B-10

**Done:**
- Phase 0: fork, rename, verify load
- Session A: all 10 DataModels defined and registered
- Session A.5: theme field backfilled on Major/Connection/NPC; chatStyle removed from Major
- Session A.6: Family `heirStatus` enum + optional `establishedYear` and `heirStatusFlavor` fields ✓
- Design integration v1 + v2: theming architecture, registry, antique-but-clean principle, per-component design docs (04-09) integrated
- Design integration v3: per-component design docs 10–20 integrated (chat cards, Upkeep wizard, item sheets, persona switcher, Family sheet, Welcome panel, NPC sheet, Token hover card, Condition picker, GM tools, Rule tooltips)
- Design integration v4: docs 21–28 + meta-overview (00) integrated; primitives spec captured; pending changes log section ordering noted; token frame canvas spec captured for Phase 6; Foundry chrome theme slotted into Session B-2.5
- Session B-0: CSS architecture
  - House variables (palette, type, scale)
  - @fontsource imports for all twelve themes
  - House base styling
  - .gs-themed wrapper mechanism (with 0.5px accent border)
  - Three foundational primitives: card, section header, hairline
  - themedWrap helper at module/helpers/themed-wrap.js (canonical wrapping for all themed content)
  - Clayton theme implemented as override on both .gs-actor and .gs-themed selectors
  - Validated: Clayton cards render distinctly from house cards, themedWrap returns expected HTML
- Session B-1: all sheet templates ✓
  - Component primitives: buttons, form inputs, resolve track, MT badge, monologue dot, GM pill, polarity arrow, reputation tag, reputation meter, visibility flag, inner conflict grid, impression card, crest medallion
  - Major Character sheet: header, tab nav (Public/Private), tab-public, tab-private, persistent strip
  - Connection sheet: header, description, impressions, scene, state (resolve + personas)
  - Family sheet: header, crest, origin, reputation, notes, members (cross-theme rows)
  - NPC sheet: header, description, scene, personas
  - Item sheets (all 5): reputation-tag, reputation-condition, inner-conflict, magic-skill, backstory-action
  - In-sheet persona picker: native `<select>` on Major header; persona pills on Connection state block
  - Comprehensive lang/en.json backfill: all 127 template keys present; `family.origin.*` and `family.heirStatus.*` structural bug fixed (flat dotted keys → proper nesting with `.label` sub-key)

- Session B-4: custom apps batch ✓
  - Public Info Dashboard (7/07), My Characters Dock, Cycle HUD, NPC Organizer, Rule Tooltip system, Token Hover Card, Bulk Permissions Panel
  - Dashboard "permissions ↗" link opens panel from the GM bulk actions row
  - Scene controls: gs-dashboard (all users), gs-organizer (GM only), gs-permissions (GM only)

- Session B-5: interactive flows ✓
  - B-5a: Persona switcher — picker popover (vanilla DOM), editor modal (framed ApplicationV2), swap pipeline (Option B: never write actor.img)
  - B-5b: Upkeep Wizard — six-step per-Major modal, GM Roster View, cyclePhase onChange trigger, upkeepWizardEnabled client setting, sequential wizard queue (Promise-based close pattern), advance-to-next-cycle clears upkeepCompletedAt flags
  - B-5c: Condition Picker — fires on createItem hook when reputation-tag count hits 3, compendium sourcing from world packs, Later/No Condition dismiss paths, reputation-rules.js helper with lazy-import pattern

- Session B-6a: Session Log ✓ — event tracking (session-events.js), generator (session-log-generator.js), preview modal (session-log-preview.js), scene control button; world-scoped `sessionEvents` setting

- Session B-6c: Cycle 8-position structure ✓ — added `cyclePosition` (0-9) + `isFinalCycle` (GM-toggle) world settings; centralized advance logic in `module/helpers/cycle-advance.js` (one source of truth shared by Cycle HUD + Public Info Dashboard); HUD now renders 8 positional markers with first/second occurrence labels (Novel ², Reputation ², Epistolary ²) and `--skipped` / `--ended` states; final-cycle toggle pill on the HUD plus a System Settings entry; one-time migration in `Hooks.once('ready')` derives cyclePosition from cyclePhase for pre-existing worlds. Per rulebook p.112 (8-position cycle) + p.114-115 (final-cycle skips Rumour & Scandal + 2nd Reputation; 2nd Epistolary becomes the epilogue; game ends after).

- Session B-6b ✓:
  - B-6b/1: pendingChanges writer pipeline ✓ — `module/helpers/pending-changes.js` (appendPendingChange, clearPendingChanges, buildSceneLabel); wired into session-events.js createItem/deleteItem hooks (GM-only single-writer); upkeep-wizard.js updated to call clearPendingChanges helper; lang/en.json adds `cycle.label` + `cyclePhase.ended`
  - B-6b/2: GM Reputation Phase Wizard ✓ — five-step shared modal (roster → createTags → triggerConditions → clearConditions → complete), left-rail round-robin, ConditionPicker handoff
  - B-6b/3: Dashboard reputation tags + conditions ✓ — tag chips + condition badges on Major rows, house-pinned colors, `createItem`/`deleteItem` hooks refresh dashboard
  - B-6b/4: Actions You Can Take cheat sheet ✓ — singleton ApplicationV2, `?` button on Major sheet strip + Speaking-As bar, six-section TOC layout
  - B-6b/7: Player Reputation Phase Wizard + real-time sync ✓ — per-Major five-step framed wizard, `_openSequential` player queue, `reopenReputationPhaseFlow()` export, rep marker click handler on Cycle HUD, `_attachActorWatchers`/`_detachActorWatchers` on both wizards

- Session B-7: Stub sweep ✓
  - `#toggleBox` on Major sheet: toggles leftBoxes/rightBoxes, checks isConflictComplete, moves ID active → completed on actor, posts ceremony card.
  - InnerConflictSheet `#toggleBox` fixed: also moves ID on actor when completing (pre-existing gap — the item sheet had the logic but didn't update the actor arrays).
  - Major sheet `_onDrop`: reputation-tag drop → copy + route to positiveTags/negativeTags + checkThresholdAndPrompt; Connection actor drop → add to system.connections.
  - Connection sheet: `#switchPersona` upgraded to full Option-B pipeline; `#addImpression` / `#editImpression` (DialogV2 with Major selector / textarea); `#addPublicTag` (DialogV2 text input); `#addPersona` routes to openPersonaEditor.
  - NPC sheet: `#promoteToConnection` creates Connection actor (copies bio/sceneInfo/personas), closes/deletes NPC, opens new sheet; `#switchPersona` upgraded; `#addPublicTag` / `#addPersona` wired.
  - Family sheet: `#linkMajor` DialogV2 select of unlinked Majors + two-way link (family.memberMajorIds + major.familyId).
  - `sceneTag.*` / `connection.addImpression*` / `connection.editImpression*` / `family.linkMajor*` / `npc.promote*` lang keys added.

- Session B-11: Event Timeline ✓ — in-fiction calendar of dated events. Two world settings (`calendarEvents` array, `currentInGameDate` object). Per-event visibility (`public` / `gm-only` / `revealed-on-date`). Framed singleton ApplicationV2 with two-mode rendering (GM full read/write, players read-only). Server-side visibility filter in `_prepareContext` so non-GM clients never receive `gm-only` events in the rendered context. Mounts: GM-only `gs-calendar` scene control button (visible to all per scope decision) + `calendar ↗` link in dashboard GM bulk row. Real-time sync via setting `onChange` re-rendering any open instance. Per `docs/design/31-event-timeline.md`.

- Session B-8: Magic/Skill cast pipeline ✓
  - `module/helpers/cast-magic.js` — shared helper called by both the Major sheet skill tile and the item sheet Cast button. Five steps: homebrewMagicEnabled guard → visibility confirm (DialogV2 with public/secret/cancel) → Sequencer VFX (public only; secret Sequencer deferred to v1.1) → persona swap → postSystemCard (whispered when secret).
  - `postSystemCard` extended with optional `whisper` array (non-breaking).
  - `MagicSkillSheet#cast` wired (was a console.log stub); `sequencerActive` added to `_prepareContext` so footer note is dynamic.
  - `magic-skill.hbs` footer now shows "chat-only cast" warning when Sequencer is absent.
  - `castSkill.*` and `item.magicSkill.castNoteNoSequencer` lang keys added.

- Session B-12: Rumour & Scandal Wizard + Board ✓ — implements the missing Rumour & Scandal phase that was previously stubbed on the dashboard. Player-driven round-robin per rulebook p.126-128: each player takes two turns (round 1 + round 2 reverse), creating new rumours or spreading existing ones. State machine: `unspread` → `spread` (resolve token attached) → `used`; or `unspread` → `fading` → `faded` after surviving two R&S phases without being spread. Two world settings (`rumours` array, `rumourPhaseState`). Cross-client coordination via Foundry system socket (`system.json` `socket: true`) — players can't write world settings directly, so action helpers (`requestCreateRumour` / `requestSpreadRumour` / `requestUseRumour`) emit over the socket and the GM client processes via `_processAction`. New Rumour Board (singleton, opens from the dashboard's `rumours ↗` button — replaces the old stub action) shows all rumours with state, click a `●` token to spend it. Per `docs/design/32-rumour-wizard.md` (forthcoming).

- Session B-9: Letter composer / Epistolary UI ✓
  - `module/apps/letter-composer.js` — framed singleton ApplicationV2 (680px). State machine (`_state`) holds fromActorId/toName/subject/body/seal. Input listeners (via AbortController on each `_onRender`) debounce preview updates at 150ms by re-rendering `templates/chat-cards/letter.hbs` into `#gs-letter-preview-zone` via `themedWrap()`. Draft auto-saves every 10s to `letterDraft` client setting; restored on next open.
  - Send flow: `postLetterCard()` → `_archiveToJournal()` (JournalEntry with themed letter HTML) → `goodSociety.epistolarySent` hook → clear draft → close. Whisper recipients include sender, recipient (resolved by actor-name match), and GM.
  - Cancel: confirms discard if body has changed since last save.
  - `templates/apps/letter-composer.hbs` — single-root `<section>` wrapper; form (FROM select, TO text, SUBJECT, BODY textarea, SEAL circles) + preview eyebrow + preview zone + action bar.
  - `styles/apps/_letter-composer.css` — house chrome styling; `@import` activated in `good-society.css`.
  - Scene control `gs-letter` (envelope icon, visible to all) added to `scene-controls.js`.
  - `letterDraft` client setting registered in `good-society.js`.
  - `GOODSOCIETY.letterComposer.*` lang keys added (20 keys).

**Next:**
- Session B-10 — Release prep: README rewrite (install steps, module dependencies, screenshots, link to design docs); settings UI pass (every `config: true` setting has descriptive name + hint); final QA test path through every player-facing feature; tag release.

**Cut from scope:**
- Compendium packs / canonical conditions / archetype inner conflicts (cut 2026-05-07; user direction). Conditions sourced from any world packs the user creates manually.
- Sample world / Dixon-and-friends bundled content (cut 2026-05-06).
- Welcome Panel (cut 2026-05-06; consequence of sample-world cut).
- Expanded compendium content (Phase 11 in PLAN.md; cut 2026-05-07; user direction).

---

## 15. Open decisions / running log

Record decisions made *during* the build here so future sessions don't re-litigate them.

- **B-0 (2026-05-05): Font loading approach.** The boilerplate uses Sass (not Vite), and `@import "@fontsource/..."` npm paths aren't browser-resolvable without a bundler. Decision: copy the needed woff2 files from node_modules into `styles/fonts/` (tracked in git); `@font-face` declarations in `_fonts.css` use local relative paths. A `postinstall` script (`scripts/copy-fonts.mjs`) keeps them in sync after `npm install`. If a bundler (Vite) is added later, the `_fonts.css` approach can swap to `@import` npm paths at that point.
- **B-0 (2026-05-05): `"type": "module"` added to package.json.** All JS files in this project use ES module syntax (`import`/`export`). Added to eliminate Node.js `MODULE_TYPELESS_PACKAGE_JSON` warnings from the helpers.
- **B-1 (2026-05-05): Public tab section ordering updated.** Per `docs/design/26-pending-changes-log.md`, the Major sheet's Public tab now renders the Pending Changes Log between Active Conditions and Inner Conflict (conditional — only when `pendingChanges.length > 0`). Public tab section ordering is now: Reputation Criteria → Reputation Tags grid → Active Conditions → Pending Changes Log (conditional) → Inner Conflict → Completed Conflicts.
- **B-1 (2026-05-05): Token frame implementation deferred to Phase 6.** Per `docs/design/27-token-frame.md`, canvas-side ring frames are not in B-1 scope. Inventory entry #51 stays as Phase 6 work.
- **B-1 (2026-05-05): Edit Conflict Warning, Session Log, Backup Export deferred to Session B-6.** Per docs/design/21, 24, 25 — these are robustness features that don't block any other phase. Group them at the end as a single robustness session.
- **B-1 (2026-05-05): Bulk Permissions Panel slotted into Session B-4 (custom apps batch).** Per `docs/design/22-bulk-permissions-panel.md`. It's a GM tool comparable to the dashboard in surface complexity.
- **B-1 (2026-05-05): Foundry chrome theme slotted into Session B-2.5.** Per `docs/design/28-foundry-chrome-theme.md`. Small standalone CSS session — overrides Foundry's surrounding application chrome (titlebars, sidebar, chat log, scene navigation, default form controls, notifications, player list, hotbar). Opt-in via `applyFoundryChrome` setting (default true). Body-class wrapper (`body.gs-chrome-themed`) for instant runtime toggling without page reload. Independent of B-1 sheet work; can run after B-2 themes or anywhere CSS-only work is convenient.
- **B-3 (2026-05-06): Speaking-As switcher rebuilt as a click-driven popover.** Native `<select>` rendered as zero-size in Foundry v13's chat-sidebar context (cause not chased; symptom-fixed). Replaced with `<button class="gs-speaking-as__pill">` + `.gs-speaking-as__popover` listing actors and indented personas. Matches the design spec from `docs/design/10-chat-cards.md` §"Speaking-As switcher" better than the select did.
- **B-3 (2026-05-06): Speaking-As switcher uses delegated listeners + MutationObserver.** Per-element handlers were going stale across Foundry's chat-sidebar re-renders. Now: a single `document`-level capture-phase delegated `click` handler (in `module/hooks/speaking-as.js`) covers the bar regardless of how many times it's torn down and recreated. A MutationObserver on `document.body` re-injects the bar if it goes missing. Inject calls are serialized through a single promise chain to prevent the duplicate-bar race we saw with the GM popout chat.
- **B-3 (2026-05-06): Foundry v13 chat-input injection — use `renderChatInput` hook, not `renderChatLog`.** Added in v13.346, fires when the chat input is mounted/re-parented (Foundry moves it dynamically via `ChatLog#_toggleNotifications`). The legacy `renderChatLog` + `#chat-form` lookup doesn't work — by the time the hook fires the form may not yet be a child of the rendered log, OR a subsequent re-parent strips your injected node. Kept `renderChatLog` as a fallback for older builds via `_findChatInput()` which queries the whole document and prefers the `#chat`-scoped instance over the popout.
- **B-3 (2026-05-06): Foundry v13 sidebar chain has `pointer-events: none` on every parent.** The `#interface > .ui-right > #sidebar > .sidebar-content > .chat-sidebar` chain all set `pointer-events: none` so the canvas stays interactive in non-UI gaps; individual interactive elements explicitly re-enable. Because `pointer-events` inherits, our injected bar inherited `none` — `getBoundingClientRect()` reported it visible but `elementsFromPoint()` didn't include it and real mouse clicks passed through to the canvas (synthetic `.click()` worked because it bypasses hit-testing). Fixed in `styles/components/_speaking-as.css` with explicit `pointer-events: auto` on `.gs-speaking-as` and `.gs-speaking-as *`. **Anti-pattern logged below.** Any future surface injected into the Foundry sidebar/chrome chain MUST explicitly set `pointer-events: auto` or face the same silent bug.
- **B-3 (2026-05-06): Speaking-As speaker rewriting via `preCreateChatMessage`.** The switcher UI selecting an actor wasn't enough — Foundry still used the user's default speaker. Hook in `module/hooks/speaking-as.js` rewrites `data.speaker.actor`, `speaker.alias`, and `style: IC` on every non-whisper, non-roll message when an actor is selected. Persona name is used as the alias when a persona is active; the underlying actor stays unchanged so chat-card flags still resolve theme/portrait. The Speaking-As selection takes precedence over Foundry's chat-mode toggle (globe/IC/etc) — picking an actor in the switcher means "I want to speak as this actor," full stop. OOC mode users who want OOC chat should set the switcher to "myself."
- **B-3 (2026-05-06): Monologue editor JournalEntry creation rebuilt for v10+ pages API.** Old code passed `content` at the entry level (v9-era pattern); v10+ moved content to `pages` and the entry is just a container. Empty entries got created instead of populated ones. Now creates a `pages: [{ type: 'text', text: { content, format: HTML }}]` shape. Page content is wrapped via `themedWrap()` so the actor's theme applies (parchment surface, brand color, persona `chatColor` override). Wraps in `<div class="gs-card gs-monologue-archive">` with section header showing speaker name + cycle.
- **2026-05-06 — Bundled sample world cut from scope.** No Dixon-and-friends compendium content will ship with the system. Players bring their own characters; the system is a blank shell at install time. Dixon remains an illustrative example throughout the design docs (he motivates magic-visibility, persona-swap, and inner-conflict patterns) but is not a deliverable. Affected docs: `good-society-foundry-system-plan.md` §12.6, §13, Phase 11; `15-welcome-panel.md` (cut); `03-component-inventory.md` row 18; `00-system-overview.md` doc-catalog and authoring checklist.
- **B-4 (2026-05-06): Token Hover Card built as vanilla DOM, not ApplicationV2.** Per §16 anti-pattern ("Don't use ApplicationV2 for transient overlays like tooltips, context menus, or hover cards"). The design doc suggested "a single Application instance" — that suggestion predates the anti-pattern being codified. Implementation in `module/hooks/token-hover-card.js`, `register()` called at module level alongside `registerSpeakingAs()` etc. CSS in `styles/components/_token-hover-card.css`.
- **B-4 (2026-05-06): Token Hover Card dismiss grace period.** When the pointer moves from the PIXI canvas token to the DOM card floating above it, Foundry fires `hoverToken(token, false)`. Without a grace period, the card dismisses immediately before the pointer reaches it. Solution: 200ms dismiss timer on `hoverToken(token, false)`; `mouseover` on the card cancels the timer. Identical pattern to rule-tooltip's `HIDE_GRACE`. Any future transient surface that needs to stay open when the pointer enters it should use the same pattern.
- **B-4 (2026-05-06): Token Hover Card canvas→viewport coordinate math.** `canvas.stage.scale.x` is the zoom level; `canvas.stage.position.x/y` is the pan offset in screen pixels (viewport origin = canvas element origin in Foundry's full-screen layout). Formula: `screen_x = canvas_x * scale + panX`. Token's canvas coords: `placeable.x`, `placeable.y` (top-left); `placeable.w`, `placeable.h` (dimensions). Used for positioning the fixed-position DOM card.
- **B-4 (2026-05-06): Major actor hover card has no sceneInfo.hoverSummary field.** The design doc says all actor types pull `sceneInfo.hoverSummary`, but the Major data model (§6.1) doesn't define a `sceneInfo` field. For Majors, the hover card falls back to `activePersona.hoverSummary` (if set) or empty (no summary section shown). Connection and NPC have `system.sceneInfo.hoverSummary` per their data models. If a Major needs a hover summary, add it via a persona.
- **2026-05-06 — Welcome Panel cut from scope.** Direct consequence of cutting the sample world: with no Sample World card to feature, the remaining two cards (Blank / Quick-Start) didn't justify a first-load modal. Removed from B-4 scope (B-4 now 7 steps, not 8). The `welcomePanelDismissed` user setting is removed from §8. Design preserved in `15-welcome-panel.md` for future reference if it returns.
- **B-4 (2026-05-06): Bulk Permissions Panel — framed ApplicationV2 singleton.** Unlike transient overlays (hover card, tooltip), the panel has real lifecycle: pending-change state, save/discard, re-renders on actor updates. Framed ApplicationV2 (same pattern as PublicInfoDashboard). Opened via: scene control button `gs-permissions` (GM-only visible), and "permissions ↗" link in the dashboard's GM bulk actions row.
- **B-4 (2026-05-06): Bulk Permissions Panel — pending changes tracked in a private Map, DOM updated in-place.** The `#pending = new Map<actorId, Map<userId, level>>` tracks all unsaved edits. Cell clicks update the Map then patch DOM directly (no Handlebars re-render). Only full re-render on Save and Discard. This is the correct pattern for any grid-style editor where re-rendering on every cell change would reset scroll position and lose focus.
- **B-4 (2026-05-06): Bulk Permissions Panel — save merges pending onto current ownership; `{ ...actor.ownership }` shallow spread is sufficient.** The `ownership` object is flat (`{ default: N, [userId]: N }`), so a spread copy preserves all keys. Only the pending-changed user IDs are overwritten. The GM's implicit OWNER access is Foundry-enforced and does not need a key in the ownership object.
- **B-4 (2026-05-06): Bulk Permissions Panel — keyboard shortcut deferred.** Ctrl+Shift+P collides with browser Print on some platforms. Keyboard shortcut can be added in v1 as an opt-in user setting. Not in v0.
- **B-5a-i (2026-05-06): Persona picker — vanilla DOM popover replaces native `<select>`.** The native `<select name="system.activePersonaId">` on the Major sheet header was causing two bugs: form-submit not firing, then silent actor-rename. Replaced with a `data-action="openPersonaSwitcher"` button that opens a vanilla DOM popover (same pattern as reveal-control.js). Theme `<select name="system.theme">` added to the eyebrow row — the read-only label was replaced with an editable select; `submitOnChange: true` persists immediately and re-renders with the updated `data-theme`. `activePersonaExplicit: !!(system.activePersonaId)` distinguishes "no explicit selection" (show "true identity ▾") from "persona chosen" (show persona name ▾). Popover z-index: 500 (must overlay ApplicationV2 sheet windows).
- **B-5a-ii (2026-05-06): Persona swap — Option B (never write actor.img).** The CLAUDE.md §11 worked example included `"img": persona.portraitUrl` in the actor.update call. Option B removes this line. actor.img stays as the canonical base-identity portrait permanently. Only `prototypeToken.texture.src` and placed Token textures change on each swap. The "no persona / true identity" target for both is always `actor.img`. This simplifies the reverse direction (no flag needed to store original portrait) and matches how rendering surfaces already resolve portraits: `activePersona?.portraitUrl || actor.img`. The §11 pseudocode in CLAUDE.md has been updated to reflect this.
- **B-5a-ii (2026-05-06): Persona editor — `chatColor` color input defaults to theme brand.** `<input type="color">` requires a non-empty value; when persona.chatColor is '' (no override), the input defaults to `#2A3A2D` (Clayton theme brand). On save, the editor detects this case and stores '' instead of the stub default, so a user who never touches the color picker doesn't accidentally store an override. Users who want to set the theme's own brand as an explicit override will need to type the hex manually — acceptable for v0.
- **B-5a-ii (2026-05-06): Persona editor — per-actor instance ID (`gs-persona-editor-{actor.id}`).** The editor uses a per-actor ID so multiple actors can have editors open simultaneously. Without this, opening the editor for a second actor would silently reuse the first's window.
- **B-4 (2026-05-06): Bulk Permissions Panel — `_setPending` reverts to server state when level matches.** If the GM clicks a cell to OWN and then clicks it back to read (the server value), the pending entry is removed so the cell shows clean. This avoids showing a "changed" indicator for no-op changes.
- **B-6b/1 (2026-05-07): pendingChanges single-writer pattern.** `appendPendingChange` is GM-only (guards with `if (!game.user?.isGM) return`), not "any owner or GM" as the scope doc proposed. Reason: `createItem` / `deleteItem` hooks fire on ALL connected clients simultaneously; owner + GM would both call the function and produce duplicate entries. Single-writer via GM client is the same pattern as `appendSessionEvent` in session-events.js. Players who own a character and add a tag will not append pendingChanges on their client; the GM client writes on their behalf. **How to apply:** any new hook or action that calls `appendPendingChange` need not re-guard — the function itself is GM-gated.
- **B-6c (2026-05-07): Cycle 8-position structure.** The `cyclePhase` enum had only 6 distinct phase TYPES (`pre-cycle`, `novel`, `reputation`, `rumour-scandal`, `epistolary`, `upkeep`), but per rulebook p.112 a single cycle is **8 ordered positions** — Novel, Reputation, Rumour & Scandal, Epistolary, **second Novel, second Reputation, second Epistolary**, Upkeep. The Cycle HUD was missing those second-pass positions. Fix: add `cyclePosition` (0-9) world setting; keep `cyclePhase` as the type (every existing phase-aware hook keeps working — Reputation Phase Wizard naturally fires twice per cycle, etc.); centralize advance logic in `module/helpers/cycle-advance.js` so the HUD's button and the Public Info Dashboard's button both call the same code. Final-cycle special case (skip positions 3 + 6 per p.114-115; epilogue at 7; game ends after) is GM-controlled via `isFinalCycle` setting (toggleable from a pill on the HUD AND from System Settings, since `config: true`). State 9 = ended (post-epilogue); HUD shows a gold-accent "ended" pill when reached. One-time migration runs on `ready` for GM clients: if `cyclePosition` is 0 but `cyclePhase` is mid-cycle, derive position from phase using first-occurrence (`'novel' → 1`, `'reputation' → 2`, etc.). The HUD's "skipped" marker styling is conditional: a future skip position renders dashed/struck-through, but if the GM toggles final-cycle on AFTER passing position 3, that already-completed position renders as `--complete` (it ran before the toggle).
- **B-6b (2026-05-07): Reputation Phase Wizard — three open-question decisions resolved.** Per docs/design/29-reputation-batch.md §9: (1) Erased tags shown in step 1 roster: **yes** — small "traded tags this cycle" footnote per character (context for the table). (2) Double-polarity condition trigger (character hits ≥3 positive AND ≥3 negative in same phase): **yes, positive first then negative** — fire ConditionPicker twice serially for the same actor. (3) Tag chip click on dashboard: **open the Major sheet** — `data-actor-id` on the chip delegates to the existing row click handler; no separate chip action.
- **B-6b/7 (2026-05-08): `reputationPhaseCompletedAt` flag clearing deferred.** The flag is set when a player completes their per-Major wizard. It is NOT auto-cleared between positions 2 and 6 in the same cycle — this was deemed out of scope per docs/design/30. `reopenReputationPhaseFlow()` bypasses the completion filter (users explicitly asked to re-enter). The clear path should be added to `module/helpers/cycle-advance.js` alongside the `upkeepCompletedAt` clearing: when advancing past a reputation position, unset `reputationPhaseCompletedAt` on all Majors owned by connected users. Until then, players who finish position 2 will need to use the HUD click to re-open for position 6.
- **B-6b/7 (2026-05-08): Player wizard uses themed body wrapper, house-styled chrome.** The `.gs-themed[data-theme="..."]` wrapper applies to `gs-player-rep-wizard__body` only — the header (ribbon, eyebrow) and footer (Back/Next buttons) are house-styled. This keeps navigation buttons readable in all themes while giving the step content a character-bound feel. The GM wizard is entirely house-styled since it's a facilitator tool not bound to any one character's theme.
- **B-6b/7 (2026-05-08): `_attachActorWatchers` guard uses `if (this._watchers) return;`.** Both wizards guard re-attachment so calling `_attachActorWatchers()` from `_onRender` on every render cycle doesn't leak hooks. Only the first render attaches; `_detachActorWatchers()` in `_onClose` is the single cleanup point. Pattern verified: `Hooks.on()` returns a numeric ID; `Hooks.off(hookName, id)` removes by ID — the `_watchers` array stores IDs, not function references.
- **B-7 (2026-05-08): NPC promote-to-Connection uses Actor.create + explicit this.close() order.** Foundry v13 has no built-in actor-type conversion. Pattern: (1) create new Connection actor with copied fields, (2) `await this.close()` to close the NPC sheet before deletion, (3) `await this.actor.delete()`, (4) `newActor.sheet?.render(true)`. Closing before deleting avoids Foundry's cleanup logic trying to re-render a sheet whose actor no longer exists. Theme defaults to `connection-green` — user can change it on the new sheet.
- **B-7 (2026-05-08): Connection/NPC #switchPersona upgraded to full Option-B pipeline.** The original stubs did `await this.actor.update({ 'system.activePersonaId': ... })` — no token updates, no VFX, no chat card. Now routed to `switchPersona(actor, personaId)` in `module/helpers/persona-swap.js`. The call passes `''` when clearing to true identity (matching the helper's `toPersonaId === ''` → null persona path).
- **B-7 (2026-05-08): InnerConflictSheet #toggleBox was missing the actor array move.** The item sheet already had a complete `#toggleBox` implementation (toggle + completion check + completion card) but it did NOT update the actor's `innerConflictsActiveIds` → `innerConflictsCompletedIds` arrays when completing. This meant completing a conflict from the item sheet left it displayed in the "active" section on the Major sheet. Fixed in B-7 by adding the array move to the item sheet handler (same fix applied to the new Major sheet handler).
- **B-7 (2026-05-08): `npc-quick-create.js` entry point not missing.** The B-7 scope noted "wire npc-quick-create.js entry point if missing." Checked: the file already exists and is registered; no wiring gap found.
- **B-8 (2026-05-08): Cast pipeline extracted to a shared helper rather than duplicated in two sheet action handlers.** Both `MajorCharacterSheet#castSkill` (tile on Private tab) and `MagicSkillSheet#cast` (item sheet footer) call `castMagicSkill(item, actor)` from `module/helpers/cast-magic.js`. Keeping it in one place ensures the two entry points never drift apart and simplifies future v1.1 work (secret-cast Sequencer GM-only effect).
- **B-8 (2026-05-08): Secret-cast Sequencer (GM-view-only VFX) deferred to v1.1.** The design doc notes this as advanced ("defer if not feasible"). When "cast secretly" is chosen, the VFX is skipped entirely and only the whispered chat card fires. The v1.1 path would add `canvas.app.renderer.visible` or a socket-based emit so only the casting player and GM see the Sequencer effect.
- **B-11 (2026-05-08): Event Timeline storage — world settings, not Item type.** Considered modeling each event as a `calendar-event` Item but rejected: events have no parent-actor relationship, the Items sidebar would get noisy, and a flat array on a world setting gives Foundry's WebSocket setting-replication behavior for free (no custom sync code; players see GM changes within ~50-100ms). Tradeoff: events aren't searchable via the Items index, but at v0 scale (~10-50 events per game) that doesn't matter.
- **B-11 (2026-05-08): Date math is pure-numeric for compare, `Date` only at format time.** `compareDate(a, b)` uses `year×10000 + month×100 + day` to avoid timezone weirdness from JavaScript `Date`. `formatDate` constructs a `Date` purely for `Intl.DateTimeFormat`. V8 uses the proleptic Gregorian calendar, which matches actual Regency-era Britain (Gregorian since 1752) — pre-1900 weekday computation works fine.
- **B-11 (2026-05-08): Visibility filter is server-side, not template-side.** Non-GM clients receive only events visible to them in `_prepareContext`. Defense-in-depth: even with DevTools, `gm-only` event titles never reach the player's browser. The `revealed-on-date` filter compares against the `currentInGameDate` setting; advancing that setting re-renders and previously-hidden events flip to visible without reload.
- **B-11 (2026-05-08): `gs-calendar` scene control visible to ALL.** Other GM-tool buttons gate on `game.user?.isGM`, but the calendar is `visible: true`. The timeline app itself enforces read-only mode for non-GMs (no add/edit/delete buttons). Gives players a top-of-canvas button rather than burying it behind a dashboard click.
- **B-12 (2026-05-08): Rumour & Scandal player-driven via system socket.** Per Natalie's choice (1b in the design poll), each player takes their own turn rather than the GM doing all the typing. World settings are GM-only-writable, so the player action helpers (`requestCreateRumour` / `requestSpreadRumour` / `requestUseRumour`) emit a payload over Foundry's system socket; the GM client subscribes via `module/hooks/rumour-socket.js#register` and dispatches each payload through `_processAction`. Required `system.json` flip from `"socket": false` to `"socket": true` — anti-pattern flag: any future cross-client coordination should use the same pattern (single GM-side processor, not an actor flag race). The `_processAction` validation checks `_isAllowedActor(requestedBy)` to ensure only the current turn's user can advance the wizard — without that guard, a malicious or buggy client could spread rumours out of turn. Setting `onChange` on `rumours` + `rumourPhaseState` re-renders any open wizard/board on every client, so all players see state updates within Foundry's socket round-trip latency.
- **B-12 (2026-05-08): Rumour state machine — fading + faded are separate states, not flags.** Considered modeling fade as a `lastSpreadCycle` field with a derived "faded" boolean, but rejected: the rulebook (p.128) describes a discrete fade-out symbol that gets ADDED to a rumour during one R&S phase, then the rumour is CROSSED OFF during the next R&S phase if still not spread. That's two distinct visual states. Storing them as enum values (`fading` and `faded`) makes the state machine explicit and the `_runFadeout` pass trivial: every `unspread` becomes `fading`, every `fading` becomes `faded` (with `endedAt` timestamp). Spreading a `fading` rumour resurrects it to `spread`, matching the rulebook's "rumour saved" path.
- **B-11.1 (2026-05-08): Stage-based bucketing replaces date-based.** v0 of the Event Timeline used numeric `year/month/day` per event with a `currentInGameDate` setting; the bucketing logic compared dates to assign each event to upcoming / today / past. Natalie reported this didn't fit the play style — Good Society's in-fiction time is loose, so strict date matching produced awkward results (an event "around the 15th" never landing in 'today' until the GM moves the current date to exactly the 15th). Replaced with manual stage-based bucketing: each event has `stage: 'coming-soon' | 'today' | 'past'`, and the GM moves events between buckets explicitly (`promoteEvent` with optional Foundry Scene link, `concludeEvent`, `revertToComingSoon`). Date is now an optional free-text `dateLabel` ("next month", "after the harvest"). Migrations handled on-read in `_normalizeEvent`: legacy `year/month/day` → formatted `dateLabel` string; legacy `revealed-on-date` visibility → `gm-only`; missing `stage` → `'coming-soon'`. The `currentInGameDate` setting is no longer registered — if a world has it on disk it's harmless, just unused. Per-event scene linking uses Foundry's built-in Scene documents (DialogV2 picker on promote). Auto-reveal on promote: `gm-only` events flip to `public` when promoted to today (single-click prep-then-reveal). Concluding a 'today' event moves it to past (manual GM action; auto-conclude on Scene deactivation considered but rejected for v0 — too magical).
- **B-8 (2026-05-08): `postSystemCard` now accepts `whisper` array.** Non-breaking — default is `[]` (empty = public). Spread-conditional so the field is omitted entirely when not whispering (Foundry treats `whisper: []` and omitted identically, but explicit empty array avoids potential edge cases).
- **B-9 (2026-05-08): Letter composer TO field is plain text, not an actor picker.** The design doc specifies a styled actor-picker for TO matching the FROM control. For v0, TO is a plain `<input type="text">` accepting a recipient name as free text. The `postLetterCard()` helper already accepts `letter.to` as a string. Recipient actor resolution (for whisper-target lookup) is a best-effort name match: `game.actors.find(a => a.name === this._state.toName)`. This is sufficient for v0; a proper actor picker can be added in v1 as a chip-list.
- **B-9 (2026-05-08): FROM field uses a native `<select>`.** The design doc specifies a custom styled actor picker with portrait, name, subtitle, and ▾ chevron. For v0, a native `<select>` listing owned actors is used. The key behavior (selecting FROM changes the preview theme) works identically. The styled picker is a v1 visual enhancement.
- **B-9 (2026-05-08): Journal archive always fires on send; no GM setting for v0.** The design doc says archive is GM-configurable (default true). For v0, archiving always runs; failure is non-fatal (caught + `console.warn`). The setting can be added in v1.
- **B-9 (2026-05-08): `goodSociety.epistolarySent` hook fired; session-events.js listener not yet added.** The hook payload (`actorId`, `actorName`, `speakerName`, `letter`, `cycleNumber`) is complete. Wiring the session-events append (so sent letters appear in the session log) is deferred to B-10 or a follow-up session — it does not block the letter composer.
- **B-9 (2026-05-08): `letterDraft` setting stores the entire `_state` object (fromActorId, toName, subject, body, seal) plus a `ts` timestamp.** Draft is per-user (client-scoped). A null draft means no draft exists. The draft is cleared after successful send, and confirmed-discard on cancel; it persists through Save Draft + close and is restored in the constructor via `_restoreDraft()`.
- **B-9 (2026-05-08): Preview updates the `#gs-letter-preview-zone` innerHTML directly, not via full PART re-render.** The form DOM persists; only the preview zone changes. This avoids losing textarea focus/cursor position on every keystroke. Input listeners are bound via `AbortController.signal` on each `_onRender` call so re-renders never duplicate handlers.
- **2026-05-07: Scope reconciliation — gap audit between PLAN.md and Sessions B-0..B-6.** Audit performed mid-B-6 found that several PLAN.md deliverables were never explicitly slotted into a Session despite appearing to be in-scope, and a number of sheet-level handlers shipped as stubs ("coming in a future session" notifications) without being tracked anywhere. The pattern: scope ADDITIONS and explicit DEFERRALS were logged (Token Frame to B-6, Bulk Permissions into B-4, Foundry chrome into B-2.5, Welcome Panel cut, sample world cut), but items that drifted from PLAN.md without picking up a Session home left no audit trail. Outcome: (a) compendium packs and Phase 11 expanded compendium content cut at user direction; (b) four new Sessions added to §14 — B-7 stub sweep + Phase 2/4 mechanics, B-8 Magic/Skill cast pipeline, B-9 letter composer, B-10 release prep; (c) "Cut from scope" subsection added to §14 listing every documented cut so future readers see at a glance what's intentionally absent. Going-forward rule: every PLAN.md deliverable must have either a Session home in §14 or a documented cut decision in §15. Stubs that ship pending later wiring count as not-done — track them in §14 against the Session that will wire them, not as ambient "this works but the action is a notification."

## 16. Anti-patterns — don't do these

- ❌ Don't mutate `actor.system.x = y` directly. Always `await actor.update(...)`.
- ❌ Don't use `Application` (v1) — only `ApplicationV2`.
- ❌ Don't hardcode user-facing strings. Localize everything.
- ❌ Don't reach into `game.actors.contents` for filtered queries when `game.actors.filter(...)` works just as well and is clearer.
- ❌ Don't write tests against Foundry internals. Test pure helpers in `module/helpers/` only; integration testing happens in-world.
- ❌ Don't store derived state. Compute it in the data model's `prepareDerivedData()` or in a sheet's `_prepareContext()`.
- ❌ Don't add modules as hard dependencies. Sequencer + JB2A are *recommended*; the system must degrade gracefully if they're missing.
- ❌ Don't store `chatStyle.color` or `chatStyle.font` on the actor. They're derived from `actor.system.theme` at render time. Hard-coding them anywhere except the theme CSS files defeats the registry.
- ❌ Don't add new theme presets without an entry in `docs/design/decisions.md` §"Theme registry". Visual decisions live in the design track; code follows the registry, not the other way around.
- ❌ Don't put `:root` overrides inside a sheet's stylesheet. They leak globally. Scope to `.gs-actor[data-theme="..."]` or `.gs-themed[data-theme="..."]`.
- ❌ Don't let a `.gs-themed` wrapper's variable cascade override "always-house" properties (e.g. dashboard row backgrounds). Hardcode house values inside the themed component for those properties, and document with a comment. See `docs/design/07-public-info-dashboard.md` §"Theme behavior" for the canonical example.
- ❌ Don't manually concatenate `<div class="gs-themed" data-theme="...">` inline. Always go through `themedWrap()` from `module/helpers/themed-wrap.js`. Centralized wrapping survives class-name changes; inline concatenation doesn't.
- ❌ Don't render the Tokens & Cycle strip as a third tab on the Major sheet. It's a persistent strip below the tab body; tokens state must remain visible across tab switches. See `docs/design/04-character-sheet.md` §"Structural recommendation."
- ❌ Don't render the Token Hover Card with hardcoded actor-type styling. The same component template handles Majors, Connections, and NPCs via the `.gs-themed[data-theme="..."]` wrapper. Per `docs/design/17-token-hover-card.md`.
- ❌ Don't filter the Token Hover Card's content client-side. Visibility filtering for non-owners (hiding secret-persona true names, etc.) happens in `_prepareContext` server-side. Client-side filtering is not safe for secret-persona protection.
- ❌ Don't tooltip a section header without a `data-tooltip-key` attribute and a body in `lang/en.json` under `GOODSOCIETY.tooltips.{key}.body`. Per `docs/design/20-rule-tooltips.md`. Missing keys silently render no tooltip — easy to miss in QA.
- ❌ Don't manually concatenate chat-card HTML. Always go through `module/helpers/chat-cards.js`. Centralized helpers carry the right flags + theme wrapping consistently. Per `docs/design/10-chat-cards.md`.
- ❌ Don't store session-event tracking in actor flags. Per `docs/design/24-session-log.md`, the event log lives at `flags["good-society-homebrew"].sessionEvents` on the world (game), not per-actor. Per-actor would fragment the log and complicate retrieval.
- ❌ Don't paint custom token graphics directly onto the Token document's image. Per `docs/design/27-token-frame.md`, ring frames use Foundry's TokenRing API (or a PIXI overlay fallback) — modifying the token's image baked-in would lose persona-aware swap behavior.
- ❌ Don't render the Pending Changes Log section when `actor.system.reputation.pendingChanges` is empty. Per `docs/design/26-pending-changes-log.md`, the section is conditional — empty state collapses entirely. Don't ship an empty placeholder card.
- ❌ Don't move existing primitives from `styles/components/` to `styles/primitives/`. The folder split proposed in `23-primitives-batch.md` is conventional; the repo's current organization works. Adding a `styles/primitives/` folder mid-build would cause every sheet's import to need updating — defer the rebrand or skip it entirely.
- ❌ Don't get the ApplicationV2 tab wiring wrong — there are two independent requirements, both mandatory. (1) The **nav element** must have class `tabs` (e.g. `<nav class="tabs ...">`). `changeTab` queries `.tabs [data-group][data-tab]` to find the nav button — if `tabs` is missing it throws "No matching tab element found" even though the buttons are present. (2) Each **tab body** root element needs `class="tab ..."` plus `data-group` and `data-tab`. Foundry's CSS hides `.tab[data-tab]:not(.active)`, so the initial active tab must also carry `class="... active"` (render it conditionally: `{{#if (eq tabGroups.sheet 'public')}}active{{/if}}`). Do not use the `hidden` HTML attribute for tab visibility — Foundry's CSS owns that. Worked example: `templates/actors/major-character/` (header nav + tab-public/tab-private).
- ❌ Don't use the bare global `renderTemplate(...)` — it's deprecated in Foundry v13 and removed in v15. Use `foundry.applications.handlebars.renderTemplate(...)` for all template rendering. Same pattern applies broadly: many v12 globals moved under `foundry.applications.*`, `foundry.utils.*`, `foundry.canvas.*` in v13. When a deprecation warning appears in the console, it always names the new namespace — follow it immediately rather than leaving deprecated calls to accumulate.
- ❌ Don't write a Handlebars PART template with multiple top-level elements, conditional blocks, or text/whitespace at the root. Foundry v13 ApplicationV2's `_parsePartHTML` requires each PART to render exactly one root HTML element. Wrap everything in a single root (e.g. `<form>`, `<section>`, `<div>`) and put conditionals INSIDE that root. Whitespace before or after the root is also read as a text node and trips the same error.
- ❌ Don't promote `<form>` to be the root element of an ApplicationV2 PART template if your sheet class queries `this.element.querySelector('form')`. Either keep the form nested inside a wrapper div, or change the JS to use `this.element` directly. The wrapper approach is usually less risky. This applies to every item sheet — all five (`reputation-tag`, `reputation-condition`, `inner-conflict`, `magic-skill`, `backstory-action`) use `<section class="gs-item-sheet__wrapper">` as the PART root with `<form>` nested inside. Without this wrapper, `submitOnChange: true` silently fails (form never found) and nothing saves. Worked example: `templates/items/reputation-tag.hbs`.
- ⚠ Chat card templates (`templates/chat-cards/*.hbs`) render via `ChatMessage.create → innerHTML`, NOT through ApplicationV2 PARTS, so multiple top-level elements are fine there. The letter composer renders `letter.hbs` via `foundry.applications.handlebars.renderTemplate` (not as a PART), so multiple top-level elements in that template are also fine. Only templates registered as `static PARTS` entries need the single-root constraint.
- ❌ Don't inject UI into the Foundry sidebar/chrome chain without explicitly setting `pointer-events: auto` on your root element AND its descendants. Foundry v13 sets `pointer-events: none` on every parent in the `#interface > .ui-right > #sidebar > .sidebar-content > .chat-sidebar` chain so the canvas stays interactive in non-UI gaps; built-in UI elements re-enable on themselves. Because `pointer-events` inherits, anything you inject inherits `none` — the bar renders visibly but `elementsFromPoint()` doesn't include it and real mouse clicks pass through to the canvas. Synthetic `.click()` works (it bypasses hit-testing), which makes the bug feel like a click-handler issue when it's actually a CSS one. Worked example: `styles/components/_speaking-as.css` `.gs-speaking-as { pointer-events: auto; } .gs-speaking-as * { pointer-events: auto; }`. This applies to every B-4 app that injects into the sidebar (My Characters Dock, Cycle HUD, etc.).
- ❌ Don't inject above the chat input via `Hooks.on('renderChatLog', ...)` and `bar.querySelector('#chat-form')` in v13. The chat input is a `<chat-input>` custom element re-parented dynamically by `ChatLog#_toggleNotifications`; by the time `renderChatLog` fires it may not be a child of the rendered html, AND a subsequent re-parent strips your injected node. Use `renderChatInput` (v13.346+) instead — it fires when the input is actually mounted/in-position. Keep `renderChatLog` as a fallback that searches the whole document. Worked example: `module/hooks/speaking-as.js` `_findChatInput()` and the dual-hook `register()`. There may be more than one `<chat-input>` (main + GM popout) — pick the one inside `#chat` to avoid duplicate bars, and serialize injects through a single promise chain to prevent the race.
- ❌ Don't bind event listeners directly to elements injected into Foundry chrome that gets re-rendered. Foundry's chat sidebar (and likely other ApplicationV2 surfaces) re-renders frequently. Per-element handlers go stale and the click-target you wired vanishes. Use a single `document`-level capture-phase delegated listener that matches by class. Worked example: `_attachDelegatedListeners()` in `module/hooks/speaking-as.js`. Pair with a `MutationObserver` that re-injects the bar if a re-render strips it.
- ❌ Don't create a `JournalEntry` with `content` at the entry level — that's pre-v10 API. The entry is just a container; content lives in `pages`. Always pass `pages: [{ name, type: 'text', text: { content: html, format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML } }]`. The entry will get created either way, but the page won't, and the journal opens to an empty body. Worked example: `module/apps/monologue-editor.js` `JournalEntry.create(...)`.
- ❌ Don't ship a frameless ApplicationV2 (`window: { frame: false }`) without explicit `position: fixed` (or `absolute`) AND `z-index` AND `pointer-events: auto` in CSS. The framing logic that gets stripped by `frame: false` is also what positions the wrapper, manages its z-index, and re-enables pointer-events. Without `position: fixed`, the wrapper is `position: static` and inline `left`/`top` from `setPosition()` or `DEFAULT_OPTIONS.position` have no effect — the wrapper ends up wherever document flow puts it (often inside a flex slot in `<body>` at `x ≠ 0`). Without explicit z-index, it's at `auto` and renders behind anything with z-index > 0 (canvas overlays, player list, sidebar). Worked example + full recipe: §11 "Adding a frameless ApplicationV2 surface" and `module/apps/my-characters-dock.js` + `styles/apps/_dock.css`.
- ❌ Don't use `_onFirstRender + setPosition()` to set the default position of a frameless ApplicationV2. `setPosition` sometimes only lands a subset of keys when the wrapper is static-positioned with `height: 'auto'` (we observed `left` applying but `top` silently dropping). Put default position in `DEFAULT_OPTIONS.position` directly; merge stored overrides in the constructor. Worked example: `module/apps/my-characters-dock.js` constructor pattern.
- ❌ Don't anchor a frameless ApplicationV2 to viewport-right (`left: window.innerWidth - width`). Foundry v13's default layout puts the chat sidebar there. The surface will render *visibly correct per CSS* but be hidden behind the chat sidebar's parent stack — confusing during debug because `getBoundingClientRect()` and `getComputedStyle().visibility` both report it as visible. Anchor to the left of the canvas (e.g. `left: 70` to clear the tools panel) for v0 surfaces; detect the chat-sidebar's left edge at construction time if you need to anchor right.
- ❌ Don't use ApplicationV2 (or v1 Application) for transient overlays like tooltips, context menus, or hover cards. These surfaces have no lifecycle needs — no tab management, no re-render, no Foundry document binding. A plain `document.createElement('div')` appended to `document.body` is correct; ApplicationV2 adds framing logic, window management, and re-render overhead that are all dead weight. Wire the show/hide imperatively from delegated document listeners.
- ❌ Don't read `element.textContent` and expect it to reflect CSS `text-transform`. `textContent` returns the raw DOM text regardless of CSS. If a section header has `text-transform: uppercase` applied and the localized string is "Reputation Tags", `textContent` returns "Reputation Tags" — the tooltip title is already sentence-case with no conversion. Deriving a display title from `textContent.trim()` is always correct for this pattern.
- ❌ Don't enable `form.submitOnChange` on an ApplicationV2 sheet without auditing every native `<input>` / `<select>` / `<textarea>` against the `actor.system` field it claims to write. `submitOnChange` runs the form serializer on every change event, which means EVERY input with a `name` attribute participates in the submit — even ones whose `value` is computed from something *other* than the field they appear to bind. The classic foot-gun: a name input with `value="{{displayName}}"` and `name="name"` where `displayName` resolves to a persona's name (not `actor.name`). Each submit silently rewrites `actor.name` to the persona name. Fix: when an input's displayed value isn't the same as its bound field, either (a) strip the `name=""` attribute via `{{#unless ...}}`, or (b) bind `value` to the actual field. Both is best. Worked example: `templates/actors/major-character/header.hbs` name input gates BOTH `readonly` AND the `name` attribute on `hasActivePersona`.
- ❌ Don't gate a sheet input's read-only state on a raw id field (e.g. `activePersonaId`) when the data-model has a getter that does fallback resolution (e.g. `activePersona` falling back to the primary persona when the id is empty). The id check misses the fallback case. Compute a `hasActivePersona`-style boolean from `!!actor.system.activePersona` (the resolved getter) and pass it to the template. Worked example: `module/sheets/major-character-sheet.js` `_prepareContext` adds `hasActivePersona` to context.
- ❌ Don't use `actor.name` directly in display surfaces (sheets, dashboards, dock rows, hover cards, chat-card aliases, journal entries) when the actor has personas. The active persona's name overrides the actor's true name in displays — the actor's canonical name is editable on the sheet's name input but everywhere else, what users should see is the active persona. Always resolve `displayName = actor.system.activePersona?.name || actor.name` before rendering. `themedWrap()` handles persona-aware brand color but not display name — that's a separate resolution. Worked examples: `module/helpers/dashboard-context.js` (`displayName` computation), `module/helpers/dock-context.js` (`speakerName`), `module/sheets/major-character-sheet.js` (`displayName` in `_prepareContext`). When the editable name input on a sheet shows the resolved displayName, also add `{{#if activePersonaId}}readonly{{/if}}` so editing doesn't silently rename the actor while the persona's name keeps showing.
- ❌ Don't ship localization changes without validating `lang/en.json` first. JSON parse errors break ALL localization globally — every key renders literally (e.g. `GOODSOCIETY.dock.title` instead of "My Characters") because Foundry can't load the file at all. Common cause: unescaped double quotes inside translated strings (`"NPC "{name}" dropped"` should be `"NPC \"{name}\" dropped"`). Always run `python3 -m json.tool lang/en.json > /dev/null` before committing localization changes; consider a pre-commit git hook to enforce. **Validity is necessary but not sufficient**: a structurally valid JSON file can still silently break a feature's localization if new key blocks land at the WRONG nesting level. We hit this with `upkeepWizard` and `upkeepRoster` getting added at the top level of `en.json` instead of inside `GOODSOCIETY` — the file parsed fine, every other localization kept working, but only that feature's keys rendered as literal `GOODSOCIETY.upkeepRoster.windowTitle` strings because the lookup `GOODSOCIETY.upkeepRoster.*` didn't find anything under `GOODSOCIETY`. After validating JSON, also verify with `python3 -c "import json; d = json.load(open('lang/en.json')); print(list(d.keys()))"` — top-level keys should be exactly `['BOILERPLATE', 'GOODSOCIETY', 'TYPES']` (or whatever the registered system namespaces are). Anything else means a block landed outside its intended namespace.
- ❌ Don't compute canvas-element-relative positions from `canvas.stage.scale/position` alone for hover cards or other viewport-anchored UI. The math `placeable.x * scale + panX` gives canvas-internal coords, NOT viewport coords — when the canvas element isn't at viewport `(0, 0)` (sidebars open, DevTools docked, popouts), the conversion is incomplete and the UI lands in the wrong place. Worse, `getBoundingClientRect()` and `elementsFromPoint()` will appear to confirm the wrong location. The robust pattern: track cursor position via a global `mousemove` listener and place the UI at `ev.clientX/Y` — `clientX/Y` is already in viewport coordinates, no conversion needed. Worked example: `module/hooks/token-hover-card.js` `_positionCard` (cursor-relative placement with edge-flip logic).
- ❌ Don't ship a transient overlay (popover, hover card, dropdown menu) opened from inside an `ApplicationV2` sheet with `z-index < 500`. Active ApplicationV2 windows climb above `z-index: 100` (Foundry's window manager assigns them high stacks), so a `z-index: 100` popover renders correctly, lives in the DOM at the right viewport coords, computes `display: block; visibility: visible; opacity: 1` — and is still invisible because it's stacked **behind** the sheet that opened it. The bug looks like "click did nothing" until you probe `getBoundingClientRect()` and find the popover is right there, just buried. Established z-index precedent in this codebase: tooltips `10000` (overlays everything including modals), reveal-control popover `500` (overlays sheets), token hover card `300` (overlays canvas only), persona switcher popover `500` (overlays sheets — set after debugging this exact bug). Use `500` as the default for any new sheet-anchored overlay.
- ❌ Don't write to `actor.system.reputation.pendingChanges` from hook handlers that fire on all clients (e.g. `Hooks.on('createItem', ...)`) without a `game.user.isGM` guard. These hooks fire on every connected client simultaneously; both the GM client and the owning player's client would call `appendPendingChange`, producing duplicate entries. Single-writer pattern: guard with `if (!game.user?.isGM) return;` inside `appendPendingChange` so only the GM client writes — same pattern as `appendSessionEvent`. Players who need to write pendingChanges do so via wizard actions that run exclusively on the GM client. Worked example: `module/helpers/pending-changes.js`.
