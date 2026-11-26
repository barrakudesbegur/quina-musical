// Horari's rows (D87's J2 look, board Mobil-B-J2; D150, D152): the card-selling time first ("Venda de cartrons", the
// plan's `doorsAtMs`, only when it has one), then the night's rounds in order, each planned Throw as a descans after
// its round ("Primer descans", "Segon descans"…, D149), and the end of the night ("Fi"). The board's "Benvinguda" and
// "Mitja part" rows are now the doors and the descans. A round always shows (when it started, else when it should,
// else no time); a descans at the planned end of its round (no time without the plan's start); the end from the
// cloud's expected end (`gameEndMs`), else the plan's. The doors and each descans are done once a later round started;
// until then their times are "~" predictions, like a round's planned start. Pure.
import type { PublicPlan } from '../../../packages/ui/plan.ts';
import type { PublicState, RoundKind } from '../feed/public.ts';
import { plannedStarts, prizeRounds } from './view.ts';

/** Done (gold, ticked), the one being played (on paper, "Ara"), or still to come. */
export type TimelineState = 'done' | 'current' | 'next';

export type TimelineRow =
  /** The doors open and the cards go on sale (the plan's `doorsAtMs`). */
  | { kind: 'doors'; state: 'done' | 'next'; atMs: number; predicted: boolean }
  | {
      kind: 'round';
      number: number;
      roundKind: RoundKind;
      state: TimelineState;
      /** When it started, else when it should (`predicted`), else null. */
      atMs: number | null;
      predicted: boolean;
    }
  /** A planned Throw's descans after round `afterRound`; `order` is 1 for the night's first ("Primer descans"). */
  | { kind: 'throw'; order: number; afterRound: number; state: 'done' | 'next'; atMs: number | null; predicted: boolean }
  /** The expected end of the night. Gone once the night is over: nobody knows when it really ended. */
  | { kind: 'end'; state: 'next'; atMs: number; predicted: true };

export function timelineOf(plan: PublicPlan | null, state: PublicState | null): TimelineRow[] {
  const starts = plannedStarts(plan);
  const started = new Map((state?.rounds ?? []).map((r) => [r.number, r.startedAtMs] as const));
  /** A round after `number` started: what comes before it is over. */
  const passed = (number: number) => [...started.keys()].some((n) => n > number);
  const after = state?.scene === 'after';
  const roundMs = (plan?.schedule.roundMinutes ?? 0) * 60_000;
  const throws = [...(plan?.schedule.throws ?? [])].sort((a, b) => a.afterRound - b.afterRound);
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
    const order = throws.findIndex((t) => t.afterRound === round.number) + 1;
    if (order) {
      const done = passed(round.number);
      const atMs = planned === null ? null : planned + roundMs;
      rows.push({ kind: 'throw', order, afterRound: round.number, state: done ? 'done' : 'next', atMs, predicted: !done && atMs !== null });
    }
  }
  const doorsAtMs = plan?.schedule.doorsAtMs;
  if (rows.length && doorsAtMs != null) {
    const done = passed(0);
    rows.unshift({ kind: 'doors', state: done ? 'done' : 'next', atMs: doorsAtMs, predicted: !done });
  }
  const lastPlanned = plan?.rounds.length ? starts?.get(plan.rounds[plan.rounds.length - 1].number) : undefined;
  const endMs = state?.gameEndMs ?? (lastPlanned === undefined ? null : lastPlanned + roundMs);
  if (rows.length && endMs !== null && !after) rows.push({ kind: 'end', state: 'next', atMs: endMs, predicted: true });
  return rows;
}

/** A row's key in a keyed list. */
export function timelineKey(row: TimelineRow): string {
  if (row.kind === 'round') return `round:${row.number}`;
  if (row.kind === 'throw') return `throw:${row.afterRound}`;
  return row.kind;
}
