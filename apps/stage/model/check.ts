// The Check on the projector: the claimed card's grid, and which step shows what at a given time. The
// engine schedules every step in advance (`steps[i].atMs`, `durationMs`, `endAtMs`), so the projector only
// reads its clock: the playing tile gets a ring for the snippet, then its mark (✓ or ✗) stamps on, and the
// result shows from `endAtMs` (ANIMATIONS.md `check-step`, `check-result`). A failed Check also names the
// first song that didn't sound and places its plaque where it hides nothing that was checked. Pure.
import type { CheckOutcome, WinKind } from '../../../packages/ui/flow.ts';
import type { PlayerCard } from '../../../packages/rules/marks.ts';

export interface CheckStepView {
  songId: number;
  landed: boolean;
  atMs: number;
  durationMs: number;
}

/** What the projector says once the Check is over. */
export type CheckVerdict = 'complete' | 'incomplete' | 'notValid';

export interface CheckCell {
  songId: number;
  title: string | null;
  /** 0–2, top to bottom. */
  row: number;
  /** 0–3, left to right. */
  col: number;
  /** Index into `steps` when this song is played in the Check, else null. */
  step: number | null;
}

export interface CheckView {
  /** Changes when another card's Check starts. */
  key: string;
  cardId: number;
  kind: WinKind;
  verdict: CheckVerdict;
  /** A Line's row (0–2), whose songs play; the other rows dim. Null for a Bingo. */
  row: number | null;
  /** The card's 12 songs (3 × 4), or only the played ones when the card is not in the catalog. */
  cells: CheckCell[];
  steps: CheckStepView[];
  startAtMs: number;
  endAtMs: number;
}

/** The engine's finding as the projector words it: unknown cards and wrong-type cards are "not valid". */
export const verdictOf = (outcome: CheckOutcome): CheckVerdict =>
  outcome === 'complete' ? 'complete' : outcome === 'incomplete' ? 'incomplete' : 'notValid';

/**
 * The grid for a checked card. With the card in the catalog (and holding every played song): its 3 × 4
 * songs. Otherwise the played songs alone, 4 per row (a Line's on its own row).
 */
export function checkCells(
  card: PlayerCard | null,
  steps: readonly CheckStepView[],
  row: number | null,
  title: (songId: number) => string | null,
): CheckCell[] {
  const stepOf = new Map<number, number>();
  steps.forEach((s, i) => {
    if (!stepOf.has(s.songId)) stepOf.set(s.songId, i);
  });
  const cardSongs = new Set(card?.lines.flat() ?? []);
  if (card && card.lines.length === 3 && steps.every((s) => cardSongs.has(s.songId))) {
    return card.lines.flatMap((line, r) =>
      line.map((songId, c) => ({ songId, title: title(songId), row: r, col: c, step: stepOf.get(songId) ?? null })),
    );
  }
  return steps.map((s, i) => ({
    songId: s.songId,
    title: title(s.songId),
    row: row ?? Math.floor(i / 4),
    col: i % 4,
    step: i,
  }));
}

/**
 * What the drawn grid depends on. It changes within one Check when the catalog arrives after the Check started
 * (a projector reloaded mid-Check): the grid then grows from the played songs to the whole card.
 */
export const gridKey = (cells: readonly CheckCell[]): string =>
  cells.map((c) => `${c.songId}@${c.row}.${c.col}:${c.step ?? '-'}:${c.title ?? ''}`).join('|');

/** One step at a given time: not yet, its snippet playing, or marked. */
export type StepState = 'pending' | 'playing' | 'landed' | 'missed';

export interface CheckReveal {
  steps: StepState[];
  /** The step whose snippet is playing, or null. */
  playing: number | null;
  /** Shown from `endAtMs`; a card that is not valid shows it at once (it has no steps). */
  result: CheckVerdict | null;
}

/**
 * Each step's state at `nowMs`. The snippet plays from `atMs` for `durationMs`; the mark shows when the
 * snippet ends (`markAt: 'end'`, ANIMATIONS.md) or as it starts (`'start'`).
 */
export function checkReveal(
  check: Pick<CheckView, 'steps' | 'endAtMs' | 'verdict'>,
  nowMs: number,
  markAt: 'end' | 'start' = 'end',
): CheckReveal {
  let playing: number | null = null;
  const steps = check.steps.map((s, i): StepState => {
    const markMs = markAt === 'end' ? s.atMs + s.durationMs : s.atMs;
    if (nowMs >= markMs) return s.landed ? 'landed' : 'missed';
    if (nowMs >= s.atMs) {
      playing = i;
      return 'playing';
    }
    return 'pending';
  });
  const result = check.verdict === 'notValid' || nowMs >= check.endAtMs ? check.verdict : null;
  return { steps, playing, result };
}

/** A Check that ends without a prize: the card is incomplete, or not valid. */
export const isFailed = (verdict: CheckVerdict): boolean => verdict !== 'complete';

/** The song a failed Check names: the first step (in the order they played) that didn't land. */
export interface CheckMiss {
  /** Index into `steps`; its tile is the one marked ✗ first. */
  step: number;
  songId: number;
  /** From the tile, so null when the catalog doesn't know the song (the plaque then names none). */
  title: string | null;
}

export function firstMiss(check: Pick<CheckView, 'steps' | 'cells'>): CheckMiss | null {
  const step = check.steps.findIndex((s) => !s.landed);
  if (step < 0) return null;
  const cell = check.cells.find((c) => c.step === step);
  return { step, songId: check.steps[step].songId, title: cell?.title ?? null };
}

/** Rows on a card. The grid keeps all three slots even when it only knows the played songs. */
export const CARD_ROWS = 3;

/** Where the result plaque sits over the card. */
export interface PlaqueSpot {
  /** Its centre, as a share of the card's height (0 top, 1 bottom). */
  at: number;
  /**
   * `rows`: over a Line's two other rows. `row`: over one row only (the checked row is the middle one), so the
   * plaque is compact. `card`: over the whole card (a scrim dims it when the Check failed).
   */
  over: 'row' | 'rows' | 'card';
}

/**
 * A Line's plaque covers the rows that weren't checked, so its ✓ and ✗ stay readable: the two other rows when
 * they're side by side, the bottom one when the checked row is the middle one. A Bingo's, or one with no grid
 * (a card that is not valid), sits in the middle of the card.
 */
export function plaqueSpot(check: Pick<CheckView, 'row' | 'cells'>): PlaqueSpot {
  const { row } = check;
  if (row === null || row < 0 || row >= CARD_ROWS || check.cells.length === 0) return { at: 0.5, over: 'card' };
  const others = Array.from({ length: CARD_ROWS }, (_, r) => r).filter((r) => r !== row);
  const covered = others[1] - others[0] === 1 ? others : [others[others.length - 1]];
  const centre = covered.reduce((sum, r) => sum + r + 0.5, 0) / covered.length;
  return { at: centre / CARD_ROWS, over: covered.length > 1 ? 'rows' : 'row' };
}
