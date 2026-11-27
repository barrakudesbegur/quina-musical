// Small lookups the panels share: a song's title (or every song's title and artist, for the tabs' lists), a round's
// prize bundles from the Game plan and whether phones may see them yet, the Winners of a Celebration, and the Winners
// grouped by round. Pure.
import { winKindsOf, type CommandFields, type RoundKind, type ShowState, type SongRef } from '@quina/protocol';
import type { Catalog } from '../../../packages/ui/data/catalog.ts';
import type { CelebrationInfo, WinKind, WinnerInfo } from '../../../packages/ui/flow.ts';
import { prizeBundleOf, revealedRounds, roundIntroFields, roundPlan, sponsorOf, splitBundle, type GamePlan, type Prize } from '../../../packages/ui/plan.ts';

/** A song's title: from the snapshot (current, next, recent landings), then the printed cards, else null. */
export function songTitleOf(songId: number | null | undefined, state: ShowState | null, catalog: Catalog | null): string | null {
  if (songId === null || songId === undefined) return null;
  if (state?.current?.songId === songId) return state.current.title;
  if (state?.next?.songId === songId) return state.next.title;
  const landing = state?.landings.find((l) => l.songId === songId);
  if (landing) return landing.title;
  return catalog?.songs.get(songId)?.title ?? null;
}

/** Every song's title and artist the console knows, for the song lists: the printed cards', then the songs to come
 * (the engine's `upcoming`), then the snapshot's (current, next, landings), the later ones winning. */
export function songIndex(catalog: Catalog | null, state: ShowState | null, upcoming: readonly SongRef[] | null): Map<number, SongRef> {
  const index = new Map<number, SongRef>();
  for (const s of catalog?.songs.values() ?? []) index.set(s.id, { songId: s.id, title: s.title, artist: s.artist });
  for (const s of [...(upcoming ?? []), ...(state?.landings ?? []), state?.next, state?.current]) if (s) index.set(s.songId, { songId: s.songId, title: s.title, artist: s.artist });
  return index;
}

export interface PrizeView {
  title: string;
  detail: string | null;
  sponsor: string | null;
  /** Shown first and bigger. */
  headline: boolean;
}

export interface RoundPrizes {
  number: number;
  kind: RoundKind;
  /** The bundles, headline prizes first; empty when none is set. */
  line: PrizeView[];
  bingo: PrizeView[];
  /** One bundle per win the round can have (winKindsOf): Line and Quina, or the Desgraciat round's last card
   * standing (its `bingo` bundle). */
  bundles: { kind: WinKind; prizes: PrizeView[] }[];
}

/** What `roundPrizes` found: the plan is missing, the round isn't in it, or its prizes. */
export type RoundPrizesResult = { status: 'noPlan' } | { status: 'noRound'; number: number } | { status: 'ok'; prizes: RoundPrizes };

const prizeView = (plan: GamePlan, prize: Prize, headline: boolean): PrizeView => ({ title: prize.title, detail: prize.detail, sponsor: sponsorOf(plan, prize)?.name ?? null, headline });

/** A bundle as the console lists it: headline prizes first (splitBundle), then the others. */
function bundleView(plan: GamePlan, bundle: readonly Prize[]): PrizeView[] {
  const { headline, others } = splitBundle(bundle);
  return [...headline.map((p) => prizeView(plan, p, true)), ...others.map((p) => prizeView(plan, p, false))];
}

export function roundPrizes(plan: GamePlan | null, number: number): RoundPrizesResult {
  if (!plan) return { status: 'noPlan' };
  const round = roundPlan(plan, number);
  if (!round) return { status: 'noRound', number };
  return {
    status: 'ok',
    prizes: {
      number,
      kind: round.kind,
      line: bundleView(plan, round.line),
      bingo: bundleView(plan, round.bingo),
      bundles: winKindsOf(round.kind).map((kind) => ({ kind, prizes: bundleView(plan, prizeBundleOf(round, kind)) })),
    },
  };
}

/** The `roundIntro` that introduces round `number`, kind and card type from the plan (ui/plan.ts roundIntroFields). */
export const roundIntroArgs = (plan: GamePlan | null, number: number): CommandFields['roundIntro'] => roundIntroFields(plan, number);

/**
 * Whether phones may see a round's prizes yet (plan.ts revealedRounds over the engine's `prizes.revealed`):
 * 'revealed', 'secret' (the presenters can reveal them), or 'unknown' without a plan or from an engine that
 * doesn't report reveals.
 */
export function prizeRevealOf(plan: Pick<GamePlan, 'prizeReveal'> | null, state: Pick<ShowState, 'prizes'> | null, round: number): 'revealed' | 'secret' | 'unknown' {
  if (!plan || !state?.prizes) return 'unknown';
  return revealedRounds(plan, state.prizes.revealed).includes(round) ? 'revealed' : 'secret';
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

/** A Claim's kind as `claim` takes it ('standing' in the Desgraciat round). */
export type ClaimKind = NonNullable<CommandFields['claim']['kind']>;

/** The kind of the next Claim when the presenters don't pick one: what the Phase is climbing towards; in the
 * Desgraciat round always the last card standing (its only win). */
export function defaultClaimKind(state: ShowState | null): ClaimKind {
  if (!state) return 'line';
  if (state.round.kind === 'desgraciat' || state.cards.climbingTo === 'standing') return 'standing';
  return state.cards.climbingTo === 'bingo' || state.round.lineConfirmed ? 'bingo' : 'line';
}

/** The kinds the claim pad offers this round (winKindsOf): Line and Quina, or only the last card standing, which
 * needs no choice. */
export const claimKindsOf = (state: ShowState | null): readonly ClaimKind[] => winKindsOf(state?.round.kind ?? 'normal');
