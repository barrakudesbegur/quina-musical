// The Desgraciat's finale on stage (D161, D166–D168, D180–D187), as the tablet and the projector both draw it from the
// engine's `state.finale`. Shared so the two screens agree on who stands where, with which nino, and when a landing
// was «Salvats!». Pure: the engine decides who fell; these functions only lay it out.
// - One nino per finalist, each with its own look (D182), kept when they fall: faded at its place until the next Spin.
// - Ascending card order, so the finalists can line up on stage (D161); the tablet may reverse it («Al revés»).
// - «Salvats!» (D181): a landing whose song is on every finalist still standing counts for none of them (D180).
import type { FinaleInfo } from '@quina/protocol';

/**
 * The nino poses a finalist can have, one each (D182): the newest ninos (the user's canvas comment #86: "the newer ones
 * look better"), every one a single standing figure, all different colours. Images every screen ships
 * (packages/ui/assets/ninos/nino-<pose>.svg).
 */
export const FINALE_POSES = ['sardana', 'afro', 'ballet', 'cuiner', 'capita', 'rosa', 'angel', 'dimoni'] as const;
export type FinalePose = (typeof FINALE_POSES)[number];

/** The first eight finalists keep their drawings' own colours; each further eight turn every hue by this much, so the 20
 * finalists the `finale` command allows never share a look. */
const FINALE_HUE_STEP = 40;

export interface FinaleLook {
  pose: FinalePose;
  /** A `hue-rotate()` in degrees over the pose's own colours. */
  hue: number;
}

/** The look of the finalist entered `index`-th (0-based): by the order entered, so adding one never changes the others'. */
export function finaleLook(index: number): FinaleLook {
  const i = Math.max(0, Math.floor(index));
  const hue = FINALE_HUE_STEP * Math.floor(i / FINALE_POSES.length);
  return { pose: FINALE_POSES[i % FINALE_POSES.length], hue: hue % 360 };
}

/** Where a finalist is: standing, fallen at the last landing (faded until the next Spin), or the winner. */
export type FinalistFate = 'standing' | 'fallen' | 'winner';

export interface FinalistSpot {
  cardId: number;
  fate: FinalistFate;
  look: FinaleLook;
}

export interface FinaleMoment {
  /** The last counted landing's Queue index (`queue.position`). */
  position: number;
  /** A Spin (or a Suspens) has started since that landing: the fallen leave the row (`finale-clear`). */
  spinning: boolean;
}

/**
 * The finalists on stage, in ascending card order (`reversed`: descending, the tablet's «Al revés»). A finalist who fell
 * at the last landing stays, faded, until the next Spin; those who fell earlier have left. A removed finalist is gone at
 * once (it isn't in `cardIds` any more).
 */
export function finaleRow(finale: FinaleInfo, moment: FinaleMoment, reversed = false): FinalistSpot[] {
  const standing = new Set(finale.standing);
  // With a winner nothing spins any more: the last landing's fallen stay beside them.
  const keepFallen = (position: number) => position === moment.position && (finale.winner !== null || !moment.spinning);
  const shownFallen = new Set(finale.fallen.filter((f) => keepFallen(f.position)).map((f) => f.cardId));
  const spots: FinalistSpot[] = [];
  finale.cardIds.forEach((cardId, index) => {
    const fate: FinalistFate | null = finale.winner?.cardId === cardId ? 'winner' : standing.has(cardId) ? 'standing' : shownFallen.has(cardId) ? 'fallen' : null;
    if (fate) spots.push({ cardId, fate, look: finaleLook(index) });
  });
  spots.sort((a, b) => (reversed ? b.cardId - a.cardId : a.cardId - b.cardId));
  return spots;
}

/** The finalists who fell at the landing in `position`, in the order entered. */
export const fellAtLanding = (finale: FinaleInfo, position: number): number[] => finale.fallen.filter((f) => f.position === position).map((f) => f.cardId);

/**
 * «Salvats!» (D181) at this landing: its song is on the card of every finalist still standing (two or more), so it
 * counted for none of them (D180) and nobody fell. `songsOf` gives a card's songs on the round's side (the printed
 * cards are public); a card it doesn't know makes the answer false, never a guess.
 */
export function finaleSaved(
  finale: FinaleInfo | null | undefined,
  landing: { position: number; songId: number } | null,
  songsOf: (cardId: number) => readonly number[] | null,
): boolean {
  if (!finale || !landing || finale.winner || finale.standing.length < 2) return false;
  if (finale.fallen.some((f) => f.position === landing.position)) return false;
  return finale.standing.every((cardId) => songsOf(cardId)?.includes(landing.songId) === true);
}
