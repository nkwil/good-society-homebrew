/**
 * GM Tools popover — vanilla-DOM dropdown that lists the Good Society
 * GM-only canvas tools under a single scene-control button.
 *
 * Before this consolidation, the scene control bar carried five separate
 * GM-only buttons (NPC Organizer, Bulk Permissions, Session Log, Events
 * Command Center, Return to Splash) + the Cast Manager, cluttering the
 * canvas chrome for a GM already using the Cabinet drawer. This popover
 * surfaces the same tools from one anchor.
 *
 * Vanilla DOM (per the CLAUDE.md §16 anti-pattern against ApplicationV2
 * for transient overlays) — one node is appended to document.body on
 * open, removed on close. Click outside / Escape dismisses.
 */

import { toggleOrganizer } from './npc-organizer.js';
import { openBulkPermissionsPanel } from './bulk-permissions-panel.js';
import { openSessionLogPreview } from './session-log-preview.js';
import { openEventCommandCenter } from './event-command-center.js';
import { openCastManager } from './cast-of-characters.js';
import { returnToSplash } from '../hooks/scene-controls.js';
import { startSession, endSession, isSessionActive, currentSessionNumber } from '../helpers/session-mechanism.js';
import { openSessionRecaps } from './session-recaps.js';

const NS = 'good-society-homebrew';

let _popover = null;
let _dismissHandler = null;
let _keyHandler = null;

/** The ordered GM tool entries. Each is a plain descriptor; the popover
 *  renders one row per entry and dispatches to `action` on click. */
function _tools() {
  const sessionActive = isSessionActive();
  const sessionN = currentSessionNumber();
  const sessionLabel = sessionActive
    ? game.i18n.format('GOODSOCIETY.gmToolsPopover.endSession', { n: sessionN })
    : game.i18n.format('GOODSOCIETY.gmToolsPopover.startSession', { n: sessionN + 1 });
  return [
    // Session mechanism — top of the list, because it's the GM's bookend
    // for a sitting. Label flips between start/end based on world state.
    {
      key: 'session-toggle',
      label: sessionLabel,
      icon: sessionActive ? 'fa-solid fa-circle-stop' : 'fa-solid fa-circle-play',
      action: () => sessionActive ? endSession() : startSession(),
    },
    {
      key: 'session-recaps',
      label: game.i18n.localize('GOODSOCIETY.gmToolsPopover.sessionRecaps'),
      icon: 'fa-solid fa-book-bookmark',
      action: () => openSessionRecaps(),
    },
    {
      key: 'events',
      label: game.i18n.localize('GOODSOCIETY.gmToolsPopover.events'),
      icon: 'fa-solid fa-bolt',
      action: () => openEventCommandCenter(),
    },
    {
      key: 'cast-manage',
      label: game.i18n.localize('GOODSOCIETY.gmToolsPopover.castManage'),
      icon: 'fa-solid fa-masks-theater',
      action: () => openCastManager(),
    },
    {
      key: 'organizer',
      label: game.i18n.localize('GOODSOCIETY.gmToolsPopover.organizer'),
      icon: 'fa-solid fa-list',
      action: () => toggleOrganizer(),
    },
    {
      key: 'permissions',
      label: game.i18n.localize('GOODSOCIETY.gmToolsPopover.permissions'),
      icon: 'fa-solid fa-key',
      action: () => openBulkPermissionsPanel(),
    },
    {
      key: 'session-log',
      label: game.i18n.localize('GOODSOCIETY.gmToolsPopover.sessionLog'),
      icon: 'fa-solid fa-book-bookmark',
      action: () => openSessionLogPreview(),
    },
    {
      key: 'splash',
      label: game.i18n.localize('GOODSOCIETY.gmToolsPopover.splash'),
      icon: 'fa-solid fa-door-open',
      action: () => returnToSplash(),
    },
  ];
}

/** Open (or re-open) the popover anchored to the given DOM element.
 *  Calling again while open closes it — the scene-control button acts
 *  as a toggle, same as the drawer-toggle pattern. */
export function openGmToolsPopover({ anchor } = {}) {
  if (!game.user?.isGM) return;
  if (_popover) {
    closeGmToolsPopover();
    return;
  }

  const tools = _tools();

  const el = document.createElement('div');
  el.className = 'gs-gm-tools-popover';
  el.setAttribute('role', 'menu');
  el.setAttribute('aria-label', game.i18n.localize('GOODSOCIETY.gmToolsPopover.title'));

  const list = document.createElement('ul');
  list.className = 'gs-gm-tools-popover__list';

  for (const tool of tools) {
    const li = document.createElement('li');
    li.className = 'gs-gm-tools-popover__item';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gs-gm-tools-popover__btn';
    btn.setAttribute('role', 'menuitem');

    const icon = document.createElement('i');
    icon.className = `gs-gm-tools-popover__icon ${tool.icon}`;
    icon.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'gs-gm-tools-popover__label';
    label.textContent = tool.label;

    btn.append(icon, label);
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      try { tool.action(); } catch (err) { console.warn('GS | GM tool action failed:', err); }
      closeGmToolsPopover();
    });

    li.append(btn);
    list.append(li);
  }

  el.append(list);
  document.body.append(el);
  _popover = el;
  _positionPopover(anchor);

  // Dismiss on outside click or Escape.
  _dismissHandler = (ev) => {
    if (!_popover) return;
    if (_popover.contains(ev.target)) return;
    // Don't dismiss when clicking the anchor itself — Foundry's scene
    // control will fire onChange on click, and openGmToolsPopover's
    // "already open? close" branch handles the toggle. Live-query the
    // anchor each time so Foundry's scene-control re-renders (which
    // replace the DOM node between clicks) don't leave us with a stale
    // reference that misses the toggle target.
    const liveAnchor = findGmToolsAnchor() ?? anchor;
    if (liveAnchor && liveAnchor.contains(ev.target)) return;
    closeGmToolsPopover();
  };
  _keyHandler = (ev) => {
    if (ev.key === 'Escape') { ev.stopPropagation(); closeGmToolsPopover(); }
  };
  // Capture-phase to beat Foundry's own listeners.
  document.addEventListener('mousedown', _dismissHandler, true);
  document.addEventListener('keydown',   _keyHandler,     true);
}

export function closeGmToolsPopover() {
  if (!_popover) return;
  _popover.remove();
  _popover = null;
  if (_dismissHandler) document.removeEventListener('mousedown', _dismissHandler, true);
  if (_keyHandler)     document.removeEventListener('keydown',   _keyHandler,     true);
  _dismissHandler = null;
  _keyHandler = null;
}

/** Place the popover to the right of the anchor (fallback: 60px from
 *  the left edge of the viewport, roughly where the scene control bar
 *  sits in Foundry v13 defaults). */
function _positionPopover(anchor) {
  if (!_popover) return;
  _popover.style.position = 'fixed';
  // 10001 so the popover stacks above every other GS surface: tooltip
  // (10000), ApplicationV2 sheet frames (>1000), Cabinet drawer (1000),
  // My Characters Dock + Speaking-As bar (50 each). A transient menu
  // should always sit on top of persistent chrome.
  _popover.style.zIndex = '10001';

  // Measure first so the layout is settled before we read offsets.
  _popover.style.visibility = 'hidden';
  _popover.style.left = '0';
  _popover.style.top  = '0';

  requestAnimationFrame(() => {
    if (!_popover) return;
    const rect = _popover.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = 68;    // just right of the Foundry scene control bar
    let top  = 120;   // roughly aligned with first tool entry
    if (anchor && anchor.getBoundingClientRect) {
      const a = anchor.getBoundingClientRect();
      top = a.top;
      // Smart edge: anchor on the LEFT half → open to the right of it
      // (scene control bar case). Anchor on the RIGHT half → open to the
      // left (Cabinet rail / drawer case). Either way we never overlap
      // the anchor itself.
      const anchorMidX = (a.left + a.right) / 2;
      if (anchorMidX < vw / 2) {
        left = a.right + 6;
      } else {
        left = a.left - rect.width - 6;
      }
    }
    // Clamp inside the viewport.
    if (left < 12)                     left = 12;
    if (left + rect.width > vw - 12)   left = Math.max(12, vw - rect.width - 12);
    if (top  < 12)                     top  = 12;
    if (top  + rect.height > vh - 12)  top  = Math.max(12, vh - rect.height - 12);
    _popover.style.left = `${left}px`;
    _popover.style.top  = `${top}px`;
    _popover.style.visibility = 'visible';
  });
}

/** Find the GM Tools scene-control button in the DOM. Foundry v13 marks
 *  tool buttons with `[data-tool="<name>"]`. Returns null if not mounted. */
export function findGmToolsAnchor() {
  return document.querySelector('[data-tool="gs-gm-tools"]')
    ?? document.querySelector('button[data-control-name="gs-gm-tools"]')
    ?? null;
}
