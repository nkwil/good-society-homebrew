/*
 * Seed Random Events — sample content for the Random Event system.
 * ------------------------------------------------------------------
 * HOW TO USE (one-time, GM only):
 *   1. In Foundry: Macros directory → Create Macro → Type: "Script".
 *   2. Paste this entire file into the macro's command box.
 *   3. Save, then execute the macro once.
 *   4. It creates 12 sample `random-event` Items (2 per archetype) in the
 *      Items sidebar. Re-running it is safe — events that already exist
 *      (matched by name) are skipped, not duplicated.
 *
 * After seeding, open the Event Command Center (the ⚡ scene-control button,
 * or the Cabinet → GM tools → "Random Event Command Center"), pick a Major,
 * and launch. Edit any event's text / tag options via its item sheet.
 *
 * Compendium packs are intentionally out of scope for this system, so this
 * macro is the supported way to seed starter content. Delete the events you
 * don't want; author your own from the Command Center's "+ new event".
 */

const SAMPLE_EVENTS = [
  // ── The Heir ───────────────────────────────────────────────────────────
  {
    name: 'The Contested Inheritance',
    archetype: 'heir',
    description: '<p>A distant relation has surfaced with documents — or the'
      + ' confident appearance of them — claiming a prior right to what you'
      + ' were raised to expect. The drawing rooms have already chosen sides.</p>'
      + '<p>How do you secure what is yours?</p>',
    positiveTagOptions: ['Rightful', 'Composed under pressure', 'Shrewd'],
    negativeTagOptions: ['Grasping', 'Litigious', 'Insecure'],
  },
  {
    name: 'An Unwelcome Betrothal',
    archetype: 'heir',
    description: '<p>Your family has arranged a match that serves the estate'
      + ' admirably and your heart not at all. The announcement is expected'
      + ' within the fortnight.</p><p>What do you do before it is too late?</p>',
    positiveTagOptions: ['Dutiful', 'Diplomatic', 'Quietly defiant'],
    negativeTagOptions: ['Cold', 'Ungrateful', 'Reckless'],
  },

  // ── The New Arrival ────────────────────────────────────────────────────
  {
    name: 'A Misjudged Introduction',
    archetype: 'new-arrival',
    description: '<p>At your first proper ball you addressed a dowager by the'
      + ' wrong title, mistook a tradesman for a baron, and laughed at a joke'
      + ' that was not one. The room noticed.</p><p>How do you recover?</p>',
    positiveTagOptions: ['Charmingly candid', 'Quick to learn', 'Self-aware'],
    negativeTagOptions: ['Gauche', 'Out of her depth', 'Provincial'],
  },
  {
    name: 'The Question of Origins',
    archetype: 'new-arrival',
    description: '<p>Someone influential has begun asking, pointedly and in'
      + ' company, exactly where you come from and how you came by your'
      + ' present circumstances.</p><p>What story do you let them have?</p>',
    positiveTagOptions: ['Mysterious', 'Graceful', 'Unshakeable'],
    negativeTagOptions: ['Evasive', 'Suspected', 'Exposed'],
  },

  // ── The Hedonist ───────────────────────────────────────────────────────
  {
    name: 'The Morning After',
    archetype: 'hedonist',
    description: '<p>Last night was glorious and you remember perhaps half of'
      + ' it. The half you do remember is enough to worry about. Several'
      + ' people are waiting to speak with you.</p><p>How do you face the day?</p>',
    positiveTagOptions: ['Irrepressible', 'Disarming', 'Honest about it'],
    negativeTagOptions: ['Dissolute', 'Unreliable', 'A cautionary tale'],
  },
  {
    name: 'An Expensive Habit',
    archetype: 'hedonist',
    description: '<p>The card tables, the wine, the tailor, the little gifts —'
      + ' it has all outrun your purse. A creditor has begun to be indelicate'
      + ' about it in public.</p><p>How do you settle the matter?</p>',
    positiveTagOptions: ['Resourceful', 'Generous to a fault', 'Frank'],
    negativeTagOptions: ['Indebted', 'Profligate', 'Desperate'],
  },

  // ── The Careerist ──────────────────────────────────────────────────────
  {
    name: 'A Door Half-Opened',
    archetype: 'careerist',
    description: '<p>A patron of real influence has hinted — never quite'
      + ' said — that advancement is available to you. The price is also'
      + ' hinted at, and never quite said.</p><p>How far do you walk through?</p>',
    positiveTagOptions: ['Ambitious', 'Principled', 'Astute'],
    negativeTagOptions: ['Compromised', 'A climber', 'Beholden'],
  },
  {
    name: "The Rival's Promotion",
    archetype: 'careerist',
    description: '<p>Someone with half your competence and twice your'
      + ' connections has been raised to a position you had earned in every'
      + ' way but the one that counted.</p><p>How do you respond?</p>',
    positiveTagOptions: ['Gracious in defeat', 'Determined', 'Respected'],
    negativeTagOptions: ['Bitter', 'Petty', 'Overlooked'],
  },

  // ── The Socialite ──────────────────────────────────────────────────────
  {
    name: 'The Ruined Soirée',
    archetype: 'socialite',
    description: '<p>Your event — months in the planning — has gone wrong in'
      + ' a way that is nobody\'s fault and everybody\'s memory: a quarrel,'
      + ' a spilled thing, a guest who should not have come.</p>'
      + '<p>How do you save the evening?</p>',
    positiveTagOptions: ['Unflappable', 'A consummate host', 'Witty'],
    negativeTagOptions: ['Overreaching', 'Flustered', 'The talk of the town'],
  },
  {
    name: 'A Whisper in the Wrong Ear',
    archetype: 'socialite',
    description: '<p>A piece of gossip you set loose — lightly, amusingly —'
      + ' has travelled further and landed harder than you intended. It has'
      + ' now come back around to you.</p><p>How do you handle the return?</p>',
    positiveTagOptions: ['Owns her mistakes', 'Persuasive', 'Well-connected'],
    negativeTagOptions: ['Indiscreet', 'A gossip', 'Two-faced'],
  },

  // ── The Tutor ──────────────────────────────────────────────────────────
  {
    name: 'The Difficult Pupil',
    archetype: 'tutor',
    description: '<p>A student has defied your instruction openly, in front of'
      + ' the family that employs you, and in front of guests. The family is'
      + ' watching to see what you are made of.</p><p>How do you hold the room?</p>',
    positiveTagOptions: ['Patient', 'Commands respect', 'Wise'],
    negativeTagOptions: ['Ineffectual', 'Harsh', 'Undermined'],
  },
  {
    name: 'An Improper Attachment',
    archetype: 'tutor',
    description: '<p>Feelings — yours, theirs, or both — have begun to'
      + ' complicate a relationship that your position requires remain'
      + ' strictly professional. Someone has begun to notice.</p>'
      + '<p>What do you do with what you feel?</p>',
    positiveTagOptions: ['Honourable', 'Discreet', 'Steadfast'],
    negativeTagOptions: ['Imprudent', 'Compromised', 'A scandal in waiting'],
  },
];

(async () => {
  if (!game.user?.isGM) {
    ui.notifications.warn('Only the GM can seed random events.');
    return;
  }
  const existing = new Set(
    game.items.filter((i) => i.type === 'random-event').map((i) => i.name),
  );
  const toCreate = SAMPLE_EVENTS
    .filter((e) => !existing.has(e.name))
    .map((e) => ({
      name: e.name,
      type: 'random-event',
      system: {
        archetype: e.archetype,
        description: e.description,
        positiveTagOptions: e.positiveTagOptions,
        negativeTagOptions: e.negativeTagOptions,
      },
    }));

  if (!toCreate.length) {
    ui.notifications.info('All sample random events already exist — nothing to add.');
    return;
  }
  await Item.createDocuments(toCreate);
  ui.notifications.info(
    `Created ${toCreate.length} sample random event(s). `
    + `Skipped ${SAMPLE_EVENTS.length - toCreate.length} already present.`,
  );
})();
