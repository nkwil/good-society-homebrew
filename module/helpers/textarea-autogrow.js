/**
 * textarea-autogrow.js — JS fallback for auto-growing single-line textareas.
 *
 * CSS `field-sizing: content` would do this natively, but it requires
 * Chromium 123+ (March 2024). Foundry v13's bundled Electron may be older
 * on some builds — in which case textareas styled as wrapping subtitles
 * (Major dossier subhead, Connection/NPC bio-line) render at their default
 * 2-row height and ignore content overflow.
 *
 * This helper sizes every `textarea[data-autogrow]` inside a given root to
 * its content height, re-sizes on input, and is idempotent (safe to call
 * on every render — listeners attach fresh because re-renders mount new
 * DOM nodes, and old listeners die with their elements).
 *
 * @param {HTMLElement} root - The sheet's outer element (`this.element`).
 */
export function bindAutogrowTextareas(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  for (const ta of root.querySelectorAll('textarea[data-autogrow]')) {
    _grow(ta);
    ta.addEventListener('input', () => _grow(ta));
  }
}

/** Resize one textarea to fit its content. `auto` reset is required so a
 *  *shrinking* value (delete key) re-collapses; without it, `scrollHeight`
 *  reads the previous, taller, value. */
function _grow(ta) {
  ta.style.height = 'auto';
  ta.style.height = `${ta.scrollHeight}px`;
}
