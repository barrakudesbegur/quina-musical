// The edition's plan (D116): read it from a plan source (data/editions/<year>.plan.json, a GamePlan) or an edition
// file (which carries it as `plan`), check it as the cloud and the screens will, and move its times for a test.
// Pure: the files and the cloud are main.ts's and upload.ts's.
import { checkGamePlan, roundCardType, roundSide, sidePool, sideWarnings, type CardTypeSides, type GamePlan } from '@quina/protocol';

export interface PlanReport {
  /** The plan as checkGamePlan reads it (what the cloud stores), when it passes. */
  plan: GamePlan | null;
  /** Stop the upload: the check's errors, and a round on a side its card type doesn't have. */
  errors: string[];
  /** Worth reading, never blocking: a side no round plays, a pool with no songs yet (it then plays the whole repertoire). */
  warnings: string[];
}

export interface PlanContext {
  /** The printed card types (card-types.json), or null when unknown: the sides are then not checked. */
  cardTypes: readonly CardTypeSides[] | null;
  /** Each pool's song count, from the repertoire's songs.json. */
  poolSongs?: Readonly<Record<string, number>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The plan inside a file: a plan source is the GamePlan itself; an edition file carries it as `plan`. */
export function planOf(json: unknown): unknown {
  return isRecord(json) && !('rounds' in json) && 'plan' in json ? json.plan : json;
}

export function checkPlan(json: unknown, context: PlanContext): PlanReport {
  // Write mode: a sponsor logo that isn't an upload to the cloud (/media/<hash>.png|jpg) stops the upload.
  const read = checkGamePlan(planOf(json), { write: true });
  if (!read.ok) return { plan: null, errors: read.errors, warnings: [] };
  const { plan } = read;
  if (!context.cardTypes) return { plan, errors: [], warnings: ["no card types to check the rounds' sides against (pass --repertoire)"] };
  const types = context.cardTypes;
  const errors: string[] = [];
  plan.rounds.forEach((round, i) => {
    if (sidePool(types, roundCardType(round), roundSide(round)) == null) {
      errors.push(`plan.rounds[${i}].side: round ${round.number} plays side ${roundSide(round)} of card type "${roundCardType(round)}", which card-types.json doesn't have`);
    }
  });
  const warnings = sideWarnings(plan, types, context.poolSongs)
    .filter((w) => !/has no side/.test(w.message))
    .map((w) => `${w.path}: ${w.message}`);
  return { plan, errors, warnings };
}

/** The venue's time zone: a test's start time is read as Begur's wall clock, whatever the laptop's zone. */
export const VENUE_TIME_ZONE = 'Europe/Madrid';
/** The doors open this long before the first round (D192: card sales from 5 pm, the start at 6 pm). */
export const DOORS_BEFORE_START_MS = 60 * 60_000;

/** Minutes east of UTC in `timeZone` at `atMs`. */
function offsetMinutes(atMs: number, timeZone: string): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(atMs).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === '-' ? -minutes : minutes;
}

/**
 * "2026-11-27 19:00" (or with a T) as Begur's wall clock → epoch ms. Null when it isn't that shape or isn't a real
 * time (a time skipped by the clock change).
 */
export function venueTimeMs(text: string, timeZone = VENUE_TIME_ZONE): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const [y, mo, d, h, mi] = match.slice(1).map(Number) as [number, number, number, number, number];
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let ms = wall - offsetMinutes(wall, timeZone) * 60_000;
  ms = wall - offsetMinutes(ms, timeZone) * 60_000;
  const back = new Date(ms + offsetMinutes(ms, timeZone) * 60_000);
  return back.getUTCHours() === h && back.getUTCMinutes() === mi && back.getUTCDate() === d ? ms : null;
}

/** The plan with the first round at `startAtMs` and the doors an hour before, for a test: nothing else moves. */
export function withStart(plan: GamePlan, startAtMs: number): GamePlan {
  return { ...plan, schedule: { ...plan.schedule, startAtMs, doorsAtMs: startAtMs - DOORS_BEFORE_START_MS } };
}

/** One line per thing an organizer would notice, to compare the cloud's plan with the one about to replace it. */
export function planSummary(plan: GamePlan | null, timeZone = VENUE_TIME_ZONE): string[] {
  if (!plan) return ['(no plan)'];
  const when = (ms: number | null | undefined) =>
    ms == null ? 'not set' : new Intl.DateTimeFormat('en-GB', { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(ms);
  const prizes = plan.rounds.reduce((sum, r) => sum + r.line.length + r.bingo.length, 0);
  const throws = plan.schedule.throws?.map((t) => `after round ${t.afterRound}, ${t.minutes} min`).join('; ') ?? 'none';
  return [
    `"${plan.title}", edition ${plan.edition}, prizes revealed ${plan.prizeReveal}`,
    `${plan.rounds.length} round(s): ${plan.rounds.map((r) => `${r.number} ${r.kind} ${roundCardType(r)}/${roundSide(r)}`).join(', ')}`,
    `${prizes} prize(s), ${plan.sponsors.length} sponsor(s)`,
    `doors ${when(plan.schedule.doorsAtMs)}, start ${when(plan.schedule.startAtMs)}, throws: ${throws}`,
  ];
}
