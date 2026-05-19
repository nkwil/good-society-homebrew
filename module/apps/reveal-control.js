/**
 * Reveal Control — GM popover for confirming per-field visibility flips.
 *
 * Per docs/design/19-gm-tools.md §"Reveal Control widget".
 *
 * Vanilla DOM (not ApplicationV2). Per CLAUDE.md §16 anti-pattern: "Don't
 * use ApplicationV2 for transient overlays like tooltips, context menus, or
 * hover cards — they have no lifecycle needs." The Reveal Control is a
 * short-lived confirmation popover: appears on GM click, disappears on
 * confirm/cancel/outside-click. No tab management, no re-render, no document
 * binding. Same pattern as rule-tooltip.js.
 *
 * Public API: openRevealControl(actor, field, anchorEl)
 *
 * Two wired call sites:
 *   1. MajorCharacterSheet #toggleVisibility → visibility flag buttons on
 *      the Private tab (desire, backstory, magic, notesObjectives, etc.).
 *   2. PublicInfoDashboard _wireRowClicks → desire cell on each row.
 *
 * Hybrid theming: house chrome for the popover shell; actor name rendered in
 * the character's brand color via .gs-themed[data-theme] on just that element.
 * Same hybrid pattern as dashboard rows (CLAUDE.md §12.7, §16 row-bg-bleed note).
 */

const NS = 'good-society-homebrew';
const POPOVER_ID = 'gs-reveal-control';

/** The single-field visibility cycle. Always advances in this direction. */
const NEXT_STATE = { secret: 'public', public: 'redacted', redacted: 'secret' };

/** Maps visibility field keys → i18n label keys. */
const FIELD_LABEL_KEY = {
  desire:              'GOODSOCIETY.private.desire',
  backstory:           'GOODSOCIETY.private.backstory',
  magic:               'GOODSOCIETY.private.magicSkills',
  adventurerSentiment: 'GOODSOCIETY.private.adventurerSentiment',
  notesObjectives:     'GOODSOCIETY.private.notesObjectives',
  innerConflicts:      'GOODSOCIETY.public.innerConflict',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function _fieldLabel(field) {
  const key = FIELD_LABEL_KEY[field];
  if (!key) return field;
  const loc = game.i18n.localize(key);
  return loc === key ? field : loc;
}

function _stateGlyph(state) {
  return state === 'public' ? '●' : state === 'redacted' ? '⊘' : '○';
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function _buildHtml(actor, field, currentState, nextState) {
  const themeId = actor.system?.theme ?? 'npc';
  const fieldLbl = _fieldLabel(field);
  const fieldLblLower = fieldLbl.toLowerCase();
  const actorName = actor.name ?? '?';

  const consequenceKey = nextState === 'public'
    ? 'GOODSOCIETY.revealControl.consequencePublic'
    : nextState === 'redacted'
      ? 'GOODSOCIETY.revealControl.consequenceRedacted'
      : 'GOODSOCIETY.revealControl.consequenceSecret';
  const consequence = game.i18n.format(consequenceKey, { name: actorName, field: fieldLblLower });

  const primaryKey = nextState === 'public'
    ? 'GOODSOCIETY.revealControl.btnPublic'
    : nextState === 'redacted'
      ? 'GOODSOCIETY.revealControl.btnRedacted'
      : 'GOODSOCIETY.revealControl.btnSecret';
  const primaryLabel = game.i18n.localize(primaryKey);

  const irreversibleHtml = nextState === 'public'
    ? `<em class="gs-reveal-control__irreversible">${game.i18n.localize('GOODSOCIETY.revealControl.irreversibleFeel')}</em>`
    : '';

  return `<div id="${POPOVER_ID}" class="gs-reveal-control" role="dialog" aria-modal="true" aria-label="${game.i18n.localize('GOODSOCIETY.revealControl.ariaLabel')}">
  <div class="gs-reveal-control__header">
    <div class="gs-reveal-control__eyebrow">
      <span class="gs-gm-pill">GM</span>
      <span class="gs-reveal-control__title">${game.i18n.localize('GOODSOCIETY.revealControl.title')}</span>
    </div>
    <div class="gs-reveal-control__actor-name gs-themed" data-theme="${themeId}">${actorName}</div>
  </div>
  <div class="gs-reveal-control__body">
    <div class="gs-reveal-control__grid">
      <span class="gs-reveal-control__grid-label">${game.i18n.localize('GOODSOCIETY.revealControl.gridField')}</span>
      <span class="gs-reveal-control__grid-value">${fieldLbl}</span>
      <span class="gs-reveal-control__grid-label">${game.i18n.localize('GOODSOCIETY.revealControl.gridCurrent')}</span>
      <span class="gs-reveal-control__grid-value gs-reveal-control__state gs-reveal-control__state--${currentState}">${_stateGlyph(currentState)} ${currentState}</span>
      <span class="gs-reveal-control__grid-label">${game.i18n.localize('GOODSOCIETY.revealControl.gridFlipTo')}</span>
      <span class="gs-reveal-control__grid-value gs-reveal-control__state gs-reveal-control__state--${nextState}">${_stateGlyph(nextState)} ${nextState} ${irreversibleHtml}</span>
    </div>
    <div class="gs-reveal-control__consequence">${consequence}</div>
  </div>
  <div class="gs-reveal-control__footer">
    <button class="gs-reveal-control__btn-cancel" type="button" data-action="rc-cancel">${game.i18n.localize('GOODSOCIETY.revealControl.btnCancel')}</button>
    <button class="gs-reveal-control__btn-confirm" type="button" data-action="rc-confirm">${primaryLabel}</button>
  </div>
</div>`;
}

// ── Positioning (viewport-aware, anchors below the clicked element) ───────────

function _position(popover, anchor) {
  popover.style.visibility = 'hidden';
  document.body.appendChild(popover);

  const ar = anchor.getBoundingClientRect();
  const pw = popover.offsetWidth;
  const ph = popover.offsetHeight;
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;

  let top  = ar.bottom + 8;
  let left = ar.left;

  if (left + pw > vpW - 8) left = Math.max(8, ar.right - pw);
  left = Math.max(8, left);

  // Flip above if it clips bottom
  if (top + ph > vpH - 8) top = ar.top - ph - 8;
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

// ── Confirm: mutate → chat card → close ───────────────────────────────────────

async function _doConfirm(actor, field, nextState) {
  _close();

  await actor.update({ [`system.visibility.${field}`]: nextState });

  const fieldLbl = _fieldLabel(field).toLowerCase();
  const chatKey = nextState === 'public'
    ? 'GOODSOCIETY.revealControl.postedPublic'
    : nextState === 'redacted'
      ? 'GOODSOCIETY.revealControl.postedRedacted'
      : 'GOODSOCIETY.revealControl.postedSecret';

  // Route through postSystemCard so the cardType flag is set — without it,
  // the speaking-as preCreateChatMessage hook would rewrite the speaker if
  // the GM has an active speaker selected. (CLAUDE.md §16.)
  // Display name resolves through the active persona to keep persona-swapped
  // characters' chat output consistent with the rest of the system.
  const { profileName } = await import('../helpers/profile-pic.js');
  const displayName = profileName(actor);
  const { postSystemCard } = await import('../helpers/chat-cards.js');
  await postSystemCard({
    content: game.i18n.format(chatKey, { name: displayName, field: fieldLbl }),
    context: 'reveal',
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Open the Reveal Control popover anchored to a clicked element.
 *
 * @param {Actor}       actor     The actor whose visibility is being changed.
 * @param {string}      field     Visibility field key (e.g. 'desire', 'backstory').
 * @param {HTMLElement} anchorEl  The element that was clicked — popover anchors to it.
 */
export function openRevealControl(actor, field, anchorEl) {
  if (!game.user?.isGM) return;

  // Close any existing popover before opening a new one.
  _close();

  const currentState = actor.system?.visibility?.[field] ?? 'secret';
  const nextState    = NEXT_STATE[currentState] ?? 'public';

  const wrapper = document.createElement('div');
  wrapper.innerHTML = _buildHtml(actor, field, currentState, nextState);
  const popover = wrapper.firstElementChild;
  if (!popover) return;

  _position(popover, anchorEl);

  // Direct listeners on confirm/cancel are fine here: these buttons exist only
  // for the lifespan of the popover and are not subject to Foundry re-renders.
  popover.querySelector('[data-action="rc-confirm"]')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    _doConfirm(actor, field, nextState);
  });
  popover.querySelector('[data-action="rc-cancel"]')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    _close();
  });

  // Delay outside-click handler so the originating click doesn't instantly close.
  setTimeout(() => {
    document.addEventListener('click',   _onOutsideClick, { capture: true });
    document.addEventListener('keydown', _onEsc);
  }, 0);
}
