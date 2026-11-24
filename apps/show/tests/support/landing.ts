// The landing invariants every plan keeps, whatever its recipe (shared by tests/recipes.test.ts, which forces each
// technique, and tests/variety.test.ts, which checks every transition of whole simulated nights).
import assert from 'node:assert/strict';
import { eventStart } from '../../engine/src/plan/planner.ts';
import { deckTimeline } from '../../engine/src/plan/timeline.ts';
import { MOVES, STEMS } from '../../engine/src/config.ts';
import type { LaneCoverage, OutgoingSong, Plan } from '../../engine/src/plan/planner.ts';
import type { PlanEvent, RampEvent, SetEvent, StemLaneEvent } from '../../engine/src/plan/recipes.ts';

const targetOf = (e: PlanEvent): string => ('target' in e ? e.target : '');

/** The value an A or bus param holds at `t`, applying set and ramp events in start order (as the scheduler does). */
export function valueAt(events: readonly PlanEvent[], target: string, t: number, initial = 1): number {
  let value = initial;
  const own = events.filter((e): e is SetEvent | RampEvent => (e.kind === 'set' || e.kind === 'ramp') && e.target === target);
  own.sort((x, y) => eventStart(x) - eventStart(y));
  for (const e of own) {
    if (eventStart(e) > t) break;
    if (e.kind === 'set') value = e.value;
    else if (t >= e.t1) value = e.to;
    else {
      const u = (t - e.t0) / (e.t1 - e.t0);
      value = e.curve === 'exp' ? e.from * (e.to / e.from) ** u : e.from + (e.to - e.from) * u;
    }
  }
  return value;
}

/** The gap's start: A is silent (or the build over) from here to B's pickup. */
export const gapStartOf = (plan: Plan): number => plan.T - plan.hook.pickupSec - plan.gapBeats * plan.hook.beat;
export const pickupOf = (plan: Plan): number => plan.T - plan.hook.pickupSec;

/**
 * B's hook downbeat exactly at T (a tape start lands on the plan's clock too), nothing before the Spin, an audible
 * produced effect, A silent after its exit and never re-opening, and A's lanes inside its decoded stems.
 * @param A  the outgoing song as the planner saw it (its deck, landed hook and lanes), or null
 */
export function checkLanding(plan: Plan, A: OutgoingSong | null): void {
  const what = `${plan.recipe}${plan.variant ? `/${plan.variant.kind}` : ''} ${plan.phase}`;
  assert.ok(Math.abs(plan.b.startCtx + (plan.hook.downbeatSec - plan.b.offset) - plan.T) < 1e-9, `${what}: hook not at T`);
  assert.ok(plan.b.startCtx >= plan.spinStart && plan.b.offset >= 0);
  if (plan.landing === 'tape') {
    // P5: B powers up inside the silent gap, its rate reaching full speed on the pickup.
    const up = plan.b.powerUp;
    assert.ok(up && Math.abs(up.until - pickupOf(plan)) < 1e-9 && up.from === MOVES.tape.fromRate, `${what}: tape start`);
    assert.ok(plan.b.startCtx >= gapStartOf(plan) - 1e-9 && pickupOf(plan) - plan.b.startCtx >= MOVES.tape.minSec - 1e-9, `${what}: tape start outside the gap`);
    assert.notEqual(plan.teaseStyle, 'lpf', `${what}: a tape start after B itself was heard`);
    assert.notEqual(plan.shape, 'S3');
  } else assert.ok(!plan.b.powerUp, `${what}: a power-up without the tape landing`);
  // Nothing starts before the Spin.
  for (const e of plan.events) assert.ok(eventStart(e) >= plan.spinStart - 0.03 - 1e-9, `${what}: ${e.kind} ${targetOf(e)} before the Spin`);
  // An audible produced effect: an impact, and at least two moves that are not just gain.
  assert.ok(plan.events.some((e) => e.kind === 'synth' && e.name === 'impact'), `${what}: no impact`);
  assert.ok(plan.events.filter((e) => e.kind !== 'sfx' && !targetOf(e).endsWith('.gain')).length >= 2, `${what}: no effects`);
  if (!plan.a || !A) return;
  // A is silent from the end of its move (the gap, or the bridge's start) and stays silent.
  const silentAt = (plan.shape === 'S2' ? plan.exitAt : gapStartOf(plan)) + 0.03;
  assert.ok(valueAt(plan.events, 'A.gain', silentAt) <= 0.001, `${what}: A not silent after its exit (${valueAt(plan.events, 'A.gain', silentAt)})`);
  for (const e of plan.events) {
    if (targetOf(e) !== 'A.gain' || eventStart(e) <= silentAt) continue;
    assert.ok((e.kind === 'set' ? e.value : e.kind === 'ramp' ? Math.max(e.from, e.to) : 0) <= 0.001, `${what}: A re-opens after its exit`);
  }
  // A's lanes play only inside its decoded stems (less the margin), at rate 1, and stop with A.
  const tl = deckTimeline(A.analysis, A.deck, A.landedDownbeatIndex);
  const lanes: LaneCoverage | null | undefined = A.lanes;
  const rate = A.deck.rate ?? 1;
  for (const e of plan.events.filter((x): x is StemLaneEvent => x.kind === 'stemLane' && x.deck === 'A')) {
    assert.equal(rate, 1, `${what}: a lane on a resampled deck`);
    assert.ok(lanes, `${what}: a lane without A's stems`);
    assert.ok(tl.posAt(e.at) >= lanes.fromSec + STEMS.laneMarginSec - 1e-6 && tl.posAt(e.until) <= lanes.toSec - STEMS.laneMarginSec + 1e-6, `${what}: lane ${e.part} outside A's stems`);
    assert.ok(e.until <= plan.a.stopAt + 1e-9, `${what}: lane ${e.part} outlives A`);
  }
}
