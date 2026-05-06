/**
 * MyCharactersDock — pinned compact panel showing the user's owned actors.
 *
 * Per docs/design/09-my-characters-dock.md.
 *
 * Implementation notes:
 *   - frameless ApplicationV2 (window.frame = false). Foundry's window
 *     chrome would be too heavy for a "dock" surface.
 *   - The ROW click handler is delegated on the dock root element so
 *     re-renders don't lose wiring.
 *   - The footer Speaking-As pill renders the same .gs-speaking-as markup
 *     as the chat-input bar but with data-variant="dock" so the chat-input
 *     bar's _doInject doesn't strip it. The popover delegated click handlers
 *     (in module/hooks/speaking-as.js) match by class and pick up clicks
 *     here too.
 */

import { buildDockContext } from '../helpers/dock-context.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;

export class MyCharactersDock extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-my-characters-dock',
    classes: ['good-society', 'gs-my-characters-dock'],
    window: {
      frame: false,
      positioned: true,
    },
    position: {
      width: 290,
      height: 'auto',
      // Default position — left side of canvas, below scene navigation, clear
      // of the chat sidebar on the right and the tools panel on the very-left.
      // CSS sets position: fixed on .application.gs-my-characters-dock so
      // these inline left/top values actually apply (frameless ApplicationV2
      // doesn't auto-position via the window manager).
      left: 70,
      top: 100,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/apps/dock.hbs',
      templates: [
        'systems/good-society-homebrew/templates/components/dock-major-row.hbs',
        'systems/good-society-homebrew/templates/components/dock-connection-row.hbs',
      ],
    },
  };

  /** Allow stored position to override defaults (set when drag-to-save lands
   * in v0.5). Read on construction so DEFAULT_OPTIONS.position serves as the
   * baseline, and any stored {left, top} merges over it. */
  constructor(options = {}) {
    const stored = (() => {
      try { return game.settings.get('good-society-homebrew', 'dockPosition'); }
      catch { return null; }
    })();
    if (stored && typeof stored.left === 'number' && typeof stored.top === 'number') {
      options.position = { ...MyCharactersDock.DEFAULT_OPTIONS.position, ...stored };
    }
    super(options);
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    Object.assign(ctx, buildDockContext());
    ctx.minimized = (() => {
      try { return game.settings.get('good-society-homebrew', 'dockMinimized'); }
      catch { return false; }
    })();
    return ctx;
  }

  /** @inheritDoc */
  _onRender(context, options) {
    super._onRender?.(context, options);
    this._wireRowClicks();
    this._wireDrag();
    this._wireMinimize();
  }

  /** Single delegated handler on the dock root — open the actor sheet. */
  _wireRowClicks() {
    const root = this.element;
    if (!root || root._gsDockRowsBound) return;
    root._gsDockRowsBound = true;

    root.addEventListener('click', (ev) => {
      // Don't trigger row-open when clicking inside the speaker switcher,
      // header, or minimize button.
      if (ev.target.closest('.gs-speaking-as')) return;
      if (ev.target.closest('.gs-dock__header')) return;
      const row = ev.target.closest('[data-actor-id]');
      if (!row) return;
      const actorId = row.dataset.actorId;
      if (!actorId) return;
      const actor = game.actors?.get(actorId);
      if (!actor) return;
      actor.sheet?.render(true);
    });

    root.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      const row = ev.target.closest?.('[data-actor-id]');
      if (!row) return;
      ev.preventDefault();
      const actor = game.actors?.get(row.dataset.actorId);
      actor?.sheet?.render(true);
    });
  }

  /** Drag-to-move on the header. Mousedown anywhere on the header (except the
   * minimize button) starts a drag; mousemove updates inline left/top; mouseup
   * persists the new position to the dockPosition setting. */
  _wireDrag() {
    const root = this.element;
    const header = root?.querySelector('.gs-dock__header');
    if (!header || header._gsDockDragBound) return;
    header._gsDockDragBound = true;

    let dragging = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;

    header.addEventListener('mousedown', (ev) => {
      // Don't start a drag if the click is on the minimize button.
      if (ev.target.closest('[data-action="toggle-minimize"]')) return;
      ev.preventDefault();
      dragging = true;
      startX = ev.clientX;
      startY = ev.clientY;
      const rect = root.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      root.classList.add('is-dragging');
    });

    document.addEventListener('mousemove', (ev) => {
      if (!dragging) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const newLeft = Math.max(0, Math.min(window.innerWidth - 50, startLeft + dx));
      const newTop = Math.max(0, Math.min(window.innerHeight - 30, startTop + dy));
      root.style.left = newLeft + 'px';
      root.style.top = newTop + 'px';
    });

    document.addEventListener('mouseup', async (ev) => {
      if (!dragging) return;
      dragging = false;
      root.classList.remove('is-dragging');
      const left = parseInt(root.style.left, 10);
      const top = parseInt(root.style.top, 10);
      try {
        await game.settings.set('good-society-homebrew', 'dockPosition', { left, top });
      } catch (e) {
        console.warn('[good-society dock] could not persist position:', e);
      }
    });
  }

  /** Minimize button — collapses body + footer, persists state. */
  _wireMinimize() {
    const root = this.element;
    const btn = root?.querySelector('[data-action="toggle-minimize"]');
    if (!btn || btn._gsDockMinBound) return;
    btn._gsDockMinBound = true;

    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const dock = root.querySelector('.gs-dock');
      if (!dock) return;
      const willMinimize = !dock.classList.contains('is-minimized');
      dock.classList.toggle('is-minimized', willMinimize);
      btn.textContent = willMinimize ? '+' : '−';
      try {
        await game.settings.set('good-society-homebrew', 'dockMinimized', willMinimize);
      } catch (e) {
        console.warn('[good-society dock] could not persist minimized state:', e);
      }
    });
  }
}

/** Lazy singleton — created on first render call. */
let _instance = null;

/** Get-or-create the singleton dock instance. */
export function getDock() {
  if (!_instance) _instance = new MyCharactersDock();
  return _instance;
}

/** Render or re-render the dock if the user has any owned actors. */
export function renderDock() {
  const ctx = buildDockContext();
  const visible = (() => {
    try { return game.settings.get('good-society-homebrew', 'dockVisible'); }
    catch { return true; }
  })();
  const dock = getDock();
  if (!visible || !ctx.hasAny) {
    if (dock.rendered) dock.close({ animate: false });
    return;
  }
  dock.render({ force: true });
}
