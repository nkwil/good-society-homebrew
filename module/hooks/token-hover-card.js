/**
 * Token Hover Card — transient DOM card shown when hovering a canvas token.
 *
 * Per docs/design/17-token-hover-card.md.
 *
 * Architecture: pure vanilla DOM (no ApplicationV2). Hover cards are
 * transient overlays with no lifecycle needs — ApplicationV2 adds framing
 * overhead that would be dead weight here. Same pattern as rule-tooltip.js.
 *
 * Trigger: Hooks.on('hoverToken', ...). On hovered=false, a 200ms grace
 * period allows the pointer to enter the card before dismissing — otherwise
 * the card disappears the moment the pointer crosses from the PIXI token
 * to the DOM card floating above the canvas.
 *
 * Visibility filtering: all filtering is done in _buildCardData() before
 * any HTML is generated. The DOM never contains data the viewer shouldn't see.
 * Non-owners see the active persona's name only; the actor's true name is
 * never present in the HTML.
 */

import { themedWrap } from '../helpers/themed-wrap.js';

const DISMISS_GRACE_MS = 200;
const FADE_MS = 100;
const CURSOR_OFFSET_X = 14; // card placed to the right of the cursor by this much
const CURSOR_OFFSET_Y = 14; // card placed below the cursor by this much

let _card = null;
let _dismissTimer = null;
let _lastMouseX = 0;
let _lastMouseY = 0;

// ── Public API ────────────────────────────────────────────────────────────────

export function register() {
  // Track cursor position globally so the hover card can position itself
  // relative to where the user is actually pointing — bypasses every
  // canvas-coordinate-conversion gotcha (zoom, pan, board offset, etc).
  document.addEventListener('mousemove', (ev) => {
    _lastMouseX = ev.clientX;
    _lastMouseY = ev.clientY;
    // While the card is visible, follow the cursor for a "sticky" feel.
    if (_card && _card.isConnected) _positionCard(_card);
  }, { passive: true });

  Hooks.on('hoverToken', _onHoverToken);
}

// ── Hook handler ──────────────────────────────────────────────────────────────

function _onHoverToken(placeable, hovered) {
  // Post-MVP §10.2 — `hoverCardEnabled` client setting bypasses the system
  // hover card entirely; Foundry's default tooltip shows instead.
  let enabled = true;
  try { enabled = game.settings.get('good-society-homebrew', 'hoverCardEnabled'); } catch {}
  if (!enabled) return;

  if (hovered) {
    _cancelDismiss();
    _clearCard();
    const data = _buildCardData(placeable);
    if (data) _showCard(placeable, data);
  } else {
    _scheduleDismiss();
  }
}

// ── Data preparation (visibility filtering happens here) ───────────────────────

function _buildCardData(placeable) {
  const actor = placeable.actor;

  if (!actor) {
    return {
      actor: null,
      displayName: placeable.document?.name || game.i18n.localize('GOODSOCIETY.hoverCard.unknownToken'),
      portraitUrl: placeable.document?.texture?.src || '',
      portraitInitial: (placeable.document?.name?.[0] ?? '?').toUpperCase(),
      roleLabel: game.i18n.localize('GOODSOCIETY.hoverCard.unlinkedToken'),
      roleLabelStyle: 'muted',
      secretPersonaNote: null,
      hoverSummary: '',
      publicTags: [],
      reputationTags: [],
    };
  }

  const isGM = game.user?.isGM;

  // Resolve EXPLICIT active persona only (no primary/first fallback). The
  // data-model getter falls back to "any persona," which makes "true
  // identity" silently render as a persona — wrong for both display name
  // and the persona-divergence GM badge.
  const activePersonaId = actor.system?.activePersonaId;
  const personas = actor.system?.personas ?? [];
  const activePersona = activePersonaId
    ? personas.find(p => p.id === activePersonaId)
    : null;

  // GM note: flag when an EXPLICIT persona's name diverges from actor.name.
  const personaName = activePersona?.name;
  const namesDiverge = personaName && personaName !== actor.name;
  const secretPersonaNote = (isGM && namesDiverge)
    ? game.i18n.localize('GOODSOCIETY.hoverCard.secretPersona')
    : null;

  // Display name: when a persona is explicitly active, show that. Otherwise
  // show actor.name. Non-owners never see the actor's true name when a
  // persona is active — the persona name IS what they see. Persona-
  // protection safeguard.
  const displayName = personaName || actor.name;

  // Portrait: persona overrides actor-level.
  const portraitUrl = activePersona?.portraitUrl
    || actor.system?.bio?.portraitUrl
    || actor.img
    || '';
  const portraitInitial = (displayName?.[0] ?? '?').toUpperCase();

  // Role label: type-specific format.
  let roleLabel, roleLabelStyle;
  if (actor.type === 'major-character') {
    const archetype = actor.system?.bio?.archetype;
    roleLabel = archetype ? game.i18n.localize(`GOODSOCIETY.major.archetype.${archetype}`) : '';
    roleLabelStyle = 'branded';
  } else if (actor.type === 'connection') {
    const rel = actor.system?.bio?.relationshipLabel?.trim();
    roleLabel = rel
      ? game.i18n.format('GOODSOCIETY.hoverCard.connectionRole', { role: rel })
      : game.i18n.localize('GOODSOCIETY.hoverCard.connection');
    roleLabelStyle = 'branded';
  } else if (actor.type === 'npc') {
    const role = actor.system?.bio?.role?.trim();
    roleLabel = role
      ? game.i18n.format('GOODSOCIETY.hoverCard.npcRole', { role })
      : game.i18n.localize('GOODSOCIETY.hoverCard.npc');
    roleLabelStyle = 'muted';
  } else {
    roleLabel = '';
    roleLabelStyle = 'muted';
  }

  // Hover summary: persona overrides actor-level. Post-MVP §10.2 upgraded
  // sceneInfo.hoverSummary on Connection + NPC to HTMLField — render it raw
  // (assumed safe; the Foundry editor sanitizes) rather than via _esc.
  const hoverSummary = (
    activePersona?.hoverSummary
    || actor.system?.sceneInfo?.hoverSummary
    || ''
  );
  const hoverSummaryIsHtml =
    actor.type === 'connection' || actor.type === 'npc';

  // Subtitle line (post-MVP §10.2; Connection + NPC only).
  const subtitle = (actor.system?.sceneInfo?.subtitle || '').trim();

  // Editable subhead (system.bio.title) — free-form title or quick
  // description set on the sheet's cameo. Renders directly under the
  // name on the hover card, above the roleLabel/subtitle line. Available
  // on Major / Connection / NPC.
  const title = (actor.system?.bio?.title || '').trim();

  // Public tags: persona overrides actor-level.
  const publicTags = (
    activePersona?.publicTags?.length
      ? activePersona.publicTags
      : (actor.system?.sceneInfo?.publicTags ?? [])
  ).filter(Boolean);

  // ── Major-only auto-summary (post-MVP §10.2) ────────────────────────────
  // The Major data model has no `sceneInfo.hoverSummary`; instead the hover
  // card derives a public-info snapshot from existing fields. Honors the
  // world-scope setting `hoverCardMajorAutoSummary` — when off, render only
  // the header (name + role/peerage subtitle).
  let reputationTags = [];
  let activeCondition = null;
  let familyCriteria = '';
  let showOpenDossier = false;

  if (actor.type === 'major-character') {
    let majorAuto = true;
    try { majorAuto = game.settings.get('good-society-homebrew', 'hoverCardMajorAutoSummary'); } catch {}
    showOpenDossier = true; // always show "open dossier ↗" for Majors

    if (majorAuto) {
      // Top 3 rep tags total, prioritizing the highest pinned positive +
      // highest pinned negative + one more of either polarity.
      const posItems = (actor.system?.reputation?.positiveTags ?? [])
        .map(id => actor.items.get(id))
        .filter(i => i?.type === 'reputation-tag')
        .map(item => ({ label: '▲ ' + item.name, polarity: 'positive' }));
      const negItems = (actor.system?.reputation?.negativeTags ?? [])
        .map(id => actor.items.get(id))
        .filter(i => i?.type === 'reputation-tag')
        .map(item => ({ label: '▼ ' + item.name, polarity: 'negative' }));
      const slot1 = posItems[0] ?? null;
      const slot2 = negItems[0] ?? null;
      const slot3 = posItems[1] ?? negItems[1] ?? null;
      reputationTags = [slot1, slot2, slot3].filter(Boolean);

      // Active condition — first item from reputation.activeConditions.
      const condIds = actor.system?.reputation?.activeConditions ?? [];
      for (const id of condIds) {
        const item = actor.items.get(id);
        if (item?.type === 'reputation-condition' && item.system?.active) {
          activeCondition = {
            name: item.name,
            polarity: item.system?.polarity ?? 'positive',
          };
          break;
        }
      }

      // Family criteria — only when visible to the viewer.
      const family = actor.system?.familyId
        ? game.actors?.get(actor.system.familyId)
        : null;
      const criteriaVis = family?.system?.visibility?.uniqueNegativeRepCriteria;
      const viewerCanSeeCriteria = isGM || criteriaVis === 'public';
      if (family && viewerCanSeeCriteria) {
        familyCriteria = (family.system?.uniqueNegativeRepCriteria || '').trim();
      }
    }
  }

  return {
    actor,
    displayName,
    portraitUrl,
    portraitInitial,
    roleLabel,
    roleLabelStyle,
    subtitle,
    title,
    secretPersonaNote,
    hoverSummary,
    hoverSummaryIsHtml,
    publicTags,
    reputationTags,
    activeCondition,
    familyCriteria,
    showOpenDossier,
  };
}

// ── Card HTML builder ─────────────────────────────────────────────────────────

/** Escape a value for safe HTML insertion. */
function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _buildInnerHtml(data) {
  // Portrait
  const portraitInner = data.portraitUrl
    ? `<img class="gs-token-hover-card__portrait-img" src="${_esc(data.portraitUrl)}" alt="" />`
    : `<span class="gs-token-hover-card__portrait-initial">${_esc(data.portraitInitial)}</span>`;

  // Title — editable subhead from system.bio.title. Sits directly under
  // the name (above roleLabel/subtitle) on every actor type.
  const titleHtml = data.title
    ? `<div class="gs-token-hover-card__title"><em>${_esc(data.title)}</em></div>`
    : '';

  // Role line
  const roleLabelHtml = data.roleLabel
    ? `<div class="gs-token-hover-card__role gs-token-hover-card__role--${data.roleLabelStyle}">${_esc(data.roleLabel)}</div>`
    : '';

  // Subtitle (post-MVP §10.2 — Connection + NPC).
  const subtitleHtml = data.subtitle
    ? `<div class="gs-token-hover-card__subtitle"><em>${_esc(data.subtitle)}</em></div>`
    : '';

  // GM-only secret persona note
  const secretNoteHtml = data.secretPersonaNote
    ? `<div class="gs-token-hover-card__secret-note">${_esc(data.secretPersonaNote)}</div>`
    : '';

  // Active condition (Major-only, post-MVP §10.2 auto-summary).
  const conditionHtml = data.activeCondition
    ? `<div class="gs-token-hover-card__condition gs-token-hover-card__condition--${data.activeCondition.polarity}">◆ ${_esc(data.activeCondition.name)}</div>`
    : '';

  // Family criteria (Major-only, when visible).
  const criteriaHtml = data.familyCriteria
    ? `<div class="gs-token-hover-card__criteria"><em>${_esc(data.familyCriteria)}</em></div>`
    : '';

  // Summary — Connection + NPC bodies are HTML; the user-authored content is
  // already in the safe Foundry-editor format. Major hover never has a
  // `hoverSummary` (auto-summary uses other fields), so this branch is mostly
  // for Connection / NPC.
  const summaryHtml = data.hoverSummary
    ? data.hoverSummaryIsHtml
      ? `<div class="gs-token-hover-card__summary gs-token-hover-card__summary--rich">${data.hoverSummary}</div>`
      : `<div class="gs-token-hover-card__summary">${_esc(data.hoverSummary)}</div>`
    : '';

  // Tags: reputation pills + public tag pills
  const repHtml = data.reputationTags
    .map(t => `<span class="gs-token-hover-card__tag gs-token-hover-card__tag--${t.polarity}">${_esc(t.label)}</span>`)
    .join('');
  const pubHtml = data.publicTags
    .map(t => `<span class="gs-token-hover-card__tag">${_esc(t)}</span>`)
    .join('');
  const allTagsHtml = repHtml + pubHtml;
  const tagsHtml = allTagsHtml
    ? `<div class="gs-token-hover-card__tags">${allTagsHtml}</div>`
    : '';

  // Open dossier footer (Major-only).
  const footerHtml = data.showOpenDossier
    ? `<div class="gs-token-hover-card__footer"><em>${_esc(game.i18n.localize('GOODSOCIETY.hoverCard.openDossier'))} ↗</em></div>`
    : '';

  return `<header class="gs-token-hover-card__header"><div class="gs-token-hover-card__portrait">${portraitInner}</div><div class="gs-token-hover-card__identity"><div class="gs-token-hover-card__name">${_esc(data.displayName)}</div>${titleHtml}${roleLabelHtml}${subtitleHtml}${secretNoteHtml}</div></header>${conditionHtml}${criteriaHtml}${summaryHtml}${tagsHtml}${footerHtml}`;
}

// ── Show / hide ───────────────────────────────────────────────────────────────

function _showCard(placeable, data) {
  const innerHtml = _buildInnerHtml(data);
  // themedWrap handles null actor gracefully (falls back to theme "npc").
  const html = themedWrap(data.actor, innerHtml, ['gs-token-hover-card']);

  const temp = document.createElement('div');
  temp.innerHTML = html;
  const cardEl = temp.firstElementChild;
  if (!cardEl) return;

  // Start offscreen so offsetHeight is measurable but card is invisible.
  cardEl.style.left = '-9999px';
  cardEl.style.top = '-9999px';
  document.body.appendChild(cardEl);
  _card = cardEl;

  // Wire card interactivity.
  cardEl.addEventListener('mouseover', _cancelDismiss);
  cardEl.addEventListener('mouseout', (ev) => {
    if (!cardEl.contains(ev.relatedTarget)) _scheduleDismiss();
  });
  cardEl.addEventListener('click', () => {
    data.actor?.sheet?.render(true);
    _clearCard();
  });

  // Position relative to the cursor (tracked globally via mousemove).
  _positionCard(cardEl);
}

/**
 * Place the card relative to the user's cursor. Default is to the right and
 * slightly below the pointer; flips to the left or above if there's no room.
 *
 * Cursor-relative (rather than token-relative) because:
 *   1. The cursor IS on the token when hovering, so this still feels
 *      "anchored to the token" without doing canvas-coord math.
 *   2. Canvas-coord-to-viewport conversion is fragile across zoom/pan/sidebar
 *      configurations; using ev.clientX/Y bypasses all of that.
 *   3. Matches the convention of native browser tooltips (which is what
 *      Natalie said she expected when first reviewing this).
 */
function _positionCard(cardEl) {
  if (!cardEl.isConnected) return;

  const cardW = cardEl.offsetWidth;
  const cardH = cardEl.offsetHeight;
  const vpW   = window.innerWidth;
  const vpH   = window.innerHeight;
  const PAD   = 8;

  // Default: right and below the cursor.
  let left = _lastMouseX + CURSOR_OFFSET_X;
  let top  = _lastMouseY + CURSOR_OFFSET_Y;

  // Right clip → flip to the left of the cursor.
  if (left + cardW > vpW - PAD) {
    left = _lastMouseX - cardW - CURSOR_OFFSET_X;
  }
  // Bottom clip → flip above the cursor.
  if (top + cardH > vpH - PAD) {
    top = _lastMouseY - cardH - CURSOR_OFFSET_Y;
  }

  // Final clamp to keep the card on-screen if the cursor is in a corner.
  left = Math.max(PAD, Math.min(left, vpW - cardW - PAD));
  top  = Math.max(PAD, Math.min(top,  vpH - cardH - PAD));

  cardEl.style.left = `${Math.round(left)}px`;
  cardEl.style.top  = `${Math.round(top)}px`;
}

function _scheduleDismiss() {
  _cancelDismiss();
  _dismissTimer = setTimeout(_clearCard, DISMISS_GRACE_MS);
}

function _cancelDismiss() {
  if (_dismissTimer) { clearTimeout(_dismissTimer); _dismissTimer = null; }
}

function _clearCard() {
  _cancelDismiss();
  if (!_card) return;
  const card = _card;
  _card = null;
  card.classList.add('gs-token-hover-card--dismissing');
  card.addEventListener('transitionend', () => card.remove(), { once: true });
  // Fallback removal if transitionend never fires (hidden element, etc.).
  setTimeout(() => card.remove(), FADE_MS + 60);
}
