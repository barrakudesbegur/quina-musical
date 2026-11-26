// What the screens show, derived from the public state, the player's cards and the printed catalogue. Pure, so
// the Svelte components stay thin and the rules are tested in node.
import { cardFace, type Catalog, type CatalogCard } from '../../../packages/ui/data/catalog.ts';
import { cardTypeLabel, type PrintedCardType } from '../../../packages/ui/data/card-types.ts';
import { breakMinutes, checkGamePlan, publicPlan, roundCardType, roundTitle, splitBundle, type Prize, type PublicPlan, type SchedulePlan } from '../../../packages/ui/plan.ts';
import { cardMarks, cardsForRound, type CardMarks, type PlayerCard } from '../../../packages/rules/marks.ts';
import { standOf, type CardStand } from './desgraciat.ts';
import { nearSongs } from './near-win.ts';
import { defaultCardType, roundSide, type PublicLanding, type PublicRound, type PublicState, type PublicWinKind, type RoundKind } from '../feed/public.ts';
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

/**
 * A round's kind, wherever the phone learns it: the round being introduced, a round played, else the plan.
 * 'normal' when nothing says (a round the plan doesn't list).
 */
export function roundKindOf(number: number | null, state: PublicState | null, plan: { rounds: readonly { number: number; kind: RoundKind }[] } | null): RoundKind {
  if (number === null) return 'normal';
  if (state?.intro?.round === number) return state.intro.kind;
  return state?.rounds.find((r) => r.number === number)?.kind ?? plan?.rounds.find((r) => r.number === number)?.kind ?? 'normal';
}

/** A round the phone knows by its number only, by name ("Quina 4", "Quina Especial"…: plan.ts roundTitle), its kind
 * from roundKindOf. */
export function roundNameOf(number: number, state: PublicState | null, plan: { rounds: readonly { number: number; kind: RoundKind }[] } | null): string {
  return roundTitle({ number, kind: roundKindOf(number, state, plan) }, plan);
}

/** The round's counted landings' song ids, in landing order. */
export const landedIds = (round: PublicRound | null): number[] => (round ? [...round.landings].sort((a, b) => a.position - b.position).map((l) => l.songId) : []);

/** The latest counted landing of the current round. */
export const latestLanding = (round: PublicRound | null): PublicLanding | null => {
  if (!round?.landings.length) return null;
  return round.landings.reduce((a, b) => (b.position > a.position ? b : a));
};

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The public plan in the feed, checked (it arrives untyped). It goes through the full plan's validator with
 * what phones never get filled in (a locked round's bundles empty, no cheat-sheet rules), then back to the
 * public shape: only the rounds the feed marks `revealed` keep their bundles. Anything else reads as no plan.
 */
export function planOf(state: PublicState | null): PublicPlan | null {
  const raw: unknown = state?.plan;
  if (!isRec(raw) || !Array.isArray(raw.rounds)) return null;
  const revealed = raw.rounds.filter((r): r is Rec => isRec(r) && r.revealed === true).map((r) => r.number);
  const check = checkGamePlan({
    v: raw.v,
    edition: raw.edition,
    title: raw.title,
    prizeReveal: raw.prizeReveal,
    rounds: raw.rounds.map((r: unknown) =>
      isRec(r)
        ? {
            number: r.number,
            kind: r.kind,
            // Only when sent: an older cloud's plan has none (checkGamePlan then fills the kind's default).
            ...(r.cardType !== undefined ? { cardType: r.cardType } : {}),
            ...(r.side !== undefined ? { side: r.side } : {}),
            line: r.revealed === true ? r.line : [],
            bingo: r.revealed === true ? r.bingo : [],
          }
        : r,
    ),
    sponsors: raw.sponsors,
    schedule: raw.schedule,
    cheatSheet: { claimRules: [], specialRoundRules: [] },
  });
  return check.ok ? publicPlan(check.plan, revealed.filter((n): n is number => typeof n === 'number')) : null;
}

export interface CardView {
  saved: SavedCard;
  /** The side the phone shows (its songs, `{ id, type, lines }`): the round's (shownFace). null while the catalogue
   * loads, or for a number that isn't a printed card. */
  card: PlayerCard | null;
  /** Counts in the current round: the card is of the printed type the round plays, and has its side. */
  valid: boolean;
  marks: CardMarks | null;
  /** The songs gently highlighted on this card's grid: each one is all the card is missing for a Line or the Quina. */
  near: ReadonlySet<number>;
  /** In the Desgraciat round, a playing card's state (standing, or the landing that sank it); else null. */
  stand: CardStand | null;
}

/**
 * The side a phone shows of a printed card in a round of side `side` (D178): that side; a card without it (an especial
 * card while the normal cards play side 2) shows its first side, and doesn't count.
 */
export const shownFace = (card: CatalogCard, side: number): PlayerCard | null => cardFace(card, side) ?? cardFace(card, card.sides[0]?.side);

/** Each saved card with its marks for the round, on the round's side. Before any round every card shows its side 1,
 * unmarked. */
export function cardViews(saved: readonly SavedCard[], catalog: Catalog | null, round: PublicRound | null): CardView[] {
  const landed = landedIds(round);
  const side = roundSide(round ?? {});
  return saved.map((s) => {
    const printed = catalog?.cards.get(s.id) ?? null;
    const card = printed && shownFace(printed, side);
    // An older snapshot's round has no card type: it plays its kind's default (roundCardType); nor a side: side 1.
    const valid = !printed || !round ? true : cardsForRound([printed], roundCardType(round)).length === 1 && cardFace(printed, side) !== null;
    const marks = card && round && valid ? cardMarks(card, landed) : null;
    return { saved: s, card, valid, marks, near: nearSongs(card, marks, round), stand: standOf(card, valid, round) };
  });
}

/**
 * Which cards a round counts, as the phone words it: the printed type it plays, by name (card-types.json,
 * knownCardTypes; "Cartró <id>" when it isn't listed). `usual` is a regular round playing the normal cards: the intro
 * says nothing then, and only the cards list explains why a card rests. Every other round names its type at the intro
 * too (the Especial's and, since D70, the Desgraciat's special cards).
 */
export interface RoundRule {
  name: string;
  usual: boolean;
}

export function roundRule(round: { kind: RoundKind; cardType?: string }, types: readonly PrintedCardType[]): RoundRule {
  const type = roundCardType(round);
  return { name: cardTypeLabel(type, types).name, usual: round.kind === 'normal' && type === defaultCardType('normal') };
}

/** Which of the player's cards show a song as marked: songId → the cards' identities (Historial shows their icons). */
export function markedIdentities(views: readonly CardView[]): Map<number, number[]> {
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

export interface HistoryRound {
  round: number;
  kind: RoundKind;
  /** Newest first: the song playing now, if any, is the first. */
  landings: PublicLanding[];
  /** The landing playing now (the latest, while its round is on), or null once the round has ended. */
  nowPosition: number | null;
}

/**
 * Historial: the current round's songs only (the last round played, until the next one starts), newest first,
 * the song playing now included (the user's decision).
 */
export function historyOf(state: PublicState | null): HistoryRound | null {
  const r = currentRound(state);
  if (!r) return null;
  const landings = [...r.landings].sort((a, b) => b.position - a.position);
  return { round: r.number, kind: r.kind, landings, nowPosition: !r.ended && landings.length ? landings[0].position : null };
}

/** One prize as the phone shows it. */
export interface PrizeItem {
  title: string;
  detail: string | null;
  /** The sponsor's name, or null. */
  sponsor: string | null;
}

export interface PrizeLine {
  kind: PublicWinKind;
  /** The bundle's headline prizes, shown first and bigger; empty when none is set (or it is locked). */
  headline: PrizeItem[];
  /** The rest of the bundle, smaller. */
  others: PrizeItem[];
  /** Someone has won it ("Ja té guanyador"). Never which card: phones show no winning card numbers. */
  won: boolean;
  /** The phone's own cards among its confirmed winners (the only winners a phone ever names). */
  ownCardIds: number[];
}

export interface PrizeRound {
  number: number;
  kind: RoundKind;
  state: 'done' | 'current' | 'next' | 'later';
  /**
   * Its prizes aren't revealed yet (shown locked, game-style): 'intro' when they come as the round is
   * introduced, 'presenters' when only the presenters reveal them (an all-secret plan). Null once revealed.
   */
  lockedUntil: 'intro' | 'presenters' | null;
  lines: PrizeLine[];
}

/**
 * Premis: every planned round with its Line and Quina bundles (locked until revealed), and whether each was won.
 * `ownIds` are the phone's cards: a prize won by one of them says so; nobody else's card is ever named.
 */
export function prizeRounds(plan: PublicPlan | null, state: PublicState | null, ownIds: readonly number[] = []): PrizeRound[] {
  const winners = state?.winners ?? [];
  const current = currentRound(state);
  const focus = focusRoundNumber(state);
  const numbers = new Set<number>([...(plan?.rounds.map((r) => r.number) ?? []), ...(state?.rounds.map((r) => r.number) ?? [])]);
  return [...numbers]
    .sort((a, b) => a - b)
    .map((number) => {
      const planned = plan?.rounds.find((r) => r.number === number) ?? null;
      const played = state?.rounds.find((r) => r.number === number);
      const done = Boolean(played?.ended);
      const roundState: PrizeRound['state'] = done
        ? 'done'
        : number === current?.number && state?.scene !== 'interval' && !state?.intro
          ? 'current'
          : number === focus
            ? 'next'
            : 'later';
      const item = (p: Prize): PrizeItem => ({ title: p.title, detail: p.detail, sponsor: plan?.sponsors.find((s) => s.id === p.sponsorId)?.name ?? null });
      const line = (kind: PublicWinKind): PrizeLine => {
        // The Desgraciat round's last card standing wins its `bingo` bundle (ui/plan.ts prizeBundleOf).
        const { headline, others } = splitBundle((kind === 'line' ? planned?.line : planned?.bingo) ?? []);
        const cardIds = winners.filter((w) => w.round === number && w.kind === kind).flatMap((w) => w.cardIds);
        return { kind, headline: headline.map(item), others: others.map(item), won: cardIds.length > 0, ownCardIds: cardIds.filter((id) => ownIds.includes(id)) };
      };
      const lockedUntil = planned && !planned.revealed ? (plan?.prizeReveal === 'allSecret' ? 'presenters' : 'intro') : null;
      // The round as played wins over the plan (it's what the phones' cards play).
      const kind = played?.kind ?? planned?.kind ?? 'normal';
      // The Desgraciat round has one bundle, the last card standing's (the plan keeps it as its `bingo`), and no Line.
      const lines = kind === 'desgraciat' ? [line('standing')] : [line('line'), line('bingo')];
      return { number, kind, state: roundState, lockedUntil, lines };
    });
}

/** What the schedule views need of a plan (public or whole). */
type ScheduleOf = { rounds: readonly { number: number }[]; schedule: SchedulePlan };

/** "Quina 4 de 12": the round in focus and how many are planned (null without a plan or a round). */
export function progress(plan: ScheduleOf | null, state: PublicState | null): { current: number; total: number } | null {
  const total = plan?.rounds.length ?? 0;
  const current = focusRoundNumber(state);
  return total && current ? { current, total } : null;
}

/**
 * Each planned round's rough start time from the schedule, or null when the schedule has no start: each round before
 * it, and each break before it (an Interval, or a planned Throw's break in its place: packages/ui/plan.ts breakMinutes).
 */
export function plannedStarts(plan: ScheduleOf | null): Map<number, number> | null {
  if (!plan?.schedule.startAtMs) return null;
  const { startAtMs, roundMinutes } = plan.schedule;
  const breaks = (i: number) => plan.rounds.slice(0, i).reduce((sum, r) => sum + breakMinutes(plan.schedule, r.number), 0);
  return new Map(plan.rounds.map((r, i) => [r.number, startAtMs + (i * roundMinutes + breaks(i)) * 60_000] as const));
}

/**
 * What the Celebration shows. No winning card numbers, ever (the user's decision: people only care when it's
 * them): only the phone's own cards among the confirmed winners, which turn it into "La teva línia!".
 */
export interface CelebrationView {
  key: string;
  kind: PublicWinKind;
  round: number;
  /** The phone's own cards among the winners; empty when someone else won. */
  ownCardIds: number[];
}

/**
 * The Celebration on screen: the latest prize won in the current round (the Quina over the Line; the Desgraciat
 * round's last card standing, its only prize). `ownIds` are the phone's cards.
 */
export function celebrationOf(state: PublicState | null, ownIds: readonly number[] = []): CelebrationView | null {
  if (state?.scene !== 'celebration') return null;
  const round = currentRound(state)?.number;
  const won = state.winners.filter((w) => w.round === round);
  const latest = won.find((w) => w.kind === 'standing') ?? won.find((w) => w.kind === 'bingo') ?? won.find((w) => w.kind === 'line');
  if (!latest || round === undefined) return null;
  return { key: `celebration:${round}:${latest.kind}`, kind: latest.kind, round, ownCardIds: latest.cardIds.filter((id) => ownIds.includes(id)) };
}

export type HeatLevel = 'cold' | 'warm' | 'hot' | 'fire';

/** The Heat's word-sized level, for the garland's colour and its label. */
export function heatLevel(value: number): HeatLevel {
  if (value < 0.25) return 'cold';
  if (value < 0.5) return 'warm';
  if (value < 0.75) return 'hot';
  return 'fire';
}
