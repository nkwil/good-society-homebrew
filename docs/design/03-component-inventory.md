# 03 — Component Inventory

**Status:** Open — initial inventory complete; per-component design pending
**Date opened:** 2026-05-05

## Purpose

This is the master list of every visual component in the Good Society Foundry system. Each entry maps a component to:

- **Source** — where in the system plan / CLAUDE.md it's specified
- **Theme scope** — house, character, or hybrid (and which sub-surfaces are which)
- **Design status** — not started, sketched, locked
- **Notes** — anything specific the design needs to honor

When a component is fully designed, it gets its own `0X-{component}.md` file under `docs/design/` and this entry links to it.

The "antique but clean and legible" principle (see `decisions.md`) applies to everything below without further mention.

## How theme scope works

Three values:

- **House** — uses the Inkwell & Wildflower house style only. Theme-neutral. Applies to chrome, item sheets, mechanical surfaces.
- **Character** — adopts a single actor's theme. Applies to character sheets, letters, in-character chat, persona-bound surfaces.
- **Hybrid** — primarily house-styled, with per-actor accents that pull from the character theme (typically: a name color, a portrait border, a tag accent stripe). Applies to shared surfaces that need to identify individual characters.

Reference: `02-theme-architecture.md` for the scope-boundary rules.

## Actor sheets

| # | Component | Source | Theme scope | Status | Notes |
|---|-----------|--------|------------|--------|-------|
| 1 | Major Character — sheet header | Plan §6.1, CLAUDE.md §10 | Character | Sketched | Portrait side panel uses `--gs-side-panel`; main column uses `--gs-paper`. Locked-in layout: 120px portrait column + flex main. See widget `good_society_major_character_sheet_headers_locked` for proof. |
| 2 | Major Character — tab nav | Plan §6.1 | Character | Not started | Three tabs: Public, Private, Tokens & Cycle. Tab type uses `--gs-display` small-caps. Active tab has a 0.5px `--gs-brand` underline. |
| 3 | Major Character — Public tab | Plan §6.1 (public) | Character | Not started | Holds Reputation Tags grid, Active Conditions, Possible Conditions drag target, Reputation Criteria (read-only), Inner Conflict pair, Completed Conflicts list. |
| 4 | Major Character — Private tab | Plan §6.1 (private) | Character | Not started | Holds Bio header (age, peerage, appearance, temperament given/taken), Notes & Objectives, Connections list, Desire, Backstory, Magic/Skills, Adventurer Sentiment. Each field has a visibility flag indicator. |
| 5 | Major Character — Tokens & Cycle tab | Plan §6.1, §9 | Hybrid | Not started | Resolve track and MT toggle adopt character theme; cycle phase indicator at top-right reads from world state and uses house style. |
| 6 | Connection — sheet | Plan §6.2 | Character (connection variant) | Sketched | Portrait, name, pronouns, relationship label, impressions list (one per Major), resolve track (max 5, default 1), hover summary, public tags. Tighter and less ornate than Major sheet — see widget `good_society_connection_theme_set_locked` for the card form. The full sheet expands the card with the impressions list and editable fields. |
| 7 | Family — sheet | Plan §3.3 | House | Not started | Family name, origin, heir status, unique negative reputation criteria (read-only on member Majors), crest (image + motto), GM-only notes, member Majors list. House-styled because Families are shared across multiple Majors with different themes. |
| 8 | NPC — sheet | Plan §3.4 | House | Not started | Bio, scene info, optional personas. Inherits house style (NPC = world citizen). |

## Item sheets

All item sheets are house-styled — items are objects in the world, not voices.

| # | Component | Source | Theme scope | Status | Notes |
|---|-----------|--------|------------|--------|-------|
| 9 | Reputation Tag — sheet | Plan §4, CLAUDE.md §9 | House | Not started | Compact popup-style sheet (360px wide, height auto). Polarity dropdown with positive ▲ / negative ▼ colored markers. Description editor. Source field. |
| 10 | Reputation Condition — sheet | Plan §4 | House | Not started | Polarity, description, active toggle, source tag references. |
| 11 | Inner Conflict — sheet | Plan §4 | House | Not started | Left/right label inputs, 5+5 box grid, completion state. The box grid is the headline component — needs to feel weighty when boxes fill. |
| 12 | Magic/Skill — sheet | Plan §4, §10 | House | Not started | Name, description, reference URL, VFX key picker, sound URL, hidden toggle, optional "triggers persona swap" target. The Cast button gets prominent placement. |
| 13 | Backstory Action — sheet | Plan §4 | House | Not started | Earned via inner conflict completion. Name, description, source conflict reference, expanded/used toggles. |

## Custom apps and overlays

| # | Component | Source | Theme scope | Status | Notes |
|---|-----------|--------|------------|--------|-------|
| 14 | Public Info / Facilitator Dashboard | Plan §7, §12.5 | Hybrid | Not started | One row per Major: portrait, name, MT, resolve track (read-only), monologue dot, public desire. Dashboard chrome is house; each Major's row uses character theme accent for name color and portrait border. GM bulk actions panel at the top: refresh resolve, clear monologue flags, reveal desires. |
| 15 | My Characters Dock | Plan §12.1 | Hybrid | Not started | Pinned panel listing user-owned actors. Each row: portrait (current persona), name, persona name, resolve count, MT indicator. Row uses character theme accent. Dock chrome is house. |
| 16 | Cycle Phase HUD Strip | Plan §12.2 | House | Not started | Always-visible bar at top of canvas. "Cycle 3 — Reputation Phase." GM sees Advance Phase button. Persistent, so very restrained — house-style hairlines, small type. |
| 17 | Upkeep Wizard | Plan §12.2 | Hybrid | Not started | Multi-step modal walking each player through resolve refresh → notes update → monologue prompt → reputation review. Wizard chrome is house; the content area carries the character's theme since the player is being walked through their character's upkeep. |
| 18 | Welcome Panel | Plan §12.6 | House | Not started | First-load modal. Three big buttons: sample world, blank, quick-start. Suppressible. |
| 19 | Bulk Permissions Panel | Plan §12.5 | House | Not started | GM-only grid: actors × users with permission level dropdowns. Pure utility surface. |
| 20 | Reveal Control widget | Plan §12.5 | Hybrid | Not started | Per-Major widget for flipping field visibility. Small inline component on the Major sheet (character-themed) and on the dashboard (house chrome with character accent). Confirmation step before flips — these moments are dramatic. |
| 21 | NPC Quick-Create modal | Plan §12.5 | House | Not started | Right-click empty canvas → "Create NPC here." Tiny modal: name, role, optional portrait. |
| 22 | NPC Organizer (per scene) | Plan §12.5 | House | Not started | Sidebar panel listing all Connection and NPC tokens currently placed on the active scene. Click to focus camera, hover to highlight. |
| 23 | NPC Hover Card | Plan §8 | Hybrid | Not started | Small floating panel shown when cursor enters a token. Portrait, name, relationship label, hover summary. NPC tokens use house style. Connection tokens use the connection's theme accent. |
| 24 | Edit-Conflict Warning | Plan §12.7 | House | Not started | Two-user simultaneous edit warning on shared Connections. Appears as a non-blocking toast or inline banner on the affected sheet. |

## Chat and communication

| # | Component | Source | Theme scope | Status | Notes |
|---|-----------|--------|------------|--------|-------|
| 25 | Chat card — system-emitted | CLAUDE.md §11 | House | Not started | Mechanical chat output: token spends, phase changes, "Player joined" notices. Plain. |
| 26 | Chat card — in-character (persona-aware) | Plan §12.1, CLAUDE.md schema | Character | Not started | Speaker's persona portrait + name, message body styled with active theme's `chatStyle.color` and `chatStyle.font`. Persona's `chatColor` overrides character theme's brand if set. |
| 27 | Speaking-As chat switcher | Plan §12.1 | Hybrid | Not started | Dropdown above chat input listing user's owned actors with portraits. Each entry shows the actor's theme color. The switcher chrome is house. |
| 28 | Inner Monologue editor + journal entry + chat card | Plan §12.4 | Character | Not started | Click "Take Monologue" → editor opens (1–3 sentences) → saves to per-character Monologues journal folder → posts stylized chat card with persona portrait + theme styling → sets `monologuedThisCycle = true`. The chat card is the most theme-expressive moment in normal play. |
| 29 | Inner Conflict completion ceremony card | Plan §12.4 | Character | Not started | Auto-posted when a conflict completes: "★ [Major] has resolved [conflict label] — earn an Expanded Backstory Action." Uses character theme. Auto-creates a `backstory-action` item on the Major. |
| 30 | Epistolary Letter composer | Plan §12.5 | Hybrid | Not started | Sender persona, recipient persona, subject, body, optional handwriting style. Composer chrome is house; preview pane carries the sender's full theme. |
| 31 | Epistolary Letter card (in chat / journal) | Plan §12.5 | Character (sender) | Sketched | Already proven in widget `good_society_per_character_theming_letters_demo`. Sealed, themed, beautiful. The wrapper uses `.gs-themed[data-theme="..."]` so the same template renders correctly for any sender. |
| 32 | Persona switch announcement card | CLAUDE.md §11 (switchPersona) | Character | Not started | Posted to chat when an actor swaps persona: "[Actor] is now [Persona]." Whispered or public depending on the persona's `visibility.magic`. Uses the *new* persona's theme/chat styling. |

## Component primitives

These are the reusable building blocks that compose all of the above. House style is the default; themes override via CSS variables.

| # | Component | Theme behavior | Status | Notes |
|---|-----------|----------------|--------|-------|
| 33 | Card surface | Inherits scope | Not started | Padding 18–24px, `border-radius: 12px`, 0.5px border in `--gs-accent-2` or `--gs-muted`. |
| 34 | Section header (small caps) | Inherits scope | Not started | Display font, 12px, letter-spacing 0.12em, font-feature-settings 'smcp', color `--gs-brand`. Optional 0.5px hairline rule below. |
| 35 | Hairline divider | Inherits scope | Not started | 0.5px solid `--gs-accent-2` or `--gs-muted`. Optional centered ornament (small floral or simple lozenge). |
| 36 | Text input / textarea | House | Not started | 14px body type, 0.5px border `--gs-muted`, focus ring 1px `--gs-brand`. |
| 37 | Dropdown / select | House | Not started | Match text input height (36px) and styling. |
| 38 | Checkbox | Inherits scope | Not started | Used for inner conflict box grid (large) and visibility toggles (small). |
| 39 | Inner Conflict box grid (5+5) | Character | Not started | Two columns of 5 boxes each, separated by the conflict's left/right labels. Boxes are 18px squares, hand-drawn-ish corners, fill with `--gs-brand` when checked. The completion sound/animation matters here — earning a Backstory Action is a story moment. |
| 40 | Button — primary | Inherits scope | Not started | Solid `--gs-brand` background, paper text. Used for "Take Monologue", "Cast", "Advance Phase". |
| 41 | Button — secondary | Inherits scope | Not started | Outline only. 0.5px border `--gs-brand`. Body text in `--gs-brand`. |
| 42 | Button — GM-only | House | Not started | Distinguished by a small key icon and slightly different styling. Always confirms before destructive actions. |
| 43 | Reputation tag pill — positive ▲ | Hybrid | Not started | Pill shape, paper bg, small ▲ marker, `--gs-positive` accent stripe on the left edge. Tag text in `--gs-ink`. On a character's own sheet, uses character theme palette; on the public board, the pill stays neutral but a left-edge accent uses the originating character's `--gs-brand`. |
| 44 | Reputation tag pill — negative ▼ | Hybrid | Not started | Same as above with ▼ marker and `--gs-danger` accent. |
| 45 | Resolve token track | Character | Sketched | Five-pip horizontal row. Filled pips use `--gs-brand`. Empty pips are 0.5px outlines in `--gs-accent-2`. Click to toggle individual pips; right-click resets to default starting value. Already proven in widget headers. |
| 46 | MT toggle | Character | Not started | Single small badge. Off = outline; On = filled `--gs-brand` with "MT" in paper color. |
| 47 | Monologue dot | Character | Not started | Tiny circular indicator. Available = `--gs-accent-3` filled; spent = outline only. Tooltip explains. |
| 48 | Visibility flag indicator | Hybrid | Not started | Three-state pill or inline icon: secret (closed eye, `--gs-accent-2`), public (open eye, `--gs-brand`), redacted (slash, `--gs-danger`). Small enough to sit inline next to a field label without crowding. |
| 49 | Visual reputation meter | Character | Not started | Three-pip indicator showing how close to a condition trigger. Two filled = warning state. Pure CSS off the existing tag arrays — no new state needed (per Plan §12.3). |
| 50 | Portrait frame (oval, side panel) | Character | Sketched | Oval frame, 78×92px on sheet header, smaller (e.g. 36×42px) in dock and dashboard rows. Frame border uses character theme's `--gs-brand` or `--gs-accent-1`. The "tan side panel" the printed sheet uses translates to `--gs-side-panel` per theme. |
| 51 | Token frame (canvas) | Character | Not started | Custom token ring or border art so Connection tokens read as Connections vs PCs. Uses character theme color. May be implemented via Foundry's `core.tokenRingSubject` or a custom SVG token frame. |
| 52 | Modal / dialog | House | Not started | `border-radius: 16px`, paper background, optional title bar in `--gs-brand` with paper text. Backdrop is 40% opacity ink. |
| 53 | Tab navigation | Inherits scope | Not started | See #2 above. |
| 54 | Icon button | Inherits scope | Not started | 28px square, ghost by default, hover fill `--gs-paper-warm`. |
| 55 | Tooltip | House | Not started | Small floating panel with paper bg and 0.5px `--gs-muted` border. Used for in-sheet rule explanations (Plan §12.6). Body text 12px. |
| 56 | Persona switcher | Character | Not started | Sits in the sheet's bio header. Current persona portrait + name, dropdown of others, "+ New persona" button. |
| 57 | Crest display | House | Not started | On Family sheet. Image + motto in italic display. House style because Families are shared across themes. |
| 58 | Magic skill tile | Character | Not started | Tile in the Magic/Skills section of the Major Private tab. Shows skill name, description hint, Cast button. The Cast button respects visibility — if `visibility.magic = "secret"`, casting prompts a confirm before firing the on-canvas effect (per Plan §10). |
| 59 | Family panel (read-only on Major sheet) | Hybrid | Not started | Renders Family info on the Major sheet's Public tab. Family chrome is house (for shared consistency); the panel sits inside the character-themed sheet so it's wrapped in character colors. |

## Counts

- **Sheets and apps:** 32 components
- **Primitives:** 27 components
- **Total:** 59

About 3 sketched, 56 not started. Sketched components have visual proofs in widgets but no implementation spec yet.

## Implementation order (suggested)

When this document feeds into actual code work in Claude Code, the recommended order matches the system plan's build phases (CLAUDE.md §13, Plan §14):

1. Component primitives 33–35 (card, section header, divider) — foundational, used everywhere
2. Component primitives 40–42 (buttons), 36–38 (form inputs)
3. Major Character sheet header (#1) — first character-themed surface, validates the wrapper mechanism
4. Resolve token track (#45), MT toggle (#46), monologue dot (#47) — token economy primitives
5. Reputation tag pills (#43, #44) and meter (#49)
6. Inner Conflict box grid (#39) — the highest-stakes mechanical primitive
7. Major Character sheet tabs (#2–5) and full layout
8. Connection sheet (#6), Family sheet (#7), NPC sheet (#8) — remaining actor sheets
9. Item sheets (#9–13)
10. Public Info dashboard (#14), Cycle HUD (#16), My Characters dock (#15)
11. Chat cards (#25–32) including monologue and letter flows
12. Upkeep Wizard (#17) — the highest-impact polish surface
13. Remaining apps and primitives

This roughly tracks the system plan's phases 1–11.

## Files this will spawn

As individual components reach the design stage, they get their own document under `docs/design/`:

- `04-character-sheet.md` — full Major Character sheet design (depends on schema lockdown)
- `05-epistolary-ui.md` — letter composer + card design
- `06-reputation-board.md` — public board + tag pills + visual meter
- `07-token-economy.md` — resolve / MT / monologue UI
- `08-inner-conflict.md` — the box grid, completion ceremony
- `09-public-info-dashboard.md` — facilitator view
- `10-cycle-phase-hud.md` — persistent strip
- `11-upkeep-wizard.md` — multi-step modal flow
- `12-persona-switcher.md` — in-sheet persona UX
- `13-chat-cards.md` — all chat card variants
- `14-npc-hover-card.md` — canvas overlay

Numbering is suggested but not binding — open files as the work demands.

## Changelog

| Date       | Change                                                                |
|------------|-----------------------------------------------------------------------|
| 2026-05-05 | File created. Full inventory of 59 components captured with theme scope and design status. Three components (#1, #6, #31) sketched via widgets; rest not started. |
