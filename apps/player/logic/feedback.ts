// Interface feedback from one public update to the next: which blip to play, which kernels drop in, which cards
// fall or stand up. Pure. Sound map (packages/ui/ANIMATIONS.md): landing pop, mark "tock" (once, not per card),
// the Desgraciat's fall
// "bloop" (once per landing however many cards fall), the tap blip as the Desgraciat round stands everyone up,
// celebration blip; never more than one at a time, so the most important cue wins.

export type Cue = 'celebrate' | 'fall' | 'mark' | 'standUp' | 'landing';

/** Most important first: only the first cue of an update plays. */
export const CUE_PRIORITY: readonly Cue[] = ['celebrate', 'fall', 'mark', 'standUp', 'landing'];

export interface FeedbackSnapshot {
  /** The current round's number (a new round starts quiet). */
  round: number | null;
  /** How many counted landings the round has. */
  landings: number;
  /** "cardId:songId" of every marked cell. */
  marks: readonly string[];
  /** The Celebration on screen, or null. */
  celebration: string | null;
  /** The current round is the Desgraciat one. */
  desgraciat: boolean;
  /** Desgraciat round: the phone's cards still standing. */
  standing: readonly number[];
  /** Desgraciat round: "cardId:position" of the phone's seated cards (desgraciat.ts fallenKeys). */
  fallen: readonly string[];
  /** The latest counted landing's position, or null. */
  latest: number | null;
}

export interface Feedback {
  /** At most one, the most important. */
  cue: Cue | null;
  /** Cells to animate (mark-in), in card order. */
  freshMarks: string[];
  /** Desgraciat round: the cards that just fell, at the latest landing only, in card order (`card-fall`). */
  freshFalls: number[];
  /** Desgraciat round: it just started with some of the phone's cards playing (`stand-up`). */
  standUp: boolean;
}

const QUIET: Feedback = { cue: null, freshMarks: [], freshFalls: [], standUp: false };

export function feedbackFor(prev: FeedbackSnapshot | null, next: FeedbackSnapshot): Feedback {
  // The first update after opening: show the state as it is, quietly.
  if (!prev) return QUIET;
  // A new round starts quiet, except the Desgraciat round standing the phone's cards up (once, at its start).
  if (prev.round !== next.round) {
    const standUp = next.desgraciat && next.standing.length > 0 && next.landings === 0;
    return standUp ? { ...QUIET, cue: 'standUp', standUp } : QUIET;
  }
  const before = new Set(prev.marks);
  const freshMarks = next.marks.filter((k) => !before.has(k));
  // A card falls only at its landing: a newly seated card whose sinking landing is the latest one.
  const seated = new Set(prev.fallen);
  const freshFalls = next.fallen
    .filter((k) => !seated.has(k))
    .map((k) => k.split(':').map(Number) as [number, number])
    .filter(([, position]) => position === next.latest)
    .map(([cardId]) => cardId);
  const cues = new Set<Cue>();
  if (next.celebration && next.celebration !== prev.celebration) cues.add('celebrate');
  if (freshFalls.length) cues.add('fall');
  // In the Desgraciat round a ✗ on a card that already sat down makes no sound: that card already fell.
  if (freshMarks.length && !next.desgraciat) cues.add('mark');
  if (next.landings > prev.landings) cues.add('landing');
  return { cue: CUE_PRIORITY.find((c) => cues.has(c)) ?? null, freshMarks, freshFalls, standUp: false };
}

/** The phone's vibration for an update (Android only; nothing depends on it): a fall keeps its own pattern; otherwise a landing that marks one of the phone's cards buzzes as your song lands (§8 Y1). Never in the
 *  Desgraciat round's ✗s (the fall already says it). */
export type Buzz = 'fall' | 'yourSong';

export function buzzFor(f: Pick<Feedback, 'cue' | 'freshMarks'>, desgraciat: boolean): Buzz | null {
  if (f.cue === 'fall') return 'fall';
  return f.freshMarks.length && !desgraciat ? 'yourSong' : null;
}
