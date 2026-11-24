// The Game plan now lives in @quina/protocol (protocol/plan.ts). This file re-exports it so the screens
// keep one import path, and adds the screens' own small helpers for prize bundles.
import {
  COMMANDS,
  headlinePrizes,
  roundCardType,
  roundPlan,
  type CommandFields,
  type GamePlan,
  type Prize,
  type PrizeBundle,
  type RoundKind,
  type RoundPlan,
  type WinKind,
} from '@quina/protocol';

export { PLAN_VERSION, checkGamePlan, headlinePrizes, publicPlan, revealedRounds, sponsorOf, roundPlan, roundCardType } from '@quina/protocol';
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
} from '@quina/protocol';

/**
 * The `roundIntro` that introduces round `number` (the console's and Admin's): with its kind and printed card type
 * from the plan when the plan has that round (a plan from before card types per round plays its kind's default). The
 * engine keeps the type for the round's `newRound`.
 */
export function roundIntroFields(plan: GamePlan | null, number: number): CommandFields['roundIntro'] {
  const planned = roundPlan(plan, number);
  if (!planned) return { number };
  const kind = introKind(planned.kind);
  return { number, ...(kind ? { kind } : {}), cardType: roundCardType(planned) };
}

/** A round kind as `roundIntro` takes it. The protocol doesn't accept 'desgraciat' there yet: such a kind is left out
 * rather than sent and refused (the engine then plays the round as it knows it). */
function introKind(kind: RoundKind): CommandFields['roundIntro']['kind'] {
  const accepted: readonly string[] = COMMANDS.roundIntro.kind.oneOf;
  return accepted.includes(kind) ? (kind as CommandFields['roundIntro']['kind']) : undefined;
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
