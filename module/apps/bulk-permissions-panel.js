import { profilePic } from '../helpers/profile-pic.js';

/**
 * BulkPermissionsPanel — GM-only matrix for setting actor ownership across
 * all users in one screen.
 *
 * Per docs/design/22-bulk-permissions-panel.md.
 *
 * Interaction model:
 *   - Cell click → inline vanilla-DOM dropdown → updates #pending Map.
 *   - All DOM updates happen in-place; no full re-render until Save/Discard.
 *   - Save: confirm once, then batch actor.update({ ownership }) per actor.
 *   - Discard: clear #pending, full re-render.
 */

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const NS = 'good-society-homebrew';

// ── Permission level metadata ─────────────────────────────────────────────────

const PERM_LEVELS = [
  { level: 0, label: '—',    cssClass: 'none' },
  { level: 1, label: 'view', cssClass: 'limited' },
  { level: 2, label: 'read', cssClass: 'observer' },
  { level: 3, label: 'OWN',  cssClass: 'owner' },
];

const TYPE_DEFAULTS = {
  'major-character': 2,  // OBSERVER
  'connection':      2,  // OBSERVER
  'family':          2,  // OBSERVER
  'npc':             0,  // NONE
};

const SECTION_ORDER = ['major-character', 'connection', 'family', 'npc'];

const SECTION_LABEL_KEYS = {
  'major-character': 'GOODSOCIETY.bulkPermissions.section.majors',
  'connection':      'GOODSOCIETY.bulkPermissions.section.connections',
  'family':          'GOODSOCIETY.bulkPermissions.section.family',
  'npc':             'GOODSOCIETY.bulkPermissions.section.npcs',
};

// ── Panel class ───────────────────────────────────────────────────────────────

export class BulkPermissionsPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gs-bulk-permissions-panel',
    classes: ['good-society', 'gs-bulk-permissions-panel'],
    window: {
      frame: true,
      positioned: true,
      title: 'GOODSOCIETY.bulkPermissions.windowTitle',
    },
    position: { width: 720, height: 'auto' },
    actions: {},
  };

  static PARTS = {
    main: {
      template: 'systems/good-society-homebrew/templates/apps/bulk-permissions-panel.hbs',
    },
  };

  /** @type {Map<string, Map<string, number>>} actorId → (userId → level) */
  #pending = new Map();

  /** Currently open inline dropdown element, or null. */
  #dropdown = null;

  /** Cached document-level outside-click listener for cleanup. */
  #outsideClickListener = null;

  // ── Context ─────────────────────────────────────────────────────────────────

  /** @override */
  async _prepareContext(options) {
    if (!game.user?.isGM) return {};
    const ctx = await super._prepareContext(options);

    // Users: non-banned, GM first then players by name.
    const users = game.users.contents
      .filter(u => u.role !== CONST.USER_ROLES.NONE)
      .sort((a, b) => {
        if (a.isGM !== b.isGM) return a.isGM ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map(u => ({ id: u.id, name: u.name, isGM: u.isGM }));

    // Actor sections in canonical order.
    const sections = [];
    for (const type of SECTION_ORDER) {
      const actors = game.actors.filter(a => a.type === type);
      if (!actors.length) continue;
      const rows = actors
        .sort((a, b) => {
          const na = a.system?.activePersona?.name || a.name;
          const nb = b.system?.activePersona?.name || b.name;
          return na.localeCompare(nb);
        })
        .map(actor => this.#buildRow(actor, users));
      sections.push({
        type,
        label: game.i18n.localize(SECTION_LABEL_KEYS[type]),
        actors: rows,
      });
    }

    const pendingCount = this.#countPending();

    return {
      ...ctx,
      users,
      sections,
      totalActors: sections.reduce((n, s) => n + s.actors.length, 0),
      userCount: users.length,
      pendingCount,
      hasPending: pendingCount > 0,
      pendingSummary: this.#buildPendingSummary(),
    };
  }

  #buildRow(actor, users) {
    const sys = actor.system;
    // Honor only EXPLICIT persona selections. `sys.activePersona` getter
    // falls back to primary → first persona, which would mask the actor's
    // canonical name on a "true identity" selection. The permissions
    // matrix is a GM admin surface — show the actor's true name when no
    // persona is explicitly active.
    const explicitPersona = sys?.activePersonaId
      ? (sys.personas ?? []).find(p => p.id === sys.activePersonaId)
      : null;
    const displayName = explicitPersona?.name || actor.name;

    // Stranded = no non-GM player has OWNER.
    const isStranded = !users.some(u => {
      if (u.isGM) return false;
      const userDoc = game.users.get(u.id);
      return userDoc && actor.getUserLevel(userDoc) >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    });

    const cells = users.map(u => {
      const userDoc = game.users.get(u.id);
      const serverLevel = userDoc ? actor.getUserLevel(userDoc) : 0;
      const pendingLevel = this.#pending.get(actor.id)?.get(u.id);
      const level = pendingLevel ?? serverLevel;
      const meta = PERM_LEVELS[level] ?? PERM_LEVELS[0];
      return {
        actorId: actor.id,
        userId: u.id,
        level,
        label: meta.label,
        cssClass: meta.cssClass,
        isPending: pendingLevel !== undefined,
        isGMCell: u.isGM,
        ariaLabel: game.i18n.format('GOODSOCIETY.bulkPermissions.cell.ariaLabel', {
          actor: displayName, user: u.name, level: meta.label,
        }),
      };
    });

    return {
      id: actor.id,
      type: actor.type,
      displayName,
      // Editable subhead from system.bio.title — renders below the
      // displayName in the row's name column when set.
      title: (sys?.bio?.title ?? '').trim(),
      initial: (displayName || '?')[0].toUpperCase(),
      portraitUrl: profilePic(actor),  // §8.5 token-based
      theme: sys?.theme || 'npc',
      isStranded,
      cells,
    };
  }

  #countPending() {
    let n = 0;
    for (const m of this.#pending.values()) n += m.size;
    return n;
  }

  #buildPendingSummary() {
    const parts = [];
    for (const [actorId, userMap] of this.#pending) {
      const actor = game.actors.get(actorId);
      if (!actor) continue;
      const displayName = actor.system?.activePersona?.name || actor.name;
      for (const [userId, level] of userMap) {
        const user = game.users.get(userId);
        if (!user) continue;
        const meta = PERM_LEVELS[level] ?? PERM_LEVELS[0];
        parts.push(`${displayName} → ${user.name} (${meta.label})`);
      }
    }
    if (parts.length <= 3) return parts.join(' · ');
    const remainder = parts.length - 3;
    const more = game.i18n.format('GOODSOCIETY.bulkPermissions.footer.andMore', { n: remainder });
    return parts.slice(0, 3).join(' · ') + ` ${more}`;
  }

  // ── Render lifecycle ─────────────────────────────────────────────────────────

  /** @override */
  _onRender(context, options) {
    super._onRender?.(context, options);
    if (!game.user?.isGM) { this.close(); return; }

    // Set CSS custom property so the grid column count matches user count.
    const userCount = this.element.querySelectorAll('.gs-bulk-permissions__col-user').length;
    this.element.style.setProperty('--gs-perm-user-count', userCount);

    this._wireFilters();
    this._wireCells();
    this._wireRowQuickSet();
    this._wireColQuickSet();
    this._wireSectionReset();
    this._wireFooter();
  }

  /** @override */
  async _onClose(options) {
    await super._onClose?.(options);
    this._closeDropdown();
    this.#pending.clear();
    _instance = null;
  }

  // ── Filters ──────────────────────────────────────────────────────────────────

  _wireFilters() {
    const root = this.element;
    const searchInput = root.querySelector('.gs-bulk-permissions__search');
    const typeSelect  = root.querySelector('.gs-bulk-permissions__type-filter');

    const apply = () => {
      const query      = searchInput?.value.trim().toLowerCase() ?? '';
      const typeFilter = typeSelect?.value ?? 'all';

      root.querySelectorAll('.gs-bulk-permissions__section').forEach(sec => {
        const typeMatch = typeFilter === 'all' || typeFilter === sec.dataset.type;
        sec.hidden = !typeMatch;
        if (sec.hidden) return;

        let visibleCount = 0;
        sec.querySelectorAll('.gs-bulk-permissions__actor-row').forEach(row => {
          const nameMatch = !query || (row.dataset.displayName ?? '').toLowerCase().includes(query);
          row.hidden = !nameMatch;
          if (nameMatch) visibleCount++;
        });

        const emptyEl = sec.querySelector('.gs-bulk-permissions__section-empty');
        if (emptyEl) emptyEl.hidden = visibleCount > 0;
      });
    };

    searchInput?.addEventListener('input', apply);
    typeSelect?.addEventListener('change', apply);
  }

  // ── Cell interactions ─────────────────────────────────────────────────────────

  _wireCells() {
    this.element.addEventListener('click', ev => {
      const cell = ev.target.closest('.gs-bulk-permissions__cell[data-actor-id]');
      if (!cell || cell.dataset.gmCell === 'true') return;
      ev.stopPropagation();
      this._openCellDropdown(cell, ev);
    });

    this.element.addEventListener('keydown', ev => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      const cell = ev.target.closest('.gs-bulk-permissions__cell[data-actor-id]');
      if (!cell || cell.dataset.gmCell === 'true') return;
      ev.preventDefault();
      this._openCellDropdown(cell, ev);
    });
  }

  _openCellDropdown(cell, ev) {
    const actorId = cell.dataset.actorId;
    const userId  = cell.dataset.userId;
    const current = parseInt(cell.dataset.level ?? '0', 10);
    this._openDropdown(ev, current, (level) => {
      this._setPending(actorId, userId, level);
      this._updateCellDom(cell, level);
      this._updateFooterDom();
    });
  }

  // ── Row quick-set ─────────────────────────────────────────────────────────────

  _wireRowQuickSet() {
    this.element.addEventListener('click', ev => {
      const btn = ev.target.closest('.gs-bulk-permissions__row-quickset');
      if (!btn) return;
      ev.stopPropagation();
      const row = btn.closest('.gs-bulk-permissions__actor-row');
      if (!row) return;
      this._openDropdown(ev, null, (level) => {
        row.querySelectorAll('.gs-bulk-permissions__cell[data-actor-id]').forEach(cell => {
          if (cell.dataset.gmCell === 'true') return;
          this._setPending(cell.dataset.actorId, cell.dataset.userId, level);
          this._updateCellDom(cell, level);
        });
        this._updateFooterDom();
      });
    });
  }

  // ── Column quick-set ──────────────────────────────────────────────────────────

  _wireColQuickSet() {
    this.element.addEventListener('click', ev => {
      const btn = ev.target.closest('.gs-bulk-permissions__col-quickset');
      if (!btn) return;
      ev.stopPropagation();
      const userId = btn.dataset.userId;
      if (!userId) return;
      this._openDropdown(ev, null, (level) => {
        this.element
          .querySelectorAll(`.gs-bulk-permissions__cell[data-user-id="${CSS.escape(userId)}"]`)
          .forEach(cell => {
            if (cell.dataset.gmCell === 'true') return;
            this._setPending(cell.dataset.actorId, userId, level);
            this._updateCellDom(cell, level);
          });
        this._updateFooterDom();
      });
    });
  }

  // ── Section reset ─────────────────────────────────────────────────────────────

  _wireSectionReset() {
    this.element.addEventListener('click', ev => {
      const btn = ev.target.closest('.gs-bulk-permissions__section-reset');
      if (!btn) return;
      const section = btn.closest('.gs-bulk-permissions__section');
      if (!section) return;
      const type         = section.dataset.type;
      const defaultLevel = TYPE_DEFAULTS[type] ?? 0;
      const meta         = PERM_LEVELS[defaultLevel] ?? PERM_LEVELS[0];
      const sectionLabel = game.i18n.localize(SECTION_LABEL_KEYS[type] ?? '');

      const confirmed = window.confirm(
        game.i18n.format('GOODSOCIETY.bulkPermissions.section.resetConfirm', {
          section: sectionLabel, level: meta.label,
        })
      );
      if (!confirmed) return;

      section.querySelectorAll('.gs-bulk-permissions__actor-row').forEach(row => {
        row.querySelectorAll('.gs-bulk-permissions__cell[data-actor-id]').forEach(cell => {
          if (cell.dataset.gmCell === 'true') return;
          this._setPending(cell.dataset.actorId, cell.dataset.userId, defaultLevel);
          this._updateCellDom(cell, defaultLevel);
        });
      });
      this._updateFooterDom();
    });
  }

  // ── Shared dropdown ───────────────────────────────────────────────────────────

  _openDropdown(ev, currentLevel, onSelect) {
    this._closeDropdown();

    const dropdown = document.createElement('div');
    dropdown.className = 'gs-perm-dropdown';

    for (const meta of PERM_LEVELS) {
      const opt = document.createElement('div');
      opt.className = `gs-perm-dropdown__option gs-perm-pill gs-perm-pill--${meta.cssClass}`;
      if (meta.level === currentLevel) opt.classList.add('gs-perm-dropdown__option--active');
      opt.textContent = meta.label;
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(meta.level);
        this._closeDropdown();
      });
      dropdown.appendChild(opt);
    }

    // Position at cursor, with right-edge guard.
    const x = Math.min((ev.clientX ?? 0), window.innerWidth - 144);
    const y = ev.clientY ?? 0;
    dropdown.style.cssText = `position:fixed;left:${x}px;top:${y + 4}px;z-index:10000`;
    document.body.appendChild(dropdown);
    this.#dropdown = dropdown;

    // Close on outside click.
    this.#outsideClickListener = (e) => {
      if (!dropdown.contains(e.target)) this._closeDropdown();
    };
    document.addEventListener('click', this.#outsideClickListener, { capture: true });
  }

  _closeDropdown() {
    if (this.#dropdown) { this.#dropdown.remove(); this.#dropdown = null; }
    if (this.#outsideClickListener) {
      document.removeEventListener('click', this.#outsideClickListener, { capture: true });
      this.#outsideClickListener = null;
    }
  }

  // ── Pending state management ──────────────────────────────────────────────────

  _setPending(actorId, userId, level) {
    const actor = game.actors.get(actorId);
    const userDoc = game.users.get(userId);
    const serverLevel = (actor && userDoc) ? actor.getUserLevel(userDoc) : 0;

    if (!this.#pending.has(actorId)) this.#pending.set(actorId, new Map());
    if (level === serverLevel) {
      this.#pending.get(actorId).delete(userId);
      if (this.#pending.get(actorId).size === 0) this.#pending.delete(actorId);
    } else {
      this.#pending.get(actorId).set(userId, level);
    }
  }

  _updateCellDom(cell, level) {
    const meta = PERM_LEVELS[level] ?? PERM_LEVELS[0];
    const pill = cell.querySelector('.gs-perm-pill');
    if (pill) {
      PERM_LEVELS.forEach(m => pill.classList.remove(`gs-perm-pill--${m.cssClass}`));
      pill.classList.add(`gs-perm-pill--${meta.cssClass}`);
      pill.textContent = meta.label;
    }

    cell.dataset.level = level;
    const actorId  = cell.dataset.actorId;
    const userId   = cell.dataset.userId;
    const isPending = this.#pending.get(actorId)?.has(userId) ?? false;
    cell.classList.toggle('gs-bulk-permissions__cell--pending', isPending);

    // "changed" label — add/remove dynamically
    let changedEl = cell.querySelector('.gs-bulk-permissions__cell-changed');
    if (isPending && !changedEl) {
      changedEl = document.createElement('span');
      changedEl.className = 'gs-bulk-permissions__cell-changed';
      changedEl.textContent = game.i18n.localize('GOODSOCIETY.bulkPermissions.cell.changed');
      cell.appendChild(changedEl);
    } else if (!isPending && changedEl) {
      changedEl.remove();
    }

    // Row tint
    const row = cell.closest('.gs-bulk-permissions__actor-row');
    if (row) row.classList.toggle('gs-bulk-permissions__actor-row--pending', this.#pending.has(actorId));
  }

  _updateFooterDom() {
    const root     = this.element;
    const count    = this.#countPending();
    const hasPending = count > 0;

    const countPill  = root.querySelector('.gs-bulk-permissions__pending-pill');
    const summaryEl  = root.querySelector('.gs-bulk-permissions__pending-summary');
    const noneEl     = root.querySelector('.gs-bulk-permissions__pending-none');
    const saveBtn    = root.querySelector('.gs-bulk-permissions__save-btn');
    const discardBtn = root.querySelector('.gs-bulk-permissions__discard-btn');

    if (countPill) {
      countPill.hidden = !hasPending;
      countPill.textContent = game.i18n.format(
        'GOODSOCIETY.bulkPermissions.footer.pendingPill', { n: count }
      );
    }
    if (summaryEl) { summaryEl.hidden = !hasPending; summaryEl.textContent = this.#buildPendingSummary(); }
    if (noneEl)    noneEl.hidden = hasPending;
    if (saveBtn) {
      saveBtn.disabled = !hasPending;
      saveBtn.textContent = hasPending
        ? game.i18n.format('GOODSOCIETY.bulkPermissions.footer.saveBtn', { n: count })
        : game.i18n.localize('GOODSOCIETY.bulkPermissions.footer.saveBtnEmpty');
    }
    if (discardBtn) discardBtn.disabled = !hasPending;
  }

  // ── Footer actions ────────────────────────────────────────────────────────────

  _wireFooter() {
    const root = this.element;
    root.querySelector('.gs-bulk-permissions__save-btn')
      ?.addEventListener('click', () => this._saveChanges());
    root.querySelector('.gs-bulk-permissions__discard-btn')
      ?.addEventListener('click', () => { this.#pending.clear(); this.render({ force: true }); });
  }

  async _saveChanges() {
    const count = this.#countPending();
    if (count === 0) return;

    const confirmed = window.confirm(
      game.i18n.format('GOODSOCIETY.bulkPermissions.footer.saveConfirm', { n: count })
    );
    if (!confirmed) return;

    let savedActors = 0;
    let errorMsg = null;

    for (const [actorId, userMap] of this.#pending) {
      const actor = game.actors.get(actorId);
      if (!actor) continue;

      // Merge pending changes onto current ownership; preserve default and
      // all unaffected user entries.
      const newOwnership = { ...actor.ownership };
      for (const [userId, level] of userMap) newOwnership[userId] = level;

      try {
        await actor.update({ ownership: newOwnership });
        savedActors++;
      } catch (err) {
        errorMsg = err.message ?? String(err);
        console.error(`BulkPermissionsPanel: failed to update ${actor.name}:`, err);
      }
    }

    if (errorMsg) {
      ui.notifications.error(
        game.i18n.format('GOODSOCIETY.bulkPermissions.footer.saveError', { error: errorMsg })
      );
    } else {
      ui.notifications.info(
        game.i18n.format('GOODSOCIETY.bulkPermissions.footer.saveSuccess', { n: savedActors })
      );
    }

    this.#pending.clear();
    this.render({ force: true });
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _instance = null;

export function getBulkPermissionsPanel() {
  if (!_instance) _instance = new BulkPermissionsPanel();
  return _instance;
}

export function openBulkPermissionsPanel() {
  if (!game.user?.isGM) return;
  getBulkPermissionsPanel().render({ force: true });
}
