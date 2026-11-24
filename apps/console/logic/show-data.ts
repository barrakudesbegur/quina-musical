// Small lookups the panels share: a song's title, a round's prizes from the Game plan, the Winners of a
// Celebration, and the Winners grouped by round. Pure.
import type { RoundKind, ShowState } from '@quina/protocol';
import type { Catalog } from '../../../packages/ui/data/catalog.ts';
import type { CelebrationInfo, WinKind, WinnerInfo } from '../../../packages/ui/flow.ts';
import { roundPlan, sponsorOf, type GamePlan, type Prize } from '../../../packages/ui/plan.ts';

/** A song's title: from the snapshot (current, next, recent landings), then the printed cards, else null. */
export function songTitleOf(songId: number | null | undefined, state: ShowState | null, catalog: Catalog | null): string | null {
  if (songId === null || songId === undefined) return null;
  if (state?.current?.songId === songId) return state.current.title;
  if (state?.next?.songId === songId) return state.next.title;
  const landing = state?.landings.find((l) => l.songId === songId);
  if (landing) return landing.title;
  return catalog?.songs.get(songId)?.title ?? null;
}

export interface PrizeView {
  kind: WinKind;
  title: string;
  detail: string | null;
  sponsor: string | null;
}

export interface RoundPrizes {
  number: number;
  kind: RoundKind;
  line: PrizeView | null;
  bingo: PrizeView | null;
}

/** What `roundPrizes` found: the plan is missing, the round isn't in it, or its prizes. */
export type RoundPrizesResult = { status: 'noPlan' } | { status: 'noRound'; number: number } | { status: 'ok'; prizes: RoundPrizes };

const prizeView = (plan: GamePlan, kind: WinKind, prize: Prize | null): PrizeView | null =>
  prize ? { kind, title: prize.title, detail: prize.detail, sponsor: sponsorOf(plan, prize)?.name ?? null } : null;

export function roundPrizes(plan: GamePlan | null, number: number): RoundPrizesResult {
  if (!plan) return { status: 'noPlan' };
  const round = roundPlan(plan, number);
  if (!round) return { status: 'noRound', number };
  return { status: 'ok', prizes: { number, kind: round.kind, line: prizeView(plan, 'line', round.line), bingo: prizeView(plan, 'bingo', round.bingo) } };
}

/** The Winners this Celebration is for. */
export function celebrationWinners(winners: readonly WinnerInfo[], celebration: CelebrationInfo | null): WinnerInfo[] {
  if (!celebration) return [];
  return winners.filter((w) => w.round === celebration.round && w.kind === celebration.kind && celebration.cardIds.includes(w.cardId));
}

export interface WinnersByRound {
  round: number;
  winners: WinnerInfo[];
}

/** The whole Game's Winners by round (latest round first), Line before Bingo, then by time. */
export function winnersByRound(winners: readonly WinnerInfo[]): WinnersByRound[] {
  const rounds = new Map<number, WinnerInfo[]>();
  for (const w of winners) rounds.set(w.round, [...(rounds.get(w.round) ?? []), w]);
  const kindOrder = (k: WinKind) => (k === 'line' ? 0 : 1);
  return [...rounds.entries()]
    .sort(([a], [b]) => b - a)
    .map(([round, list]) => ({ round, winners: list.sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind) || a.atMs - b.atMs) }));
}

/** The kind of the next Claim when the presenters don't pick one: what the Phase is climbing towards. */
export function defaultClaimKind(state: ShowState | null): WinKind {
  if (!state) return 'line';
  return state.cards.climbingTo === 'bingo' || state.round.lineConfirmed ? 'bingo' : 'line';
}

/** Tabs: the index after an arrow, Home or End key (wrapping), or null for any other key. */
export function tabIndexForKey(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (current + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
