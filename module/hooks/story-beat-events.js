/**
 * Story Beat → Event Timeline auto-entry.
 *
 * Listens for `goodSociety.storyBeatPlayed` (fired by `playStoryBeat()` in
 * story-beat-overlay.js) and, for beats that announce an upcoming in-fiction
 * event, adds a matching row to the Event Timeline.
 *
 * Today: only `invitation` participates. The dialog's `occasion` becomes
 * the timeline title, `when` becomes the (free-form) dateLabel, and the
 * sender + note + where compose the description. Visibility = `public`
 * (the table just saw the announcement); stage = `coming-soon` (the
 * announced event is in the in-fiction future). The GM can promote to
 * `today` when the scene actually plays.
 *
 * Future beats that imply a timeline row (e.g. a "Time Skip" that marks a
 * boundary) can extend the `_makeEventFromBeat` switch.
 *
 * GM-only writer — `addEvent` already guards on `game.user?.isGM`, and the
 * hook fires only on the triggering client (which is the GM), so this
 * stays single-writer by construction.
 */

import { addEvent } from '../helpers/event-timeline.js';

export function register() {
  Hooks.on('goodSociety.storyBeatPlayed', async ({ beatId, payload }) => {
    if (!game.user?.isGM) return;
    const evt = _makeEventFromBeat(beatId, payload ?? {});
    if (!evt) return;
    try {
      await addEvent(evt);
    } catch (err) {
      console.warn('GS | story-beat-events: addEvent failed (non-fatal):', err);
    }
  });
}

/** Build the event-timeline payload for a played beat, or null to skip. */
function _makeEventFromBeat(beatId, p) {
  switch (beatId) {
    case 'invitation': {
      const title = (p.occasion || '').trim();
      if (!title) return null; // require at least an occasion
      const lines = [];
      if (p.sender) lines.push(game.i18n.format('GOODSOCIETY.storyBeats.timelineFmt.invitedBy', { sender: p.sender }));
      if (p.where)  lines.push(game.i18n.format('GOODSOCIETY.storyBeats.timelineFmt.atVenue',   { where:  p.where  }));
      if (p.body)   lines.push(p.body);
      return {
        title,
        dateLabel:   (p.when || '').trim(),
        description: lines.join('\n\n'),
        visibility:  'public',
      };
    }
    default:
      return null;
  }
}
