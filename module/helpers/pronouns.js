/**
 * Pronoun parser & set resolver.
 *
 * Parses the free-text `actor.system.bio.pronouns` string into a structured
 * pronoun set with all five English pronoun forms:
 *
 *   subject            she / he / they / xe / ze
 *   object             her / him / them / xem / zir
 *   possessive         her / his / their / xyr / zir       (determiner: "her cat")
 *   possessivePronoun  hers / his / theirs / xyrs / zirs   (pronoun: "is hers")
 *   reflexive          herself / himself / themselves / xemself / zirself
 *
 * Plus capitalized variants (`Subject`, `Possessive`, etc.) for sentence-start
 * use (e.g. "Her Present Desire").
 *
 * The system never assumes pronouns: empty / unrecognized input falls back to
 * "they/them/their/theirs/themselves".
 *
 * Recognized free-text formats (case-insensitive):
 *   "she/her", "she/her/hers", "she"          → she set
 *   "he/him", "he/him/his", "he"              → he set
 *   "they/them", "they/them/theirs", "they"   → they set
 *   "xe/xem", "xe/xem/xyr"                    → xe set (neopronoun)
 *   "ze/zir", "ze/zir/zirs"                   → ze set (neopronoun)
 *   "she/they", "he/they", "they/she"         → uses the FIRST recognized set
 *
 * Anything else falls back to they/them.
 */

const SETS = {
  she: {
    subject: 'she',
    object: 'her',
    possessive: 'her',
    possessivePronoun: 'hers',
    reflexive: 'herself',
  },
  he: {
    subject: 'he',
    object: 'him',
    possessive: 'his',
    possessivePronoun: 'his',
    reflexive: 'himself',
  },
  they: {
    subject: 'they',
    object: 'them',
    possessive: 'their',
    possessivePronoun: 'theirs',
    reflexive: 'themselves',
  },
  xe: {
    subject: 'xe',
    object: 'xem',
    possessive: 'xyr',
    possessivePronoun: 'xyrs',
    reflexive: 'xemself',
  },
  ze: {
    subject: 'ze',
    object: 'zir',
    possessive: 'zir',
    possessivePronoun: 'zirs',
    reflexive: 'zirself',
  },
};

const FALLBACK_SET = 'they';

/**
 * Pick the first recognized pronoun set in a free-text input. Order checked
 * matches how multi-pronoun strings ("she/they") are written: leftmost wins.
 * @param {string} text
 * @returns {string} key into SETS
 */
function _detectSet(text) {
  const t = (text || '').toLowerCase();
  if (!t.trim()) return FALLBACK_SET;

  // Tokenize on slashes / spaces / commas so we can scan each pronoun token
  // in order and return whichever lands on a recognized set first.
  const tokens = t.split(/[\s/,]+/).filter(Boolean);
  for (const tok of tokens) {
    if (tok === 'she' || tok === 'her' || tok === 'hers' || tok === 'herself') return 'she';
    if (tok === 'he'  || tok === 'him' || tok === 'his'  || tok === 'himself') return 'he';
    if (tok === 'they'|| tok === 'them'|| tok === 'their'|| tok === 'theirs' || tok === 'themselves') return 'they';
    if (tok === 'xe'  || tok === 'xem' || tok === 'xyr'  || tok === 'xyrs'   || tok === 'xemself') return 'xe';
    if (tok === 'ze'  || tok === 'zir' || tok === 'zirs' || tok === 'zirself') return 'ze';
  }
  return FALLBACK_SET;
}

/** Capitalize first letter; passes empty string through. */
function _cap(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Build a complete pronoun set (lowercase + capitalized variants) from a
 * free-text input. Always returns a fully-populated object — never null —
 * so templates can read any field without optional-chaining.
 *
 * Capitalized variants follow the pattern `Subject`, `Object`, `Possessive`,
 * `PossessivePronoun`, `Reflexive`. Use these at the start of sentences /
 * section headers (e.g. "{{pronouns.Possessive}} Present Desire" → "Her
 * Present Desire" or "Their Present Desire").
 *
 * @param {string} [pronounsText='']
 * @returns {{
 *   subject: string, object: string, possessive: string,
 *   possessivePronoun: string, reflexive: string,
 *   Subject: string, Object: string, Possessive: string,
 *   PossessivePronoun: string, Reflexive: string,
 *   set: string, raw: string,
 * }}
 */
export function parsePronouns(pronounsText = '') {
  const setKey = _detectSet(pronounsText);
  const set = SETS[setKey];
  return {
    ...set,
    Subject: _cap(set.subject),
    Object: _cap(set.object),
    Possessive: _cap(set.possessive),
    PossessivePronoun: _cap(set.possessivePronoun),
    Reflexive: _cap(set.reflexive),
    set: setKey,
    raw: pronounsText,
  };
}

/**
 * Convenience: pull pronouns from an actor (or any object with
 * `system.bio.pronouns`). Always returns a fully-populated set.
 * @param {object} actor
 */
export function pronounsFor(actor) {
  return parsePronouns(actor?.system?.bio?.pronouns ?? '');
}
