// The Game plan now lives in @quina/protocol (protocol/plan.ts). This file re-exports it so the screens
// keep one import path, and adds the screens' own small helpers: round names and prize bundles.
import {
  headlinePrizes,
  roundCardType,
  roundPlan,
  roundSide,
  type CommandFields,
  type GamePlan,
  type Prize,
  type PrizeBundle,
  type RoundKind,
  type RoundPlan,
  type SchedulePlan,
  type WinKind,
} from '@quina/protocol';
import { CA } from './i18n/ca.ts';

export { PLAN_VERSION, checkGamePlan, headlinePrizes, publicPlan, revealedRounds, sponsorOf, roundPlan, roundCardType, roundSide, sideWarnings } from '@quina/protocol';
export type {
  GamePlan,
  Sponsor,
  Prize,
  PrizeBundle,
  PrizeReveal,
  PrizesRevealed,
  RoundPlan,
  SchedulePlan,
  CheatSheet,
  PlanCheck,
  PublicPlan,
  PublicRoundPlan,
  SideWarning,
} from '@quina/protocol';

/**
 * How long the break after round `afterRound` lasts, in minutes: a planned Throw's minutes when there is one after it
 * (the whole break, the throw inside it, in place of the Interval), else the Interval.
 */
export function breakMinutes(schedule: Pick<SchedulePlan, 'intervalMinutes' | 'throws'>, afterRound: number): number {
  return schedule.throws?.find((t) => t.afterRound === afterRound)?.minutes ?? schedule.intervalMinutes;
}

/**
 * A normal round's Quina number, as the screens name it ("Quina N"): its place among the plan's normal rounds. The
 * special rounds have no number ("Quina Especial", "Quina del Desgraciat"), so they don't count, wherever they sit in
 * the plan (screens.md; the card's printed mark reads "QUINES 1–5" / "QUINES 6–10", D171, D193). Null for a special
 * round.
 */
export function quinaNumber(round: Pick<RoundPlan, 'number' | 'kind'>, rounds: readonly Pick<RoundPlan, 'number' | 'kind'>[]): number | null {
  if (round.kind !== 'normal') return null;
  return 1 + rounds.filter((r) => r.kind === 'normal' && r.number < round.number).length;
}

/** A round as roundTitle names it: its number in the plan and its kind. */
type RoundRef = Pick<RoundPlan, 'number' | 'kind'>;
/** What roundTitle needs of a plan (whole or public). */
type RoundsOf = { readonly rounds: readonly RoundRef[] };

/**
 * A round's name on every screen (screens.md): "Quina N" for a normal round, N its Quina number (quinaNumber); the
 * special rounds have no number: "Quina Especial", "Quina del Desgraciat" (D251; roundShortTitle where space is short).
 * Without the plan, or with one that lacks the round (a screen before the plan loads, an old snapshot), a normal round
 * falls back to its number in the plan (`round.number`), which is only right until a special round has played.
 */
export function roundTitle(round: RoundRef, plan: RoundsOf | null): string {
  if (round.kind === 'special') return CA.specialRound;
  if (round.kind === 'desgraciat') return CA.desgraciatRound;
  return CA.round(quinaOf(round, plan));
}

/** roundTitle where space is short (D251): the Desgraciat round is "Desgraciat"; every other round keeps its name. */
export function roundShortTitle(round: RoundRef, plan: RoundsOf | null): string {
  return round.kind === 'desgraciat' ? CA.desgraciatShort : roundTitle(round, plan);
}

/** roundTitle with the night's total after a normal round's number, "Quina 4 de 8" (what the total counts is pending
 * U163); a special round keeps its bare name, and no total (null or 0) gives roundTitle's. */
export function roundTitleOf(round: RoundRef, plan: RoundsOf | null, total: number | null): string {
  return round.kind === 'normal' && total ? CA.roundOf(quinaOf(round, plan), total) : roundTitle(round, plan);
}

/** A round a screen knows by its number only, with its kind from the plan (`known` when the plan lacks it: a normal
 * round unless said). */
export function roundAt(plan: RoundsOf | null, number: number, known: RoundKind = 'normal'): RoundRef {
  return { number, kind: plan?.rounds.find((r) => r.number === number)?.kind ?? known };
}

/** A normal round's Quina number, else its plan number when the plan lacks it (roundTitle). */
function quinaOf(round: RoundRef, plan: RoundsOf | null): number {
  return plan?.rounds.some((r) => r.number === round.number) ? (quinaNumber(round, plan.rounds) ?? round.number) : round.number;
}

/**
 * The `roundIntro` that introduces round `number` (the console's and Admin's): with its kind (the Desgraciat round's
 * too), printed card type and card side from the plan when the plan has that round (a plan from before card types per
 * round plays its kind's default; one from before sides, side 1). The engine keeps them for the round's `newRound`.
 */
export function roundIntroFields(plan: GamePlan | null, number: number): CommandFields['roundIntro'] {
  const planned = roundPlan(plan, number);
  if (!planned) return { number };
  return { number, kind: planned.kind, cardType: roundCardType(planned), side: roundSide(planned) };
}

/** A round's prize bundle for a win: the Line's, else the Quina's (the Desgraciat round's last card standing wins its
 * `bingo` bundle). */
export const prizeBundleOf = (round: Pick<RoundPlan, 'line' | 'bingo'>, kind: WinKind): PrizeBundle => (kind === 'line' ? round.line : round.bingo);

/** A bundle as screens show it: its headline prizes (first and bigger: headlinePrizes), then the others. */
export function splitBundle(bundle: readonly Prize[]): { headline: Prize[]; others: Prize[] } {
  const headline = headlinePrizes(bundle as PrizeBundle);
  return { headline, others: bundle.filter((p) => !headline.includes(p)) };
}

/** A bundle in a few words, for lists and diffs: its headline prizes' titles and how many others
 * ("Sopar per a dos · Pernil +3"). Null for an empty bundle. */
export function bundleSummary(bundle: readonly Prize[]): string | null {
  if (!bundle.length) return null;
  const { headline, others } = splitBundle(bundle);
  const titles = headline.map((p) => p.title || '…').join(' · ');
  return others.length ? `${titles} +${others.length}` : titles;
}

/** A stretch of a bundle's other prizes for a compact list: `plain` ones (no sponsor, no detail: a hamper's staples)
 * flow together on one wrapped line ("Xocolata · Torró · Neules…"); the others, which name a sponsor or a detail,
 * take a line each. */
export interface PrizeRun<T> {
  plain: boolean;
  items: T[];
}

/** A bundle's other prizes as runs (PrizeRun), in their order: consecutive plain prizes share a run, every other
 * prize is a run of its own. Nothing is dropped or reordered. */
export function prizeRuns<T extends { detail: string | null; sponsor: string | null }>(items: readonly T[]): PrizeRun<T>[] {
  const runs: PrizeRun<T>[] = [];
  for (const item of items) {
    const plain = !item.detail && !item.sponsor;
    const last = runs.at(-1);
    if (plain && last?.plain) last.items.push(item);
    else runs.push({ plain, items: [item] });
  }
  return runs;
}
