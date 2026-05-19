/**
 * chat-portraits.js — render a speaker portrait (token-based, persona-aware)
 * next to the sender name on every Good Society chat message.
 *
 * Foundry v13's default chat message renders only a text sender — no avatar.
 * This hook injects a small circular portrait based on `profilePic(actor)`
 * (post-MVP §8.5 — token image, with active-persona override) right before
 * the sender name in `.message-header`.
 *
 * Speaker resolution prefers `message.speaker.actor` (set by speaking-as +
 * every chat-card helper), then falls back to `flags['good-society-homebrew']
 * .speakerActorId` we stamp on themed cards.
 */

import { profilePic, profileName } from '../helpers/profile-pic.js';
import { effectiveThemeOf } from '../helpers/themed-wrap.js';

const NS = 'good-society-homebrew';
const PORTRAIT_CLASS = 'gs-chat-portrait';

function _resolveSpeakerActor(message) {
  const flagActorId = message?.flags?.[NS]?.speakerActorId;
  if (flagActorId) {
    const actor = game.actors?.get(flagActorId);
    if (actor) return actor;
  }
  const speakerActorId = message?.speaker?.actor;
  if (speakerActorId) {
    const actor = game.actors?.get(speakerActorId);
    if (actor) return actor;
  }
  return null;
}

/** Inject the portrait into the rendered chat-message DOM AND theme the
 *  message to the speaker's effective theme. Idempotent — safe to re-run
 *  on re-renders / persona swaps. */
function _applyPortrait(message, root) {
  if (!root) return;
  const actor = _resolveSpeakerActor(message);
  if (!actor) return;

  // ── Theme the whole message row to the speaker's effective theme ────────
  // `gs-themed` + data-theme cascades the theme's CSS variables to every
  // descendant, so the sender name, timestamp, and card chrome all pick up
  // the character's palette. The inner themedWrap()'d card content keeps
  // its own wrapper, which simply re-asserts the same theme — no conflict.
  const theme = effectiveThemeOf(actor);
  if (theme) {
    root.classList.add('gs-themed', 'gs-chat-themed');
    root.dataset.theme = theme;
    // Persona chatColor override — if the active persona has a custom chat
    // color, apply it as an inline --gs-brand override (mirrors themedWrap).
    const persona = actor.system?.activePersonaId
      ? (actor.system.personas ?? []).find(p => p.id === actor.system.activePersonaId)
      : null;
    if (persona?.chatColor) {
      root.style.setProperty('--gs-brand', persona.chatColor);
    } else {
      root.style.removeProperty('--gs-brand');
    }
  }

  // ── Portrait ────────────────────────────────────────────────────────────
  const url = profilePic(actor);
  if (!url) return;
  const name = profileName(actor);

  // Find or create the portrait img. Prefer to refresh the existing one
  // (re-renders can fire with stale src on persona swaps).
  let img = root.querySelector(`img.${PORTRAIT_CLASS}`);
  if (!img) {
    // Locate the insertion point: just before the sender name in the header.
    const header = root.querySelector('.message-header, header.message-header');
    if (!header) return;
    img = document.createElement('img');
    img.classList.add(PORTRAIT_CLASS);
    img.alt = name;
    img.title = name;
    img.loading = 'lazy';
    header.prepend(img);
  }
  if (img.src !== url) img.src = url;
  if (img.alt !== name) img.alt = name;
  if (img.title !== name) img.title = name;
}

/** Refresh every currently-rendered chat message — used when a persona swap
 *  happens so existing cards re-pick the new portrait without a reload. */
function _refreshAll() {
  document.querySelectorAll('li.chat-message, .chat-message').forEach((row) => {
    const id = row.dataset?.messageId;
    if (!id) return;
    const msg = game.messages?.get(id);
    if (msg) _applyPortrait(msg, row);
  });
}

export function register() {
  // v13 (newer builds): renderChatMessageHTML — root is an HTMLElement.
  Hooks.on('renderChatMessageHTML', (message, html) => {
    try { _applyPortrait(message, html); }
    catch (err) { console.warn('GS | chat portrait inject (HTML) failed:', err); }
  });
  // v12 / older v13: renderChatMessage — html is a jQuery-like wrapper.
  Hooks.on('renderChatMessage', (message, html) => {
    try {
      const root = html?.[0] ?? html;
      _applyPortrait(message, root);
    } catch (err) { console.warn('GS | chat portrait inject failed:', err); }
  });

  // Persona swap → refresh all currently-visible cards so their portraits
  // re-pick the new token image. The actor.update fires updateActor; we
  // also listen to the canonical goodSociety.personaSwapped hook in case
  // a swap path emits that without a top-level actor.update.
  Hooks.on('updateActor', (actor, changes) => {
    if (changes?.system?.activePersonaId !== undefined ||
        changes?.system?.personas !== undefined ||
        changes?.prototypeToken?.texture?.src !== undefined) {
      _refreshAll();
    }
  });
  Hooks.on('goodSociety.personaSwapped', () => _refreshAll());
}
