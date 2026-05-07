# 29 — Reputation Batch

**Status:** Drafted, ready for Claude Code implementation
**Date opened:** 2026-05-07
**Covers:** Plan §12 reputation surfaces. Spans four locked decisions made together because they share the same data layer (`actor.system.reputation`) and the same gameplay phase (Reputation phase + the cycle leading up to it).

## Why one doc

The four sub-features below were originally going to be separate, but they all hinge on a single missing pipeline: nothing currently writes to `actor.system.reputation.pendingChanges`. The data model has the field, the Upkeep wizard reads it, the Pending Changes Log spec (`docs/design/26-pending-changes-log.md`) renders it on the Major sheet — but no code populates it. That gap is also the reason the Upkeep wizard's Reputation Review step is always empty: it's reading a field nobody has filled.

Fixing the writer pipeline cleanly unlocks all four:

1. **pendingChanges writer pipeline** — the missing data layer.
2. **Reputation Phase Wizard** — a GM-driven shared modal that walks the table through the rulebook's four-step Reputation phase (assess → create tags → trigger condition → clear condition).
3. **Dashboard tags + conditions** — surface tags + active conditions on each Major row of the Public Info Dashboard.
4. **Actions You Can Take modal** — a player-reference cheat sheet for resolve-token spend rules and tag-trade rules, sourced from the rulebook.

## Rulebook anchors

All four sub-features have direct rulebook citations. Anyone implementing or revising them should re-check these passages first.

| Topic | Rulebook section |
|---|---|
| Reputation overview (criteria, tags, conditions) | pp. 89–91 |
| Reputation tags — creation, trade, erasure | pp. 92–94 |
| Reputation conditions — trigger, clear, conflict with tokens | pp. 95–97 |
| Reputation phase steps (1–4) | p. 125 |
| Resolve tokens — when required | pp. 69–80 |
| Token negotiations | pp. 82–88 |
| Cycle of play overview (where Reputation sits) | pp. 111–112 |

Quoting only what implementation needs:

- **Reputation tags are public.** "When you create a reputation tag, write it on the public information sheet" (p. 92). Tags are inherently public information; no per-tag visibility flag.
- **Tag → token trade.** "To use a reputation tag to affect the story, you must first explain what change you want that tag to create in the narrative. Then, trade that tag for a resolve token, and spend it … once the resolve token has been successfully spent, erase the tag" (pp. 92–93).
- **Negative tags can be used against the bearer by anyone.** "Any player can use a negative reputation tag against the major character that bears it. Where a negative reputation tag is used by the player of the major character it belongs to, it must be used against the interests of that character" (p. 93).
- **Erased tags don't count.** "Once a reputation tag has been successfully used to affect the story, it is erased. Erased tags no longer count towards reputation conditions" (p. 93).
- **Condition trigger.** "A reputation condition will immediately trigger when a major character accumulates three or more reputation tags of the same type" (p. 95).
- **Condition clear.** "Reputation conditions remain in effect until a character drops below three tags of the relevant tag type. If a character drops below three tags, their reputation condition clears in the next reputation phase" (p. 95).
- **Reputation Phase steps.** Four steps (p. 125): assess against criteria → create tags → trigger conditions → remove conditions. Driven by the Facilitator going round the table.

## Gap audit

| What's there | What's missing |
|---|---|
| `actor.system.reputation.pendingChanges` field schema | Nothing writes to it |
| `module/hooks/session-events.js` writes tag/condition events to world-scoped session log | Same hook never appends to per-actor `pendingChanges` |
| `module/apps/upkeep-wizard.js` step 5 reads `pendingChanges` | Field is empty so step always shows "no changes" |
| `module/apps/condition-picker.js` fires when count hits 3 (mid-cycle, on createItem) | No phase-aware path: the rulebook says condition triggers happen *during the reputation phase*, not the moment a third tag lands |
| `pickerResolved.${polarity}` flag prevents re-prompting | Flag never clears, so once dismissed, it never re-fires even after counts drop and rise again |
| `templates/components/dashboard-major-row.hbs` has resolve / MT / monologue / desire | No tag chips, no condition badges |
| Reputation Phase has no surface — Cycle HUD shows the phase, but no wizard / handoff | Players have to fall back to manually creating items; no facilitator workflow |
| `docs/design/18-condition-picker.md` documents the inline-on-create path | Reputation-phase-driven path not covered |

## 1. pendingChanges writer pipeline

The data field already exists with this shape (`module/data-models/major-character.js` line 44):

```js
pendingChanges: new ArrayField(new SchemaField({
  kind:  new StringField(),       // 'gained-positive' | 'gained-negative' | 'removed'
  value: new StringField(),       // tag name
  scene: new StringField(),       // human-readable context, e.g. "Cycle 5 · Novel"
  ts:    new NumberField({ integer: true }),
})),
```

### Writer

Add `module/helpers/pending-changes.js`:

```js
export async function appendPendingChange(actor, kind, tagName, sceneLabel) {
  if (actor.type !== 'major-character') return;
  if (!game.user?.isGM && !actor.isOwner) return;  // any owner or GM can append
  const current = actor.system.reputation?.pendingChanges ?? [];
  await actor.update({
    'system.reputation.pendingChanges': [
      ...current,
      { kind, value: tagName, scene: sceneLabel, ts: Date.now() },
    ],
  });
}

export async function clearPendingChanges(actor) {
  if (actor.type !== 'major-character') return;
  await actor.update({ 'system.reputation.pendingChanges': [] });
}

export function buildSceneLabel() {
  // "Cycle 5 · Novel" — uses world settings; falls back to "—" on failure.
  try {
    const cycle = game.settings.get('good-society-homebrew', 'cycleNumber');
    const phase = game.settings.get('good-society-homebrew', 'cyclePhase');
    const phaseLabel = game.i18n.localize(`GOODSOCIETY.cyclePhase.${_camelPhase(phase)}`);
    return `${game.i18n.localize('GOODSOCIETY.cycle.label')} ${cycle} · ${phaseLabel}`;
  } catch { return '—'; }
}
```

### Wire to existing hooks

Modify `module/hooks/session-events.js` — the existing `createItem` / `deleteItem` handlers already detect tag adds/removes on Majors. Add `appendPendingChange` calls there. Code change is small (~6 lines added per hook).

```js
// in createItem handler, after the appendSessionEvent call for tags:
if (item.type === 'reputation-tag') {
  const polarity = item.system?.polarity ?? 'positive';
  await appendPendingChange(
    item.parent,
    polarity === 'positive' ? 'gained-positive' : 'gained-negative',
    item.name,
    buildSceneLabel(),
  );
}

// in deleteItem handler, after appendSessionEvent for tag removals:
if (item.type === 'reputation-tag') {
  await appendPendingChange(item.parent, 'removed', item.name, buildSceneLabel());
}
```

### Clear path

Two clear points:
- **Reputation Phase Wizard** (§2 below) clears via the standard step 5 flow it already uses.
- **Upkeep Wizard step 5** already calls `actor.update({ 'system.reputation.pendingChanges': [] })` — keep as-is.

Switch both to the new `clearPendingChanges()` helper for consistency.

### `pickerResolved.${polarity}` flag — clear path

Add a clear pass to the Reputation Phase Wizard's "remove condition" step (step 4). When the wizard clears a condition because the count dropped below 3, also clear the matching resolved flag so the picker can re-fire on a future threshold.

```js
await actor.unsetFlag('good-society-homebrew', `pickerResolved.${polarity}`);
```

## 2. Reputation Phase Wizard (GM-driven shared)

### Trigger

Same shape as Upkeep:
- `module/good-society.js` `cyclePhase.onChange` fires `goodSociety.cyclePhaseChanged`
- new `module/hooks/reputation-phase.js` listens for `newPhase === 'reputation'`
- GM only: opens the wizard
- Players: see a "Reputation phase started — your facilitator will lead" toast (no separate wizard for them; they interact via their own Major sheet which the GM walks through round-robin)

### Window

Framed ApplicationV2, single shared instance (`gs-reputation-phase-wizard`). Width 720. Wider than Upkeep (580) because the round-robin character-list left rail needs space alongside the active-character review pane.

```
┌──────────────────────────────────────────────────────────────────┐
│ Cycle 5 · Reputation Phase                       Step 2 of 4      │
│                                                                    │
│  CHARACTERS              STEP 2 — CREATE TAGS                      │
│  ▸ Avril   ⏳            Avril                                     │
│  ◯ Fin                   How does society see her after this       │
│  ◯ MC                    chapter?                                  │
│  ◯ MC3                                                             │
│  ◯ MC5                   Has Avril met any criteria?               │
│                          ☐ Negative — contravened convention…      │
│                          ☐ Negative — desire vs duty/morality…     │
│                          ☐ Negative — family criteria              │
│                          ☐ Positive — duty vs desire…              │
│                          ☐ Positive — convention despite hardship  │
│                          ☐ Positive — family criteria              │
│                                                                    │
│                          New positive tag                          │
│                          [ ▲ Selfless                       ] [+]  │
│                          New negative tag                          │
│                          [ ▼ —                              ] [+]  │
│                                                                    │
│                          Avril's tags now:                         │
│                          ▲ Helpful  ▲ Selfless  ▼ Hostile          │
│                                                                    │
│  [Back]               [Skip Avril]   [Done with Avril → Fin]      │
└──────────────────────────────────────────────────────────────────┘
```

### Steps

Per rulebook p. 125. Four steps, presented as Upkeep-style ribbon.

1. **Welcome / Roster.** GM-only. Lists every Major + a checkbox for "active in this cycle." (Off-screen majors don't go through the wizard.) Single-card summary of what step 2–4 will do.
2. **Create tags.** Per-character round-robin. For each active Major: GM clicks the character in the left rail, sees the character's reputation criteria laid out (positive ▲ on top, negative ▼ on bottom), and helps the player decide. Tag creation happens inline — no standalone Reputation Tag item-create dialog. The player or GM types the tag name, picks polarity, hits +. The new tag is created as an embedded item on the Major (existing `createItem` hook fires → `pendingChanges` writer logs `gained-positive` / `gained-negative` automatically). Move to next character with "Done with X → Y" button.
3. **Trigger conditions.** Per-character. The wizard scans every Major for `tagCount(polarity) >= 3 && !hasActiveCondition(polarity)`. For each match, opens the existing `ConditionPicker` modal with the trigger tags pre-bundled. The wizard pauses; resumes when the picker closes (re-uses the existing Promise pattern from `openUpkeepWizard`). The "Later" / "No condition" dismissals from the picker still apply — wizard moves on either way.
4. **Clear conditions.** Per-character. For every active reputation condition where current `tagCount(polarity) < 3`: the wizard offers a "Clear condition" button + an optional "Frame a short scene" prompt (rulebook p. 96 — optional). On clear: deletes the embedded `reputation-condition` item, clears the `pickerResolved.${polarity}` flag (so future thresholds can re-fire the picker), posts a system chat card.
5. **Complete.** Summary. Posts a "Reputation phase complete — N tags created, N conditions triggered, N conditions cleared" system card. Closes wizard. Does NOT auto-advance phase — GM advances manually via the existing Cycle HUD button.

### Round-robin pacing

The left rail is the round-robin spine. Click a character to focus the right pane on them. Two affordances:

- **Status icons** next to each character: ⏳ in-progress (this is the current focus), ✓ done (player and GM agreed they're complete for the current step), ◯ pending.
- **Tab order constraint** matches the active step. In step 2 (create tags), all characters are visited; in step 3, only those with `tagCount >= 3` for some polarity; in step 4, only those with active conditions and `tagCount < 3`. The wizard skips characters that don't qualify for the current step automatically.

### Files

New:
- `module/apps/reputation-phase-wizard.js` (~350 lines)
- `module/hooks/reputation-phase.js` (~30 lines)
- `templates/apps/reputation-phase-wizard.hbs` (~250 lines)
- `styles/apps/_reputation-phase-wizard.css` (~200 lines)

Modified:
- `module/good-society.js` — add `cyclePhase.onChange` branch for `newPhase === 'reputation'`
- `lang/en.json` — add `GOODSOCIETY.reputationPhaseWizard.*` keys (mirror the Upkeep wizard's structure)
- `module/settings.js` — add `reputationPhaseWizardEnabled` (client setting, default true, mirrors `upkeepWizardEnabled`)

### Integration with existing condition picker

The picker (`module/apps/condition-picker.js`) currently fires inline whenever a Major's tag count hits exactly 3 — that's the existing `checkThresholdAndPrompt(actor, polarity)` path called from `Hooks.on('createItem')`. **Keep it.** Players can still get the picker mid-cycle if a tag pushes them over. The Reputation Phase Wizard's step 3 only catches *missed* triggers (player dismissed the inline picker, or accumulated tags via some path that didn't fire it).

The picker's `pickerResolved` flag (per-actor + per-polarity) coordinates the two paths: if the player resolved it inline, the wizard skips them; if the player dismissed inline, the wizard re-prompts at the canonical phase moment.

## 3. Public Info Dashboard tags + conditions

### Decision: always public

Tags and active conditions are surfaced on every Major's row, no visibility flag. Aligns with the rulebook treating tags as public information sheet content. (Compare: `desire` keeps its existing `secret | public | redacted` visibility, since desire is genuinely meant to vary.)

### Row layout update

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ⬤ Avril   Heir   ●●●○○ MT ⬤   ▲▲▲ Selfless Helpful Brave   ◆ Toast    │
│           "I will marry for love..."  ▼ Hostile  Black Sheep            │
└─────────────────────────────────────────────────────────────────────────┘
```

Two new sub-rows under name + portrait + resolve/MT/monologue/desire:
- **Tag chips row.** ▲ chips (positive) on top, ▼ chips (negative) below. Each chip shows the tag name in small caps with a polarity arrow prefix. Click a chip → opens the Major's sheet scrolled to that tag (or a future trade-for-token shortcut — out of scope for this batch). Empty state: collapsed (row doesn't render).
- **Condition badges row.** Inline with the tag chips, slotted right of them when there's room. Active positive conditions render with a gold ◆ glyph, active negative with a charcoal ◆. Condition badge text is the condition's `name` field. Empty state: collapsed.

### Context builder additions

Modify `module/helpers/dashboard-context.js` `_buildRowData(actor)`:

```js
const tags = actor.items?.filter(i => i.type === 'reputation-tag') ?? [];
const positiveTags = tags.filter(t => t.system?.polarity === 'positive')
  .map(t => ({ id: t.id, name: t.name }));
const negativeTags = tags.filter(t => t.system?.polarity === 'negative')
  .map(t => ({ id: t.id, name: t.name }));

const conditions = actor.items?.filter(
  i => i.type === 'reputation-condition' && i.system?.active,
) ?? [];
const positiveConditions = conditions.filter(c => c.system?.polarity === 'positive')
  .map(c => ({ id: c.id, name: c.name }));
const negativeConditions = conditions.filter(c => c.system?.polarity === 'negative')
  .map(c => ({ id: c.id, name: c.name }));

// Append to returned row:
return {
  ...existing,
  positiveTags, negativeTags,
  positiveConditions, negativeConditions,
  hasReputation: tags.length > 0 || conditions.length > 0,
};
```

### Template + CSS

Modify `templates/components/dashboard-major-row.hbs` to render the two new sub-rows under the existing main row (only when `hasReputation`). Add CSS classes `.gs-dashboard__row-tags`, `.gs-dashboard__row-tag-chip` (variants `--positive` `--negative`), `.gs-dashboard__row-condition` (variants `--positive` `--negative`). Tag chip border colors use the row's themed `--gs-brand` so each character's chips stay visually attached to them.

Refresh trigger: the existing `Hooks.on('updateActor')` / `createItem` / `deleteItem` chain in `good-society.js` already calls `getDashboard()?.refreshAndReset()`. Verify item events bubble to `updateActor` (they should, via Foundry's standard embedded-doc path); if not, add explicit `createItem` / `deleteItem` hooks for `reputation-tag` and `reputation-condition` types to call `refreshAndReset`.

## 4. Actions You Can Take modal

### Decision: dual mount

A small `?` button on (a) the Major sheet's persistent strip and (b) the speaking-as bar above the chat input. Both open the same modal. Reachable from "I'm planning my move" (sheet) and "I'm at the table playing" (chat) contexts.

### Window

Framed ApplicationV2, singleton (`gs-actions-cheat-sheet`). Width 540. Height auto. House-styled (no theme — this is a reference document, not character-bound).

### Content

The content is **rulebook-derived reference text**. Sections, in order, with bullet phrasing pulled from the rulebook (cite page numbers in the body so players can look up the canon).

#### Section 1 — Trade a reputation tag

> **Trade a reputation tag for a resolve token.** First explain what change you want that tag to create. Then trade the tag for a token, spend it for the desired effect (entering negotiation if needed), and erase the tag. *Rulebook p. 92.*
>
> Positive tags: only the bearer can use them.
> Negative tags: any player can use them against the bearer. The bearer themselves can use one — but only against their own character's interests. *p. 93.*

#### Section 2 — When you must spend a resolve token

Bullet list, mirroring p. 72:

> **Spend a resolve token when you want to:**
> - Have your major character or connection do or know something difficult or unlikely (significant to the story). *p. 73, 80.*
> - Have a connection you control do something harmful to a major character or connection's interests. *p. 74.*
> - Create, contribute to, or change narrative events beyond your character's actions (significant to the story). *p. 75.*
> - Compel a major character or connection to do or feel something. *p. 76.*

> **You don't need a token for** minor narrative details, your character's normal actions, anything that would reasonably belong to them, or scene flavor without story consequence. *p. 77.*

#### Section 3 — Resolve token negotiation

Three-line summary referencing pp. 82–84:

> **When the negotiation process triggers:** compel a character; harm a character's interests; interfere with a positive reputation condition.
> The affected player can **accept**, **accept with conditions** ("yes, but only if…"), or **refuse**.
> Refused tokens stay with the offering player.

#### Section 4 — Earning resolve tokens this cycle

> **Ways to earn resolve tokens during a cycle:**
> - Accept a token offered to you in negotiation. *p. 83.*
> - Mark off boxes on your inner conflict at upkeep — one token per box, max two per cycle. *p. 100.*
> - Spread a rumour during the rumour & scandal phase — the rumour carries a token until used. *p. 127.*
> - Refresh to default at upkeep (or to default + 1 in short games). *p. 133.*

#### Section 5 — Reputation conditions quick-ref

> **Reputation conditions** trigger when you reach 3+ tags of the same polarity (positive or negative). Choose one of the two conditions on your character role sheet. They clear at the next reputation phase if your tag count drops below 3. Erased tags don't count. *pp. 95–96.*
>
> You can never use a resolve token to cancel out your **own** reputation condition. *p. 97.*

#### Section 6 — Inner monologue

> **Spend your monologue token** to deliver your character's inner monologue, or trigger another player's. Monologues do not require negotiation. Refresh at upkeep. *pp. 103–104.*

### Layout

Two-column layout:
- Left: section table-of-contents (clickable jump links).
- Right: scrollable section bodies.

Style as a printed gameplay aid, not a UI panel. Crimson Text body, Lora display headings, sentence-case prose, restrained ornament. Page-reference inline tags in small caps + accent-3 (gold).

### Files

New:
- `module/apps/actions-cheat-sheet.js` (~120 lines — small because it's mostly static content)
- `templates/apps/actions-cheat-sheet.hbs` (~180 lines)
- `styles/apps/_actions-cheat-sheet.css` (~120 lines)

Modified:
- `templates/actors/major-character/strip-tokens.hbs` — add `?` button at the right edge of the persistent strip; wires to `data-action="openActionsCheatSheet"` on the Major sheet
- `module/sheets/major-character-sheet.js` — add the action handler
- `styles/components/_speaking-as.css` — add a `.gs-speaking-as__help-pill` button styling
- `module/hooks/speaking-as.js` — inject the `?` button into the speaking-as bar; opens the cheat sheet on click (use the existing delegated-listener pattern; **do NOT** wire a per-element handler — anti-pattern §16)
- `lang/en.json` — `GOODSOCIETY.actionsCheatSheet.*` content keys

### Mount UX detail

The chat-input mount is the higher-traffic of the two. Place the `?` to the *right* of the speaking-as pill, not inside the popover. It should be visible at all times during play, not buried behind a toggle. Per CLAUDE.md §16 anti-patterns: any new injected sidebar element must explicitly set `pointer-events: auto` on itself + descendants.

## 5. Files-to-touch summary

| Phase | File | Action |
|---|---|---|
| 1 — pendingChanges writer | `module/helpers/pending-changes.js` | NEW |
| 1 | `module/hooks/session-events.js` | MODIFY (add appendPendingChange calls) |
| 1 | `module/apps/upkeep-wizard.js` | MODIFY (use clearPendingChanges helper) |
| 2 — Reputation Phase Wizard | `module/apps/reputation-phase-wizard.js` | NEW |
| 2 | `module/hooks/reputation-phase.js` | NEW |
| 2 | `templates/apps/reputation-phase-wizard.hbs` | NEW |
| 2 | `styles/apps/_reputation-phase-wizard.css` | NEW |
| 2 | `styles/good-society.css` | MODIFY (@import the new CSS) |
| 2 | `module/good-society.js` | MODIFY (cyclePhase.onChange branch) |
| 2 | `module/settings.js` | MODIFY (add reputationPhaseWizardEnabled) |
| 2 | `module/apps/condition-picker.js` | MODIFY (clear pickerResolved on condition removal) |
| 3 — Dashboard tags | `module/helpers/dashboard-context.js` | MODIFY |
| 3 | `templates/components/dashboard-major-row.hbs` | MODIFY |
| 3 | `styles/apps/_dashboard.css` | MODIFY |
| 3 | `module/good-society.js` | VERIFY (createItem/deleteItem on rep items refreshes dashboard) |
| 4 — Actions modal | `module/apps/actions-cheat-sheet.js` | NEW |
| 4 | `templates/apps/actions-cheat-sheet.hbs` | NEW |
| 4 | `styles/apps/_actions-cheat-sheet.css` | NEW |
| 4 | `templates/actors/major-character/strip-tokens.hbs` | MODIFY |
| 4 | `module/sheets/major-character-sheet.js` | MODIFY |
| 4 | `module/hooks/speaking-as.js` | MODIFY |
| 4 | `styles/components/_speaking-as.css` | MODIFY |
| All | `lang/en.json` | MODIFY (substantial localization additions) |
| All | `CLAUDE.md` §14 | MODIFY (mark batch in B-6 / new B-6b session) |
| All | `CLAUDE.md` §15 | MODIFY (running log entries per decision) |

## 6. Implementation order

Phase 1 first — every other phase depends on or benefits from `pendingChanges` writing properly. Phases 2–4 can be done in any order after that. Estimated effort:

1. **pendingChanges writer pipeline** — 1 hour. Tight scope, single helper file + small hook edits.
2. **Reputation Phase Wizard** — 4–6 hours. Largest piece. Bulk of the new code.
3. **Dashboard tags + conditions** — 2 hours. Mostly template + CSS work; context builder additions are mechanical.
4. **Actions You Can Take modal** — 2–3 hours. Static content, but two mount points to wire and the chat-input one needs the same anti-pattern care as the speaking-as bar (delegated listeners, pointer-events explicit).

Suggested commits (atomic, mirroring repo convention):

```
B-6b/1: pendingChanges writer pipeline + clearer helper
B-6b/2: Reputation Phase Wizard — core wizard, hooks, templates
B-6b/3: Reputation Phase Wizard — wire condition picker handoff + clear flag
B-6b/4: Dashboard — tag chips + condition badges on Major rows
B-6b/5: Actions You Can Take cheat sheet — sheet mount
B-6b/6: Actions You Can Take cheat sheet — chat-input mount
```

## 7. Out of scope (deliberate cuts)

- **Trade-tag-for-token shortcut button.** Tag chips on the dashboard could be click-to-trade, but the trade flow itself involves the negotiation process (pp. 82–88) and is more elaborate than a shortcut. Keep tag interaction on the Major sheet for v1; revisit when the negotiation flow gets a dedicated UI (not yet planned).
- **Per-tag visibility flags.** The rulebook treats tags as public; we honor that. If a future homebrew variant needs hidden tags, that's a separate proposal.
- **Reputation criteria authoring UI.** The four standard + two unique-from-Family criteria already render on the Major sheet's Public tab and the Family sheet. The wizard step 2 surfaces them read-only. Authoring stays where it is.
- **Auto-advance from Reputation Phase to Rumour & Scandal.** The wizard ends with a system card; advancing the cycle phase remains manual via the Cycle HUD. Same pattern as Upkeep.
- **Negotiation process UI.** Negotiation is currently table-talk + discord; building a UI for it is a separate piece (would belong in a hypothetical doc 30 — Token Negotiation flow). The Actions modal documents the rules; it doesn't automate them.

## 8. Anti-pattern reminders

When implementing, the following items in CLAUDE.md §16 are at high risk of reoccurring in this batch:

- **Pointer-events on injected chat-input UI** (the actions `?` button next to speaking-as). Already a known issue.
- **Single-root PART templates.** All three new HBS files (`reputation-phase-wizard.hbs`, `actions-cheat-sheet.hbs`, plus the modified `dashboard-major-row.hbs` if it renders new conditional sub-rows) need exactly one root element.
- **Z-index for sheet-anchored overlays.** The cheat-sheet button on the Major sheet opens a separate window — that's fine (framed ApplicationV2). But if any quick-trade popovers are added later, they need `z-index >= 500`.
- **JSON nesting in `lang/en.json`.** New top-level blocks (`reputationPhaseWizard`, `actionsCheatSheet`, `pendingChanges`) must land inside `GOODSOCIETY`, not at the root. Verify with `python3 -c "import json; print(list(json.load(open('lang/en.json')).keys()))"` after each edit — top-level keys should stay `['BOILERPLATE', 'GOODSOCIETY', 'TYPES']`.
- **chat-card flags.** The Reputation Phase Wizard posts several system cards (tag created, condition triggered, condition cleared, phase complete). All MUST go through `postSystemCard` from `module/helpers/chat-cards.js`, which sets `cardType` flag — otherwise the speaking-as `preCreateChatMessage` hook clobbers the speaker.
- **`form.submitOnChange` audit.** If any new sheet inputs are added (tag-name input on the wizard step 2), confirm their `name=""` attributes correctly target the field they display.

## 9. Open questions for follow-up

1. Should the Reputation Phase Wizard show **completed** (erased) tags from this cycle in step 1's roster summary? The rulebook is silent — they're erased, but the player may want to see "you used your Selfless and Helpful tags this cycle" as context. Suggest: yes, in a small "this cycle's traded tags" footnote per character. Decide during build.
2. Condition trigger in step 3: when more than one polarity hits 3+ at once (rare but possible — character gained 3 positive + 3 negative in one phase), should the wizard fire the picker twice serially? Suggest: yes, positive first then negative, same actor.
3. Tag chip click action on the dashboard: leave as a no-op for v1 (just visual)? Or open the Major sheet scrolled to the tag? Suggest: open the sheet (matches the row's existing click-to-open behavior); the tag chip shouldn't have its own action that competes with the row click.

---

**To hand off to Claude Code:** point at this doc, point at CLAUDE.md §16 (anti-patterns) and §11 (recipes for adding apps/hooks/settings), and ask it to implement Phase 1 first as a stand-alone commit. Phases 2–4 can each be their own commit batch. Verify after each phase.
