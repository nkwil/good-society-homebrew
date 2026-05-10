# Patch: Journal elevation — "The Novel"

> **Status:** drafting. Lifts the journal from a flat dump of unstyled entries into an organized, on-theme archive presented as a collaboratively-written Jane Austen novel — the rulebook's own canonical framing (p.115: "the Jane Austen novel you have written together"). Four sub-batches: organization plumbing, journal sheet visual elevation, a dedicated Novel Reader app, and cycle dividers + novel-title affordance.
>
> **Companion docs:** [`post-mvp-design-patch.md`](./post-mvp-design-patch.md) §13 (master summary), [`patch-foundry-chrome-icons.md`](./patch-foundry-chrome-icons.md) (extends `CHROME_ICONS` with new `journalEntries` slot + a `gs-novel-reader` scene control), [`patch-cabinet.md`](./patch-cabinet.md) (the reader app gets a `COWORK_SURFACES` entry), [`patch-token-events.md`](./patch-token-events.md) (the monologue archive write path is touched here), [`patch-epistolary-wizard.md`](./patch-epistolary-wizard.md) (the letter archive write path is touched here).
>
> **Repo target:** `module/apps/novel-reader.js` (new), `module/helpers/journal-folders.js` (new), `module/helpers/cycle-divider.js` (new), `templates/apps/novel-reader*.hbs` (new), `templates/journal/cycle-divider-page.hbs` (new), `styles/journal-sheet.css` (new), `styles/journal-sidebar.css` (new), `styles/apps/_novel-reader.css` (new), edits to `module/apps/letter-composer.js`, `module/apps/monologue-editor.js`, `module/apps/session-log-preview.js`, `module/helpers/cycle-advance.js`, `module/hooks/scene-controls.js`, `module/constants.js`, `module/good-society.js`, `module/settings.js`, `lang/en.json`, `styles/good-society.css`.

---

## 1. Goals

1. **Organize what's already being archived.** Letters and session logs have folder hierarchies; monologues are dumped at the journal sidebar root with broken default permissions. Fix the asymmetry.
2. **Stop the journal sheet from fighting the wrapped cards.** Foundry's default journal page is a white sheet with default fonts. The themed letter and monologue cards inside look like they got pasted in from a different product. Extend v1 §28 chrome theming to a ninth surface.
3. **Make the archive discoverable.** Today, players find archived content by browsing the Foundry journal sidebar. Add a dedicated entry point — the Novel Reader — that presents the archive chronologically as the rulebook's promised novel.
4. **Honor the rulebook's "novel" framing.** The campaign IS the novel. Cycle phase 1 is "Novel Chapter." The end-of-game ritual (p.115) is to title the finished novel. The reader's cover page leans into that — title, author lineup, cycle count, "Begin reading ↗" pill.
5. **Don't fight Foundry.** The Foundry journal sidebar still works for direct browsing. Anything the Novel Reader does is additive — players can use either path. The Reader is the curated experience; the sidebar is the raw filesystem.

---

## 2. Relationship to existing surfaces

| Existing surface | This patch's relationship |
|---|---|
| Letter composer's `_archiveToJournal()` (B-9, lines 252–317 of `letter-composer.js`) | Folder logic centralized via the new `journalFolders.letter()` helper. Entry-type flag set so the sidebar list can render a wax-seal glyph. Permission map unchanged (sender OWNER, recipient OBSERVER). |
| Monologue editor `JournalEntry.create` (lines 76–105 of `monologue-editor.js`) | Three changes: folder hierarchy (`Monologues / Cycle N`); default permission upgraded from inherited-NONE to OBSERVER (consistent with the chat card already broadcasting the body); entry-type flag for the quill glyph. |
| Session log preview's `#doSaveLog` (lines 108–166 of `session-log-preview.js`) | Folder logic centralized via the new `journalFolders.sessionLog(year)` helper. Entry-type flag set for the ledger glyph. Permission unchanged (default OBSERVER). |
| `module/helpers/cycle-advance.js` | Hooks a new `createCycleDivider(cycleNumber)` call when phase advances to `upkeep` for the first time in a given cycle. Idempotent. |
| `gs-chrome-themed` body class (v1 §28) | Extended to cover the journal sheet body (ninth surface). New `styles/journal-sheet.css` is scoped under `body.gs-chrome-themed .journal-entry-content` — the existing class boundary just gains another stylesheet. No new body class. |
| `CHROME_ICONS` registry (patch §13.2) | Extended with a new sub-object `journalEntries` keyed by entry-type (`letter`, `monologue`, `sessionLog`, `cycleDivider`), and a new `sceneControls.gs-novel-reader` entry for the reader's button. |
| `COWORK_SURFACES` (patch §9.1 Cabinet) | New entry: `gs-novel-reader`. Players can hide the reader's scene-control button via the Cabinet rail like any other system surface. |

---

## 3. The Novel framing

The rulebook frames the campaign as a novel: p.115 ("Now all that's left is to give it a title!"), Cycle Phase 1 ("Novel Chapter"), the entire game-design pitch (p.5: "if writing a Jane Austen novel sounds like a fun way to spend an afternoon").

The journal is the only place this novel actually exists in fixed form. Letters are the dialog; monologues are the inner-thought interludes; session logs are the chapter summaries; cycle dividers (this patch, §7) are the chapter breaks. The Novel Reader (§6) is the binding that makes them a single readable artifact.

The framing is **assertive but skippable.** The Reader's cover page leans into the metaphor; the rest of Foundry doesn't have to. Players who don't care about the novel framing get a well-organized, well-styled journal that just happens to be browseable as a book if they want.

---

## 4. Batch 1 — Organization & permissions plumbing

Low-risk, no UI work. Entirely behind-the-scenes write-path consolidation.

### 4.1 Folder hierarchy (locked)

| Entry type | Folder path | Color |
|---|---|---|
| Letter | `Letters / {Recipient}'s Inbox / …` | `--gs-brand` (#2A3A2D forest green) |
| Monologue | `Monologues / Cycle N / …` | `--gs-accent-1` (#B85C3F terracotta) |
| Session log | `Session Logs / {year} / Session N` | `--gs-ink-soft` (subdued sage) |
| Cycle divider | `Cycle Reflections / …` | `--gs-accent-3` (#C9A55C gilt) |

The colors are purely Foundry folder colors — they show as small color swatches next to folder names in the journal sidebar. Folder names are localized.

If a recipient on a letter isn't an actor (the v1 letter composer's TO field is plain text — see B-9 decisions), the recipient-inbox folder is named with the literal text. This is fine; the folder appears under `Letters/` alongside actor-recipient inboxes.

### 4.2 Permissions (locked)

- **Letter** — sender OWNER, recipient (if an actor) OBSERVER, default NONE. Unchanged from B-9.
- **Monologue** — default OBSERVER (NEW). Spender doesn't need OWNER because the body is permanent table content already broadcast in chat. GMs can downgrade specific entries to NONE if a private monologue is later desired.
- **Session log** — default OBSERVER. Unchanged.
- **Cycle divider** — default OBSERVER. New (this patch).

Per-actor permission grants are still possible — the Cabinet's permission patch (v1 §22) handles per-document permissions. This batch just sets sane defaults at create time.

### 4.3 The shared folder helper

`module/helpers/journal-folders.js` exports four named functions. Each returns a Promise<Folder> — get-or-create. All folder-creation calls are wrapped in try/catch (per the letter composer's existing pattern from B-9): if a player lacks permission to create a folder, the create silently no-ops and the entry is created at root with a console.warn.

```js
// module/helpers/journal-folders.js
export async function letterFolder(recipientName) { /* "Letters / {Recipient}'s Inbox" */ }
export async function monologueFolder(cycleNumber) { /* "Monologues / Cycle N" */ }
export async function sessionLogFolder(year) { /* "Session Logs / {year}" */ }
export async function cycleReflectionFolder() { /* "Cycle Reflections" */ }

async function ensureFolder({ name, parent = null, color = "" }) { /* … */ }
```

Folder colors come from `--gs-brand`, `--gs-accent-1`, etc. — but Foundry folder colors are stored as literal hex strings, not CSS variables. The helper resolves the hex from `decisions.md` palette at call time.

### 4.4 Entry-type flag

Every entry created by these helpers receives a flag:

```js
flags: {
  "good-society-homebrew": {
    entryType: "letter" | "monologue" | "sessionLog" | "cycleDivider",
    cycleNumber: <integer>,
    speakerActorId: <string>,  // for letters and monologues
  }
}
```

The sidebar list and Novel Reader both consume `entryType` for icon dispatch and `cycleNumber` for chronological grouping. Without the flag, both still work (entries fall back to "untyped" rendering with no glyph) but lose the polish.

### 4.5 Edge cases

- **Pre-existing entries from before this patch.** Already-created letters and monologues lack the flag. The patch's `module/hooks/journal-migrate.js` runs once on `Hooks.once("ready", …)` for GM clients only and back-fills `entryType` based on entry name pattern (`{name} → {name} (Cycle N)` is a letter; `{name} — Cycle N Monologue` is a monologue; `Session N — {date}` is a session log). Conservative — entries that don't match any pattern stay untyped.
- **Folder creation race during multi-archive (e.g., several players send letters in the same second).** Foundry serializes folder creates per-document type; the get-or-create helper re-queries on conflict and returns the existing folder. Verified pattern from the existing B-9 letter composer — no changes needed beyond the helper centralization.
- **Recipient name with slashes or special characters.** Foundry tolerates them in folder names; sanitization is a no-op. The literal name is preserved.

---

## 5. Batch 2 — Journal sheet visual elevation

Style Foundry's journal sheet so the wrapped cards stop fighting it.

### 5.1 The journal-sheet stylesheet

`styles/journal-sheet.css` — all rules scoped under `body.gs-chrome-themed .journal-entry-content`. Loaded after `styles/foundry-chrome.css` in the import order.

Rules cover:

- **Background.** The journal sheet body changes from white to `--gs-paper` (cream). Subtle inner shadow (1 px sage) to read as paper.
- **Page chrome.** The sheet's outer hairline becomes a 0.5 px sage frame at 12 px inset. Replaces Foundry's default border.
- **Typography.**
  - `h1`/`h2` in `--gs-display` (Lora 600), forest green, 1.0 em letter-spacing.
  - `h3`/`h4` use the §8.1 standalone eyebrow primitive (Lora 600, 11.5 px, uppercase, sage hairline + gilt diamond). Authors writing free-form notes inside an entry get this for free.
  - Body in `--gs-body` (Crimson Text), `--gs-ink`, 16 px, line-height 1.6.
  - Italic spans use the proper italic face (`--gs-italic`).
- **Lists.** `ul` / `ol` get sage bullet markers (custom CSS). `blockquote` gets a 4 px terracotta left stripe + paper-warm fill, italic body.
- **Tables.** Sage hairline borders, 0.5 px. Header row in `--gs-paper-warm`. Sentence-case column headers in `--gs-display` 13 px.
- **Links.** `a:not(.content-link)` in `--gs-brand` with a 1 px dotted underline. `.content-link` (Foundry document references) keep their existing styling — those are Foundry chrome, not user content.

The themed cards already inside an entry (`.gs-letter-card`, `.gs-monologue-archive`, etc.) sit cleanly on the cream background — no adjustments needed to the existing card CSS.

### 5.2 Journal sidebar polish

`styles/journal-sidebar.css` — scoped under `body.gs-chrome-themed #sidebar .directory--journal` (Foundry v13's journal directory class). Loaded alongside `styles/foundry-chrome.css`.

- **Folder rows.** 4 px left-edge color stripe pulled from the folder's `color` field (the colors set in §4.1). Folder name in `--gs-display` 11.5 px, uppercase, brand-color.
- **Entry rows.** 24 px row height. Entry name in `--gs-body` 13 px, `--gs-ink`. Hover lifts background to `--gs-paper-warm`.
- **Entry-type glyphs.** Each entry row renders a 14 px glyph at the leading edge based on `flags["good-society-homebrew"].entryType`:
  - `letter` → wax-seal SVG (asset: `assets/journal-glyphs/letter.svg`).
  - `monologue` → quill SVG (asset: `assets/journal-glyphs/monologue.svg`).
  - `sessionLog` → ledger SVG (asset: `assets/journal-glyphs/session-log.svg`).
  - `cycleDivider` → small fleuron SVG (asset: `assets/journal-glyphs/cycle-divider.svg`).
  - Untyped entries get no glyph (preserves the row's visual hierarchy without a placeholder).
- **Sidebar tab eyebrow.** The "Journals" tab label gets the §8.1 standalone eyebrow primitive (Lora 600, uppercase, gilt diamond). Same treatment will likely apply to other sidebar tabs in a future polish pass — flag in v1 of the chrome-icons doc, defer the broader pass.

The entry-type attribute is injected via a `Hooks.on("renderJournalDirectory", …)` handler that adds `data-entry-type` to each entry's DOM row. CSS reads via `[data-entry-type]` selector. Same delegation pattern as `data-tooltip-key` (per CLAUDE.md "Adding a tooltipped surface" recipe).

### 5.3 Three new chrome-icon slots

Extend `CHROME_ICONS` (patch §13.2) with a new sub-object:

```js
journalEntries: {
  letter:        { asset: "assets/journal-glyphs/letter.svg",        label: "Letter" },
  monologue:     { asset: "assets/journal-glyphs/monologue.svg",     label: "Monologue" },
  sessionLog:    { asset: "assets/journal-glyphs/session-log.svg",   label: "Session Log" },
  cycleDivider:  { asset: "assets/journal-glyphs/cycle-divider.svg", label: "Cycle Reflection" },
}
```

And one new entry under `sceneControls`:

```js
"gs-novel-reader": { asset: "assets/chrome-icons/scene-novel-reader.svg", label: "The Novel" },
```

All four new asset paths follow the day-one default behavior from patch §13.7 — when the asset is missing, the system falls back to a default. For `journalEntries`, the fallback is no glyph (the row renders without one). For the scene control, the fallback is the standard Foundry FA glyph (book / book-open).

### 5.4 No new body class

This batch piggybacks on `gs-chrome-themed` — the existing class from v1 §28. The §16 body class registry's "what it does" cell for `gs-chrome-themed` should be updated from "8 surfaces" to "9 surfaces" with the journal sheet body as the addition.

---

## 6. Batch 3 — The Novel Reader app

A dedicated reader for the archived journal contents, presented as the rulebook's collaboratively-written novel.

### 6.1 What it is

A framed `ApplicationV2` window. Singleton (only one open at a time). 920 × 780 default size, resizable. Opened via:

- A new scene-control button `gs-novel-reader` (visible to all users, book icon).
- Optional Cabinet rail entry — `COWORK_SURFACES` gets a new entry so users can show/hide the button via the Cabinet drawer.
- The chat-card monologue and letter cards' "[archived ↗]" link still opens the underlying entry in Foundry's journal sheet (preserves existing B-9 / monologue behavior); the Reader is parallel discovery, not a replacement.

### 6.2 The class

```js
// module/apps/novel-reader.js
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class NovelReaderApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "gs-novel-reader",
    classes: ["good-society", "gs-novel-reader"],
    window: {
      frame: true,
      title: "GOODSOCIETY.novel.windowTitle",
      icon: "fa-solid fa-book-open",
      contentClasses: ["gs-novel-reader__content"],
    },
    position: { width: 920, height: 780 },
    actions: {
      goToCycle: NovelReaderApp.#goToCycle,
      toggleCycleSection: NovelReaderApp.#toggleCycleSection,
      titleNovel: NovelReaderApp.#titleNovel,
      openInJournal: NovelReaderApp.#openInJournal,
      beginReading: NovelReaderApp.#beginReading,
    },
  };

  static PARTS = {
    cover: { template: "systems/good-society-homebrew/templates/apps/novel-reader-cover.hbs" },
    rail:  { template: "systems/good-society-homebrew/templates/apps/novel-reader-rail.hbs" },
    reader:{ template: "systems/good-society-homebrew/templates/apps/novel-reader-reader.hbs" },
  };

  async _prepareContext(options) {
    // 1. Find every entry with flags.good-society-homebrew.entryType
    // 2. Group by cycleNumber
    // 3. Sort within each cycle by createdTime
    // 4. Compute totals (entries per cycle, total monologues, total letters, etc.)
    // 5. Resolve the novel's title from setting `novelTitle`, falling back to game.world.title
    // 6. Resolve cover-page metadata: author list (game.users.filter active or contributing), cycle count, status (in progress vs complete)
  }
}
```

### 6.3 Template structure

Three PARTs compose horizontally inside the window:

- **`cover`** — the full-window title page. Visible on initial open and when the reader scrolls back to the top. Vertically centered. Contains:
  - The novel's title in `--gs-display` 56 px, weight 500, brand color. First letter gets the `--gs-ornament` face (Lavishly Yours) at 84 px — same exception that applies to the dossier name initial (§4.2 of master spec). Rationale: the cover is a once-per-session moment, ornament-face here reads as ceremony.
  - "*A novel in {N} cycles, {status}.*" — italic Crimson 18 px, subdued sage. Status is "in progress," "in its final cycle," or "complete" depending on `cyclePosition` and `isFinalCycle`.
  - "*By {author names joined with commas, with 'and' before the last}*" — italic Crimson 14 px.
  - A 240 px gilt-fade hairline rule.
  - A primary pill: **"Begin reading ↗"** (action: `beginReading` — scrolls to first cycle's first entry).
  - When `isFinalCycle && cyclePosition === 9` (game has ended): a secondary pill below: **"Title your novel ↗"** (action: `titleNovel` — opens a small inline input that writes to `novelTitle` setting).
- **`rail`** — left-side cycle navigation, ~180 px wide. Hidden when `cover` is showing. Contains:
  - "COVER" eyebrow at top (action: scrolls back to cover).
  - One row per cycle: "CYCLE 1" eyebrow + "12 entries · 3 letters · 4 monologues · 1 session" subdued meta line. Click jumps to that cycle (action: `goToCycle`).
  - Each cycle row collapsible (action: `toggleCycleSection`) — expanded shows entry titles indented as a sub-list.
  - Active cycle row has a 4 px gilt left-edge accent.
- **`reader`** — right-side scrolling reader. Renders entries in chronological order with cycle dividers between groups. Contains:
  - For each cycle:
    - A chapter divider — large display-type heading "CYCLE N", below it the cycle's in-fiction date label (from event timeline if present), below that a 200 px gilt rule.
    - Each entry rendered inline using its archived HTML body, wrapped in `gs-novel-reader__entry`. Entry-type glyph at the upper-left of each entry. Entry name as an eyebrow above the body.
    - At the foot of each entry: an "[open in journal ↗]" subdued link (action: `openInJournal` with the entry's UUID).

### 6.4 Reader visual contract

- Background: `--gs-paper`, full-bleed inside the window's frame.
- Padding: 64 px top/bottom, 80 px left/right (book-page generous).
- Reader column max-width: 640 px (legible reading column at default size).
- Cycle divider headings: 32 px Lora 500 brand color, paper-warm hairline above and below.
- Entry rows: 32 px gap between entries.
- Entry-type glyphs: 18 px in subdued sage, top-left of each entry block.
- The themed letter / monologue cards inside entries render at their existing sizes — the reader provides the cream paper backdrop they were designed against.

### 6.5 Per-user state

Per-user state stored in `game.user.flags["good-society-homebrew"]`:

```js
novelReader: {
  scrollPosition: <number>,        // last scroll Y when closed
  lastCycleViewed: <integer>,
  collapsedCycles: <integer[]>,    // which cycle sections are collapsed
}
```

Restored on next open. If the user has never opened the reader, the cover page renders.

### 6.6 Empty states

- **Zero archived entries.** Cover page renders with status "*Not yet begun.*" The "Begin reading ↗" pill is replaced with a subdued italic message: "*The first letter, monologue, or session log will start the novel.*" No rail; no reader pane.
- **One cycle, very few entries.** Cover renders with "*A novel in 1 cycle, in progress.*" Rail shows just Cycle 1. Normal reader experience.

### 6.7 Foundry journal sheet still works

Direct browsing in the Foundry sidebar continues to work and is now properly themed (Batch 2). The Reader is the curated experience; the sidebar is the raw access.

---

## 7. Batch 4 — Cycle dividers & novel framing polish

Auto-create chapter breaks, support the rulebook's title-the-novel ritual.

### 7.1 Cycle divider auto-creation

Hooked into `module/helpers/cycle-advance.js`. When the cycle phase advances **into** `upkeep` for the first time in a given cycle (i.e., transitioning from epistolary or rumour-scandal into upkeep), the system creates a divider entry.

```js
// module/helpers/cycle-divider.js
export async function createCycleDivider(cycleNumber) {
  // Idempotent — skip if entry exists in the Cycle Reflections folder for this cycle
  const folder = await journalFolders.cycleReflectionFolder();
  const name = game.i18n.format("GOODSOCIETY.novel.cycleDivider.name", { n: cycleNumber });
  const existing = game.journal.find(j =>
    j.folder?.id === folder.id &&
    j.flags?.["good-society-homebrew"]?.cycleNumber === cycleNumber
  );
  if (existing) return existing;

  return JournalEntry.create({
    name,
    folder: folder.id,
    pages: [{
      name: name,
      type: "text",
      text: {
        format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML,
        content: await foundry.applications.handlebars.renderTemplate(
          "systems/good-society-homebrew/templates/journal/cycle-divider-page.hbs",
          await prepareDividerContext(cycleNumber)
        ),
      },
    }],
    flags: {
      "good-society-homebrew": {
        entryType: "cycleDivider",
        cycleNumber,
      },
    },
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
  });
}
```

Created GM-only (only GM-clients run the create — same single-writer pattern as `appendPendingChange` per CLAUDE.md anti-pattern). All other clients see it via Foundry's standard document sync.

### 7.2 Divider entry shape

`templates/journal/cycle-divider-page.hbs` renders:

- Eyebrow: "CYCLE N · REFLECTIONS" (the §8.1 standalone primitive, brand color).
- A short auto-summary pulled from session events (per `module/apps/session-events.js`):
  - "*This cycle, {N} letters changed hands.*"
  - "*{Speaker} laid bare an inner monologue."* — one bullet per monologue.
  - "*{Speaker}'s reputation took on the mark of '{tag}'."* — one bullet per major rep change.
  - "*{Family}'s heir status changed to {status}."* — when applicable.
  - "*A scandal broke at the {sceneName}."* — when rumour-scandal events fired.
- A gilt-fade hairline at the bottom.
- All content is auto-generated boilerplate; the GM may freely edit the entry afterward to add reflection or alter the prose.

The template is intentionally short — 3–8 bullets per cycle is normal. Heavy editing is encouraged for the cycle's "real" reflection.

### 7.3 Reader renders dividers as chapter breaks

The Novel Reader's `reader` PART (§6.3) special-cases entries with `entryType === "cycleDivider"`:

- Renders larger than other entries — chapter-break treatment (display-type 28 px, double gilt rule above and below, paper-warm fill behind the body, 48 px vertical padding).
- The divider's own auto-summary content shows directly inline, no need to click through.
- These are the natural section breaks in the reader's chronological flow.

### 7.4 Title your novel — affordance

Per rulebook p.115: "Now all that's left is to give it a title!"

The cover's "Title your novel ↗" pill (§6.3) is conditionally visible: **only when the game has ended** (`isFinalCycle && cyclePosition === 9`). Clicking opens an inline input (replaces the cover's title block with a text field):

- Single-line input, ~40 character soft limit (a Jane Austen title length).
- Placeholder: *"Pride and Prejudice. Emma. Persuasion. What is yours?"*
- Save pill: writes to `novelTitle` world setting. Cancel reverts.
- Saving triggers a re-render of the cover with the new title. The first-letter ornament-face character carries from the new title.

The setting is also editable from System Settings (config: true), in case the GM wants to set it without going through the reader.

### 7.5 Game-end hook integration

A new game-end hook `goodSociety.gameEnded` fires from `cycle-advance.js` when the GM toggles `isFinalCycle` and `cyclePosition` reaches 9. The reader app subscribes; on receiving the hook, it auto-opens for every connected user, scrolled to the cover, with the "Title your novel" pill prominent. Single moment of ceremony — closes when users dismiss.

---

## 8. Settings

```js
// module/settings.js — additions

novelTitle: {
  scope: "world",
  config: true,
  type: String,
  default: "",  // falls back to game.world.title in the reader
}

novelReaderEnabled: {
  scope: "client",
  config: true,
  type: Boolean,
  default: true,  // hides the scene-control button when false
}

autoCreateCycleDividers: {
  scope: "world",
  config: true,
  type: Boolean,
  default: true,  // GMs can opt out if they want to write their own dividers
}
```

---

## 9. Localization

```json
{
  "GOODSOCIETY.novel.windowTitle": "The Novel",
  "GOODSOCIETY.novel.cover.statusInProgress": "in progress",
  "GOODSOCIETY.novel.cover.statusFinalCycle": "in its final cycle",
  "GOODSOCIETY.novel.cover.statusComplete": "complete",
  "GOODSOCIETY.novel.cover.cyclesLine": "A novel in {n} cycles, {status}.",
  "GOODSOCIETY.novel.cover.byline": "By {authors}",
  "GOODSOCIETY.novel.cover.beginReading": "Begin reading ↗",
  "GOODSOCIETY.novel.cover.titleNovel": "Title your novel ↗",
  "GOODSOCIETY.novel.cover.titlePlaceholder": "Pride and Prejudice. Emma. Persuasion. What is yours?",
  "GOODSOCIETY.novel.cover.titleSave": "Save title",
  "GOODSOCIETY.novel.cover.titleCancel": "Cancel",
  "GOODSOCIETY.novel.cover.notYetBegun": "Not yet begun.",
  "GOODSOCIETY.novel.cover.firstWillStart": "The first letter, monologue, or session log will start the novel.",
  "GOODSOCIETY.novel.rail.coverEyebrow": "COVER",
  "GOODSOCIETY.novel.rail.cycleEyebrow": "CYCLE {n}",
  "GOODSOCIETY.novel.rail.cycleMeta": "{total} entries · {letters} letters · {monologues} monologues · {sessions} sessions",
  "GOODSOCIETY.novel.reader.cycleHeading": "CYCLE {n}",
  "GOODSOCIETY.novel.reader.openInJournal": "[open in journal ↗]",
  "GOODSOCIETY.novel.cycleDivider.name": "Cycle {n} — Reflections",
  "GOODSOCIETY.novel.cycleDivider.eyebrow": "CYCLE {n} · REFLECTIONS",
  "GOODSOCIETY.novel.cycleDivider.lettersLine": "This cycle, {n} letters changed hands.",
  "GOODSOCIETY.novel.cycleDivider.monologueLine": "{speaker} laid bare an inner monologue.",
  "GOODSOCIETY.novel.cycleDivider.repChangeLine": "{speaker}'s reputation took on the mark of '{tag}'.",
  "GOODSOCIETY.novel.cycleDivider.heirStatusLine": "{family}'s heir status changed to {status}.",
  "GOODSOCIETY.novel.cycleDivider.scandalLine": "A scandal broke at the {sceneName}.",
  "GOODSOCIETY.journal.folders.letters": "Letters",
  "GOODSOCIETY.journal.folders.recipientInbox": "{recipient}'s Inbox",
  "GOODSOCIETY.journal.folders.monologues": "Monologues",
  "GOODSOCIETY.journal.folders.cycleN": "Cycle {n}",
  "GOODSOCIETY.journal.folders.sessionLogs": "Session Logs",
  "GOODSOCIETY.journal.folders.cycleReflections": "Cycle Reflections",
  "GOODSOCIETY.settings.novelTitle.name": "The novel's title",
  "GOODSOCIETY.settings.novelTitle.hint": "Shown on the Novel Reader's cover page. Defaults to your world's name. The end-game ritual is to give the finished novel its title (rulebook p.115).",
  "GOODSOCIETY.settings.novelReaderEnabled.name": "Show The Novel reader button",
  "GOODSOCIETY.settings.novelReaderEnabled.hint": "When on, a book-icon button appears in the scene controls that opens the curated archive of letters, monologues, and session logs.",
  "GOODSOCIETY.settings.autoCreateCycleDividers.name": "Auto-create cycle reflections",
  "GOODSOCIETY.settings.autoCreateCycleDividers.hint": "When a cycle ends, automatically create a 'Cycle N — Reflections' journal entry summarizing the cycle's events. The GM can edit it afterward."
}
```

---

## 10. File-by-file plan

| File | Action |
|---|---|
| `module/helpers/journal-folders.js` | **NEW.** Centralized folder helpers (§4.3). |
| `module/helpers/cycle-divider.js` | **NEW.** `createCycleDivider(cycleNumber)` and divider context preparation. |
| `module/apps/novel-reader.js` | **NEW.** The Novel Reader app class. |
| `module/hooks/journal-migrate.js` | **NEW.** One-time backfill of `entryType` flags on legacy entries. GM-client-only. |
| `module/hooks/journal-sidebar.js` | **NEW.** `renderJournalDirectory` hook handler that injects `data-entry-type` onto entry rows. |
| `templates/apps/novel-reader-cover.hbs` | **NEW.** Cover page. |
| `templates/apps/novel-reader-rail.hbs` | **NEW.** Left rail. |
| `templates/apps/novel-reader-reader.hbs` | **NEW.** Reading pane. |
| `templates/journal/cycle-divider-page.hbs` | **NEW.** Cycle divider page body. |
| `styles/journal-sheet.css` | **NEW.** Foundry journal sheet body theming. |
| `styles/journal-sidebar.css` | **NEW.** Sidebar list polish. |
| `styles/apps/_novel-reader.css` | **NEW.** Reader window styling. |
| `styles/good-society.css` | **EDIT.** Import the three new stylesheets. |
| `module/apps/letter-composer.js` | **EDIT.** Use `journalFolders.letterFolder()`; set `flags.good-society-homebrew.entryType = "letter"`. |
| `module/apps/monologue-editor.js` | **EDIT.** Use `journalFolders.monologueFolder(cycleNumber)`; set entry-type flag and OBSERVER permission. |
| `module/apps/session-log-preview.js` | **EDIT.** Use `journalFolders.sessionLogFolder(year)`; set entry-type flag. |
| `module/helpers/cycle-advance.js` | **EDIT.** Call `createCycleDivider()` on first transition into `upkeep` per cycle, gated on `autoCreateCycleDividers` setting. |
| `module/hooks/scene-controls.js` | **EDIT.** Add `gs-novel-reader` button (visible to all users; default icon `fa-book-open`). |
| `module/constants.js` | **EDIT.** Extend `CHROME_ICONS` with `journalEntries` sub-object + `gs-novel-reader` scene control entry. Add `gs-novel-reader` to `COWORK_SURFACES`. |
| `module/good-society.js` | **EDIT.** Register the journal-migrate hook (ready, GM-only) and the journal-sidebar hook (renderJournalDirectory). Register `goodSociety.gameEnded` listener that opens the reader. |
| `module/settings.js` | **EDIT.** Register `novelTitle`, `novelReaderEnabled`, `autoCreateCycleDividers`. |
| `lang/en.json` | **EDIT.** Add the §9 keys. |

---

## 11. Implementation order

1. **Batch 1 plumbing.** Create `journal-folders.js`. Migrate the three existing writers to use it. Add entry-type flag to all three. Add the migration hook for legacy entries. Verify in-Foundry that new letters / monologues / session logs land in correct folders with correct flags.
2. **Batch 2 sheet styling.** Create `styles/journal-sheet.css`. Open existing archived entries and verify the cream-paper sheet treatment doesn't break the wrapped letter/monologue cards. Iterate typography.
3. **Batch 2 sidebar polish.** Create `styles/journal-sidebar.css` and `module/hooks/journal-sidebar.js`. Add three placeholder SVG glyphs at `assets/journal-glyphs/` (default fallbacks Natalie can replace later). Verify entry rows render glyphs based on `data-entry-type`.
4. **Batch 3 reader skeleton.** Create `NovelReaderApp` class with `_prepareContext` returning empty cover. Wire scene-control button. Verify window opens and the cover renders.
5. **Batch 3 reader content.** Implement entry loading + cycle grouping + chronological sort. Render the reader pane with entries inline. Verify cycle navigation in the rail works.
6. **Batch 3 cover polish.** Wire the "Begin reading," "Title your novel," and "Open in journal" actions. Verify scroll position persists per user.
7. **Batch 4 cycle dividers.** Create `cycle-divider.js`. Wire into `cycle-advance.js`. Verify a divider is created on cycle end and renders correctly in the reader and in the Foundry sidebar.
8. **Batch 4 game-end ceremony.** Wire `goodSociety.gameEnded` hook. Verify the reader auto-opens for all connected users when the GM toggles end-of-game state.
9. **Polish.** Empty-states, edge cases, settings descriptions, asset placeholders, localization audit.
10. **QA.** Test path: send three letters across two cycles; spend three monologues; end one session; advance the cycle; toggle final cycle; verify the reader's cover, rail, and reading pane all reflect reality.

---

## 12. Edge cases

- **A user lacks permission to open a specific archived entry.** The reader skips it silently in `_prepareContext`. The cycle's entry count in the rail still reflects what *they* can see, not the global count. Consistent with Foundry's permission model.
- **A user re-opens the reader after entries have been added since their last visit.** The scroll position is preserved, but new entries may be above where they were. Acceptable — they can scroll down and see "new" content. A future polish: a "{N} new since you last read" toast.
- **Game in single-cycle mode.** The 3-cycle vs many-cycle logic doesn't affect the reader. The reader is cycle-count-agnostic — it shows whatever cycles have content.
- **Cycle divider auto-creation on a cycle that already has one.** Idempotent — `createCycleDivider` checks for an existing entry with matching `cycleNumber` flag and returns it. No duplicates.
- **GM disables `autoCreateCycleDividers` mid-game.** Existing dividers stay; new ones don't get created. The reader handles missing dividers gracefully — cycle sections still render with their auto-computed heading; the inline summary just isn't there.
- **GM edits an auto-created divider's body.** The reader renders whatever the body is now, not the original auto-generated content. This is intentional — the auto-summary is a starting point, not a permanent generated artifact.
- **Reader open while a new entry is being archived.** Foundry's document-update hooks fire; the reader's `_onJournalUpdate` listener re-renders the rail counts and scrolls aren't disrupted. A small toast: "*A new entry was added.*"
- **User on a non-GM client tries to call `createCycleDivider`.** GM-only guard inside the function; non-GM calls silently return.
- **Pre-existing entries from before this patch.** The migration hook (§4.5) backfills `entryType` based on name pattern. Entries that don't match any pattern stay untyped — they appear in the reader as "Untyped archive entries" at the cycle they were created (`createdTime` resolves to a cycle via the world's cycle history). Unmatched entries can be manually re-flagged by the GM.
- **`novelTitle` setting empty.** Cover falls back to `game.world.title`. If that's also empty (rare), falls back to "*An untitled novel.*"

---

## 13. Open questions

- **§5.2** — Should the entry-type glyph appear on every row, or only when `applyChromeIcons=true`? Lean: gate on `applyChromeIcons` for consistency with the §13 chrome icons feature. When chrome icons are off, the sidebar shows the raw entry name with no glyph.
- **§6.3** — Cover ornament-face on the title's first letter — is the Lavishly Yours exception fitting here, or do we want a different ornament face for "novel cover" weight? Lean: stay with Lavishly Yours; consistency with the dossier name initial is the right move. Revisit only if a different display effect feels needed.
- **§6.5** — Should `lastCycleViewed` jump to the *latest* cycle on each open (so users always start near the action) or restore the *exact* scroll position from the previous session? Currently latter. Lean: stay with exact scroll position, with a "Jump to latest ↗" pill in the rail's footer for the "I've been away for a while" case.
- **§7.1** — When does the cycle divider get created — on transition INTO upkeep, or on transition OUT (i.e., when upkeep finishes)? Currently into. Pro: divider exists during upkeep play, GMs can edit during that phase. Con: cycle is technically not yet over. Lean: into upkeep — gives the GM a sandbox to edit while the cycle is still warm.
- **§7.4** — Should the "Title your novel" affordance also appear during the final cycle (before completion), so the GM can pre-set the title? Lean: no — the rulebook ritual is end-of-game; preserving the moment matters. The setting is editable from System Settings if a GM wants to skip the ritual.
- **§7.5** — Game-end hook auto-opening the reader for every user — too aggressive? Could feel like an unsolicited modal at the end of a final session. Lean: yes, but with a small "x close" available; the moment is the rulebook's prescribed ritual and worth surfacing. Users who hate it disable `novelReaderEnabled` setting.
- **§4.5** — Migration backfill name-pattern matching — should it also catch entries with names that *almost* match (e.g. user typos)? Lean: no. Conservative matcher only. Anything that doesn't match exactly stays untyped; the GM can re-flag manually.

---

## 14. Decisions log

- **2026-05-08 — Lean into the novel framing.** The rulebook itself frames the campaign as a Jane Austen novel (p.5, p.115, "Novel Chapter" phase name). The reader's cover page leans in; the framing is assertive but skippable. Players who don't care about the novel metaphor still get a well-organized journal.
- **2026-05-08 — Monologue folder strategy: by cycle, not by author.** `Monologues / Cycle N / {entries}`. Mirrors session logs. Author name carried in the entry name. Avoids deep folder trees and matches the chronological reading mental model.
- **2026-05-08 — Default monologue permission: OBSERVER.** Inherited NONE was broken — players couldn't see monologues that had already broadcast in chat. OBSERVER for all is consistent with the chat broadcast. GMs can downgrade specific entries.
- **2026-05-08 — Both Foundry sidebar and dedicated Reader.** Style Foundry's sheet so direct browsing works (Batch 2); also build the Reader as the primary discoverable entry point (Batch 3). The sidebar is the raw filesystem; the Reader is the curated experience. Each has its place.
- **2026-05-08 — Cycle dividers ARE journal entries (not just UI inside the Reader).** Two reasons: (1) the auto-summary content deserves to be persistent and editable; (2) when a user opens an archived entry directly in the Foundry sidebar, the chronological context (which cycle did this happen in?) shows in the adjacent divider. Reader treats them as chapter breaks visually; the underlying data is uniform with other archives.
- **2026-05-08 — Auto-create cycle dividers on transition INTO upkeep.** Gives the GM an edit sandbox while the cycle is still warm. Idempotent. Toggleable via `autoCreateCycleDividers` setting.
- **2026-05-08 — Title-the-novel affordance only at game end.** Rulebook p.115 ritual. Setting is editable from System Settings if a GM wants to override; but the affordance honors the moment.
- **2026-05-08 — No new body class.** This patch extends `gs-chrome-themed` to a ninth surface (the journal sheet). Keeping the toggle unified — users who want chrome theming get the journal styling too. Documented in the §16 body class registry update.
- **2026-05-08 — Three new chrome-icon slots, one new scene-control slot.** Extends `CHROME_ICONS` from §13 with `journalEntries.{letter, monologue, sessionLog, cycleDivider}` plus `sceneControls.gs-novel-reader`. Same registry pattern. Same fallback behavior — when assets are missing, the system renders gracefully (no glyph for journal entries; default FA icon for the scene control).
- **2026-05-08 — Reader is a singleton.** Only one open at a time per user. Per-user state stored on `game.user.flags`. Re-open restores last scroll position and collapsed cycles.
- **2026-05-08 — `gs-novel-reader` joins `COWORK_SURFACES`.** Players can hide the scene-control button via the Cabinet rail like any other system surface.
- **2026-05-08 — Backfill migration is conservative.** Pre-patch entries get `entryType` assigned only on exact name-pattern match. Anything ambiguous stays untyped — the GM re-flags manually if they care.
