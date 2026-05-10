/**
 * System-wide registries used by post-MVP feature batches.
 *
 * Three registries live here:
 *   - SEAL_TYPES      — Epistolary seal vocabulary (post-MVP §11.2)
 *   - COWORK_SURFACES — Cabinet visibility surfaces (post-MVP §9)
 *   - CHROME_ICONS    — Foundry chrome icon registry (post-MVP §14)
 *
 * Each follows the same id-keyed pattern: surface-id keys, GM-supplied custom
 * illustration assets dropped into a known asset directory, graceful fallback
 * when an asset is missing. Adding a new entry is additive — no schema
 * changes anywhere else.
 */

// Leading slash matters: when an asset URL ends up inside a CSS variable
// consumed by a stylesheet (e.g. `--cabinet-icon` consumed by _cabinet.css),
// the browser resolves a relative URL against the STYLESHEET'S location, not
// the document. Without the leading slash, mask-image/background-image
// requests get rewritten to .../styles/apps/systems/... and 404. The leading
// slash forces absolute resolution from the host root, which is correct in
// every consumption context (img src, background-image, mask-image, JS).
const ASSETS_BASE = '/systems/good-society-homebrew/assets';

/**
 * SEAL_TYPES — typed wax-seal registry for the Epistolary phase.
 * Per post-MVP §11.2, but expanded 2026-05 to the full hand-rendered seal
 * library shipped in `assets/seals/`. Future types get appended without
 * schema changes anywhere else.
 *
 * Each entry:
 *   - id          — string key, used as `letter.seal` value on chat-card flags
 *   - label       — localization-key fragment (resolves under GOODSOCIETY.seal.{id})
 *   - color       — hex tint used for the disc rim / accent when the asset
 *                   itself isn't enough (e.g. small inline indicator)
 *   - iconAsset   — path to the rendered wax-seal PNG; consumed as a
 *                   background-image by both the composer picker and the
 *                   chat-card footer indicator
 *   - behavior    — null | 'invitation' | 'burn' — drives downstream wiring
 *                   (see `module/hooks/letter-seals.js`)
 *   - description — localization-key fragment (GOODSOCIETY.seal.{id}Hint)
 *
 * Picker ORDER below = display order. Grouped roughly: plain wax colors,
 * then motif seals, then heraldic family seals.
 */
export const SEAL_TYPES = [
  // ── Plain wax colors ────────────────────────────────────────────────────
  { id: 'yellow',   label: 'yellow',   color: '#C9A33C',
    iconAsset: `${ASSETS_BASE}/seals/yellow.png`,   behavior: null, description: 'yellowHint' },
  { id: 'green',    label: 'green',    color: '#4A6B4A',
    iconAsset: `${ASSETS_BASE}/seals/green.png`,    behavior: null, description: 'greenHint' },
  { id: 'red-gold', label: 'redGold',  color: '#8B2A2A',
    iconAsset: `${ASSETS_BASE}/seals/red-gold.png`, behavior: 'invitation', description: 'redGoldHint' },
  { id: 'copper',   label: 'copper',   color: '#A35930',
    iconAsset: `${ASSETS_BASE}/seals/copper.png`,   behavior: null, description: 'copperHint' },
  { id: 'purple',   label: 'purple',   color: '#5E3C72',
    iconAsset: `${ASSETS_BASE}/seals/purple.png`,   behavior: null, description: 'purpleHint' },
  { id: 'grey',     label: 'grey',     color: '#6E6E6E',
    iconAsset: `${ASSETS_BASE}/seals/grey.png`,     behavior: null, description: 'greyHint' },
  { id: 'black',    label: 'black',    color: '#1f1f1f',
    iconAsset: `${ASSETS_BASE}/seals/black.png`,    behavior: 'burn', description: 'blackHint' },

  // ── Motif seals ────────────────────────────────────────────────────────
  { id: 'gold-key', label: 'goldKey',  color: '#C9A33C',
    iconAsset: `${ASSETS_BASE}/seals/gold-key.png`, behavior: null, description: 'goldKeyHint' },
  { id: 'snake',    label: 'snake',    color: '#3F5A45',
    iconAsset: `${ASSETS_BASE}/seals/snake.png`,    behavior: null, description: 'snakeHint' },
  { id: 'owl',      label: 'owl',      color: '#5A4E36',
    iconAsset: `${ASSETS_BASE}/seals/owl.png`,      behavior: null, description: 'owlHint' },
  { id: 'sun',      label: 'sun',      color: '#D4A04C',
    iconAsset: `${ASSETS_BASE}/seals/sun.png`,      behavior: null, description: 'sunHint' },
  { id: 'mushroom', label: 'mushroom', color: '#7A4A3A',
    iconAsset: `${ASSETS_BASE}/seals/mushroom.png`, behavior: null, description: 'mushroomHint' },
  { id: 'acorn',    label: 'acorn',    color: '#7A5A36',
    iconAsset: `${ASSETS_BASE}/seals/acorn.png`,    behavior: null, description: 'acornHint' },

  // ── Heraldic family seals ──────────────────────────────────────────────
  { id: 'house-cloudcandle', label: 'houseCloudcandle', color: '#cfc6a8',
    iconAsset: `${ASSETS_BASE}/seals/house-cloudcandle.png`, behavior: null, description: 'houseCloudcandleHint' },
  { id: 'house-willowood',   label: 'houseWillowood',   color: '#bfa97c',
    iconAsset: `${ASSETS_BASE}/seals/house-willowood.png`,   behavior: null, description: 'houseWillowoodHint' },
];

/**
 * COWORK_SURFACES — Cabinet drawer registry.
 * Per post-MVP §9. Each entry declares a UI surface that the Cabinet drawer
 * exposes. Two kinds are supported:
 *
 *   - `kind: 'toggle'` (default) — flips a body class to hide/show a
 *     persistent surface. Rendered as a toggle pill in the drawer and as a
 *     glyph button in the rail.
 *   - `kind: 'launcher'` — opens a modal/dialog when clicked. Rendered as
 *     an "Open ↗" outline button in the drawer; skipped from the rail
 *     (drawer-only) so the rail stays a coherent visibility-state surface.
 *
 * Each entry:
 *   - id              — string key, persisted in user.flags.cabinetVisibility
 *                       (toggle entries only)
 *   - group           — 'system' | 'modules' | 'foundry' | 'gmTools'
 *   - label           — display label (localization-key fragment)
 *   - railGlyph       — 1–2 letter fallback when no chrome icon is present
 *                       (toggle entries only)
 *   - hideBodyClass   — body class toggled when the surface is hidden
 *                       (toggle entries only)
 *   - defaultVisible  — whether the surface starts shown for new users
 *                       (toggle entries only)
 *   - ifModule        — optional module ID gate; surface only appears when
 *                       the named module is active
 *   - kind            — 'toggle' (default) | 'launcher'
 *   - gmOnly          — when true, only renders for GM users
 *   - launcherKey     — opaque key resolved against the LAUNCHERS map in
 *                       module/apps/cabinet.js (launcher entries only)
 */
export const COWORK_SURFACES = [
  // ── Rail order (minimized cabinet) ───────────────────────────────────────
  // The six entries below appear in the rail in this order. Their `railGlyph`
  // doubles as the "in-rail" indicator; without one, an entry only renders in
  // the drawer. Custom SVG icons live under assets/cabinet/<id>.svg and are
  // referenced by CHROME_ICONS.cabinetRail (further down) — when present,
  // the icon supersedes the railGlyph letters.
  { id: 'my-characters-dock',    group: 'system',  label: 'GOODSOCIETY.cabinet.surface.dock',          railGlyph: 'D',  hideBodyClass: 'gs-hide-dock',        defaultVisible: true  },
  { id: 'gs-dashboard-launch',   group: 'system',  label: 'GOODSOCIETY.cabinet.surface.dashboard',     railGlyph: 'PI', kind: 'launcher', launcherKey: 'dashboard'   },
  { id: 'gs-novel-reader-launch',group: 'system',  label: 'GOODSOCIETY.cabinet.surface.novelReader',   railGlyph: 'NR', kind: 'launcher', launcherKey: 'novelReader' },
  { id: 'tool-rumours',          group: 'tools',   label: 'GOODSOCIETY.cabinet.surface.rumourBoard',   railGlyph: 'RB', kind: 'launcher', launcherKey: 'rumours'  },
  { id: 'tool-letter',           group: 'tools',   label: 'GOODSOCIETY.cabinet.surface.letterComposer',railGlyph: 'LC', kind: 'launcher', launcherKey: 'letter'   },
  { id: 'tool-calendar',         group: 'tools',   label: 'GOODSOCIETY.cabinet.surface.calendar',      railGlyph: 'ET', kind: 'launcher', launcherKey: 'calendar' },

  // ── Drawer-only entries (no railGlyph → not in rail) ─────────────────────
  // Cycle HUD: persistent UI but the toggle is drawer-only so the rail stays
  // focused on the six core "boards/tools."
  { id: 'cycle-hud',             group: 'system',  label: 'GOODSOCIETY.cabinet.surface.cycleHud',                       hideBodyClass: 'gs-hide-cycle-hud',   defaultVisible: true  },

  // GM Tools (launchers, GM-only)
  { id: 'gm-tool-events',        group: 'gmTools', label: 'GOODSOCIETY.cabinet.surface.eventCommandCenter', kind: 'launcher', gmOnly: true, launcherKey: 'events'      },
  { id: 'gm-tool-organizer',     group: 'gmTools', label: 'GOODSOCIETY.cabinet.surface.npcOrganizer',     kind: 'launcher', gmOnly: true, launcherKey: 'organizer'   },
  { id: 'gm-tool-permissions',   group: 'gmTools', label: 'GOODSOCIETY.cabinet.surface.bulkPermissions',  kind: 'launcher', gmOnly: true, launcherKey: 'permissions' },
  { id: 'gm-tool-session-log',   group: 'gmTools', label: 'GOODSOCIETY.cabinet.surface.sessionLogOpen',   kind: 'launcher', gmOnly: true, launcherKey: 'sessionLog'  },

  // Third-party modules (gated on activation)
  { id: 'module-sequencer',      group: 'modules', label: 'GOODSOCIETY.cabinet.surface.sequencer',     hideBodyClass: 'gs-hide-sequencer',   defaultVisible: true,  ifModule: 'sequencer'    },
  { id: 'module-token-mold',     group: 'modules', label: 'GOODSOCIETY.cabinet.surface.tokenMold',     hideBodyClass: 'gs-hide-token-mold',  defaultVisible: true,  ifModule: 'token-mold'   },
  { id: 'module-dice-tray',      group: 'modules', label: 'GOODSOCIETY.cabinet.surface.diceTray',      hideBodyClass: 'gs-hide-dice-tray',   defaultVisible: false, ifModule: 'dice-tray'    },

  // Foundry chrome (toggleable, drawer-only)
  { id: 'foundry-players-list',  group: 'foundry', label: 'GOODSOCIETY.cabinet.surface.playersList',   hideBodyClass: 'gs-hide-players',     defaultVisible: true  },
  { id: 'foundry-sidebar',       group: 'foundry', label: 'GOODSOCIETY.cabinet.surface.sidebar',       hideBodyClass: 'gs-hide-sidebar',     defaultVisible: true  },
  { id: 'foundry-hotbar',        group: 'foundry', label: 'GOODSOCIETY.cabinet.surface.hotbar',        hideBodyClass: 'gs-hide-hotbar',      defaultVisible: true  },
];

/**
 * CHROME_ICONS — Foundry chrome icon registry.
 * Per post-MVP §14.2. Three sub-objects keyed by surface ID. Custom illustrated
 * SVGs dropped at `assets/chrome-icons/{filename}.svg` replace the default
 * Font Awesome glyphs when `applyFoundryChrome` AND `applyChromeIcons` are
 * both true.
 *
 * Missing assets degrade gracefully — the original FA glyph still renders.
 * No code path errors when a key is absent or its asset 404s.
 *
 * Day-one default: the registry ships fully populated for slot reservation,
 * but most assets do not yet exist on disk. As Natalie supplies illustrations,
 * the corresponding surfaces flip from FA glyph to custom illustration. The
 * Cabinet rail's day-one default is letter glyphs (`patch-cabinet.md` §3.4)
 * until `cabinetRail` entries acquire real assets — the rail's render path
 * checks asset presence per-entry.
 */
export const CHROME_ICONS = {
  sceneControls: {
    token:           { asset: `${ASSETS_BASE}/chrome-icons/scene-token.svg`,        label: 'chromeIcon.sceneControls.token' },
    measure:         { asset: `${ASSETS_BASE}/chrome-icons/scene-measure.svg`,      label: 'chromeIcon.sceneControls.measure' },
    tiles:           { asset: `${ASSETS_BASE}/chrome-icons/scene-tiles.svg`,        label: 'chromeIcon.sceneControls.tiles' },
    drawings:        { asset: `${ASSETS_BASE}/chrome-icons/scene-drawings.svg`,     label: 'chromeIcon.sceneControls.drawings' },
    walls:           { asset: `${ASSETS_BASE}/chrome-icons/scene-walls.svg`,        label: 'chromeIcon.sceneControls.walls' },
    lighting:        { asset: `${ASSETS_BASE}/chrome-icons/scene-lighting.svg`,     label: 'chromeIcon.sceneControls.lighting' },
    sounds:          { asset: `${ASSETS_BASE}/chrome-icons/scene-sounds.svg`,       label: 'chromeIcon.sceneControls.sounds' },
    regions:         { asset: `${ASSETS_BASE}/chrome-icons/scene-regions.svg`,      label: 'chromeIcon.sceneControls.regions' },
    notes:           { asset: `${ASSETS_BASE}/chrome-icons/scene-notes.svg`,        label: 'chromeIcon.sceneControls.notes' },
    // System-injected controls
    'gs-dashboard':  { asset: `${ASSETS_BASE}/chrome-icons/gs-dashboard.svg`,       label: 'chromeIcon.sceneControls.gsDashboard' },
    'gs-organizer':  { asset: `${ASSETS_BASE}/chrome-icons/gs-organizer.svg`,       label: 'chromeIcon.sceneControls.gsOrganizer' },
    'gs-permissions':{ asset: `${ASSETS_BASE}/chrome-icons/gs-permissions.svg`,     label: 'chromeIcon.sceneControls.gsPermissions' },
    'gs-session-log':{ asset: `${ASSETS_BASE}/chrome-icons/gs-session-log.svg`,     label: 'chromeIcon.sceneControls.gsSessionLog' },
    'gs-calendar':   { asset: `${ASSETS_BASE}/chrome-icons/gs-calendar.svg`,        label: 'chromeIcon.sceneControls.gsCalendar' },
    'gs-letter':     { asset: `${ASSETS_BASE}/chrome-icons/gs-letter.svg`,          label: 'chromeIcon.sceneControls.gsLetter' },
    'gs-rumours':    { asset: `${ASSETS_BASE}/chrome-icons/gs-rumours.svg`,         label: 'chromeIcon.sceneControls.gsRumours' },
    'gs-novel-reader':{ asset: `${ASSETS_BASE}/chrome-icons/gs-novel-reader.svg`,   label: 'chromeIcon.sceneControls.gsNovelReader' },
  },

  sidebarTabs: {
    chat:       { asset: `${ASSETS_BASE}/chrome-icons/tab-chat.svg`,       label: 'chromeIcon.sidebarTabs.chat' },
    combat:     { asset: `${ASSETS_BASE}/chrome-icons/tab-combat.svg`,     label: 'chromeIcon.sidebarTabs.combat' },
    scenes:     { asset: `${ASSETS_BASE}/chrome-icons/tab-scenes.svg`,     label: 'chromeIcon.sidebarTabs.scenes' },
    actors:     { asset: `${ASSETS_BASE}/chrome-icons/tab-actors.svg`,     label: 'chromeIcon.sidebarTabs.actors' },
    items:      { asset: `${ASSETS_BASE}/chrome-icons/tab-items.svg`,      label: 'chromeIcon.sidebarTabs.items' },
    journal:    { asset: `${ASSETS_BASE}/chrome-icons/tab-journal.svg`,    label: 'chromeIcon.sidebarTabs.journal' },
    tables:     { asset: `${ASSETS_BASE}/chrome-icons/tab-tables.svg`,     label: 'chromeIcon.sidebarTabs.tables' },
    cards:      { asset: `${ASSETS_BASE}/chrome-icons/tab-cards.svg`,      label: 'chromeIcon.sidebarTabs.cards' },
    playlists:  { asset: `${ASSETS_BASE}/chrome-icons/tab-playlists.svg`,  label: 'chromeIcon.sidebarTabs.playlists' },
    compendium: { asset: `${ASSETS_BASE}/chrome-icons/tab-compendium.svg`, label: 'chromeIcon.sidebarTabs.compendium' },
    settings:   { asset: `${ASSETS_BASE}/chrome-icons/tab-settings.svg`,   label: 'chromeIcon.sidebarTabs.settings' },
  },

  // Cabinet rail icons. Each entry maps a cabinet surface ID to an SVG asset.
  // Rendered via CSS mask-image in the brand-accent color (terracotta on
  // house surfaces) by `styles/apps/_cabinet.css`. Falls back to the
  // surface's `railGlyph` when no entry is present here.
  cabinetRail: {
    'my-characters-dock':     { asset: `${ASSETS_BASE}/cabinet/my-characters-dock.svg`,     label: 'GOODSOCIETY.cabinet.surface.dock'           },
    'gs-dashboard-launch':    { asset: `${ASSETS_BASE}/cabinet/public-info-dashboard.svg`,  label: 'GOODSOCIETY.cabinet.surface.dashboard'      },
    'gs-novel-reader-launch': { asset: `${ASSETS_BASE}/cabinet/novel-reader.svg`,           label: 'GOODSOCIETY.cabinet.surface.novelReader'    },
    'tool-rumours':           { asset: `${ASSETS_BASE}/cabinet/rumour-board.svg`,           label: 'GOODSOCIETY.cabinet.surface.rumourBoard'    },
    'tool-letter':            { asset: `${ASSETS_BASE}/cabinet/letter-composer.svg`,        label: 'GOODSOCIETY.cabinet.surface.letterComposer' },
    'tool-calendar':          { asset: `${ASSETS_BASE}/cabinet/event-timeline.svg`,         label: 'GOODSOCIETY.cabinet.surface.calendar'       },
  },

  // Journal-entry-type glyphs (patch-journal-elevation §13.2). Rendered at the
  // leading edge of journal sidebar rows via a renderJournalDirectory hook.
  journalEntries: {
    letter:       { asset: `${ASSETS_BASE}/chrome-icons/journal-letter.svg`,       label: 'chromeIcon.journalEntries.letter' },
    monologue:    { asset: `${ASSETS_BASE}/chrome-icons/journal-monologue.svg`,    label: 'chromeIcon.journalEntries.monologue' },
    sessionLog:   { asset: `${ASSETS_BASE}/chrome-icons/journal-session-log.svg`,  label: 'chromeIcon.journalEntries.sessionLog' },
    cycleDivider: { asset: `${ASSETS_BASE}/chrome-icons/journal-cycle-divider.svg`, label: 'chromeIcon.journalEntries.cycleDivider' },
  },
};

/**
 * Convenience helper — resolve an icon entry by surface key.
 * Returns the entry object, or null if no entry exists. Callers should check
 * for null AND for asset-on-disk presence before rendering — the registry
 * ships with placeholder paths whose files may not exist yet.
 */
export function chromeIcon(category, key) {
  return CHROME_ICONS[category]?.[key] ?? null;
}

/**
 * THEME_REGISTRY — Major character themes with display labels + cream-surface
 * swatch colors for the dossier's inline theme switcher (post-MVP §4.5b /
 * patch-dossier-refactor §3.7). Entries match `MAJOR_THEMES` enum in
 * `module/data-models/major-character.js`. Order is the canonical display
 * order (rose → roger → clayton → dixon → avril → pearlinda → secret).
 *
 * `swatchColor` is the hex shown on the theme switcher's swatch row. For
 * Secret, we substitute the dark-steel `--gs-accent-2` `#485468` per the
 * cream-surface contrast exception (post-MVP §6.5) — the cool-grey brand
 * `#8E96A8` fails AA on cream paper.
 */
export const THEME_REGISTRY = [
  { id: 'rose',      label: 'GOODSOCIETY.theme.rose',      swatchColor: '#B85B6F' },
  { id: 'roger',     label: 'GOODSOCIETY.theme.roger',     swatchColor: '#4A6B8B' },
  { id: 'clayton',   label: 'GOODSOCIETY.theme.clayton',   swatchColor: '#4a6b3f' },
  { id: 'dixon',     label: 'GOODSOCIETY.theme.dixon',     swatchColor: '#8B2A22' },
  { id: 'avril',     label: 'GOODSOCIETY.theme.avril',     swatchColor: '#5B3B9C' },
  { id: 'pearlinda', label: 'GOODSOCIETY.theme.pearlinda', swatchColor: '#A8255F' },
  { id: 'secret',    label: 'GOODSOCIETY.theme.secret',    swatchColor: '#485468' },
];

/**
 * CONNECTION_THEME_REGISTRY — the 5 dedicated connection variants. Connections
 * can also pick any Major theme (see CONNECTION_FULL_THEME_REGISTRY below)
 * but these are the "canonical" connection palette options.
 */
export const CONNECTION_THEME_REGISTRY = [
  { id: 'connection-green',  label: 'GOODSOCIETY.theme.connection-green',  swatchColor: '#3F7240' },
  { id: 'connection-purple', label: 'GOODSOCIETY.theme.connection-purple', swatchColor: '#7B3F95' },
  { id: 'connection-blue',   label: 'GOODSOCIETY.theme.connection-blue',   swatchColor: '#2A5DA0' },
  { id: 'connection-yellow', label: 'GOODSOCIETY.theme.connection-yellow', swatchColor: '#A88528' },
  { id: 'connection-grey',   label: 'GOODSOCIETY.theme.connection-grey',   swatchColor: '#4F5258' },
];

/**
 * CONNECTION_FULL_THEME_REGISTRY — the full palette available to Connection
 * actors: the 5 dedicated variants plus all 7 Major themes (including secret).
 * Used by the Connection sheet's theme picker dialog. Order is grouped:
 * connection variants first (canonical), then Major themes.
 */
export const CONNECTION_FULL_THEME_REGISTRY = [
  ...CONNECTION_THEME_REGISTRY,
  ...THEME_REGISTRY,
];
