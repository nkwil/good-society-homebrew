/**
 * NPC Quick-Create — small modal for dropping a new NPC at a canvas click point.
 *
 * Per docs/design/19-gm-tools.md §"NPC Quick-Create modal".
 *
 * Triggered by right-clicking empty canvas (see module/hooks/canvas-context.js).
 * Framed ApplicationV2 (not vanilla DOM) because the form has persistent input
 * state that needs to survive while the GM types. Different from the Reveal
 * Control (transient confirm overlay) and the tooltip (display-only).
 *
 * Form state (name, role, custom role, portrait) is stored in class fields so
 * portrait selection (which opens FilePicker without re-rendering) and role
 * toggling don't lose values.
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;
const NS = 'good-society-homebrew';

export const NPC_ROLES = [
  { value: 'innkeeper',   label: 'Innkeeper' },
  { value: 'tavernkeeper',label: 'Tavern keeper' },
  { value: 'footman',     label: 'Footman' },
  { value: 'maid',        label: 'Maid' },
  { value: 'stablehand',  label: 'Stable hand' },
  { value: 'coachman',    label: 'Coachman' },
  { value: 'gentleman',   label: 'Anonymous gentleman' },
  { value: 'lady',        label: 'Anonymous lady' },
  { value: 'vendor',      label: 'Vendor / Tradesperson' },
  { value: 'servant',     label: 'Servant' },
  { value: 'guard',       label: 'Guard' },
  { value: 'custom',      label: 'Custom...' },
];

export class NpcQuickCreate extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-npc-quick-create',
    classes: ['good-society', 'gs-npc-quick-create'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.npcQuickCreate.windowTitle',
    },
    position: { width: 380, height: 'auto' },
    actions: {
      dropNpc:       NpcQuickCreate.#dropNpc,
      browsePortrait:NpcQuickCreate.#browsePortrait,
      cancel:        NpcQuickCreate.#cancel,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/apps/npc-quick-create.hbs',
    },
  };

  // ── State ──────────────────────────────────────────────────────────────────

  /** Canvas coordinates (canvas units) where the token will be dropped. */
  #canvasPos;

  /** Mutable form state — persisted across FilePicker round-trips. */
  #state = {
    name:        '',
    role:        'footman',
    customRole:  '',
    portraitUrl: null,
  };

  constructor(canvasPos, options = {}) {
    super(options);
    this.#canvasPos = canvasPos;
  }

  // ── Context ────────────────────────────────────────────────────────────────

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    ctx.sceneName  = canvas.scene?.name ?? '';
    ctx.roles      = NPC_ROLES;
    ctx.state      = { ...this.#state };
    return ctx;
  }

  // ── Render — restore form state after any re-render ───────────────────────

  _onRender(context, options) {
    super._onRender?.(context, options);
    const root = this.element;

    // Restore values (needed after FilePicker re-routes but also on first render).
    const nameEl = root.querySelector('[name="npcName"]');
    if (nameEl) nameEl.value = this.#state.name;

    const roleEl = root.querySelector('[name="npcRole"]');
    if (roleEl) {
      roleEl.value = this.#state.role;
      this.#toggleCustomInput(this.#state.role === 'custom');
    }

    const customEl = root.querySelector('[name="npcRoleCustom"]');
    if (customEl) customEl.value = this.#state.customRole;

    // Live-save form state so FilePicker round-trips don't lose typed values.
    nameEl?.addEventListener('input', (ev) => { this.#state.name = ev.target.value; });
    roleEl?.addEventListener('change', (ev) => {
      this.#state.role = ev.target.value;
      this.#toggleCustomInput(ev.target.value === 'custom');
    });
    customEl?.addEventListener('input', (ev) => { this.#state.customRole = ev.target.value; });
  }

  #toggleCustomInput(show) {
    const wrap = this.element?.querySelector('.gs-npc-quick-create__custom-role');
    if (wrap) wrap.style.display = show ? 'block' : 'none';
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  static async #dropNpc(ev, _target) {
    const s = this.#state;
    const role = s.role === 'custom'
      ? (s.customRole.trim() || game.i18n.localize('GOODSOCIETY.npcQuickCreate.defaultRole'))
      : (NPC_ROLES.find(r => r.value === s.role)?.label ?? s.role);

    const npcName = s.name.trim() || role;
    const portraitUrl = s.portraitUrl ?? 'icons/svg/mystery-man.svg';

    // Create the NPC actor.
    const actor = await Actor.create({
      name: npcName,
      type: 'npc',
      img:  portraitUrl,
      system: {
        bio: { role, portraitUrl },
      },
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE },
    });
    if (!actor) return;

    // Drop a token at the captured canvas coordinates.
    const pos = this.#canvasPos;
    await canvas.scene?.createEmbeddedDocuments('Token', [{
      name:    npcName,
      actorId: actor.id,
      x:       Math.round(pos.x),
      y:       Math.round(pos.y),
      texture: { src: portraitUrl },
      width:   1,
      height:  1,
    }]);

    this.close();

    // Notification with implicit "open sheet" — the GM can find the actor in the sidebar.
    ui.notifications?.info(
      game.i18n.format('GOODSOCIETY.npcQuickCreate.created', { name: npcName })
    );
  }

  static async #browsePortrait(ev, _target) {
    const picker = new FilePicker({
      type: 'image',
      callback: (path) => {
        this.#state.portraitUrl = path;
        // Update preview in-place without a full re-render.
        const preview = this.element?.querySelector('.gs-npc-quick-create__portrait-preview');
        if (preview) {
          preview.src = path;
          preview.hidden = false;
        }
        const placeholder = this.element?.querySelector('.gs-npc-quick-create__portrait-placeholder');
        if (placeholder) placeholder.hidden = true;
      },
    });
    picker.render(true);
  }

  static #cancel(_ev, _target) {
    this.close();
  }
}
