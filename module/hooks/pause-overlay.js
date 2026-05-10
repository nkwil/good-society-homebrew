/**
 * Pause overlay — replaces Foundry's default <div id="pause"> contents with
 * the system's themed overlay. Post-MVP §2.2 / patch-world-identity §5.
 *
 * Relies on `body.gs-world-identity` to gate the visual output. When the body
 * class is absent, our markup is hidden via CSS and Foundry's default shows.
 */

const TEMPLATE = 'systems/good-society-homebrew/templates/apps/pause-overlay.hbs';

export function register() {
  Hooks.on('renderPause', async (app, html) => {
    // Resolve a DOM root from whatever Foundry passed (may be a jQuery wrapper
    // or an HTMLElement depending on Foundry version).
    const root = (html?.[0] && html.length === 1) ? html[0] : (html instanceof HTMLElement ? html : html?.[0]);
    if (!root || typeof root.querySelector !== 'function') return;

    // Idempotent — if our markup is already injected, skip re-render.
    if (root.querySelector('.gs-pause')) return;

    let cameoUrl = '';
    try { cameoUrl = game.settings.get('good-society-homebrew', 'pauseCameoImageUrl') || ''; } catch {}

    const eyebrow = game.i18n.localize('GOODSOCIETY.pause.eyebrow');
    const title   = game.i18n.localize('GOODSOCIETY.pause.title');
    const monogram = (game.world?.title || 'W').trim().charAt(0).toUpperCase();

    try {
      const html = await foundry.applications.handlebars.renderTemplate(TEMPLATE, {
        eyebrow, title, cameoUrl, monogram,
      });
      // Append our markup. CSS in `_pause-overlay.css` hides Foundry's default
      // children when `body.gs-world-identity` is present and shows our `.gs-pause`.
      root.insertAdjacentHTML('beforeend', html);
    } catch (err) {
      console.warn('GS | pause overlay render failed (non-fatal):', err);
    }
  });
}
