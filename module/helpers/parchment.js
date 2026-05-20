/**
 * parchment.js — shared parchment-variant picker.
 *
 * Letters in the Epistolary Wizard pick one of three torn-edge parchment
 * textures (`assets/parchment/parchment-{1,2,3}.png`) so an inbox doesn't
 * read as one uniform slab of paper. The letter composer's preview uses
 * the same helper, keyed on the sender's actor id, so each character has a
 * consistent "their stationery" feel across drafts.
 *
 * Same id → same variant (1, 2, or 3). Simple multiplicative string hash.
 */
export function parchmentVariantFor(id) {
  let h = 0;
  const str = String(id ?? '');
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 3) + 1;
}
