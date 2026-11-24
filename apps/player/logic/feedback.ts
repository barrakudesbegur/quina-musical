// Interface feedback from one public update to the next: which blip to play, which kernels drop in. Pure.
// Sound map (packages/ui/ANIMATIONS.md): landing pop, mark "tock" (once, not per card), a soft near-win chime
// (only when a card first gets a highlighted song, after none), celebration blip; never more than one at a time,
// so the most important cue wins.

export type Cue = 'celebrate' | 'nearWin' | 'mark' | 'landing';

/** Most important first: only the first cue of an update plays. */
export const CUE_PRIORITY: readonly Cue[] = ['celebrate', 'nearWin', 'mark', 'landing'];

export interface FeedbackSnapshot {
  /** The current round's number (a new round starts quiet). */
  round: number | null;
  /** How many counted landings the round has. */
  landings: number;
  /** "cardId:songId" of every marked cell. */
  marks: readonly string[];
  /** The near-win highlights ("cardId:songId"). */
  near: readonly string[];
  /** The Celebration on screen, or null. */
  celebration: string | null;
}

export interface Feedback {
  /** At most one, the most important. */
  cue: Cue | null;
  /** Cells to animate (mark-in), in card order. */
  freshMarks: string[];
}

export function feedbackFor(prev: FeedbackSnapshot | null, next: FeedbackSnapshot): Feedback {
  // The first update after opening, or a new round: show the state as it is, quietly.
  if (!prev || prev.round !== next.round) return { cue: null, freshMarks: [] };
  const before = new Set(prev.marks);
  const freshMarks = next.marks.filter((k) => !before.has(k));
  const cues = new Set<Cue>();
  if (next.celebration && next.celebration !== prev.celebration) cues.add('celebrate');
  if (prev.near.length === 0 && next.near.length > 0) cues.add('nearWin');
  if (freshMarks.length) cues.add('mark');
  if (next.landings > prev.landings) cues.add('landing');
  return { cue: CUE_PRIORITY.find((c) => cues.has(c)) ?? null, freshMarks };
}
