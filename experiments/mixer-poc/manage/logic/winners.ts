// The night's Winners as Admin lists them: in round order, the Line before the Quina, with the prize from the
// plan, and whether the name or notes being typed differ from what the engine has. Pure.
import { roundPlan, type GamePlan } from '../../ui/plan.ts';
import type { WinnerInfo } from '../../ui/flow.ts';

export interface WinnerRow {
  winner: WinnerInfo;
  /** The prize title from the plan, or null. */
  prize: string | null;
}

/** Winners sorted by round, Line before Quina, then by time. */
export function winnerRows(winners: readonly WinnerInfo[], plan: GamePlan | null): WinnerRow[] {
  const order = { line: 0, bingo: 1 } as const;
  return [...winners]
    .sort((a, b) => a.round - b.round || order[a.kind] - order[b.kind] || a.atMs - b.atMs || a.cardId - b.cardId)
    .map((winner) => ({ winner, prize: roundPlan(plan, winner.round)?.[winner.kind]?.title || null }));
}

export interface WinnerEdit {
  name: string;
  notes: string;
}

/** The engine's values as editable text. */
export const editOf = (w: Pick<WinnerInfo, 'name' | 'notes'>): WinnerEdit => ({ name: w.name ?? '', notes: w.notes ?? '' });

/** Whether an edit differs from what the engine has (blank and null are the same). */
export function editDiffers(w: Pick<WinnerInfo, 'name' | 'notes'>, edit: WinnerEdit): boolean {
  return (w.name ?? '').trim() !== edit.name.trim() || (w.notes ?? '').trim() !== edit.notes.trim();
}

/** The `winnerInfo` fields for an edit: both always sent, trimmed (an empty string clears one). */
export function winnerInfoFields(claimId: string, edit: WinnerEdit): { claimId: string; name: string; notes: string } {
  return { claimId, name: edit.name.trim(), notes: edit.notes.trim() };
}
