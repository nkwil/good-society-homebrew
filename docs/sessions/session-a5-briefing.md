# Session A.5 — Theme Field Backfill

**Goal:** add a `theme` enum field to Major, Connection, and NPC DataModels; remove `chatStyle: { color, font }` storage from Major (it's derived from theme at render). 30 minutes. Run *after* the design-integration-patch has been applied to PLAN.md and CLAUDE.md, *before* Session B-0.

## Why this exists

Session A's schemas pre-dated the locked theme registry. The decisions doc (`docs/design/decisions.md`) requires:

- Each themed actor carries a `theme` enum field with a value from the registry.
- Chat styling (`chatStyle.color`, `chatStyle.font`) is derived from the active theme at render time, not stored on the actor.
- Persona's `chatColor` remains as an override of the character theme's brand color for individual personas.

This is a small, surgical schema diff. It must land before any CSS work because the `.gs-actor[data-theme="..."]` selector reads the value from `actor.system.theme`.

## Build steps

### 1. Update `module/data-models/major-character.js`

Remove the `chatStyle` SchemaField block. Add a `theme` field:

```js
theme: new StringField({
  required: true,
  choices: ["rose", "roger", "mags", "avril", "dixon", "clayton"],
  initial: "clayton",
}),
```

Place it between the `bio` field and `personas`. The `clayton` initial is intentional — closest preset to house style, safest default for a new Major.

### 2. Update `module/data-models/connection.js`

Add a `theme` field:

```js
theme: new StringField({
  required: true,
  choices: ["connection-green", "connection-purple", "connection-blue", "connection-yellow", "connection-grey"],
  initial: "connection-green",
}),
```

### 3. Update `module/data-models/npc.js`

Add a `theme` field. Single choice — NPCs inherit house style:

```js
theme: new StringField({
  required: true,
  choices: ["npc"],
  initial: "npc",
}),
```

This locks the schema even though there's only one option. Future-proof against ever wanting a `villager`-vs-`courtier` split.

### 4. Update CLAUDE.md §6.1 / §6.2 / §6.4

The design-integration-patch has the exact text. If you ran the patch already, skip this — it's done.

### 5. Update `lang/en.json`

Add localization keys for theme labels:

```json
{
  "GOODSOCIETY.theme.rose": "Rose",
  "GOODSOCIETY.theme.roger": "Roger",
  "GOODSOCIETY.theme.mags": "Mags",
  "GOODSOCIETY.theme.avril": "Avril",
  "GOODSOCIETY.theme.dixon": "Dixon",
  "GOODSOCIETY.theme.clayton": "Clayton",
  "GOODSOCIETY.theme.connection-green": "Connection — Green",
  "GOODSOCIETY.theme.connection-purple": "Connection — Purple",
  "GOODSOCIETY.theme.connection-blue": "Connection — Blue",
  "GOODSOCIETY.theme.connection-yellow": "Connection — Yellow",
  "GOODSOCIETY.theme.connection-grey": "Connection — Grey",
  "GOODSOCIETY.theme.npc": "NPC"
}
```

These are placeholder labels — the design track may rename presets later (e.g. when Pearlinda gets a theme). Localization keys are stable; display labels can change.

### 6. Optional: data migration for existing test actors

If you already created test actors in Session A's verification step, they won't have a `theme` field. Foundry's DataModel will populate it with the `initial` value on next load — but if you want to confirm:

In F12 console with the world open:

```js
game.actors.contents.forEach(a => console.log(a.name, a.type, a.system.theme));
```

Every Major should show `clayton`. Every Connection should show `connection-green`. Every NPC should show `npc`. If any are `undefined`, run:

```js
game.actors.contents.forEach(a => {
  if (a.system.theme === undefined) {
    a.update({ "system.theme": a.type === "major-character" ? "clayton"
                              : a.type === "connection" ? "connection-green"
                              : "npc" });
  }
});
```

## Starting prompt for Claude Code

> Phase 1.5, Session A.5 — Theme field backfill. Read `session-a5-briefing.md` end-to-end. The design integration patch should already have been applied to `PLAN.md` and `CLAUDE.md`. Confirm by checking that CLAUDE.md §6.1 references the `theme` enum and no longer stores `chatStyle` on the Major.
>
> Apply the schema changes in steps 1–3 and the localization updates in step 5. Show me a diff for each file changed. Don't run any verification yet — I'll do that in Foundry.

## End-of-session verification

1. Restart the Foundry world. Console (F12) → no red errors.
2. Open one of each: Major Character, Connection, NPC. Each should open without error.
3. F12 console: `game.actors.contents[0].system.theme` → should print a valid registry id, not `undefined`.
4. F12 console: `game.actors.contents.find(a => a.type === "major-character").system.chatStyle` → should print `undefined` (the field is removed). If it prints an object, the schema change didn't apply — restart Foundry.
5. Try to set an invalid theme via console: `await actor.update({ "system.theme": "fake-theme" })` → should throw a validation error. This confirms `choices` is enforced.

## Update CLAUDE.md §13 after the session

```markdown
**Currently in:** Phase 1b — CSS architecture (next: Session B-0)

**Done:**
- Phase 0: fork, rename, verify load
- Session A: all 10 DataModels defined and registered
- Session A.5: theme field backfilled on Major/Connection/NPC; chatStyle removed from Major

**Next:**
- Session B-0 — CSS architecture (variables, fonts, card primitive, .gs-themed wrapper, clayton preset)
- Session B-1 — sheet templates batch
- Session B-2 — remaining eleven theme presets
```

Commit and push. Move on to Session B-0.
