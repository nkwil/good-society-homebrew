/**
 * Persona Switcher Popover — vanilla DOM (not ApplicationV2).
 *
 * Per CLAUDE.md §16: "Don't use ApplicationV2 for transient overlays."
 * Same pattern as reveal-control.js: _buildHtml → _position → click handlers
 * → _close on selection / outside-click / Escape.
 *
 * Delegates to switchPersona() from module/helpers/persona-swap.js for the
 * full swap pipeline (actor update, cross-scene tokens, chat card, VFX).
 *
 * Public API: openPersonaSwitcherPopover(actor, anchorEl, onNewPersona)
 */

import { switchPersona } from '../helpers/persona-swap.js';
import { openPersonaEditor } from './persona-editor.js';

const POPOVER_ID = 'gs-persona-switcher-popover';

// ── Stripe class helpers ──────────────────────────────────────────────────────

function _stripeClass(persona) {
  if (persona.isPrimary) return 'gs-persona-switcher-popover__stripe--primary';
  const vis = persona.visibility ?? {};
  const hasSecret = Object.values(vis).some(v => v === 'secret');
  if (hasSecret) return 'gs-persona-switcher-popover__stripe--secret';
  return 'gs-persona-switcher-popover__stripe--other';
}

// ── HTML builders ─────────────────────────────────────────────────────────────

function _portraitSlotHtml(portraitUrl, fallbackInitial) {
  if (portraitUrl) {
    return `<img class="gs-persona-switcher-popover__portrait" src="${portraitUrl}" alt="" />`;
  }
  return `<span class="gs-persona-switcher-popover__portrait-initial">${fallbackInitial}</span>`;
}

/**
 * @param {string|null} editPersonaId  Persona id to attach to the edit glyph.
 *                                     Null on the "true identity" row (no edit affordance).
 */
function _buildRowHtml(rowId, stripeClass, portraitHtml, name, sub, isActive, editPersonaId = null) {
  const badge = isActive
    ? `<span class="gs-persona-switcher-popover__badge">${game.i18n.localize('GOODSOCIETY.personaSwitcher.active')}</span>`
    : `<span class="gs-persona-switcher-popover__switch">${game.i18n.localize('GOODSOCIETY.personaSwitcher.switchLink')} ↗</span>`;

  const editBtn = editPersonaId !== null
    ? `<button type="button" class="gs-persona-switcher-popover__edit-btn"
               data-action="ps-edit" data-persona-id="${editPersonaId}"
               title="${game.i18n.localize('GOODSOCIETY.personaSwitcher.editHint')}">✎</button>`
    : '';

  const subHtml = sub
    ? `<div class="gs-persona-switcher-popover__sub">${sub}</div>`
    : '';

  return `
    <div class="gs-persona-switcher-popover__row ${isActive ? 'gs-persona-switcher-popover__row--active' : ''}"
         data-action="ps-switch" data-persona-id="${rowId}">
      <div class="gs-persona-switcher-popover__stripe ${stripeClass}"></div>
      <div class="gs-persona-switcher-popover__row-content">
        <div class="gs-persona-switcher-popover__portrait-slot">${portraitHtml}</div>
        <div class="gs-persona-switcher-popover__info">
          <div class="gs-persona-switcher-popover__name">${name}</div>
          ${subHtml}
        </div>
      </div>
      <div class="gs-persona-switcher-popover__row-right">
        ${badge}
        ${editBtn}
      </div>
    </div>`;
}

function _buildHtml(actor, currentPersonaId) {
  const personas = actor.system?.personas ?? [];
  const themeId  = actor.system?.theme ?? 'npc';
  const actorInitial = (actor.name?.[0] ?? '?').toUpperCase();

  // Header count label
  const n = personas.length;
  const countLabel = n === 1
    ? game.i18n.localize('GOODSOCIETY.personaSwitcher.oneIdentity')
    : game.i18n.format('GOODSOCIETY.personaSwitcher.nIdentities', { n });

  // "True identity" row — always first
  const noPersonaActive = currentPersonaId === '';
  const trueIdentityRow = _buildRowHtml(
    '',
    'gs-persona-switcher-popover__stripe--none',
    _portraitSlotHtml('', actorInitial),
    game.i18n.localize('GOODSOCIETY.personaSwitcher.trueIdentity'),
    game.i18n.localize('GOODSOCIETY.personaSwitcher.trueIdentitySub'),
    noPersonaActive,
    null,  // no edit glyph on the "true identity" row
  );

  // Persona rows
  const personaRows = personas.map(p => {
    const isActive = p.id === currentPersonaId;
    const subParts = [];
    if (p.isPrimary) subParts.push(game.i18n.localize('GOODSOCIETY.personaSwitcher.primary'));
    const sub = subParts.join(' · ');
    return _buildRowHtml(
      p.id,
      _stripeClass(p),
      _portraitSlotHtml(p.portraitUrl ?? '', (p.name?.[0] ?? '?').toUpperCase()),
      p.name ?? '?',
      sub,
      isActive,
      p.id,  // edit glyph on every persona row
    );
  }).join('');

  return `
    <div id="${POPOVER_ID}" class="gs-persona-switcher-popover gs-themed" data-theme="${themeId}" role="dialog"
         aria-label="${game.i18n.localize('GOODSOCIETY.personaSwitcher.ariaLabel')}">
      <div class="gs-persona-switcher-popover__header">
        <span class="gs-persona-switcher-popover__eyebrow">
          ${game.i18n.localize('GOODSOCIETY.personaSwitcher.eyebrow')}
        </span>
        <span class="gs-persona-switcher-popover__count">${countLabel}</span>
      </div>
      <div class="gs-persona-switcher-popover__list">
        ${trueIdentityRow}
        ${personaRows}
      </div>
      <div class="gs-persona-switcher-popover__footer">
        <button type="button" class="gs-persona-switcher-popover__new-btn" data-action="ps-new">
          <span class="gs-persona-switcher-popover__new-icon">⊕</span>
          ${game.i18n.localize('GOODSOCIETY.personaSwitcher.newPersona')}
        </button>
      </div>
    </div>`;
}

// ── Positioning ───────────────────────────────────────────────────────────────

function _position(popover, anchor) {
  popover.style.visibility = 'hidden';
  document.body.appendChild(popover);

  const ar  = anchor.getBoundingClientRect();
  const pw  = popover.offsetWidth;
  const ph  = popover.offsetHeight;
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;

  let top  = ar.bottom + 6;
  let left = ar.left;

  if (left + pw > vpW - 8) left = Math.max(8, ar.right - pw);
  left = Math.max(8, left);
  if (top + ph > vpH - 8) top = ar.top - ph - 6;
  top = Math.max(8, top);

  popover.style.left = `${Math.round(left)}px`;
  popover.style.top  = `${Math.round(top)}px`;
  popover.style.visibility = '';
}

// ── Close ─────────────────────────────────────────────────────────────────────

function _close() {
  document.getElementById(POPOVER_ID)?.remove();
  document.removeEventListener('click',   _onOutsideClick, { capture: true });
  document.removeEventListener('keydown', _onEsc);
}

function _onOutsideClick(ev) {
  const popover = document.getElementById(POPOVER_ID);
  if (popover && !popover.contains(ev.target)) _close();
}

function _onEsc(ev) {
  if (ev.key === 'Escape') { ev.preventDefault(); _close(); }
}

// ── Switch ────────────────────────────────────────────────────────────────────

async function _doSwitch(actor, newPersonaId, currentPersonaId) {
  if (newPersonaId === currentPersonaId) { _close(); return; }
  _close();
  // Full pipeline: actor update + cross-scene tokens + chat card + VFX.
  // See module/helpers/persona-swap.js for Option B rationale (no actor.img write).
  await switchPersona(actor, newPersonaId);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Open the persona switcher popover anchored to a clicked element.
 *
 * @param {Actor}    actor         The actor whose persona is being switched.
 * @param {Element}  anchorEl      The trigger button — popover anchors below it.
 * @param {Function} onNewPersona  Called when user clicks "+ new persona" (editor stub until 5a-ii).
 */
export function openPersonaSwitcherPopover(actor, anchorEl, onNewPersona) {
  _close();

  const currentPersonaId = actor.system?.activePersonaId ?? '';

  const wrapper = document.createElement('div');
  wrapper.innerHTML = _buildHtml(actor, currentPersonaId);
  const popover = wrapper.firstElementChild;
  if (!popover) return;

  _position(popover, anchorEl);

  popover.addEventListener('click', (ev) => {
    // Edit glyph — must be checked before ps-switch since the glyph lives
    // inside a ps-switch row and closest() would otherwise match the row first.
    const editBtn = ev.target.closest('[data-action="ps-edit"]');
    if (editBtn) {
      ev.stopPropagation();
      const personaId = editBtn.dataset.personaId;
      const persona   = actor.system?.personas?.find(p => p.id === personaId) ?? null;
      _close();
      openPersonaEditor(actor, persona);
      return;
    }
    const switchRow = ev.target.closest('[data-action="ps-switch"]');
    if (switchRow) {
      ev.stopPropagation();
      _doSwitch(actor, switchRow.dataset.personaId ?? '', currentPersonaId);
      return;
    }
    const newBtn = ev.target.closest('[data-action="ps-new"]');
    if (newBtn) {
      ev.stopPropagation();
      _close();
      if (typeof onNewPersona === 'function') onNewPersona();
    }
  });

  setTimeout(() => {
    document.addEventListener('click',   _onOutsideClick, { capture: true });
    document.addEventListener('keydown', _onEsc);
  }, 0);
}
