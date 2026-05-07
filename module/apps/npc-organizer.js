/**
 * NpcOrganizer — frameless sidebar listing all Connection and NPC tokens
 * on the active scene. Updates in real-time via token hooks.
 *
 * Per docs/design/19-gm-tools.md §"NPC Organizer per scene".
 *
 * Architecture: frameless ApplicationV2 (same pattern as my-characters-dock).
 * Singleton — only one instance; token hooks call render() on it.
 * Position persisted to 'organizerPosition' client setting.
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;
const NS = 'good-society-homebrew';

export class NpcOrganizer extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-npc-organizer',
    classes: ['good-society', 'gs-npc-organizer'],
    window: { frame: false, positioned: true },
    position: { width: 290, height: 'auto', left: 370, top: 100 },
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/apps/npc-organizer.hbs',
    },
  };

  constructor(options = {}) {
    const stored = (() => {
      try { return game.settings.get(NS, 'organizerPosition'); }
      catch { return null; }
    })();
    if (stored?.left != null && stored?.top != null) {
      options.position = { ...NpcOrganizer.DEFAULT_OPTIONS.position, ...stored };
    }
    super(options);
  }

  // ── Context ────────────────────────────────────────────────────────────────

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const scene = canvas.scene;
    ctx.sceneName = scene?.name ?? '';
    ctx.hasScene = !!scene;

    if (!scene) {
      ctx.connections = [];
      ctx.npcs = [];
      ctx.total = 0;
      return ctx;
    }

    const connections = [];
    const npcs = [];

    for (const token of scene.tokens.contents) {
      const actor = game.actors?.get(token.actorId);
      if (!actor) continue;
      const item = {
        tokenId: token.id,
        tokenName: token.name,
        portraitUrl: actor.system?.bio?.portraitUrl || actor.img || '',
        portraitInitial: (actor.name?.[0] ?? '?').toUpperCase(),
        theme: actor.system?.theme ?? (actor.type === 'npc' ? 'npc' : 'connection-green'),
        actorId: actor.id,
      };
      if (actor.type === 'connection') connections.push(item);
      else if (actor.type === 'npc') npcs.push(item);
    }

    ctx.connections = connections;
    ctx.npcs = npcs;
    ctx.total = connections.length + npcs.length;
    return ctx;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  _onRender(context, options) {
    super._onRender?.(context, options);
    this._wireInteractions();
    this._makeDraggable();
  }

  // ── Row interactions ───────────────────────────────────────────────────────

  _wireInteractions() {
    const root = this.element;
    if (!root || root._gsOrgBound) return;
    root._gsOrgBound = true;

    // Click → pan camera to token
    root.addEventListener('click', (ev) => {
      const row = ev.target.closest('[data-token-id]');
      if (!row) return;
      const placeable = canvas.tokens?.placeables.find(t => t.id === row.dataset.tokenId);
      if (!placeable) return;
      const scale = Math.max(canvas.stage?.scale?.x ?? 1, 0.5);
      canvas.animatePan({ x: placeable.center.x, y: placeable.center.y, scale });
    });

    // Double-click → open actor sheet
    root.addEventListener('dblclick', (ev) => {
      const row = ev.target.closest('[data-token-id]');
      if (!row) return;
      const actor = game.actors?.get(row.dataset.actorId);
      actor?.sheet?.render(true);
    });

    // Right-click → context menu
    root.addEventListener('contextmenu', (ev) => {
      const row = ev.target.closest('[data-token-id]');
      if (!row) return;
      ev.preventDefault();
      _showContextMenu(row.dataset.tokenId, row.dataset.actorId, ev.clientX, ev.clientY);
    });
  }

  // ── Draggable header ───────────────────────────────────────────────────────

  _makeDraggable() {
    const root = this.element;
    const header = root?.querySelector('.gs-npc-organizer__header');
    if (!header || root._gsDragBound) return;
    root._gsDragBound = true;

    let startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', (ev) => {
      if (ev.button !== 0) return;
      startX = ev.clientX;
      startY = ev.clientY;
      const rect = root.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;

      const onMove = (e) => {
        root.style.left = `${startLeft + e.clientX - startX}px`;
        root.style.top = `${startTop + e.clientY - startY}px`;
      };
      const onUp = async () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        const r = root.getBoundingClientRect();
        try {
          await game.settings.set(NS, 'organizerPosition', {
            left: Math.round(r.left),
            top: Math.round(r.top),
          });
        } catch { /* ignore */ }
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  /** @override — clean up context menu on close. */
  async _onClose(options) {
    await super._onClose?.(options);
    document.getElementById('gs-organizer-ctx')?.remove();
    _instance = null;
  }
}

// ── Context menu ─────────────────────────────────────────────────────────────

function _showContextMenu(tokenId, actorId, clientX, clientY) {
  document.getElementById('gs-organizer-ctx')?.remove();

  const token = canvas.scene?.tokens.get(tokenId);
  const actor = game.actors?.get(actorId);
  if (!token || !actor) return;

  const menu = document.createElement('div');
  menu.id = 'gs-organizer-ctx';
  menu.className = 'gs-organizer-ctx';
  menu.style.cssText = `position:fixed;left:${clientX}px;top:${clientY}px;z-index:600;pointer-events:auto;`;
  menu.innerHTML = `
    <button class="gs-organizer-ctx__item" data-action="open-sheet">
      ${game.i18n.localize('GOODSOCIETY.npcOrganizer.ctx.openSheet')}
    </button>
    <button class="gs-organizer-ctx__item gs-organizer-ctx__item--danger" data-action="remove-token">
      ${game.i18n.localize('GOODSOCIETY.npcOrganizer.ctx.removeToken')}
    </button>
  `;

  document.body.appendChild(menu);

  menu.addEventListener('click', async (ev) => {
    const action = ev.target.closest('[data-action]')?.dataset.action;
    menu.remove();
    if (action === 'open-sheet') {
      const a = game.actors?.get(actorId);
      a?.sheet?.render(true);
    } else if (action === 'remove-token') {
      const confirmed = window.confirm(
        game.i18n.format('GOODSOCIETY.npcOrganizer.ctx.removeConfirm', { name: actor.name })
      );
      if (confirmed) {
        await canvas.scene?.deleteEmbeddedDocuments('Token', [tokenId]);
      }
    }
  });

  setTimeout(() => {
    const dismiss = () => { menu.remove(); document.removeEventListener('click', dismiss); };
    document.addEventListener('click', dismiss);
  }, 0);
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _instance = null;

export function getOrganizer() {
  if (!_instance) _instance = new NpcOrganizer();
  return _instance;
}

export function toggleOrganizer() {
  if (_instance?.rendered) {
    _instance.close();
  } else {
    getOrganizer().render({ force: true });
  }
}

export function renderOrganizer() {
  if (_instance?.rendered) _instance.render({ force: true });
}
