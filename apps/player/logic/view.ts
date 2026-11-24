// What the screens show, derived from the public state, the player's cards and the printed catalogue. Pure, so
// the Svelte components stay thin and the rules are tested in node.
import type { Catalog } from '../../../packages/ui/data/catalog.ts';
import { checkGamePlan, roundPlan, sponsorOf, type GamePlan, type Prize } from '../../../packages/ui/plan.ts';
import { cardMarks, cardsForRound, type CardMarks, type PlayerCard } from '../../../packages/rules/marks.ts';
import type { PublicLanding, PublicRound, PublicState, PublicWinKind } from '../feed/public.ts';
import type { SavedCard } from './storage.ts';

/** The round being played or last played: the last of `rounds`. */
export const currentRound = (state: PublicState | null): PublicRound | null => state?.rounds[state.rounds.length - 1] ?? null;

/** The round the screens talk about: the one introduced, the next one in the Interval, else the current one. */
export function focusRoundNumber(state: PublicState | null): number | null {
  if (!state) return null;
  if (state.intro) return state.intro.round;
  if (state.scene === 'interval' && state.interval) return state.interval.nextRound;
  return currentRound(state)?.number ?? null;
}

/** The round's counted landings' song ids, in landing order. */
export const landedIds = (round: PublicRound | null): number[] => (round ? [...round.landings].sort((a, b) => a.position - b.position).map((l) => l.songId) : []);

/** The latest counted landing of the current round. */
export const latestLanding = (round: PublicRound | null): PublicLanding | null => {
  if (!round?.landings.length) return null;
  return round.landings.reduce((a, b) => (b.position > a.position ? b : a));
};

/** The Game plan in the feed, checked (it arrives untyped). */
export function planOf(state: PublicState | null): GamePlan | null {
  if (!state?.plan) return null;
  const check = checkGamePlan(state.plan);
  return check.ok ? check.plan : null;
}

export interface CardView {
  saved: SavedCard;
  /** null while the catalogue loads, or for a number that isn't a printed card. */
  card: PlayerCard | null;
  /** Counts in the current round (normal cards in normal rounds, special cards in the special round). */
  valid: boolean;
  marks: CardMarks | null;
}

/** Each saved card with its marks for the round. Before any round every card shows, unmarked. */
export function cardViews(saved: readonly SavedCard[], catalog: Catalog | null, round: PublicRound | null): CardView[] {
  const landed = landedIds(round);
  return saved.map((s) => {
    const card = catalog?.cards.get(s.id) ?? null;
    const valid = !card || !round ? true : cardsForRound([card], round.kind).length === 1;
    const marks = card && round && valid ? cardMarks(card, landed, { roundEnded: round.ended }) : null;
    return { saved: s, card, valid, marks };
  });
}

/** Which of the player's cards show a song as marked: songId → the cards' colours (for Historial's dots). */
export function markedColors(views: readonly CardView[]): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const v of views) {
    if (!v.card || !v.marks) continue;
    v.card.lines.forEach((line, li) =>
      line.forEach((songId, si) => {
        if (!v.marks?.marked[li]?.[si]) return;
        out.set(songId, [...(out.get(songId) ?? []), v.saved.color]);
      }),
    );
  }
  return out;
}

/** The cells marked now that weren't before ("cardId:songId"), in card order: the mark-in animation. */
export function markKeys(views: readonly CardView[]): string[] {
  const out: string[] = [];
  for (const v of views) {
    if (!v.card || !v.marks) continue;
    v.card.lines.forEach((line, li) => line.forEach((songId, si) => v.marks?.marked[li]?.[si] && out.push(`${v.saved.id}:${songId}`)));
  }
  return out;
}

/** A kernel's tilt in degrees (−15…15), fixed per card and song so it never changes on re-render. */
export function kernelTilt(cardId: number, songId: number): number {
  let h = (cardId * 2654435761 + songId * 40503) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  return (h % 31) - 15;
}

export interface HistoryGroup {
  round: number;
  kind: 'normal' | 'special';
  current: boolean;
  /** Newest first. */
  landings: PublicLanding[];
}

/** Historial: this round's songs, then earlier rounds', newest first. */
export function historyGroups(state: PublicState | null): HistoryGroup[] {
  const rounds = state?.rounds ?? [];
  const last = rounds[rounds.length - 1]?.number;
  return [...rounds]
    .sort((a, b) => b.number - a.number)
    .map((r) => ({ round: r.number, kind: r.kind, current: r.number === last && !r.ended, landings: [...r.landings].sort((a, b) => b.position - a.position) }));
}

export interface PrizeLine {
  kind: PublicWinKind;
  prize: Prize | null;
  sponsor: string | null;
  winners: number[];
}

export interface PrizeRound {
  number: number;
  kind: 'normal' | 'special';
  state: 'done' | 'current' | 'next' | 'later';
  lines: PrizeLine[];
}

/** Premis: every planned round with its Line and Quina prizes and the winning card numbers. */
export function prizeRounds(plan: GamePlan | null, state: PublicState | null): PrizeRound[] {
  const winners = state?.winners ?? [];
  const current = currentRound(state);
  const focus = focusRoundNumber(state);
  const numbers = new Set<number>([...(plan?.rounds.map((r) => r.number) ?? []), ...(state?.rounds.map((r) => r.number) ?? [])]);
  return [...numbers]
    .sort((a, b) => a - b)
    .map((number) => {
      const planned = roundPlan(plan, number);
      const played = state?.rounds.find((r) => r.number === number);
      const done = Boolean(played?.ended);
      const roundState: PrizeRound['state'] = done
        ? 'done'
        : number === current?.number && state?.scene !== 'interval' && !state?.intro
          ? 'current'
          : number === focus
            ? 'next'
            : 'later';
      const line = (kind: PublicWinKind): PrizeLine => {
        const prize = planned ? (kind === 'line' ? planned.line : planned.bingo) : null;
        return {
          kind,
          prize,
          sponsor: plan && prize ? (sponsorOf(plan, prize)?.name ?? null) : null,
          winners: winners.filter((w) => w.round === number && w.kind === kind).flatMap((w) => w.cardIds),
        };
      };
      return { number, kind: planned?.kind ?? played?.kind ?? 'normal', state: roundState, lines: [line('line'), line('bingo')] };
    });
}

/** "Quina 4 de 12": the round in focus and how many are planned (null without a plan or a round). */
export function progress(plan: GamePlan | null, state: PublicState | null): { current: number; total: number } | null {
  const total = plan?.rounds.length ?? 0;
  const current = focusRoundNumber(state);
  return total && current ? { current, total } : null;
}

/** Each planned round's rough start time from the schedule, or null when the schedule has no start. */
export function plannedStarts(plan: GamePlan | null): Map<number, number> | null {
  if (!plan?.schedule.startAtMs) return null;
  const step = (plan.schedule.roundMinutes + plan.schedule.intervalMinutes) * 60_000;
  return new Map(plan.rounds.map((r, i) => [r.number, plan.schedule.startAtMs! + i * step] as const));
}

export interface CelebrationView {
  key: string;
  kind: PublicWinKind;
  round: number;
  cardIds: number[];
}

/** The Celebration on screen: the latest prize won in the current round. */
export function celebrationOf(state: PublicState | null): CelebrationView | null {
  if (state?.scene !== 'celebration') return null;
  const round = currentRound(state)?.number;
  const won = state.winners.filter((w) => w.round === round);
  const latest = won.find((w) => w.kind === 'bingo') ?? won.find((w) => w.kind === 'line');
  if (!latest || round === undefined) return null;
  return { key: `celebration:${round}:${latest.kind}`, kind: latest.kind, round, cardIds: latest.cardIds };
}

export type HeatLevel = 'cold' | 'warm' | 'hot' | 'fire';

/** The Heat's word-sized level, for the garland's colour and its label. */
export function heatLevel(value: number): HeatLevel {
  if (value < 0.25) return 'cold';
  if (value < 0.5) return 'warm';
  if (value < 0.75) return 'hot';
  return 'fire';
}

/** A number typed on the pad: digits only, at most 4. */
export function padValue(current: string, key: string): string {
  if (key === 'back') return current.slice(0, -1);
  if (key === 'clear') return '';
  if (!/^\d$/.test(key)) return current;
  const next = (current + key).replace(/^0+/, '');
  return next.length > 4 ? current : next;
}
