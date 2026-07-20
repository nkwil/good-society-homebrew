/**
 * session-greeting-auto.js — auto-pop coordinator for the Session
 * Greeting + Pregame Checklist.
 *
 * Routing rule (per user design call):
 *   - cyclePhase === 'pre-cycle'  → Pregame Checklist (existing behavior;
 *                                    handles its own per-user dismiss flag)
 *   - cyclePhase !== 'pre-cycle'  → Session Greeting (if fresh for this
 *                                    user — `isGreetingFreshForUser()`)
 *
 * Called from good-society.js's `ready` handler. Wraps the existing
 * pregame auto-open so the two surfaces never collide.
 */

import {
  isGreetingFreshForUser,
  hasPublishableGreeting,
  getSessionGreeting,
} from '../helpers/session-greeting.js';
import { openSessionGreeting } from '../apps/session-greeting.js';
import { maybeAutoOpenPregameChecklist } from '../apps/pregame-checklist.js';

const NS = 'good-society-homebrew';

/**
 * Resolve which surface should auto-open and trigger it. Wrapped in a
 * setTimeout by the caller so other ready-time UI settles first.
 */
export function maybeAutoOpenSessionSurface() {
  let cyclePhase = 'pre-cycle';
  try { cyclePhase = game.settings.get(NS, 'cyclePhase') ?? 'pre-cycle'; } catch {}

  if (cyclePhase === 'pre-cycle') {
    // Pre-cycle = campaign hasn't started. Pregame checklist takes the
    // foreground; greeting (if authored) is silently skipped — the GM
    // shouldn't publish "what happened last session" before there's been
    // any session.
    maybeAutoOpenPregameChecklist();
    return;
  }

  // In-game: prefer the greeting. Fall through to pregame ONLY if no
  // greeting has been published (so a GM who never authored one still
  // gets the checklist's onboarding).
  if (hasPublishableGreeting(getSessionGreeting())) {
    if (isGreetingFreshForUser()) {
      openSessionGreeting();
    }
    return;
  }
  // No greeting authored — fall through.
  maybeAutoOpenPregameChecklist();
}
