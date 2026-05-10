/**
 * Chrome icons — post-MVP §14 / patch-foundry-chrome-icons.md.
 *
 * Replaces Foundry's default Font Awesome glyphs on scene controls and sidebar
 * tabs with custom illustrated SVGs from the `CHROME_ICONS` registry. The icon
 * swap is purely CSS (pseudo-element + asset URL); this module's only job is
 * to mark each renderable target with `data-icon-asset` and an inline
 * `--icon-asset` CSS variable so the foundry-chrome.css rules can resolve.
 *
 * Activation gate: stacks on top of `applyFoundryChrome` — chrome icons swap
 * only when BOTH `applyFoundryChrome` AND `applyChromeIcons` are true. Body
 * classes (`gs-chrome-themed` + `gs-chrome-icons-on`) gate the CSS; this hook
 * always runs (cheap; sets DOM attributes) and the CSS decides whether to
 * apply the swap.
 *
 * Per-asset graceful fallback: each registry entry with an asset path is
 * probed via `fetch HEAD` once on first reference. If the SVG 200s, the
 * data-icon-asset attribute is stamped on matching elements and the FA
 * glyph hides. If the SVG 404s (e.g. the GM hasn't supplied art yet), no
 * attribute is set and Foundry's default FA glyph renders untouched.
 * Result: the chrome-icons feature can be left on permanently, and any
 * subset of icons that have art supplied get the upgrade — the rest stay
 * legible. (Was: hook always set the attribute regardless of file
 * existence, which left buttons empty until every slot had art. Changed
 * 2026-05-09 in response to first-time-install UX.)
 */

import { CHROME_ICONS } from '../constants.js';

/**
 * Asset existence cache. Each unique asset URL is probed once via fetch
 * HEAD; the result is reused for every subsequent lookup. Cleared only by
 * a full page reload (which is the right scope — assets don't change
 * mid-session, and supplying new art requires a hard reload anyway).
 */
const _assetExists = new Map();
async function _checkAssetExists(url) {
  if (!url) return false;
  if (_assetExists.has(url)) return _assetExists.get(url);
  const ok = await fetch(url, { method: 'HEAD', cache: 'no-cache' })
    .then((r) => r.ok)
    .catch(() => false);
  _assetExists.set(url, ok);
  return ok;
}

async function _setIconAttr(el, key, asset) {
  if (!el || !key || !asset) return;
  if (!(await _checkAssetExists(asset))) return;
  el.setAttribute('data-icon-asset', key);
  el.style.setProperty('--icon-asset', `url('${asset}')`);
}

/**
 * Walk `renderSceneControls` output and mark every control button.
 * Foundry's scene controls render with `data-control="<id>"` attributes;
 * the registry keys match those IDs.
 */
async function _markSceneControls(html) {
  const root = html?.[0] ?? html;
  if (!root || typeof root.querySelectorAll !== 'function') return;
  for (const el of root.querySelectorAll('[data-control]')) {
    const id = el.dataset.control;
    const entry = CHROME_ICONS.sceneControls?.[id];
    if (!entry?.asset) continue;
    await _setIconAttr(el, id, entry.asset);
  }
}

/**
 * Walk `renderSidebarTab` output. Foundry sidebar tabs render under elements
 * with `data-tab="<id>"`; the registry keys match those IDs.
 */
async function _markSidebarTab(html) {
  const root = html?.[0] ?? html;
  if (!root || typeof root.querySelectorAll !== 'function') return;
  // The hook fires per-tab; check both the root itself and any nested tab buttons.
  const candidates = [root, ...root.querySelectorAll('[data-tab]')].filter(Boolean);
  for (const el of candidates) {
    const id = el.dataset?.tab;
    if (!id) continue;
    const entry = CHROME_ICONS.sidebarTabs?.[id];
    if (!entry?.asset) continue;
    await _setIconAttr(el, id, entry.asset);
  }
}

/**
 * Mark journal sidebar entry rows with their `entryType` flag → glyph.
 * Per post-MVP §13.2 — the sidebar list renders a small entry-type glyph at
 * each row's leading edge, dispatched via `data-entry-type`. Same per-asset
 * existence check as scene controls / sidebar tabs: if no SVG is supplied,
 * the row renders without the glyph slot (rather than an empty 14 px gap).
 */
async function _markJournalEntries(html) {
  const root = html?.[0] ?? html;
  if (!root || typeof root.querySelectorAll !== 'function') return;
  for (const el of root.querySelectorAll('[data-document-id]')) {
    const id = el.dataset.documentId;
    const entry = id ? game.journal?.get(id) : null;
    if (!entry) continue;
    const flag = entry.getFlag?.('good-society-homebrew', 'entryType');
    if (!flag) continue;
    const def = CHROME_ICONS.journalEntries?.[flag];
    if (!def?.asset) continue;
    if (!(await _checkAssetExists(def.asset))) continue;
    el.setAttribute('data-entry-type', flag);
    el.style.setProperty('--journal-glyph-asset', `url('${def.asset}')`);
  }
}

export function register() {
  Hooks.on('renderSceneControls', (_app, html) => _markSceneControls(html));
  Hooks.on('renderSidebarTab',    (_app, html) => _markSidebarTab(html));
  Hooks.on('renderJournalDirectory', (_app, html) => _markJournalEntries(html));
  Hooks.on('renderJournalEntryDirectory', (_app, html) => _markJournalEntries(html));
}
