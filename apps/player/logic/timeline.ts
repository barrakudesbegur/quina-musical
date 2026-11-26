// Horari's rows (D87's J2 look, board Mobil-B-J2): the night's rounds in order, and the end of the night ("Fi"). A row
// shows only when the model has a time for it: a round always (when it started, else when it should, else no time);
// the end from the cloud's expected end (`gameEndMs`), else the plan's. The board's "Benvinguda" and "Mitja part" rows
// are left out: the welcome has no time anywhere in the model, and the plan's planned breaks are the throws (D136),
// whose place in Horari and whose name (U123) are still open. Pure.
import type { PublicPlan } from '../../../packages/ui/plan.ts';
import type { PublicState, RoundKind } from '../feed/public.ts';
import { plannedStarts, prizeRounds } from './view.ts';

/** Done (gold, ticked), the one being played (on paper, "Ara"), or still to come. */
export type TimelineState = 'done' | 'current' | 'next';

export type TimelineRow =
  | {
      kind: 'round';
      number: number;
      roundKind: RoundKind;
      state: TimelineState;
      /** When it started, else when it should (`predicted`), else null. */
      atMs: number | null;
      predicted: boolean;
    }
  /** The expected end of the night. Gone once the night is over: nobody knows when it really ended. */
  | { kind: 'end'; state: 'next'; atMs: number; predicted: true };

export function timelineOf(plan: PublicPlan | null, state: PublicState | null): TimelineRow[] {
  const starts = plannedStarts(plan);
  const started = new Map((state?.rounds ?? []).map((r) => [r.number, r.startedAtMs] as const));
  const after = state?.scene === 'after';
  const roundMs = (plan?.schedule.roundMinutes ?? 0) * 60_000;
  const rows: TimelineRow[] = [];
  for (const round of prizeRounds(plan, state)) {
    const real = started.get(round.number);
    const planned = starts?.get(round.number) ?? null;
    rows.push({
      kind: 'round',
      number: round.number,
      roundKind: round.kind,
      state: round.state === 'done' || round.state === 'current' ? round.state : 'next',
      atMs: real ?? planned,
      predicted: real === undefined && planned !== null,
    });
  }
  const lastPlanned = plan?.rounds.length ? starts?.get(plan.rounds[plan.rounds.length - 1].number) : undefined;
  const endMs = state?.gameEndMs ?? (lastPlanned === undefined ? null : lastPlanned + roundMs);
  if (rows.length && endMs !== null && !after) rows.push({ kind: 'end', state: 'next', atMs: endMs, predicted: true });
  return rows;
}

/** A row's key in a keyed list. */
export const timelineKey = (row: TimelineRow): string => (row.kind === 'round' ? `round:${row.number}` : 'end');
