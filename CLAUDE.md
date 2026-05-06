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
3. Check the "Build phase status" section (§13) for current scope.
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
chatStyle:
  color: string                      // hex
  font: string                       // CSS font-family
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
personas: array<Persona>             // optional; same shape as Major's
activePersonaId: string
ownership:
  defaultLevel: "OBSERVER"           // shared pool default
```

### 6.3 Family (`family`)

```
familyName: string
origin: enum["heir", "new-arrival", "foreign"]
heirStatus: boolean
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
chatColor: string                    // optional override of actor's chatStyle
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
- `welcomePanelDismissed` — boolean. User scope.

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
      chatStyle: new SchemaField({
        color: new StringField({ initial: "" }),
        font: new StringField({ initial: "" }),
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

### 10.2 Sheet — tabs structure

`module/sheets/major-character-sheet.js` extends `HandlebarsApplicationMixin(ActorSheetV2)`. PARTS:

```js
static PARTS = {
  header: { template: "systems/good-society-homebrew/templates/actors/major-character/header.hbs" },
  tabs:   { template: "systems/good-society-homebrew/templates/actors/major-character/nav.hbs" },
  public: { template: "systems/good-society-homebrew/templates/actors/major-character/tab-public.hbs" },
  private:{ template: "systems/good-society-homebrew/templates/actors/major-character/tab-private.hbs" },
  tokens: { template: "systems/good-society-homebrew/templates/actors/major-character/tab-tokens.hbs" },
};
```

Action handlers map button clicks (`data-action="..."`) to instance methods. See the boilerplate's example for the wiring pattern.

### 10.3 Build order

Don't build the whole sheet at once. Build it in this order:

1. DataModel + empty sheet that opens without errors
2. Header (portrait, name, peerage, age) — confirms the actor → sheet pipe works
3. Tab nav
4. Public tab — Reputation Tags grid (read-only first, then editable)
5. Public tab — Inner Conflict checkbox grid
6. Public tab — Reputation Conditions
7. Private tab — text fields (Desire, Notes, Backstory, Adventurer Sentiment)
8. Private tab — Connections list
9. Private tab — Magic/Skills list
10. Tokens tab — resolve track, MT, monologue

Test in Foundry after each step. Each step is small enough that if it breaks, you know which step.

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

### Adding a chat card

Use the period styling. All chat cards from this system go through `module/helpers/chat-cards.js`:

```js
import { postChatCard } from "../helpers/chat-cards.js";
postChatCard({
  speaker: ChatMessage.getSpeaker({ actor }),
  flavor: "Inner Monologue",
  content: `<div class="gs-chat-monologue">${monologueText}</div>`,
  persona,  // optional; sets portrait + name
});
```

### Switching a persona (the trickiest pattern)

```js
async function switchPersona(actor, newPersonaId) {
  const persona = actor.system.personas.find(p => p.id === newPersonaId);
  if (!persona) return;

  // 1. Update the actor's active persona
  await actor.update({
    "system.activePersonaId": newPersonaId,
    "prototypeToken.texture.src": persona.tokenImageUrl,
    "prototypeToken.name": persona.tokenName,
    "img": persona.portraitUrl,
  });

  // 2. Update every placed token of this actor across all scenes
  for (const scene of game.scenes) {
    const tokens = scene.tokens.filter(t => t.actorId === actor.id);
    if (tokens.length === 0) continue;
    await scene.updateEmbeddedDocuments("Token", tokens.map(t => ({
      _id: t.id,
      "texture.src": persona.tokenImageUrl,
      name: persona.tokenName,
    })));
  }

  // 3. Optional VFX
  if (game.modules.get("sequencer")?.active) {
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

## 12. Reference systems and resources

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

## 13. Build phase status

**Currently in:** Phase 0 — Scaffolding (almost done)

**Done:**
- Forked Asacolips' Boilerplate
- Renamed system identity (system.json, package.json, README)
- Symlinked into Foundry data folder
- Verified loads in v13 with no console errors

**Next:**
- Rename boilerplate's internal Actor type to `major-character`
- Begin Phase 1 (DataModel batch — see §17.3 of PLAN.md)

---

## 14. Open decisions / running log

Record decisions made *during* the build here so future sessions don't re-litigate them.

- (none yet — add as you go)

---

## 15. Anti-patterns — don't do these

- ❌ Don't mutate `actor.system.x = y` directly. Always `await actor.update(...)`.
- ❌ Don't use `Application` (v1) — only `ApplicationV2`.
- ❌ Don't hardcode user-facing strings. Localize everything.
- ❌ Don't reach into `game.actors.contents` for filtered queries when `game.actors.filter(...)` works just as well and is clearer.
- ❌ Don't write tests against Foundry internals. Test pure helpers in `module/helpers/` only; integration testing happens in-world.
- ❌ Don't store derived state. Compute it in the data model's `prepareDerivedData()` or in a sheet's `_prepareContext()`.
- ❌ Don't add modules as hard dependencies. Sequencer + JB2A are *recommended*; the system must degrade gracefully if they're missing.
