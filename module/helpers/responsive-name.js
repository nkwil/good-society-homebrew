/**
 * Responsive cameo name sizing.
 *
 * Strategy: actually MEASURE whether the rendered name overflows its
 * container, and shrink until it fits. Character-count heuristics turned
 * out too brittle (proportional fonts: 'W' is ~2.5× the width of 'i', and
 * the 56-px Lavishly Yours-faced ornament initial is much wider than the
 * 36-px Lora input characters), so we just iterate the scale down.
 *
 * Each `.dossier-cameo__name` container sets a CSS custom property
 * `--gs-name-scale` consumed by:
 *   - .dossier-cameo__name-initial   (56 px ornament)  → calc(56 * scale)
 *   - .dossier-cameo__name-input     (36 px input)     → calc(36 * scale)
 *   - .dossier-cameo__name-static    (36 px static)    → calc(36 * scale)
 *
 * Loop: start at scale 1 → check overflow → drop scale by step → repeat
 * until it fits or we hit the floor.
 */

const SCALE_MAX = 1.0;
// Lowered floor — very long names ("Dixon Ticonderoga Cloudcandle") were
// hitting the previous 0.45 floor and still clipping. Pushing to 0.30 lets
// names of ~30+ characters fit before falling back to overflow.
const SCALE_MIN = 0.30;
const SCALE_STEP = 0.05;

/** Read the container's available width minus its left padding. */
function _availableWidth(container) {
  const cs = getComputedStyle(container);
  const pl = parseFloat(cs.paddingLeft) || 0;
  const pr = parseFloat(cs.paddingRight) || 0;
  return container.clientWidth - pl - pr;
}

/**
 * Decide whether the name children currently fit inside `container`.
 *
 * `.dossier-cameo__name` is `display: flex` with the initial + input/static
 * as children. We sum the children's offsetWidth and compare against the
 * available width. A 1-px tolerance avoids spurious shrinks from
 * sub-pixel rounding.
 */
function _fits(container) {
  const avail = _availableWidth(container);
  if (avail <= 0) return true;  // not laid out yet — bail
  const initial = container.querySelector('.dossier-cameo__name-initial');
  const input = container.querySelector('.dossier-cameo__name-input');
  const staticEl = container.querySelector('.dossier-cameo__name-static');

  let needed = 0;
  if (initial) needed += initial.offsetWidth;
  if (input) {
    // For an editable input with flex: 1 + min-width: 0, the natural width
    // of the typed content lives in scrollWidth (clientWidth would have
    // already collapsed). Pad +2 px for the caret + browser fudge.
    needed += Math.max(input.scrollWidth, input.offsetWidth) + 2;
  } else if (staticEl) {
    needed += staticEl.offsetWidth;
  }
  return needed <= avail + 1;
}

/** Apply the smallest scale at or above the floor that fits the container. */
function _applyToContainer(container) {
  // Start at full size and let the next iteration shrink if needed.
  container.style.setProperty('--gs-name-scale', String(SCALE_MAX));
  // Force a synchronous layout before measuring.
  void container.offsetWidth;
  if (_fits(container)) return;

  // Walk the scale down by SCALE_STEP until it fits or we bottom out.
  for (let s = SCALE_MAX - SCALE_STEP; s >= SCALE_MIN; s -= SCALE_STEP) {
    container.style.setProperty('--gs-name-scale', s.toFixed(3));
    void container.offsetWidth;
    if (_fits(container)) return;
  }
  // Hit the floor. Stay at SCALE_MIN (any longer string would clip; that's
  // a deliberate trade-off — readability beats unbounded shrinkage).
  container.style.setProperty('--gs-name-scale', String(SCALE_MIN));
}

/**
 * Apply responsive sizing to every `.dossier-cameo__name` inside `rootEl`,
 * and (re-)bind input listeners so editable names re-fit as the user types.
 *
 * Idempotent: re-attaching listeners is safe because we use AbortController
 * to clean up any prior bindings on the same render cycle.
 *
 * @param {HTMLElement} rootEl                The sheet's root element.
 * @param {object}      [opts]
 * @param {AbortSignal} [opts.signal]         Optional; when provided, listeners auto-clean up on abort.
 */
export function fitDossierNames(rootEl, { signal } = {}) {
  if (!rootEl) return;
  const containers = rootEl.querySelectorAll('.dossier-cameo__name');
  for (const container of containers) {
    // Defer one frame so the container has a measurable layout — calling
    // _applyToContainer immediately on render can read offsetWidth = 0.
    requestAnimationFrame(() => _applyToContainer(container));

    const input = container.querySelector('.dossier-cameo__name-input');
    if (input) {
      input.addEventListener(
        'input',
        () => _applyToContainer(container),
        signal ? { signal } : undefined,
      );
    }
  }
}
