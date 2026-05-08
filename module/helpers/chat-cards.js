/**
 * Chat card helpers — centralized post functions for all six card variants.
 * Per docs/design/10-chat-cards.md §"Module helpers" and §"Theme-id source".
 *
 * Pattern for every helper:
 *  1. Resolve theme from actor (or 'system'/'npc' for house cards).
 *  2. Render the variant template via renderTemplate.
 *  3. Wrap themed cards via themedWrap; house cards get a bare structural div.
 *  4. Store cardType + speakerActorId + speakerTheme + speakerPersonaId on flags.
 *  5. Call ChatMessage.create.
 *
 * Theme id is written at POST TIME into message flags — historic cards survive
 * actor theme changes. Never read theme from actor.system at re-render time.
 */

import { themedWrap } from './themed-wrap.js';

const T = 'systems/good-society-homebrew/templates/chat-cards';

/** HH:MM timestamp for card headers. */
function _ts() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** World cycle number, or null if the setting isn't registered yet. */
function _cycle() {
  try { return game.settings.get('good-society-homebrew', 'cycleNumber'); }
  catch { return null; }
}

/**
 * Resolve the active persona for an actor, with optional explicit override.
 * @param {Actor} actor
 * @param {object|null} [override]
 * @returns {object|null}
 */
function _persona(actor, override = null) {
  return override ?? actor?.system?.activePersona ?? null;
}

/**
 * Build the standard GS flags block for a chat message.
 * @param {string} cardType
 * @param {Actor|null} [actor]
 * @param {object|null} [persona]
 * @returns {object}
 */
function _flags(cardType, actor = null, persona = null) {
  return {
    'good-society-homebrew': {
      cardType,
      speakerActorId: actor?.id ?? null,
      speakerTheme: actor?.system?.theme ?? 'npc',
      speakerPersonaId: persona?.id ?? actor?.system?.activePersonaId ?? null,
    },
  };
}

/**
 * Derive the pronoun possessive for the completion card subtitle.
 * Defaults to "their" — the system never assumes pronouns.
 * @param {string} [pronouns='']
 * @returns {'their'|'his'|'her'}
 */
function _possessive(pronouns = '') {
  const p = pronouns.toLowerCase();
  if (p.includes('she') || p.includes('her')) return 'her';
  if (p.includes('he') || p.includes('him')) return 'his';
  return 'their';
}

// ── 1. System card ─────────────────────────────────────────────────────────

/**
 * Post a house-styled system card. For phase changes, bulk notifications, etc.
 * No themed wrapper — this is the system's own voice.
 * @param {object} opts
 * @param {string} opts.content - Body text (plain text or minimal HTML).
 * @param {string} [opts.context=''] - Eyebrow context (e.g. "cycle 3", "upkeep").
 */
export async function postSystemCard({ content, context = '', whisper = [] }) {
  const inner = await foundry.applications.handlebars.renderTemplate(`${T}/system.hbs`, {
    content,
    context,
    timestamp: _ts(),
  });
  const html = `<div class="gs-chat-card gs-chat-card--system">${inner}</div>`;
  // Explicit system speaker — without this, Foundry falls back to the user's
  // selected character (or the speaking-as switcher's actor), which makes
  // system events look like the GM's character is announcing them. The card
  // already has its own internal "SYSTEM · {context}" eyebrow; the speaker
  // line just needs a neutral alias so Foundry doesn't supply one.
  const systemAlias = (() => {
    try { return game.i18n.localize('GOODSOCIETY.dashboard.systemAlias') || 'Good Society'; }
    catch { return 'Good Society'; }
  })();
  await ChatMessage.create({
    content: html,
    speaker: { scene: null, actor: null, token: null, alias: systemAlias },
    flags: _flags('system'),
    ...(whisper.length ? { whisper } : {}),
  });
}

// ── 2. In-character card ────────────────────────────────────────────────────

/**
 * Post an in-character themed chat card. The most common card variant.
 * @param {object} opts
 * @param {Actor} opts.actor
 * @param {object|null} [opts.persona] - Explicit persona; defaults to actor's activePersona.
 * @param {string} opts.message - The chat message text.
 * @param {string} [opts.mode='in-character']
 */
export async function postInCharacterCard({ actor, persona, message, mode = 'in-character' }) {
  const resolvedPersona = _persona(actor, persona);
  const speakerName = resolvedPersona?.name || actor.name;
  const inner = await foundry.applications.handlebars.renderTemplate(`${T}/in-character.hbs`, {
    actor,
    persona: resolvedPersona,
    message,
    mode,
    speakerName,
    portraitInitial: speakerName?.[0]?.toUpperCase() ?? '?',
    timestamp: _ts(),
  });
  const html = themedWrap(actor, inner, ['gs-chat-card', 'gs-chat-card--in-character']);
  await ChatMessage.create({
    content: html,
    speaker: ChatMessage.getSpeaker({ actor }),
    flags: _flags('in-character', actor, resolvedPersona),
  });
}

// ── 3. Inner Monologue card ─────────────────────────────────────────────────

/**
 * Post an inner monologue themed chat card.
 * Called by MonologueEditor after creating the journal entry.
 * @param {object} opts
 * @param {Actor} opts.actor
 * @param {object|null} [opts.persona]
 * @param {string} opts.monologueText
 * @param {boolean} [opts.whisper=false]
 * @param {string|null} [opts.journalEntryUuid=null] - UUID of the archived entry for "archived ↗" link.
 * @param {number|null} [opts.cycleNumber=null] - Overrides world setting if provided.
 */
export async function postMonologueCard({
  actor, persona, monologueText,
  whisper = false, journalEntryUuid = null, cycleNumber = null,
}) {
  const resolvedPersona = _persona(actor, persona);
  const speakerName = resolvedPersona?.name || actor.name;
  const personaRole = (resolvedPersona && !resolvedPersona.isPrimary) ? resolvedPersona.name : null;
  const cycleNum = cycleNumber ?? _cycle();
  const inner = await foundry.applications.handlebars.renderTemplate(`${T}/monologue.hbs`, {
    actor,
    persona: resolvedPersona,
    monologueText,
    whisper,
    journalEntryUuid,
    cycleNumber: cycleNum,
    speakerName,
    personaRole,
    portraitInitial: speakerName?.[0]?.toUpperCase() ?? '?',
  });
  const html = themedWrap(actor, inner, ['gs-chat-card', 'gs-chat-card--monologue']);
  const whisperTargets = whisper
    ? [...new Set([...(ChatMessage.getWhisperRecipients('GM') ?? []).map(u => u.id), game.user.id])]
    : [];
  await ChatMessage.create({
    content: html,
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: whisperTargets,
    flags: _flags('monologue', actor, resolvedPersona),
  });
}

// ── 4. Inner Conflict completion ceremony card ──────────────────────────────

/**
 * Post an inner conflict completion ceremony card.
 * Auto-fired from InnerConflictSheet.#toggleBox when completion triggers.
 * @param {object} opts
 * @param {Actor} opts.actor - The actor who owns the conflict.
 * @param {Item} opts.conflict - The inner-conflict Item document.
 * @param {'left'|'right'} opts.resolvedSide
 */
export async function postCompletionCard({ actor, conflict, resolvedSide }) {
  const persona = _persona(actor, null);
  const resolvedLabel = resolvedSide === 'left'
    ? conflict.system.leftLabel
    : conflict.system.rightLabel;
  const inner = await foundry.applications.handlebars.renderTemplate(`${T}/completion.hbs`, {
    actor,
    persona,
    conflict,
    resolvedSide,
    leftLabel: conflict.system.leftLabel,
    rightLabel: conflict.system.rightLabel,
    resolvedLabel,
    possessive: _possessive(actor.system.bio?.pronouns ?? ''),
    speakerName: actor.name,
    portraitInitial: actor.name?.[0]?.toUpperCase() ?? '?',
  });
  const html = themedWrap(actor, inner, ['gs-chat-card', 'gs-chat-card--completion']);
  await ChatMessage.create({
    content: html,
    speaker: ChatMessage.getSpeaker({ actor }),
    flags: _flags('completion', actor, persona),
  });
}

// ── 5. Persona switch announcement card ─────────────────────────────────────

/**
 * Post a persona switch announcement card themed to the post-switch persona.
 * MUST be called after actor.update() has set activePersonaId to toPersona.id,
 * so themedWrap picks up toPersona's chatColor correctly.
 * @param {object} opts
 * @param {Actor} opts.actor - Already updated with new activePersonaId.
 * @param {object|null} opts.fromPersona - The persona being left (may be null on first switch).
 * @param {object} opts.toPersona - The persona being entered.
 */
export async function postPersonaSwitchCard({ actor, fromPersona, toPersona }) {
  const secret = toPersona?.visibility?.magic === 'secret';
  const inner = await foundry.applications.handlebars.renderTemplate(`${T}/persona-switch.hbs`, {
    actor,
    fromPersona,
    toPersona,
    secret,
    portraitInitial: (toPersona?.name || actor.name)?.[0]?.toUpperCase() ?? '?',
  });
  const html = themedWrap(actor, inner, ['gs-chat-card', 'gs-chat-card--persona-switch']);
  const whisperTargets = secret
    ? [...new Set([...(ChatMessage.getWhisperRecipients('GM') ?? []).map(u => u.id), game.user.id])]
    : [];
  await ChatMessage.create({
    content: html,
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: whisperTargets,
    flags: {
      'good-society-homebrew': {
        cardType: 'persona-switch',
        speakerActorId: actor.id,
        speakerTheme: actor.system.theme ?? 'npc',
        speakerPersonaId: toPersona?.id ?? null,
      },
    },
  });
}

// ── 6. Letter card ──────────────────────────────────────────────────────────

/**
 * Post a letter card. Signature established here; the letter composer (Session B-4)
 * calls this after the player clicks Send.
 * @param {object} opts
 * @param {Actor} opts.actor - The sender.
 * @param {object|null} [opts.persona]
 * @param {object} opts.letter - { to, subject, body, seal, signoff }
 * @param {number|null} [opts.cycleNumber]
 * @param {boolean} [opts.whisper=true]
 * @param {string[]} [opts.whisperIds=[]] - Additional user IDs to receive the message.
 */
export async function postLetterCard({
  actor, persona, letter,
  cycleNumber = null, whisper = true, whisperIds = [],
}) {
  const resolvedPersona = _persona(actor, persona);
  const cycleNum = cycleNumber ?? _cycle();
  const inner = await foundry.applications.handlebars.renderTemplate(`${T}/letter.hbs`, {
    actor,
    persona: resolvedPersona,
    letter,
    cycleNumber: cycleNum,
    speakerName: resolvedPersona?.name || actor.name,
  });
  const html = themedWrap(actor, inner, ['gs-chat-card', 'gs-letter-card']);
  const whisperTargets = whisper
    ? [...new Set([...(ChatMessage.getWhisperRecipients('GM') ?? []).map(u => u.id), game.user.id, ...whisperIds])]
    : [];
  await ChatMessage.create({
    content: html,
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: whisperTargets,
    flags: {
      'good-society-homebrew': {
        cardType: 'letter',
        letter: true,
        speakerActorId: actor.id,
        speakerTheme: actor.system.theme ?? 'npc',
        speakerPersonaId: resolvedPersona?.id ?? null,
        senderActorId: actor.id,
        senderTheme: actor.system.theme ?? 'npc',
      },
    },
  });
}
