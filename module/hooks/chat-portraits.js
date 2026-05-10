/**
 * chat-portraits.js — swap Foundry's default chat-message speaker portrait
 * (which uses `actor.img`) for the post-MVP §8.5 token-based profile pic.
 *
 * Foundry v13 renders the speaker portrait inside each chat message at one of
 * a few selectors depending on the build (`.message-sender img.avatar`,
 * `.chat-message header .avatar`, `img.message-portrait`, etc.). We listen to
 * `renderChatMessageHTML` (v13) AND legacy `renderChatMessage` (older v13
 * builds and other systems' message styles) and rewrite any portrait img we
 * find to the result of `profilePic(actor)`.
 *
 * Defensive — we never fail loudly if the portrait can't be resolved; we
 * just leave the original src in place.
 */

import { profilePic } from '../helpers/profile-pic.js';

const NS = 'good-society-homebrew';

/** Resolve the actor a chat message is "speaking as." Prefers the explicit
 *  speaker.actor (set by the speaking-as pipeline + every chat-card helper),
 *  with a fallback to the chat-card flag we stamp on themed cards. */
function _resolveSpeakerActor(message) {
  const speakerActorId = message?.speaker?.actor;
  if (speakerActorId) {
    const actor = game.actors?.get(speakerActorId);
    if (actor) return actor;
  }
  const flagActorId = message?.flags?.[NS]?.speakerActorId;
  if (flagActorId) {
    const actor = game.actors?.get(flagActorId);
    if (actor) return actor;
  }
  return null;
}

/** Swap the avatar img src on a rendered chat message element. */
function _applyPortrait(message, root) {
  if (!root) return;
  const actor = _resolveSpeakerActor(message);
  if (!actor) return;
  const url = profilePic(actor);
  if (!url) return;
  // v13 renders one of these depending on the build / chat style. Patch all
  // matches so the change works across versions.
  const selectors = [
    '.message-sender img.avatar',
    '.message-header img.avatar',
    'header.message-header img',
    'img.message-portrait',
    '.chat-portrait',
    'img.chat-portrait',
  ];
  for (const sel of selectors) {
    const imgs = root.querySelectorAll(sel);
    for (const img of imgs) {
      if (img.tagName === 'IMG' && img.src !== url) {
        img.src = url;
      }
    }
  }
}

export function register() {
  // v13 (newer builds): renderChatMessageHTML — root is an HTMLElement.
  Hooks.on('renderChatMessageHTML', (message, html) => {
    try { _applyPortrait(message, html); }
    catch (err) { console.warn('GS | chat portrait swap (HTML) failed:', err); }
  });
  // v12 / older v13: renderChatMessage — html is a jQuery-like wrapper.
  Hooks.on('renderChatMessage', (message, html) => {
    try {
      const root = html?.[0] ?? html;
      _applyPortrait(message, root);
    } catch (err) { console.warn('GS | chat portrait swap failed:', err); }
  });
}
