// The cheat sheet's content, apart from how it looks: every round's Line and Quina prize bundles (headline
// prizes first) with their sponsors, the sponsors no prize names (money donors: every sponsor is thanked),
// the claim and special-round rules from the plan, and the fixed parts (the laptop's Plan B keys, the Wii
// remote reminder, the setup checklist) passed in as copy. Pure, so the console can show the same content
// (one round's prizes during the Interval) and Admin prints all of it.
// Proposed for ui/ (rules + words) once the console needs it.
import { winKindsOf } from '@quina/protocol';
import { prizeBundleOf, roundTitle, sponsorOf, splitBundle, type GamePlan, type Prize, type RoundPlan } from '../../../packages/ui/plan.ts';
import type { WinKind } from '../../../packages/ui/flow.ts';
import { CA } from '../../../packages/ui/i18n/ca.ts';

export interface ShowKey {
  /** The key(s) as printed on the sheet ("→ / Retorn"). */
  keys: string;
  action: string;
}

/** The parts of the sheet that don't come from the plan. */
export interface CheatSheetCopy {
  keys: readonly ShowKey[];
  wiiReminder: string;
  checklist: readonly string[];
}

export interface CheatPrizeItem {
  title: string;
  detail: string | null;
  /** The sponsor's name, or null. */
  sponsor: string | null;
  /** Shown first and in bold. */
  headline: boolean;
}

export interface CheatPrize {
  kind: WinKind;
  /** "Premi de línia" / "Premi de quina". */
  label: string;
  /** The bundle, headline prizes first; empty: this round has no such prize yet. */
  items: CheatPrizeItem[];
}

export interface CheatRound {
  number: number;
  /** "Quina 3" by its Quina number, "Quina Especial", "Quina del Desgraciat" (plan.ts roundTitle). */
  label: string;
  special: boolean;
  /** The Quina del Desgraciat: one prize, the last card standing's, and no Line. */
  desgraciat: boolean;
  /** Line and Quina; for the Desgraciat round only the last card standing's. */
  prizes: CheatPrize[];
}

export interface CheatSheetModel {
  title: string;
  rounds: CheatRound[];
  /** The sponsors no prize names (money donors, docs/event.md): the presenters thank them too. */
  otherSponsors: string[];
  claimRules: string[];
  /** Shown only when a special round is planned. */
  specialRoundRules: string[];
  hasSpecialRound: boolean;
  keys: readonly ShowKey[];
  wiiReminder: string;
  checklist: readonly string[];
}


function cheatItem(plan: GamePlan, prize: Prize, headline: boolean): CheatPrizeItem {
  return { title: prize.title, detail: prize.detail || null, sponsor: sponsorOf(plan, prize)?.name ?? null, headline };
}

function cheatPrize(plan: GamePlan, kind: WinKind, bundle: readonly Prize[]): CheatPrize {
  const { headline, others } = splitBundle(bundle);
  return {
    kind,
    label: CA.prize[kind],
    items: [...headline.map((p) => cheatItem(plan, p, true)), ...others.map((p) => cheatItem(plan, p, false))],
  };
}

/** One round's prize bundles, as the console shows them before the round. */
export function cheatRound(plan: GamePlan, round: RoundPlan): CheatRound {
  return {
    number: round.number,
    label: roundTitle(round, plan),
    special: round.kind === 'special',
    desgraciat: round.kind === 'desgraciat',
    prizes: winKindsOf(round.kind).map((kind) => cheatPrize(plan, kind, prizeBundleOf(round, kind))),
  };
}

/** The whole sheet. Without a plan, only the fixed parts are filled in. */
export function cheatSheetModel(plan: GamePlan | null, copy: CheatSheetCopy): CheatSheetModel {
  const rounds = plan ? plan.rounds.map((r) => cheatRound(plan, r)) : [];
  const hasSpecialRound = rounds.some((r) => r.special);
  const named = new Set(plan ? plan.rounds.flatMap((r) => [...r.line, ...r.bingo]).map((p) => p.sponsorId) : []);
  return {
    title: plan?.title || CA.gameTitle,
    rounds,
    otherSponsors: plan ? plan.sponsors.filter((s) => !named.has(s.id)).map((s) => s.name) : [],
    claimRules: plan ? [...plan.cheatSheet.claimRules] : [],
    specialRoundRules: plan && hasSpecialRound ? [...plan.cheatSheet.specialRoundRules] : [],
    hasSpecialRound,
    keys: copy.keys,
    wiiReminder: copy.wiiReminder,
    checklist: copy.checklist,
  };
}
