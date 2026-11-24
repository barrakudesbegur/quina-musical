// The cheat sheet's content, apart from how it looks: every round's Line and Quina prizes with their sponsors,
// the claim and special-round rules from the plan, and the fixed parts (the laptop's Plan B keys, the Wii
// remote reminder, the setup checklist) passed in as copy. Pure, so the console can show the same content
// (one round's prizes during the Interval) and Admin prints all of it.
// Proposed for ui/ (rules + words) once the console needs it.
import { sponsorOf, type GamePlan, type Prize, type RoundPlan } from '../../../packages/ui/plan.ts';
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

export interface CheatPrize {
  kind: WinKind;
  /** "Premi de línia" / "Premi de quina". */
  label: string;
  /** null: this round has no such prize. */
  title: string | null;
  detail: string | null;
  /** The sponsor's name, or null. */
  sponsor: string | null;
}

export interface CheatRound {
  number: number;
  /** "Quina 3". */
  label: string;
  special: boolean;
  prizes: CheatPrize[];
}

export interface CheatSheetModel {
  title: string;
  rounds: CheatRound[];
  claimRules: string[];
  /** Shown only when a special round is planned. */
  specialRoundRules: string[];
  hasSpecialRound: boolean;
  keys: readonly ShowKey[];
  wiiReminder: string;
  checklist: readonly string[];
}

const KINDS: readonly WinKind[] = ['line', 'bingo'];

function cheatPrize(plan: GamePlan, kind: WinKind, prize: Prize | null): CheatPrize {
  return {
    kind,
    label: CA.prize[kind],
    title: prize?.title || null,
    detail: prize?.detail || null,
    sponsor: sponsorOf(plan, prize)?.name ?? null,
  };
}

/** One round's prize lines, as the console shows them before the round. */
export function cheatRound(plan: GamePlan, round: RoundPlan): CheatRound {
  return {
    number: round.number,
    label: CA.round(round.number),
    special: round.kind === 'special',
    prizes: KINDS.map((kind) => cheatPrize(plan, kind, round[kind])),
  };
}

/** The whole sheet. Without a plan, only the fixed parts are filled in. */
export function cheatSheetModel(plan: GamePlan | null, copy: CheatSheetCopy): CheatSheetModel {
  const rounds = plan ? plan.rounds.map((r) => cheatRound(plan, r)) : [];
  const hasSpecialRound = rounds.some((r) => r.special);
  return {
    title: plan?.title || CA.gameTitle,
    rounds,
    claimRules: plan ? [...plan.cheatSheet.claimRules] : [],
    specialRoundRules: plan && hasSpecialRound ? [...plan.cheatSheet.specialRoundRules] : [],
    hasSpecialRound,
    keys: copy.keys,
    wiiReminder: copy.wiiReminder,
    checklist: copy.checklist,
  };
}
