/**
 * NpcOrganizer — frameless GM-only catalog of every character actor in the
 * world (Majors, Connections, NPCs). Drag a row onto the canvas to place a
 * token; double-click to open the sheet; right-click for a small context
 * menu. Two "+ Create…" buttons in the header spawn fresh NPCs / Connections.
 *
 * Previous behaviour listed only tokens already placed on the active scene,
 * which left the panel empty until someone had dropped one from the sidebar.
 * The new design works from the actor list directly, so it's useful even on
 * an empty scene.
 *
 * Foundry already handles the drop side: setting the `text/plain`
 * dataTransfer payload to `{ type: 'Actor', uuid: <Actor.uuid> }` is the
 * canonical format the canvas DragDrop listener consumes — it auto-creates a
 * token from the actor's prototypeToken at the drop position.
 *
 * Architecture: frameless ApplicationV2 singleton. Position persisted to
 * `organizerPosition`; minimized state to `organizerMinimized`.
 */

import { profilePic } from '../helpers/profile-pic.js';

const { HandlebarsApplicationMixin, ApplicationV2, DialogV2 } = foundry.applications.api;
const NS = 'good-society-homebrew';
const LISTED_TYPES = ['major-character', 'connection', 'npc'];

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

    // Build a map of actorId → has-token-on-active-scene, so each row can
    // show a small "on scene" indicator. Cheap, fires once per render.
    const onSceneActorIds = new Set(
      (scene?.tokens?.contents ?? []).map((t) => t.actorId).filter(Boolean),
    );

    const groups = { 'major-character': [], 'connection': [], 'npc': [] };
    const allActors = game.actors?.contents ?? [];
    for (const actor of allActors) {
      if (!LISTED_TYPES.includes(actor.type)) continue;
      const gmNote = String(actor.getFlag(NS, 'gmNote') ?? '').trim();
      groups[actor.type].push({
        actorId: actor.id,
        actorUuid: actor.uuid,
        actorName: actor.name,
        title: (actor.system?.bio?.title ?? '').trim(),
        portraitUrl: profilePic(actor),
        portraitInitial: (actor.name?.[0] ?? '?').toUpperCase(),
        theme: actor.system?.theme ?? (actor.type === 'npc' ? 'npc' : 'connection-green'),
        type: actor.type,
        onScene: onSceneActorIds.has(actor.id),
        gmNote,
        hasNote: !!gmNote,
        notePreview: gmNote.length > 80 ? `${gmNote.slice(0, 80).trimEnd()}…` : gmNote,
      });
    }
    const byName = (a, b) => (a.actorName || '').localeCompare(b.actorName || '');
    groups['major-character'].sort(byName);
    groups['connection'].sort(byName);
    groups['npc'].sort(byName);

    ctx.majors      = groups['major-character'];
    ctx.connections = groups['connection'];
    ctx.npcs        = groups['npc'];
    ctx.total       = ctx.majors.length + ctx.connections.length + ctx.npcs.length;

    ctx.minimized = (() => {
      try { return game.settings.get(NS, 'organizerMinimized'); }
      catch { return false; }
    })();

    return ctx;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  _onRender(context, options) {
    super._onRender?.(context, options);
    this._wireInteractions();
    this._makeDraggable();
    this._wireMinimize();
    this._wireCreateButtons();
  }

  /** Minimize button — collapses body + footer, persists state. */
  _wireMinimize() {
    const root = this.element;
    const btn = root?.querySelector('[data-action="toggle-minimize"]');
    if (!btn || btn._gsOrgMinBound) return;
    btn._gsOrgMinBound = true;

    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const section = root.querySelector('.gs-npc-organizer');
      if (!section) return;
      const willMinimize = !section.classList.contains('is-minimized');
      section.classList.toggle('is-minimized', willMinimize);
      btn.textContent = willMinimize ? '+' : '−';
      try {
        await game.settings.set(NS, 'organizerMinimized', willMinimize);
      } catch (e) {
        console.warn('[good-society organizer] could not persist minimized state:', e);
      }
    });
  }

  /** "+ New Connection" / "+ New NPC" header buttons. */
  _wireCreateButtons() {
    const root = this.element;
    if (!root || root._gsOrgCreateBound) return;
    root._gsOrgCreateBound = true;
    root.addEventListener('click', async (ev) => {
      const btn = ev.target.closest?.('[data-action="create-actor"]');
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      const type = btn.dataset.actorType;
      if (!LISTED_TYPES.includes(type)) return;
      await _createActorOfType(type);
    });
  }

  // ── Row interactions ───────────────────────────────────────────────────────

  _wireInteractions() {
    const root = this.element;
    if (!root || root._gsOrgBound) return;
    root._gsOrgBound = true;

    // Drag start — write the Foundry-standard Actor payload onto the
    // dataTransfer. Foundry's canvas drop listener reads this and creates a
    // token from the actor's prototypeToken at the drop coords. Setting both
    // `text/plain` and the legacy `application/json` covers every consumer.
    root.addEventListener('dragstart', (ev) => {
      // Starting a drag on the note button must not place a token.
      if (ev.target.closest?.('[data-action="edit-note"]')) {
        ev.preventDefault();
        return;
      }
      const row = ev.target.closest?.('[data-actor-uuid]');
      if (!row) return;
      const uuid = row.dataset.actorUuid;
      if (!uuid) return;
      const payload = JSON.stringify({ type: 'Actor', uuid });
      ev.dataTransfer?.setData('text/plain', payload);
      ev.dataTransfer?.setData('application/json', payload);
      if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'copy';
      // A subtle visual cue while dragging.
      row.classList.add('is-dragging');
    });
    root.addEventListener('dragend', (ev) => {
      const row = ev.target.closest?.('[data-actor-uuid]');
      row?.classList?.remove('is-dragging');
    });

    // Note button — opens the per-character GM note editor. Stops propagation
    // so the row's drag / sheet-open handlers don't also fire.
    root.addEventListener('click', (ev) => {
      const btn = ev.target.closest?.('[data-action="edit-note"]');
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      const row = btn.closest('[data-actor-id]');
      const actor = game.actors?.get(row?.dataset.actorId);
      if (actor) _openNoteEditor(actor);
    });

    // Double-click — open the actor sheet (but not when double-clicking the
    // note button).
    root.addEventListener('dblclick', (ev) => {
      if (ev.target.closest?.('[data-action="edit-note"]')) return;
      const row = ev.target.closest?.('[data-actor-id]');
      if (!row) return;
      const actor = game.actors?.get(row.dataset.actorId);
      actor?.sheet?.render(true);
    });

    // Right-click — small context menu.
    root.addEventListener('contextmenu', (ev) => {
      const row = ev.target.closest?.('[data-actor-id]');
      if (!row) return;
      ev.preventDefault();
      _showContextMenu(row.dataset.actorId, ev.clientX, ev.clientY);
    });
  }

  // ── Draggable window header ────────────────────────────────────────────────

  _makeDraggable() {
    const root = this.element;
    const header = root?.querySelector('.gs-npc-organizer__header');
    if (!header || root._gsDragBound) return;
    root._gsDragBound = true;

    let startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', (ev) => {
      // Don't intercept clicks on header buttons (minimize / create).
      if (ev.target.closest('button')) return;
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

// ── Actor creation ───────────────────────────────────────────────────────────

async function _createActorOfType(type) {
  const defaultNames = {
    'connection':      game.i18n.localize('GOODSOCIETY.npcOrganizer.newConnectionName'),
    'npc':             game.i18n.localize('GOODSOCIETY.npcOrganizer.newNpcName'),
    'major-character': game.i18n.localize('GOODSOCIETY.npcOrganizer.newMajorName'),
  };
  try {
    const actor = await Actor.create({ name: defaultNames[type] || 'New Character', type });
    if (actor) actor.sheet?.render(true);
  } catch (err) {
    console.warn('[good-society organizer] could not create actor:', err);
    ui.notifications?.error(
      game.i18n.localize('GOODSOCIETY.npcOrganizer.createFailed') || 'Could not create actor.',
    );
  }
}

// ── GM note editor ───────────────────────────────────────────────────────────
//
// Per-character GM scratchpad. Stored as an actor flag
// (`flags['good-society-homebrew'].gmNote`) rather than a schema field so it
// works uniformly across Majors, Connections, and NPCs without touching three
// locked data-model schemas. Empty notes unset the flag so rows stay clean.

async function _openNoteEditor(actor) {
  const current = String(actor.getFlag(NS, 'gmNote') ?? '');
  const displayName = actor.system?.activePersona?.name || actor.name;
  const result = await DialogV2.wait({
    window: { title: game.i18n.format('GOODSOCIETY.npcOrganizer.noteTitle', { name: displayName }) },
    position: { width: 420 },
    content: `<textarea name="gmNote" class="gs-organizer-note-editor__textarea" rows="8"
      placeholder="${game.i18n.localize('GOODSOCIETY.npcOrganizer.notePlaceholder')}">${foundry.utils.escapeHTML(current)}</textarea>`,
    buttons: [
      {
        action: 'save',
        label: game.i18n.localize('GOODSOCIETY.npcOrganizer.noteSave'),
        default: true,
        callback: (event, button) => button.form.elements.gmNote.value,
      },
      {
        action: 'cancel',
        label: game.i18n.localize('GOODSOCIETY.npcOrganizer.noteCancel'),
      },
    ],
    rejectClose: false,
  });

  // null = closed via X; 'cancel' = cancel button. Either way, no write.
  if (result == null || result === 'cancel') return;
  const text = String(result).trim();
  if (text) await actor.setFlag(NS, 'gmNote', text);
  else await actor.unsetFlag(NS, 'gmNote');
  // The setFlag/unsetFlag fires updateActor, which re-renders the organizer.
}

// ── Context menu ─────────────────────────────────────────────────────────────

function _showContextMenu(actorId, clientX, clientY) {
  document.getElementById('gs-organizer-ctx')?.remove();
  const actor = game.actors?.get(actorId);
  if (!actor) return;

  const scene = canvas.scene;
  const onSceneTokens = (scene?.tokens?.contents ?? []).filter((t) => t.actorId === actorId);
  const isOnScene = onSceneTokens.length > 0;

  const menu = document.createElement('div');
  menu.id = 'gs-organizer-ctx';
  menu.className = 'gs-organizer-ctx';
  menu.style.cssText = `position:fixed;left:${clientX}px;top:${clientY}px;z-index:600;pointer-events:auto;`;

  const hasNote = !!String(actor.getFlag(NS, 'gmNote') ?? '').trim();

  const items = [
    {
      action: 'open-sheet',
      label: game.i18n.localize('GOODSOCIETY.npcOrganizer.ctx.openSheet'),
    },
    {
      action: 'edit-note',
      label: game.i18n.localize(
        hasNote ? 'GOODSOCIETY.npcOrganizer.ctx.editNote' : 'GOODSOCIETY.npcOrganizer.ctx.addNote',
      ),
    },
    {
      action: 'place-at-center',
      label: game.i18n.localize('GOODSOCIETY.npcOrganizer.ctx.placeAtCenter'),
      disabled: !scene,
    },
    isOnScene ? {
      action: 'pan-to-token',
      label: game.i18n.localize('GOODSOCIETY.npcOrganizer.ctx.panToToken'),
    } : null,
    isOnScene ? {
      action: 'remove-tokens',
      label: game.i18n.localize('GOODSOCIETY.npcOrganizer.ctx.removeToken'),
      danger: true,
    } : null,
    {
      action: 'delete-actor',
      label: game.i18n.localize('GOODSOCIETY.npcOrganizer.ctx.deleteActor'),
      danger: true,
    },
  ].filter(Boolean);

  menu.innerHTML = items.map((it) => `
    <button class="gs-organizer-ctx__item${it.danger ? ' gs-organizer-ctx__item--danger' : ''}"
            data-action="${it.action}"
            ${it.disabled ? 'disabled' : ''}>${it.label}</button>
  `).join('');

  document.body.appendChild(menu);

  menu.addEventListener('click', async (ev) => {
    const action = ev.target.closest('[data-action]')?.dataset.action;
    menu.remove();
    if (!action) return;

    if (action === 'open-sheet') {
      actor.sheet?.render(true);
    } else if (action === 'edit-note') {
      _openNoteEditor(actor);
    } else if (action === 'place-at-center' && scene) {
      // Drop a token at the current viewport center.
      const center = canvas.stage
        ? canvas.canvasCoordinatesFromClient({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          })
        : { x: scene.dimensions?.width / 2, y: scene.dimensions?.height / 2 };
      try {
        const tokenDoc = await actor.getTokenDocument({ x: center.x, y: center.y });
        await scene.createEmbeddedDocuments('Token', [tokenDoc.toObject()]);
      } catch (err) {
        console.warn('[good-society organizer] place-at-center failed:', err);
      }
    } else if (action === 'pan-to-token' && isOnScene) {
      const placeable = canvas.tokens?.placeables.find((t) => t.id === onSceneTokens[0].id);
      if (placeable) {
        const scale = Math.max(canvas.stage?.scale?.x ?? 1, 0.5);
        canvas.animatePan({ x: placeable.center.x, y: placeable.center.y, scale });
      }
    } else if (action === 'remove-tokens' && isOnScene) {
      const confirmed = window.confirm(
        game.i18n.format('GOODSOCIETY.npcOrganizer.ctx.removeConfirm', { name: actor.name })
      );
      if (confirmed) {
        await scene.deleteEmbeddedDocuments('Token', onSceneTokens.map((t) => t.id));
      }
    } else if (action === 'delete-actor') {
      const confirmed = await DialogV2.confirm({
        window: { title: game.i18n.localize('GOODSOCIETY.npcOrganizer.ctx.deleteActor') },
        content: `<p>${game.i18n.format('GOODSOCIETY.npcOrganizer.ctx.deleteActorConfirm', { name: actor.name })}</p>`,
      });
      if (confirmed) await actor.delete();
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

// ── Auto-refresh on world actor changes ──────────────────────────────────────
//
// Without these hooks, the organizer renders its actor list once and never
// notices when an actor is created, renamed, repainted, or deleted. That
// includes the organizer's OWN "+ NPCs" / "+ Connections" buttons — the new
// actor lands in the world but doesn't appear in the panel until the user
// closes and reopens it. Listening at module level (not inside the class)
// means the listeners survive close/reopen cycles. Listed-type filter
// keeps the re-render cheap when the GM creates items, journals, etc.

function _refreshOnRelevantActorChange(actor) {
  if (!actor || !LISTED_TYPES.includes(actor.type)) return;
  renderOrganizer();
}
Hooks.on('createActor',  _refreshOnRelevantActorChange);
Hooks.on('deleteActor',  _refreshOnRelevantActorChange);
Hooks.on('updateActor',  _refreshOnRelevantActorChange);

// Scene changes affect the "on scene" dot per row. Cheap to re-render on
// canvas activation / token placement; falls back to a no-op when the
// organizer is closed.
Hooks.on('canvasReady',  () => renderOrganizer());
Hooks.on('createToken',  () => renderOrganizer());
Hooks.on('deleteToken',  () => renderOrganizer());
