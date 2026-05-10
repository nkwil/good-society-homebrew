# Patch: dossier refactor

> **Status:** drafting. The largest piece of the patch — the Major Character sheet rebuilds visually from a tabbed Foundry sheet into a leather-bound multi-spread book, while preserving every piece of the working sheet underneath.
>
> **Companion docs:** [`post-mvp-design-patch.md`](./post-mvp-design-patch.md) §4 (the spec), [`patch-preview-post-mvp.html`](./patch-preview-post-mvp.html) §iii (the visual reference), [`patch-integration-checklist.md`](./patch-integration-checklist.md) (shared rules).
>
> **Repo target:** `module/sheets/major-character-sheet.js` + `templates/actors/major-character/*.hbs` + `styles/sheets/_major-character.css`.

---

## 1. Goals

1. **Wrap the existing tabbed sheet in a leather-book shell** without breaking any of the wiring underneath: drag-drop of items, TextEditor enrichment, embedded item create/delete, `submitOnChange` form handling, action handlers (`data-action="..."`), persona swap pipeline, all Phase B-1 through B-5 behaviour.
2. **Replace "tabs" with "spreads"** as the navigation primitive. The sheet still has Public, Private, and Tokens content; they just live as different spreads of the book. Tabs nav element gets replaced by a click-delegated `data-goto` system.
3. **Add multi-spread navigation:**
   - Click a connection chip on the private spread → flip to that connection's public-info spread.
   - Click "continue reading" on the backstory teaser → flip to the dedicated backstory spread; supports multi-page.
   - "Back to dossier" buttons return.
4. **Apply the patch's visual language:** Inkwell & Wildflower house style as default, `data-theme="..."` cascade for per-actor palette swap, on-page tokens (under inner conflict), persona + theme switchers in the cameo header, Lavishly Yours name initial, hairline-pill reputation tags, dashboard-style container language.
5. **Preserve everything.** Schema is unchanged. ApplicationV2 base class unchanged. Hooks unchanged. Helpers unchanged. The refactor is structural and visual; behavior is preserved or expanded.

---

## 2. What stays the same

These are explicitly preserved. Don't refactor them as part of this work.

- **Schema** — `module/data-models/major-character.js` is unchanged. All existing fields (`bio`, `personas`, `desire`, `notesObjectives`, `backstory`, `adventurerSentiment`, `tokens`, `reputation`, `innerConflictsActiveIds`, `innerConflictsCompletedIds`, `connections`, `familyId`, `visibility`, `chatStyle`, `theme`, `activePersonaId`) keep their current types and defaults.
- **Sheet class base** — `MajorCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2)` per CLAUDE.md §10.2. Don't switch to a different base.
- **`_prepareContext`** — keeps doing what it does (pulling `system`, computing `displayName` from active persona, computing `hasActivePersona` boolean per CLAUDE.md anti-patterns log §16, etc.).
- **Action handlers** — the `static DEFAULT_OPTIONS.actions` map. Existing handlers (`#toggleBox`, `#switchPersona`, `#openPersonaSwitcher`, `#takeMonologue`, etc.) keep working; new ones get added for the new buttons (`#turnPage`, `#showConnectionSpread`, `#backToDossier`).
- **Drag-drop / `_onDrop`** — existing reputation-tag drop pipeline (drop tag onto sheet → polarity routing → `checkThresholdAndPrompt`) per CLAUDE.md Session B-7 plans. Refactor preserves the drop targets at the page level, not at the spread level.
- **Form `submitOnChange`** — every input that currently writes to `actor.system.X` keeps writing to the same path. The wrapper structural change must not break form serialization (see CLAUDE.md anti-pattern: "Don't enable `form.submitOnChange` on an ApplicationV2 sheet without auditing every native input").
- **TextEditor enrichment** — desire, notes, backstory, adventurer sentiment all stay rendered through `{{editor system.X}}` Handlebars helper or equivalent. The leather-book wrapper does NOT block enrichment.
- **Embedded item lists** — magic skills, connections, etc. The wrapper is purely presentational; existing item iteration in the Handlebars templates moves verbatim into the appropriate spread.
- **Persona swap pipeline** — `module/helpers/persona-swap.js` (Option B per CLAUDE.md Session B-5a-ii decision). The dossier triggers it via the persona switcher; no changes to the helper.

---

## 3. What changes

### 3.1 Structural: tabs → spreads

The existing sheet has tabs. Per CLAUDE.md §10.2, the PARTS map is:

```js
static PARTS = {
  header: { template: "systems/.../header.hbs" },
  tabs:   { template: "systems/.../nav.hbs" },
  public: { template: "systems/.../tab-public.hbs" },
  private:{ template: "systems/.../tab-private.hbs" },
  strip:  { template: "systems/.../strip-tokens.hbs" },
};
```

The refactor replaces this with a single PART that emits the leather-book DOM, which itself contains the existing header / public / private content as spreads:

```js
static PARTS = {
  book: { template: "systems/good-society-homebrew/templates/actors/major-character/book.hbs" },
};
```

`book.hbs` is a thin shell that includes the existing header, public, private, plus the new spreads (backstory pages, connection public-info pages):

```hbs
<div class="dossier-stage" data-theme="{{system.theme}}">
  <div class="dossier-desk-bg"></div>
  <div class="dossier-desk-color"></div>
  <div class="dossier-vignette"></div>

  <div class="dossier-book" id="book-{{actor.id}}">
    <div class="dossier-pageturn dossier-pageturn--prev" aria-label="Previous"></div>
    <div class="dossier-pageturn dossier-pageturn--next" aria-label="Next"></div>

    <!-- Spread: character (default) -->
    <div class="dossier-spread is-active" data-spread="character">
      <article class="dossier-page dossier-page-left">
        {{> "systems/good-society-homebrew/templates/actors/major-character/header.hbs"}}
        {{> "systems/good-society-homebrew/templates/actors/major-character/tab-public.hbs"}}
      </article>
      <div class="dossier-spine"></div>
      <article class="dossier-page dossier-page-right">
        {{> "systems/good-society-homebrew/templates/actors/major-character/tab-private.hbs"}}
      </article>
    </div>

    <!-- Spread: backstory pages -->
    {{#each backstoryPages as |page i|}}
      <div class="dossier-spread" data-spread="backstory-{{add i 1}}">
        {{> "systems/good-society-homebrew/templates/actors/major-character/spread-backstory.hbs" page=page index=i total=../totalBackstoryPages}}
      </div>
    {{/each}}

    <!-- Spread: connection public-info pages -->
    {{#each connectionsResolved as |conn|}}
      <div class="dossier-spread" data-spread="conn-{{conn.id}}">
        {{> "systems/good-society-homebrew/templates/actors/major-character/spread-connection.hbs" conn=conn}}
      </div>
    {{/each}}

    <!-- Spread: tokens (preserved as fallback view) -->
    <div class="dossier-spread" data-spread="tokens">
      {{> "systems/good-society-homebrew/templates/actors/major-character/strip-tokens.hbs"}}
    </div>
  </div>
</div>
```

The existing `header.hbs`, `tab-public.hbs`, `tab-private.hbs`, `strip-tokens.hbs` partials get **modified in place** for the new visual treatment but remain valid partials with the same context shape.

**Why preserve `tab-public` / `tab-private` as partials rather than inlining them into `book.hbs`:** keeps the file diffs small, makes it easier to back out if the patch goes wrong, and the partials are already organized correctly for the public-on-left / private-on-right layout.

### 3.2 Tabs nav element

The existing `nav.hbs` partial is replaced with the page-turn arrows + a small inline persona/theme switcher in the cameo header. The Foundry tab navigation infrastructure (CLAUDE.md anti-pattern: "Don't get the ApplicationV2 tab wiring wrong") is no longer needed because we have one PART, not multiple.

**Important:** verify the `tabs` group setting in `static DEFAULT_OPTIONS` — if no longer wiring tabs, remove the `groups` key. If keeping tab support as a fallback (e.g., a `?tab=tokens` URL query opens the tokens spread), keep the group declared but use the spread system instead of `changeTab()`.

### 3.3 New click-delegated navigation handler

Per the patch preview's pattern, a single click handler at the `.dossier-book` level:

```js
// Inside MajorCharacterSheet's _attachListeners or _onRender:
this.element.querySelector('.dossier-book')?.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-goto]');
  if (!trigger) return;
  e.preventDefault();
  this._showSpread(trigger.dataset.goto);
});

_showSpread(name) {
  const target = this.element.querySelector(`.dossier-spread[data-spread="${name}"]`);
  if (!target) return;
  this.element.querySelectorAll('.dossier-spread').forEach(s => s.classList.remove('is-active'));
  target.classList.add('is-active');
}
```

**Important — re-rendering:** ApplicationV2 re-renders the sheet on every actor update. After re-render, the `.is-active` spread resets to the one in the HTML (which is `character` by default). To preserve which spread the user was viewing across renders:

```js
// Track active spread on the instance
constructor(...) {
  super(...);
  this._currentSpread = 'character';
}

_showSpread(name) {
  this._currentSpread = name;
  // ... swap class ...
}

// In _onRender (or equivalent post-render hook):
_onRender(context, options) {
  super._onRender(context, options);
  if (this._currentSpread !== 'character') {
    this._showSpread(this._currentSpread);
  }
}
```

**[FILL IN]** — confirm the right hook name for ApplicationV2 post-render in Foundry v13.

### 3.4 Connection click → public-info spread

Each connection chip on the private page gets `data-goto="conn-{connectionActorId}"`. When clicked, the navigation handler swaps to the matching `.dossier-spread`.

The connection spread itself reads from the Connection actor's data, not duplicated content. In `_prepareContext`, after loading the actor:

```js
ctx.connectionsResolved = await Promise.all(
  this.actor.system.connections.map(async (id) => {
    const conn = game.actors.get(id);
    if (!conn) return null;
    return {
      id: conn.id,
      name: conn.name,
      bio: conn.system.bio,
      relationshipLabel: conn.system.relationshipLabel,
      publicTags: conn.system.publicTags ?? [],
      impressions: conn.system.impressions ?? [],
      theme: conn.system.theme,  // connection variant
      // Resolve public reputation tags from items
      publicReputationTags: conn.items
        .filter(i => i.type === "reputation-tag" && i.system.visibility === "public")
        .map(i => ({ name: i.name, polarity: i.system.polarity })),
    };
  })
).then(arr => arr.filter(Boolean));
```

The `spread-connection.hbs` partial renders the connection's public-info using the resolved data. Visibility is enforced server-side in the prepareContext (filter to public-only fields); template assumes everything passed in is publicly visible.

**Permission caveat:** `game.actors.get(id)` may return null or a sanitized object if the user doesn't have permission on that Connection actor. The prepareContext must handle that gracefully — show a "you can't see this connection's details" placeholder spread instead of crashing.

### 3.5 Backstory pages

Backstory in the data model is currently a single HTML field (`actor.system.backstory`). The patch introduces multi-page support.

**Two options for storage:**

A. **Keep single-field, paginate at render time.** `_prepareContext` splits the rendered HTML into N pages by paragraph count or character count. Authors can't control where breaks fall.

B. **Add a page-break separator.** Authors put `<hr class="page-break">` (or `---` in markdown) in the backstory HTML. `_prepareContext` splits on that.

C. **Migrate to an array.** Add `backstoryPages: array<HTMLField>` to the schema. Each page is its own HTML field. Existing single backstory migrates to a one-page array on first save.

**Recommendation:** Option B for the patch. Lowest schema impact, gives authors deliberate page breaks, doesn't require migration.

```js
// In _prepareContext:
const raw = await TextEditor.enrichHTML(this.actor.system.backstory, { ... });
ctx.backstoryPages = raw.split(/<hr\s+class="page-break"\s*\/?>/i)
  .map(html => html.trim())
  .filter(html => html.length > 0);
ctx.totalBackstoryPages = ctx.backstoryPages.length;
ctx.backstoryHasMultiplePages = ctx.totalBackstoryPages > 1;

// "continue reading" button on the character spread is shown only if multiple pages
```

The backstory teaser on the character spread shows the first ~1-2 sentences of `backstoryPages[0]` plus a "continue reading ↗" button (`data-goto="backstory-1"`).

The first backstory spread shows page 1 of N with a "next page →" button (`data-goto="backstory-2"`); subsequent spreads show their page with prev + next.

### 3.6 On-page tokens block

Currently the tokens live in `strip-tokens.hbs` (the persistent strip below tabs). The patch moves them to a section under the inner conflict on the public page.

**Approach:** keep `strip-tokens.hbs` as-is (it still works as a fallback view via `data-spread="tokens"`), AND add the same content as a section at the bottom of `tab-public.hbs`. Both render the same data; both handle the same actions (`takeMonologue`, etc.).

The visual difference is the styling — the on-page version uses the `.dossier-tokens-grid` layout from the patch preview. The strip version is unchanged.

### 3.7 Persona + theme switchers in the cameo

Currently the persona switcher is a separate popover (`module/apps/persona-switcher-popover.js`). The patch adds an **inline quick-switch** next to the cameo bio.

**Inline persona switcher (new):**

A pill button with the active persona's name, click opens the existing `persona-switcher-popover` anchored to the button's position. No new logic — reuses the popover.

**Inline theme switcher (new):**

A row of 6 colored swatches (one per Major theme). Click writes to `actor.system.theme` via `actor.update({ "system.theme": "rose" })`, which triggers a re-render. The `.dossier-stage` `data-theme` attribute updates and the palette cascades.

```hbs
<div class="dossier-controls">
  <button class="dossier-persona-switcher" data-action="openPersonaSwitcher">
    {{displayName}} <span class="chev">▾</span>
  </button>
  <span class="dossier-controls-sep">·</span>
  <span class="dossier-theme-row">
    <span class="theme-label">Theme</span>
    {{#each themeRegistry as |t|}}
      <span class="theme-swatch {{#if (eq ../system.theme t.id)}}is-active{{/if}}"
            data-action="setTheme"
            data-theme-id="{{t.id}}"
            style="background: {{t.swatchColor}};"
            title="{{t.label}}"></span>
    {{/each}}
  </span>
</div>
```

`themeRegistry` is provided by `_prepareContext` from `module/constants.js`. Each entry has `id`, `label`, `swatchColor` (the cream-surface accent — `#B85B6F` for Rose, etc., per `decisions.md` reconciled palette).

**Action handlers:**

```js
static DEFAULT_OPTIONS = {
  actions: {
    openPersonaSwitcher: this.prototype._onOpenPersonaSwitcher,
    setTheme: this.prototype._onSetTheme,
    // existing handlers...
  },
};

async _onSetTheme(event, target) {
  const themeId = target.dataset.themeId;
  await this.actor.update({ "system.theme": themeId });
}
```

### 3.8 Lavishly Yours name initial

The existing `header.hbs` partial renders the name. Update the inline initial:

```hbs
<div class="dossier-name">
  <span class="dossier-name-initial">{{firstLetter displayName}}</span>{{slice displayName 1}}
</div>
```

Add Handlebars helpers `firstLetter` and `slice` in `module/good-society.js` Handlebars block (or wherever helpers live):

```js
Handlebars.registerHelper('firstLetter', (str) => str?.charAt(0) ?? '');
Handlebars.registerHelper('slice', (str, start) => str?.substring(start) ?? '');
```

CSS for `.dossier-name-initial` per the patch preview (Lavishly Yours, 56 px, vertical-align -8 px).

The `--gs-ornament` CSS variable per the integration checklist §2.1 makes this swappable.

### 3.9 Hairline-pill reputation tags

The existing template (likely `tab-public.hbs` or a partial) renders reputation tags. Replace whatever the current markup is with:

```hbs
<section class="dossier-tags">
  <div class="dossier-eyebrow">Reputation tags</div>

  <div class="dossier-tags-row">
    <div class="dossier-tags-label">Positive</div>
    <div class="dossier-tags-list">
      {{#each positiveReputationTags as |tag|}}
        <span class="dossier-tag-pill dossier-tag-pill--positive">
          <span class="dossier-tag-mark">▲</span>{{tag.name}}
        </span>
      {{/each}}
      {{#repeat openPositiveSlots}}
        <span class="dossier-tag-pill dossier-tag-pill--empty">
          <span class="dossier-tag-mark">—</span>open slot
        </span>
      {{/repeat}}
    </div>
  </div>

  <div class="dossier-tags-row">
    <div class="dossier-tags-label">Negative</div>
    <!-- ...mirror for negative... -->
  </div>
</section>
```

`positiveReputationTags` and `negativeReputationTags` come from `_prepareContext`, resolved from `actor.system.reputation.positiveTags` and `negativeTags` (item IDs) → actual tag items.

`openPositiveSlots` and `openNegativeSlots` are computed: max slots minus current count. **[FILL IN]** — confirm what's "max" — is it 3? Per spec or per character?

### 3.10 Inner conflict, conditions, tokens — visual updates

The existing inner-conflict-grid.hbs partial gets the patch-preview styling: paper-warm container, sage hairline border, brand-color filled boxes. Mostly a CSS-only update (`styles/components/_inner-conflict-grid.css`), template stays the same.

Active conditions get the patch-preview pill treatment with laurel icon. CSS-only update.

Tokens block (the on-page version per §3.6) renders the resolve pips, MT pill, monologue dot per indicator unification rule (filled `--gs-brand` available, outline 45% spent).

---

## 4. File-by-file plan

| File | Action | Notes |
|---|---|---|
| `module/sheets/major-character-sheet.js` | Modify | Replace PARTS map with single `book` part; add `_showSpread`, `_onSetTheme` action handlers; preserve all existing handlers + getData logic; preserve drag-drop + form-submit behavior. |
| `templates/actors/major-character/book.hbs` | Create | Top-level shell wrapping the existing partials in spread divs. |
| `templates/actors/major-character/header.hbs` | Modify | Update for cameo+controls layout; Lavishly Yours name initial. |
| `templates/actors/major-character/nav.hbs` | Delete (or repurpose) | Tabs nav no longer needed; if kept for `?tab=` URL fallback, simplify. |
| `templates/actors/major-character/tab-public.hbs` | Modify | Inkwell paint, hairline pills, on-page tokens block at the foot. |
| `templates/actors/major-character/tab-private.hbs` | Modify | Inkwell paint, backstory teaser + "continue reading" button, connection chips with `data-goto`. |
| `templates/actors/major-character/strip-tokens.hbs` | Keep | Used by the `tokens` spread fallback. |
| `templates/actors/major-character/spread-backstory.hbs` | Create | Page N of M layout: header, paragraph(s), prev/next pager, "back to dossier" button. |
| `templates/actors/major-character/spread-connection.hbs` | Create | Connection's public-info layout: cameo + name + relationship + public tags + description + impressions + tied-to + "back to dossier" button. |
| `styles/sheets/_major-character.css` | Major modify | Replace tabbed-sheet styling with leather-book + spreads + cameo + persona/theme controls. |
| `styles/components/_dossier-shell.css` | Create | Leather binding, spine, marginalia, cameo frame, page texture. (Or fold into `_major-character.css` — preference.) |
| `module/data-models/major-character.js` | No change | Schema preserved. |
| `module/good-society.js` | Modify | Register `firstLetter`, `slice` Handlebars helpers if not already. Add `themeRegistry` to constants. |
| `module/constants.js` | Modify | Export `themeRegistry` (id, label, swatchColor) for the theme switcher. |
| `module/helpers/persona-swap.js` | No change | Existing pipeline. |

---

## 5. Behaviors preserved

A working dossier after the refactor must still:

- Open from the Foundry sidebar / token double-click.
- Render all schema fields correctly per `_prepareContext`.
- Save changes through `submitOnChange`.
- Drag-drop reputation tags onto the sheet, route by polarity, prompt at 3 tags per CLAUDE.md Session B-7 plans.
- Drag-drop magic skills, inner conflicts onto the sheet (existing item-create flow).
- Edit / delete embedded items via existing `data-action="..."` handlers.
- Switch persona via the existing `persona-switcher-popover` (now anchored to the inline pill).
- Render TextEditor-enriched HTML for desire, notes, backstory, sentiment.
- Trigger `takeMonologue` via the on-page tokens button → existing monologue-editor flow.
- Trigger inner-conflict box toggle via existing handler.
- Trigger persona swap with cross-scene token sync per `module/helpers/persona-swap.js`.
- Render in the actor's theme (palette cascades from `data-theme="..."` on `.dossier-stage`).

If any of these break during the refactor, the refactor is incomplete.

---

## 6. Behaviors added (new in the patch)

- **Spread navigation** via `data-goto`. Click delegation at `.dossier-book` level.
- **Connection chip → connection's public-info spread.** Resolves Connection actor data in `_prepareContext` and renders.
- **Backstory teaser → multi-page backstory spread.** Authors author with `<hr class="page-break">` separators (preferred) or single field that auto-paginates.
- **"Back to dossier"** button on every alt spread returns to `character`.
- **Inline theme switcher** in the cameo. Six swatches (Major themes); click sets `actor.system.theme`.
- **Inline persona switcher pill** as the affordance for the existing popover.
- **Lavishly Yours name initial** in the cameo header.

---

## 7. Behaviors deliberately NOT in the patch

- **Persistent multi-step back-stack** for connection navigation. Currently single-step (any alt spread → character). A back-stack (push connection visits onto a history) is a future enhancement.
- **Real CSS page-turn animation.** Currently a cross-fade. A `rotateY(-180deg)` animation around the spine is a future visual polish — captured in the dossier section of the patch preview file as a TODO.
- **Drag-drop reordering of personas** within the persona switcher. Out of scope.
- **In-place editing of backstory page breaks.** Authors use raw HTML `<hr class="page-break">`. A custom TextEditor button to insert page breaks is a future enhancement.
- **Connection-spread editing.** The connection spread is read-only (the player is viewing another actor's public info, not editing it). Editing the Connection happens through its own sheet.

---

## 8. Open questions

- **Tabs group declaration.** Per CLAUDE.md anti-pattern §16, ApplicationV2 tabs need a specific nav class structure. Once we drop nav.hbs, do we remove the `tabs` group from `DEFAULT_OPTIONS` entirely, or keep it for `?tab=tokens` URL fallback? **[FILL IN]**
- **Backstory pagination** — Option B (page-break separator) is recommended above. Confirm or pick alternative.
- **Connection spread permission handling** — graceful render when player can't see a Connection actor. What does "you can't see this" look like? Is it a hidden chip on the private page (preferred — don't expose existence) or a visible chip with an inactive flip behaviour? **[FILL IN]**
- **`_currentSpread` persistence across renders** — instance variable per §3.3 is enough for in-session. Should it persist across page reloads via `actor.flags["good-society-homebrew"].lastSpread`? Probably no (next session probably wants character spread by default). **[FILL IN — confirm.]**
- **`themeRegistry` location** — `module/constants.js` is the natural home. Is there an existing constants file in the repo? If yes, extend it. If no, this refactor introduces it. **[FILL IN — verify against repo.]**
- **`displayName` resolution** — already happens in `_prepareContext` per CLAUDE.md anti-pattern §16. Confirm the helper for first-letter extraction works on the resolved displayName, not the raw `actor.name`.

---

## 9. Implementation order

A defensible sequence to land this without ever leaving the build broken:

1. **Add CSS for new visuals** (`_major-character.css` + new `_dossier-shell.css`). The existing tabbed sheet keeps working — new CSS just doesn't apply yet because no markup uses it.
2. **Add the `themeRegistry` constant** in `module/constants.js`. Standalone change.
3. **Add Handlebars helpers** (`firstLetter`, `slice`). Standalone.
4. **Create new templates** (`book.hbs`, `spread-backstory.hbs`, `spread-connection.hbs`). Not yet used.
5. **Modify `_prepareContext`** to add `connectionsResolved`, `backstoryPages`, `totalBackstoryPages`, `themeRegistry` to the context. Existing context entries unchanged. Sheet still uses old PARTS — new context entries are unused.
6. **Switch the PARTS map** to `{ book: ... }`. Update `header.hbs`, `tab-public.hbs`, `tab-private.hbs` to reference the new context vars where needed. Sheet now renders the leather-book shell.
7. **Add the click-delegated navigation handler** in `_onRender` or equivalent. Multi-spread navigation now works.
8. **Add the action handlers** for `openPersonaSwitcher`, `setTheme`. Inline switchers now work.
9. **Test** the existing behaviors (drag-drop tags, edit items, persona swap, monologue, etc.) against the refactored sheet. Fix anything that broke.
10. **Polish** — page-turn animation, edge cases (no connections, no backstory, etc.), error states.

Each step ends with a working, testable build.

---

## 10. Decisions captured during refactor

(Empty — fill in as decisions are made during the work.)
