/**
 * Rule Tooltip system — hover-triggered rule explanations on section headers.
 *
 * Any element with [data-tooltip-key] gets a hoverable tooltip populated from
 * GOODSOCIETY.tooltips.{key}.body (required) and
 * GOODSOCIETY.tooltips.{key}.pageRef (optional).
 *
 * Per docs/design/20-rule-tooltips.md.
 *
 * Implementation notes:
 *   - Pure vanilla DOM — no ApplicationV2. A tooltip is a transient overlay
 *     with no lifecycle needs; ApplicationV2's framing, tab management, and
 *     re-render logic would all be dead weight here.
 *   - Delegated document-level listeners (capture phase) so the system works
 *     on any [data-tooltip-key] element regardless of when it appears in the
 *     DOM — sheets, modals, dock, etc.
 *   - 600ms show delay, 150ms hide grace. Dwell mode (instant subsequent
 *     tooltips) activates on first show and resets on any application close.
 */

const NS = 'good-society-homebrew';
const SHOW_DELAY = 600;
const HIDE_GRACE = 150;

let _tip = null;
let _showTimer = null;
let _hideTimer = null;
let _dwell = false;
let _attached = false;

/** Read the tooltipsEnabled setting safely. */
function _enabled() {
  try { return game.settings.get(NS, 'tooltipsEnabled'); }
  catch { return true; }
}

/**
 * Look up tooltip content for a key.
 * Returns null (with console.warn) if the body key is missing, per
 * CLAUDE.md §16: "Missing keys silently render no tooltip — easy to miss in QA."
 * @param {string} key
 * @returns {{ body: string, pageRef: string|null } | null}
 */
function _content(key) {
  const bodyKey = `GOODSOCIETY.tooltips.${key}.body`;
  const body = game.i18n.localize(bodyKey);
  if (!body || body === bodyKey) {
    console.warn(`[good-society] Tooltip body missing: ${bodyKey}`);
    return null;
  }
  const pageRefKey = `GOODSOCIETY.tooltips.${key}.pageRef`;
  const raw = game.i18n.localize(pageRefKey);
  const pageRef = (raw && raw !== pageRefKey) ? raw : null;
  return { body, pageRef };
}

/** Build the tooltip DOM node for a given target element + key. */
function _build(el, key) {
  const content = _content(key);
  if (!content) return null;

  const tip = document.createElement('div');
  tip.className = 'gs-rule-tooltip';
  tip.setAttribute('role', 'tooltip');

  // Title is derived from the header's actual text content (raw mixed-case,
  // unaffected by CSS text-transform — so "Reputation Tags" not "REPUTATION TAGS").
  const title = el.textContent.trim();
  let html = `<div class="gs-rule-tooltip__title">${title}</div>`;
  html += `<div class="gs-rule-tooltip__body">${content.body}</div>`;
  if (content.pageRef) {
    html += `<div class="gs-rule-tooltip__pageref">${content.pageRef}</div>`;
  }
  tip.innerHTML = html;
  return tip;
}

/**
 * Position the tooltip viewport-aware:
 *   - Default: above the target with left edge aligned to target left.
 *   - Right clip → align right edge to target right.
 *   - Top clip  → flip below.
 *
 * Adds .gs-rule-tooltip--below when flipping so the CSS arrow direction flips.
 */
function _position(tip, target) {
  // Append offscreen first so offsetWidth/Height are measurable.
  tip.style.visibility = 'hidden';
  document.body.appendChild(tip);

  const tr  = target.getBoundingClientRect();
  const tipW = tip.offsetWidth;
  const tipH = tip.offsetHeight;
  const vpW  = window.innerWidth;

  let top  = tr.top - tipH - 10;
  let left = tr.left;

  // Right clip
  if (left + tipW > vpW - 8) left = tr.right - tipW;
  left = Math.max(8, left);

  // Top clip → flip below
  const below = top < 8;
  if (below) top = tr.bottom + 10;
  tip.classList.toggle('gs-rule-tooltip--below', below);

  tip.style.left = `${Math.round(left)}px`;
  tip.style.top  = `${Math.round(top)}px`;
  tip.style.visibility = '';
}

function _cancelShow() {
  if (_showTimer) { clearTimeout(_showTimer); _showTimer = null; }
}

function _cancelHide() {
  if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; }
}

function _show(el) {
  _cancelHide();
  if (_tip) { _tip.remove(); _tip = null; }
  const key = el.dataset.tooltipKey;
  if (!key) return;
  const tip = _build(el, key);
  if (!tip) return;
  _tip = tip;
  _position(tip, el);
  _dwell = true;
}

function _hide() {
  _cancelShow();
  if (_tip) { _tip.remove(); _tip = null; }
}

function _scheduleShow(el) {
  _cancelHide();
  _cancelShow();
  _showTimer = setTimeout(() => _show(el), _dwell ? 0 : SHOW_DELAY);
}

function _scheduleHide() {
  _cancelShow();
  _hideTimer = setTimeout(_hide, HIDE_GRACE);
}

/**
 * Wire the global hover listeners. Called once from module/good-society.js
 * inside Hooks.once('ready', ...).
 */
export function initTooltipSystem() {
  if (_attached) return;
  _attached = true;

  // Enter a tooltip target.
  document.addEventListener('mouseover', (ev) => {
    if (!_enabled()) return;
    if (!(ev.target instanceof HTMLElement)) return;
    const el = ev.target.closest('[data-tooltip-key]');
    if (!el) return;
    // Don't re-trigger when moving between children of the same element.
    const from = ev.relatedTarget instanceof HTMLElement
      ? ev.relatedTarget.closest('[data-tooltip-key]')
      : null;
    if (from === el) return;
    _scheduleShow(el);
  }, { capture: true });

  // Leave a tooltip target.
  document.addEventListener('mouseout', (ev) => {
    if (!(ev.target instanceof HTMLElement)) return;
    const el = ev.target.closest('[data-tooltip-key]');
    if (!el) return;
    const to = ev.relatedTarget instanceof HTMLElement
      ? ev.relatedTarget.closest('[data-tooltip-key]')
      : null;
    if (to === el) return;
    // Don't dismiss if the pointer is moving into the tooltip itself.
    const intoTip = ev.relatedTarget instanceof HTMLElement
      && ev.relatedTarget.closest('.gs-rule-tooltip');
    if (intoTip) return;
    _scheduleHide();
  }, { capture: true });

  // Keep tooltip alive while the pointer is over it.
  document.addEventListener('mouseover', (ev) => {
    if (!(ev.target instanceof HTMLElement)) return;
    if (!ev.target.closest('.gs-rule-tooltip')) return;
    _cancelHide();
  }, { capture: true });

  // Leave the tooltip — schedule hide.
  document.addEventListener('mouseout', (ev) => {
    if (!(ev.target instanceof HTMLElement)) return;
    if (!ev.target.closest('.gs-rule-tooltip')) return;
    const to = ev.relatedTarget instanceof HTMLElement
      ? ev.relatedTarget.closest('.gs-rule-tooltip')
      : null;
    if (to) return;
    _scheduleHide();
  }, { capture: true });

  // Any click outside the tooltip dismisses it.
  document.addEventListener('click', (ev) => {
    if (ev.target instanceof HTMLElement && ev.target.closest('.gs-rule-tooltip')) return;
    _hide();
  }, { capture: true });

  // Reset dwell mode when any application closes (context change).
  Hooks.on('closeApplication', () => {
    _dwell = false;
    _hide();
  });
}
