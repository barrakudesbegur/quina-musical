// Interface feedback from one public update to the next: which blip to play, which kernels drop in. Pure.
// Sound map (ui/ANIMATIONS.md): landing pop, mark "tock" (once, not per card), near-win chime (only when the
// banner first appears), celebration blip; never more than one at a time, so the most important cue wins.
// Marks come from cardMarks, so the latest-song grace rule decides them: the motion and the sound never hint
// at a held-back song.

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
  /** The banner's item keys. */
  banner: readonly string[];
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
  if (prev.banner.length === 0 && next.banner.length > 0) cues.add('nearWin');
  if (freshMarks.length) cues.add('mark');
  if (next.landings > prev.landings) cues.add('landing');
  return { cue: CUE_PRIORITY.find((c) => cues.has(c)) ?? null, freshMarks };
}
