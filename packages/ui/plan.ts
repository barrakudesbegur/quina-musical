// The Game plan now lives in @quina/protocol (protocol/plan.ts). This file re-exports it so the screens
// keep one import path, and adds the screens' own small helpers for prize bundles.
import { headlinePrizes, type Prize, type PrizeBundle } from '@quina/protocol';

export { PLAN_VERSION, DEFAULT_CARD_TYPES, checkGamePlan, headlinePrizes, publicPlan, revealedRounds, sponsorOf, roundPlan, roundCardType } from '@quina/protocol';
export type {
  GamePlan,
  Sponsor,
  Prize,
  PrizeBundle,
  PrizeReveal,
  PrizesRevealed,
  CardType,
  RoundPlan,
  SchedulePlan,
  CheatSheet,
  PlanCheck,
  PublicPlan,
  PublicRoundPlan,
} from '@quina/protocol';

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
