// The Check (GLOSSARY): what a claimed card shows when its songs are revealed one by one. Pure: the show
// computes it from the card, the kind claimed, the round and the counted landings; the presenters pace the
// reveals (D107), and the cue after the last one decides.
//
// API
//   computeCheck(input)        → { outcome, row, otherRows, steps: [{ songId, landed }], revealUntil, markedCard, completeSince, warnings }
//   stepSound(song, kind, timing) → what one revealed song sounds like, and for how long
//
// Rules (docs/show-ui-and-platform-decisions.md › Check):
//   - unknownCard: a number outside the generated cards; wrongType: a card of another type than the round's
//     (an especial card in a normal round, say). Neither has steps: the result shows at once.
//   - notSold (a warning only): the card is not among the cards in play. Its Check still runs.
//   - A Line plays its completed row (the first to complete, top on a tie), else the row with most landed
//     songs (top on a tie); the other completed rows are listed. A Bingo plays all 12 songs, row by row.
//   - The reveals stop at the first ✗ (D117): a Line's or Bingo's first song that hasn't landed (`revealUntil`).
//   - 'standing' (the Desgraciat round) proves that none of the card's 12 songs landed: they play in card order
//     and stop at the first one that landed; a card still standing plays all 12 (`complete`), and is
//     `completeSince` the landing after which every other valid card in play had fallen. A card whose first landed
//     song is the latest landing sat down with it (`fellLast`, which passes: the last players standing who all sit
//     on the same song share the win; `completeSince` is that landing); one that fell earlier is `fallen`.
import type { CheckOutcome, ClaimWarning, WinKind } from '@quina/protocol';
import { cardSongIds, completionIndex, fallIndex, queuePositions, type Card } from './cards.ts';

export interface CheckInput {
  /** Every generated card (cards.json), not only the cards in play. */
  allCards: readonly Card[];
  cardId: number;
  kind: WinKind;
  /** The round's card type (`RoundInfo.cardType`): a card of another type fails as `wrongType`. */
  cardType: string;
  /** The cards in play (ids). */
  cardsInPlay: ReadonlySet<number>;
  /** The round's Queue and the Queue index of the last counted landing: queue[0..position] have landed. */
  queue: readonly number[];
  position: number;
}

export interface CheckSong {
  songId: number;
  landed: boolean;
}

export interface CheckResult {
  outcome: CheckOutcome;
  row: number | null;
  otherRows: number[];
  /** The songs its Check may reveal, in order (a Line's row, a Bingo's 12, a standing Check's up to the one that sank it). */
  steps: CheckSong[];
  /** The index of the last step its Check reveals: the last one, or a Line's or Bingo's first ✗. Null: none (the cue at once). */
  revealUntil: number | null;
  /** The whole card in its grid order, each song landed or not (the console's private view, D108); empty for a card of
   * another type or an unknown number. */
  markedCard: CheckSong[];
  /** The Queue index at which the card first completed this kind, or null. */
  completeSince: number | null;
  warnings: ClaimWarning[];
}

export interface CheckTiming {
  stepSec: number;
  missSec: number;
  /** A standing Check's ✓ (a song that hasn't landed): a short knock. */
  stillSec: number;
}

/** What a step sounds like: a landed song's snippet, the "broken record" (a Line's or Bingo's missing song), or the
 * standing Check's knock (a song that hasn't landed: good for that claim). */
export type StepSound = 'snippet' | 'miss' | 'still';

export interface TimedStep extends CheckSong {
  at: number;
  durationSec: number;
  sound: StepSound;
}

export function computeCheck({ allCards, cardId, kind, cardType, cardsInPlay, queue, position }: CheckInput): CheckResult {
  const card = allCards.find((c) => c.id === cardId);
  const none = { row: null, otherRows: [], steps: [], revealUntil: null, markedCard: [], completeSince: null };
  if (!card) return { outcome: 'unknownCard', ...none, warnings: [] };
  const warnings: ClaimWarning[] = cardsInPlay.has(cardId) ? [] : ['notSold'];
  if (card.type !== cardType) return { outcome: 'wrongType', ...none, warnings };

  // Only the counted landings: a song later in the Queue has not landed yet.
  const landedAt = queuePositions(queue.slice(0, Math.max(0, position + 1)));
  const rows = cardSongIds(card);
  const steps = (songs: number[]) => songs.map((songId) => ({ songId, landed: landedAt.has(songId) }));
  const markedCard = steps(rows.flat());
  // A Line or Bingo stops at its first ✗; a standing Check's steps already end at the song that sank it.
  const until = (list: CheckSong[], stopAtMiss: boolean): number | null => {
    if (!list.length) return null;
    const miss = stopAtMiss ? list.findIndex((s) => !s.landed) : -1;
    return miss >= 0 ? miss : list.length - 1;
  };

  if (kind === 'standing') {
    const songs = rows.flat();
    const sank = songs.findIndex((id) => landedAt.has(id));
    if (sank >= 0) {
      const fellLast = fallIndex(card, landedAt) === position;
      const shown = steps(songs.slice(0, sank + 1));
      return { outcome: fellLast ? 'fellLast' : 'fallen', row: null, otherRows: [], steps: shown, revealUntil: until(shown, false), markedCard, completeSince: fellLast ? position : null, warnings };
    }
    // The last one standing since every other valid card in play fell (within the counted landings).
    const others = allCards.filter((c) => c.id !== cardId && c.type === cardType && cardsInPlay.has(c.id)).map((c) => fallIndex(c, landedAt));
    const lastFall = others.length ? Math.max(...others) : -1;
    const shown = steps(songs);
    return { outcome: 'complete', row: null, otherRows: [], steps: shown, revealUntil: until(shown, false), markedCard, completeSince: Number.isFinite(lastFall) ? lastFall : null, warnings };
  }
  const rowEnd = (row: number[]) => Math.max(...row.map((id) => landedAt.get(id) ?? Infinity));
  const ends = rows.map(rowEnd);
  const since = completionIndex(card, landedAt, kind);
  const completeSince = Number.isFinite(since) ? since : null;
  const outcome: CheckOutcome = completeSince == null ? 'incomplete' : 'complete';

  if (kind === 'bingo') return { outcome, row: null, otherRows: [], steps: markedCard, revealUntil: until(markedCard, true), markedCard, completeSince, warnings };

  const completed = rows.map((_, i) => i).filter((i) => Number.isFinite(ends[i]));
  let row: number;
  if (completed.length) {
    // The row that completed first; the top one when two completed on the same landing.
    row = completed.reduce((best, i) => (ends[i] < ends[best] ? i : best));
  } else {
    const landedCount = rows.map((r) => r.filter((id) => landedAt.has(id)).length);
    row = landedCount.reduce((best, n, i) => (n > landedCount[best] ? i : best), 0);
  }
  const shown = steps(rows[row]);
  return { outcome, row, otherRows: completed.filter((i) => i !== row), steps: shown, revealUntil: until(shown, true), markedCard, completeSince, warnings };
}

/** What one revealed song sounds like: a landed song always plays its snippet (in a standing Check, as the proof that
 * sank the card); a Line's or Bingo's missing one the broken record; a standing Check's song that hasn't landed a knock. */
export function stepSound(song: CheckSong, kind: WinKind, timing: CheckTiming): { sound: StepSound; durationSec: number } {
  const sound: StepSound = song.landed ? 'snippet' : kind === 'standing' ? 'still' : 'miss';
  return { sound, durationSec: sound === 'snippet' ? timing.stepSec : sound === 'still' ? timing.stillSec : timing.missSec };
}
