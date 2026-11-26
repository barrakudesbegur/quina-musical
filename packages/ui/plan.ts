// The Game plan now lives in @quina/protocol (protocol/plan.ts). This file re-exports it so the screens
// keep one import path, and adds the screens' own small helpers for prize bundles.
import {
  headlinePrizes,
  roundCardType,
  roundPlan,
  roundSide,
  type CommandFields,
  type GamePlan,
  type Prize,
  type PrizeBundle,
  type RoundPlan,
  type WinKind,
} from '@quina/protocol';

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
 * A normal round's Quina number, as the screens name it ("Quina N"): its place among the plan's normal rounds. The
 * special rounds have no number ("Quina Especial", "Quina Desgraciada"), so they don't count, wherever they sit in the
 * plan (screens.md; the card's printed mark reads "QUINES 1–4" / "QUINES 5–10", D171). Null for a special round.
 */
export function quinaNumber(round: Pick<RoundPlan, 'number' | 'kind'>, rounds: readonly Pick<RoundPlan, 'number' | 'kind'>[]): number | null {
  if (round.kind !== 'normal') return null;
  return 1 + rounds.filter((r) => r.kind === 'normal' && r.number < round.number).length;
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
