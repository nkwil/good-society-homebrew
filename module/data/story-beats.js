/**
 * Story Beats — the registry of dramatic table-wide overlays the GM can
 * trigger from the Story Beats Command Center.
 *
 * Each beat is one entry. The Command Center renders the registry as a grid
 * of cards. Clicking a card opens a config dialog built from `formFields`,
 * then broadcasts a `storyBeatStart` socket message that every connected
 * client uses to render the same overlay via `StoryBeatOverlay`.
 *
 * Adding a new beat = one entry here + one template at
 * `templates/apps/story-beats/<id>.hbs` + lang keys under
 * `GOODSOCIETY.storyBeats.<id>`. No other plumbing.
 *
 * Form field types supported by the Command Center's dialog builder:
 *   - 'text'      — single-line input
 *   - 'textarea'  — multi-line input
 *   - 'majorActor'— <select> of all major-character actors
 *   - 'actor'     — <select> of all actors (any type)
 *   - 'seal'      — <select> of SEAL_TYPES (wax seal vocabulary; the overlay
 *                   resolves the id → iconAsset/color for the sealed envelope)
 *   - 'stationery'— thumbnail grid of STATIONERY_TYPES (illustrated paper
 *                   frame; the overlay resolves the id → asset + content
 *                   insets)
 *
 * Each beat also declares:
 *   - paletteClass — CSS modifier class for the overlay's colour register
 *                    (e.g. 'somber' for funereal beats, 'newspaper' for news)
 *   - autoDismissMs — optional; the overlay auto-closes after this many ms.
 *                     Omit for beats the GM should dismiss manually.
 *   - dismissibleByAll — true lets any player dismiss; default GM-only.
 */
export const STORY_BEATS = [
  // ── Invitation to all Majors ────────────────────────────────────────────
  {
    id: 'invitation',
    label: 'Invitation',
    description: 'A formal invitation addressed to all Major characters — a ball, a dinner, a salon. Renders as a heraldic card.',
    icon: '✉',
    paletteClass: 'invitation',
    template: 'systems/good-society-homebrew/templates/apps/story-beats/invitation.hbs',
    formFields: [
      { name: 'sender',   type: 'text',     label: 'Sender',   placeholder: 'The Duchess of Cloudcandle', required: true },
      { name: 'occasion', type: 'text',     label: 'Occasion', placeholder: 'A Spring Ball',               required: true },
      { name: 'when',     type: 'text',     label: 'When',     placeholder: 'The evening of the 14th',     required: false },
      { name: 'where',    type: 'text',     label: 'Where',    placeholder: 'Cloudcandle House',           required: false },
      { name: 'body',       type: 'textarea',   label: 'Note',       placeholder: 'Your presence is most humbly requested…', required: false },
      { name: 'stationery', type: 'stationery', label: 'Stationery', required: false },
      { name: 'seal',       type: 'seal',       label: 'Seal',       required: false },
    ],
  },

  // ── Reveal a Secret ─────────────────────────────────────────────────────
  {
    id: 'reveal-secret',
    label: 'Reveal a Secret',
    description: 'A hidden truth becomes known. Slow fade-in with hushed serif type.',
    icon: '🤫',
    paletteClass: 'reveal',
    template: 'systems/good-society-homebrew/templates/apps/story-beats/reveal-secret.hbs',
    formFields: [
      { name: 'subject', type: 'text',     label: 'About',  placeholder: 'A certain young gentleman…', required: false },
      { name: 'secret', type: 'textarea', label: 'Secret', placeholder: 'is not, in fact, who he claims to be.', required: true },
    ],
  },

  // ── Time Skip ───────────────────────────────────────────────────────────
  {
    id: 'time-skip',
    label: 'Time Skip',
    description: 'Move the table forward in time. Centered italic line on a quiet fade. Auto-dismisses after 6 seconds.',
    icon: '⌛',
    paletteClass: 'time-skip',
    template: 'systems/good-society-homebrew/templates/apps/story-beats/time-skip.hbs',
    autoDismissMs: 6000,
    dismissibleByAll: true,
    formFields: [
      { name: 'when', type: 'text',     label: 'Skip', placeholder: 'Some weeks later…', required: true },
      { name: 'note', type: 'textarea', label: 'Optional flavour', placeholder: 'The hawthorn is in bloom, and so is gossip.', required: false },
    ],
  },

  // ── News from Afar ──────────────────────────────────────────────────────
  {
    id: 'news',
    label: 'News from Afar',
    description: 'A newspaper-headline overlay — distant events that ripple through every drawing room. Auto-dismisses after 10 seconds.',
    icon: '📰',
    paletteClass: 'newspaper',
    template: 'systems/good-society-homebrew/templates/apps/story-beats/news.hbs',
    autoDismissMs: 10000,
    formFields: [
      { name: 'masthead', type: 'text',     label: 'Masthead', placeholder: 'The Morning Chronicle',     required: false },
      { name: 'headline', type: 'text',     label: 'Headline', placeholder: 'WAR DECLARED ABROAD',       required: true  },
      { name: 'subhead',  type: 'text',     label: 'Subhead',  placeholder: 'Parliament summoned at dawn.', required: false },
      { name: 'body',     type: 'textarea', label: 'Body',     placeholder: 'A short lead paragraph…',   required: false },
    ],
  },

  // ── An Accusation ───────────────────────────────────────────────────────
  {
    id: 'accusation',
    label: 'An Accusation',
    description: 'A public, named accusation. Stamps the accusation across the screen with the target\'s name.',
    icon: '⚖',
    paletteClass: 'accusation',
    template: 'systems/good-society-homebrew/templates/apps/story-beats/accusation.hbs',
    formFields: [
      { name: 'targetActorId', type: 'majorActor', label: 'Accused',  required: true },
      { name: 'accuser',       type: 'text',       label: 'Accuser',  placeholder: 'Lady Cloudcandle', required: false },
      { name: 'charge',        type: 'text',       label: 'Charge',   placeholder: 'of grievous deceit', required: true },
      { name: 'detail',        type: 'textarea',   label: 'Detail',   placeholder: 'Optional further description…', required: false },
    ],
  },

  // ── Death Announcement ──────────────────────────────────────────────────
  {
    id: 'death',
    label: 'Death Announcement',
    description: 'A solemn black-wreath overlay announcing a death. Targets a Major character or names someone freely.',
    icon: '✝',
    paletteClass: 'somber',
    template: 'systems/good-society-homebrew/templates/apps/story-beats/death.hbs',
    formFields: [
      { name: 'deceased', type: 'text',     label: 'Name',         placeholder: 'Sir Edmund Cloudcandle', required: true  },
      { name: 'when',     type: 'text',     label: 'When',         placeholder: 'On the evening of the 9th instant', required: false },
      { name: 'cause',    type: 'textarea', label: 'Circumstance', placeholder: 'Optional — peacefully in his sleep, by his own hand, in a duel at dawn…', required: false },
    ],
  },
];

/** Get a beat by id, or null if unknown. */
export function findStoryBeat(id) {
  return STORY_BEATS.find(b => b.id === id) ?? null;
}
