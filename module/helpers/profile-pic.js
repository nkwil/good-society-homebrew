/**
 * Profile picture resolution — single source of truth for "what image
 * represents this character" anywhere in the system.
 *
 * Per post-MVP §8.5: every render path resolves the visual that represents a
 * character from the actor's *token* image (with persona override), NOT from
 * `actor.img` or `persona.portraitUrl`. Natalie's custom illustrated tokens
 * carry whatever framing identity each character has — the token IS the cameo.
 *
 *   profilePicUrl = activePersona?.tokenImageUrl || actor.prototypeToken.texture.src
 *
 * Display shape (circular vs. square, 18 px swatch vs. 380 px overlay) stays
 * per-context; this helper only governs the *image source*.
 *
 * Anti-pattern (CLAUDE.md §16): don't inline `activePersona?.portraitUrl ||
 * actor.img` in render code. Always go through this helper. Inline portrait
 * resolution silently misses the token-based source and shows stale or empty
 * portraits when actors lack `actor.img` (which can happen — `actor.img` is
 * editable but optional).
 */

/**
 * Resolve the profile-pic URL for an actor (Major, Connection, or NPC).
 *
 * @param {Actor|null|undefined} actor - The actor to resolve. May be falsy.
 * @returns {string} The resolved URL, or '' if no source is available. Never null.
 */
export function profilePic(actor) {
  if (!actor) return '';

  // Honor only EXPLICIT persona selection. The data-model's `activePersona`
  // getter has a fallback chain (active → primary → first persona); using
  // that here meant "true identity" silently resolved to the primary
  // persona's image because activePersonaId is '' but the getter still
  // returned the primary. Result: cameo / dock / dashboard / hover-card
  // all showed the primary persona instead of actor.img when the user
  // explicitly picked "true identity." Same anti-pattern we fixed on
  // dashboard-context / dock-context for display NAMES — this is the
  // same fix for IMAGES.
  const activeId = actor.system?.activePersonaId;
  const explicitPersona = activeId
    ? (actor.system?.personas ?? []).find(p => p.id === activeId)
    : null;

  // Persona image fallback chain (when a persona is explicitly active):
  //   1. tokenImageUrl  — explicit token-only image
  //   2. portraitUrl    — cameo image, doubles as token if no separate
  //                       token image was uploaded for this persona
  // Same chain persona-swap.js uses to keep visual surfaces in sync with
  // the token texture after a swap.
  if (explicitPersona) {
    const src = explicitPersona.tokenImageUrl || explicitPersona.portraitUrl;
    if (src) return src;
    // If the persona was created with no images at all, fall through to
    // the actor-level fallbacks rather than returning ''.
  }

  // True-identity / fallback path. v13 token texture is the canonical
  // base-identity image; actor.img is the last-resort backup.
  const tokenSrc = actor.prototypeToken?.texture?.src;
  if (tokenSrc) return tokenSrc;
  return actor.img ?? '';
}

/**
 * Resolve the display name for an actor — persona name when active, falling
 * back to actor.name. Mirrors the per-surface "displayName" pattern used in
 * dashboard-context, dock-context, and the Major sheet's _prepareContext.
 *
 * Kept in this file because every consumer of profilePic() also needs the
 * display name; co-location prevents drift.
 *
 * @param {Actor|null|undefined} actor
 * @returns {string}
 */
export function profileName(actor) {
  if (!actor) return '';
  return actor.system?.activePersona?.name || actor.name || '';
}
