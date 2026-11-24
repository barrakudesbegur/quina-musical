// What the screens show, derived from the public state, the player's cards and the printed catalogue. Pure, so
// the Svelte components stay thin and the rules are tested in node.
import type { Catalog } from '../../../packages/ui/data/catalog.ts';
import { cardTypeLabel, type PrintedCardType } from '../../../packages/ui/data/card-types.ts';
import { checkGamePlan, publicPlan, roundCardType, splitBundle, type Prize, type PublicPlan, type SchedulePlan } from '../../../packages/ui/plan.ts';
import { cardMarks, cardsForRound, type CardMarks, type PlayerCard } from '../../../packages/rules/marks.ts';
import { nearSongs } from './near-win.ts';
import { defaultCardType, type PublicLanding, type PublicRound, type PublicState, type PublicWinKind, type RoundKind } from '../feed/public.ts';
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
  /** null while the catalogue loads, or for a number that isn't a printed card. */
  card: PlayerCard | null;
  /** Counts in the current round: the card is of the printed type the round plays. */
  valid: boolean;
  marks: CardMarks | null;
  /** The songs gently highlighted on this card's grid: each one is all the card is missing for a Line or the Quina. */
  near: ReadonlySet<number>;
}

/** Each saved card with its marks for the round. Before any round every card shows, unmarked. */
export function cardViews(saved: readonly SavedCard[], catalog: Catalog | null, round: PublicRound | null): CardView[] {
  const landed = landedIds(round);
  return saved.map((s) => {
    const card = catalog?.cards.get(s.id) ?? null;
    // An older snapshot's round has no card type: it plays its kind's default (roundCardType).
    const valid = !card || !round ? true : cardsForRound([card], roundCardType(round)).length === 1;
    const marks = card && round && valid ? cardMarks(card, landed) : null;
    return { saved: s, card, valid, marks, near: nearSongs(card, marks, round) };
  });
}

/**
 * Which cards a round counts, as the phone words it: the special round's or a normal round's usual rule when it plays
 * its kind's default type, else the printed type by name (card-types.json, knownCardTypes; "Cartró <id>" when it
 * isn't listed).
 */
export type RoundRule = { kind: 'normal' } | { kind: 'special' } | { kind: 'type'; name: string };

export function roundRule(round: { kind: RoundKind; cardType?: string }, types: readonly PrintedCardType[]): RoundRule {
  const type = roundCardType(round);
  if (type !== defaultCardType(round.kind)) return { kind: 'type', name: cardTypeLabel(type, types).name };
  return { kind: round.kind === 'special' ? 'special' : 'normal' };
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
        const { headline, others } = splitBundle((kind === 'line' ? planned?.line : planned?.bingo) ?? []);
        const cardIds = winners.filter((w) => w.round === number && w.kind === kind).flatMap((w) => w.cardIds);
        return { kind, headline: headline.map(item), others: others.map(item), won: cardIds.length > 0, ownCardIds: cardIds.filter((id) => ownIds.includes(id)) };
      };
      const lockedUntil = planned && !planned.revealed ? (plan?.prizeReveal === 'allSecret' ? 'presenters' : 'intro') : null;
      return { number, kind: planned?.kind ?? played?.kind ?? 'normal', state: roundState, lockedUntil, lines: [line('line'), line('bingo')] };
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

/** Each planned round's rough start time from the schedule, or null when the schedule has no start. */
export function plannedStarts(plan: ScheduleOf | null): Map<number, number> | null {
  if (!plan?.schedule.startAtMs) return null;
  const step = (plan.schedule.roundMinutes + plan.schedule.intervalMinutes) * 60_000;
  return new Map(plan.rounds.map((r, i) => [r.number, plan.schedule.startAtMs! + i * step] as const));
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

/** The Celebration on screen: the latest prize won in the current round. `ownIds` are the phone's cards. */
export function celebrationOf(state: PublicState | null, ownIds: readonly number[] = []): CelebrationView | null {
  if (state?.scene !== 'celebration') return null;
  const round = currentRound(state)?.number;
  const won = state.winners.filter((w) => w.round === round);
  const latest = won.find((w) => w.kind === 'bingo') ?? won.find((w) => w.kind === 'line');
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

/** Leaving "Afegir cartró" (close or back) asks first when a number has been typed; with nothing typed it just closes. */
export const leaveNeedsConfirm = (typed: string): boolean => typed.length > 0;

/** A number typed on the pad: digits only, at most 4. */
export function padValue(current: string, key: string): string {
  if (key === 'back') return current.slice(0, -1);
  if (key === 'clear') return '';
  if (!/^\d$/.test(key)) return current;
  const next = (current + key).replace(/^0+/, '');
  return next.length > 4 ? current : next;
}
