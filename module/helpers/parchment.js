/**
 * parchment.js — shared parchment-variant picker.
 *
 * Currently single-variant: always returns 1. parchment-1.png is the only
 * texture with dramatic torn-edge curls on all four sides; parchment-2 and
 * parchment-3 ship with flatter / less varied edges, so hashing actors onto
 * them produced letters that looked clipped or "wrong" depending on which
 * sender you opened. Until v2/v3 are regenerated with comparable curl
 * detail, every letter ships on parchment-1.
 *
 * Kept as a function (not a constant) so callers don't need to change when
 * we restore variation later.
 */
export function parchmentVariantFor(_id) {
  return 1;
}
