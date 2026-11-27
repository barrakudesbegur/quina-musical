// When the phone keeps its screen on (§8 Y4): only while a game is live, from a round's intro to the last Interval,
// Checks and Celebrations included, and offline too (the last state still says a game is on; it reconnects by
// itself). Before the night (the welcome, the countdown) and after it, the phone follows its own settings: a card
// opened days before, or left open after the night, never drains the battery. The lock itself is
// packages/ui/client/wake-lock.ts: asked for while the page is visible, dropped by the browser when it's hidden. Pure.
import type { PublicState } from '../feed/public.ts';

/** The scenes of a game in play: everything but `before` and `after`. */
const LIVE: ReadonlySet<PublicState['scene']> = new Set(['roundStart', 'play', 'check', 'celebration', 'interval']);

export const gameLive = (state: Pick<PublicState, 'scene'> | null): boolean => state !== null && LIVE.has(state.scene);
