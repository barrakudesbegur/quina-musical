// Suspense: the presenters hold a transition open. The loop on B's grid is bar-exact and builds; a release
// lands B's hook on the first free bar line; the show schedules the bars ahead, releases by itself after
// SUSPENSE.autoReleaseSec, and Back or Hold cancel it like a Spin. The drum coasts and brakes onto the card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openSuspense, suspenseBar, suspenseIntensity, releaseSuspense, type SuspenseOpen } from '../engine/src/plan/suspense.ts';
import { eventStart, type Plan } from '../engine/src/plan/planner.ts';
import { PHASES } from '../engine/src/plan/phases.ts';
import { usableHooks } from '../engine/src/plan/hooks.ts';
import { deckTimeline } from '../engine/src/plan/timeline.ts';
import { coastSpin, landingBrake, positionAt, velocityAt } from '../engine/src/wheel/solver.ts';
import { PLANNER, SUSPENSE } from '../engine/src/config.ts';
import { seededRandom } from '../engine/src/rng.ts';
import type { PlanEvent } from '../engine/src/plan/recipes.ts';
import { setup, analyses } from './support/harness.ts';

const ids = [...analyses.keys()];
const analysisOf = (id: number) => {
  const a = analyses.get(id);
  assert.ok(a, `no analysis for ${id}`);
  return a;
};
/** When an event stops sounding (or its last scheduled moment). */
function eventEnd(e: PlanEvent): number {
  switch (e.kind) {
    case 'ramp':
      return e.t1;
    case 'synth': {
      const p = e.params;
      return 't1' in p ? p.t1 : 'at' in p ? p.at : Math.max(...p.times);
    }
    default:
      return eventStart(e);
  }
}
const opened = (x: SuspenseOpen | { error: string }): SuspenseOpen => {
  assert.ok(!('error' in x), 'error' in x ? x.error : '');
  return x;
};

test('the loop: A exits on its downbeat after the duck, every bar stays inside its bar line and builds up', () => {
  const rng = seededRandom(11);
  for (let n = 0; n < 300; n++) {
    const aId = ids[Math.floor(rng() * ids.length)];
    let bId = ids[Math.floor(rng() * ids.length)];
    if (bId === aId) bId = ids[(ids.indexOf(aId) + 1) % ids.length];
    const A = analysisOf(aId);
    const aHook = usableHooks(A)[0];
    const deck = { startCtx: 100, offset: aHook.downbeatSec, rate: 1 };
    const now = 100 + 2 + rng() * 20;
    const phase = [PHASES.early, PHASES.mid, PHASES.late, PHASES.final][n % 4];
    const open = opened(openSuspense({ now, phase, rng, A: { songId: aId, analysis: A, deck, landedDownbeatIndex: aHook.downbeatIndex }, B: { songId: bId, analysis: analysisOf(bId) } }));
    assert.ok(open.loopStart >= open.spinStart + PLANNER.afterDuckSec - 1e-9);
    if (open.exitIndex != null) {
      const tl = deckTimeline(A, deck, aHook.downbeatIndex);
      assert.ok(Math.abs(tl.ctxAt(A.downbeats[open.exitIndex]) - open.loopStart) < 1e-9, 'the loop starts on A\'s exit downbeat');
      assert.ok(open.a && open.a.exitStart >= open.spinStart + PLANNER.afterDuckSec - 1e-9, 'the exit move starts after the duck');
    }
    for (const e of open.events) assert.ok(eventStart(e) >= open.spinStart - 1e-9);
    for (let k = 0; k < 20; k++) {
      const t0 = open.loopStart + k * open.bar;
      for (const e of suspenseBar(open, k)) {
        assert.ok(eventStart(e) >= t0 - 1e-9 && eventEnd(e) <= t0 + open.bar + 1e-9, `bar ${k}: ${e.kind} outside its bar`);
      }
      if (k > 0) assert.ok(suspenseIntensity(open, k) >= suspenseIntensity(open, k - 1));
    }
    assert.equal(suspenseIntensity(open, Math.ceil(SUSPENSE.rampSec / open.bar)), 1);
  }
});

test('a release lands B\'s hook on the first free bar line, with the final bar\'s build and silence before it', () => {
  const rng = seededRandom(5);
  for (let n = 0; n < 300; n++) {
    const bId = ids[Math.floor(rng() * ids.length)];
    const B = { songId: bId, analysis: analysisOf(bId) };
    const open = opened(openSuspense({ now: 50, phase: PHASES.late, rng, A: null, B }));
    const releaseAt = open.loopStart + rng() * 12 * open.bar;
    const firstFreeBar = Math.max(0, Math.ceil((releaseAt + SUSPENSE.scheduleAheadSec - open.loopStart) / open.bar));
    const plan: Plan = releaseSuspense({ open, releaseAt, firstFreeBar, B, rng });
    const bars = (plan.T - open.loopStart) / open.bar;
    assert.ok(Math.abs(bars - Math.round(bars)) < 1e-9, 'T is on a bar line of the loop');
    const finalBar = plan.T - open.bar;
    assert.ok(finalBar >= open.loopStart + firstFreeBar * open.bar - 1e-9, 'the final bar was not already scheduled as a loop bar');
    assert.ok(finalBar >= releaseAt + SUSPENSE.minReleaseLeadSec - 1e-9, 'there is time to schedule it');
    assert.ok(plan.b.startCtx >= releaseAt + SUSPENSE.minReleaseLeadSec - 1e-9, 'B starts after the release, even with a long pickup');
    const latest = Math.max(releaseAt + SUSPENSE.scheduleAheadSec, releaseAt + SUSPENSE.minReleaseLeadSec + plan.b.lead - open.bar) + open.bar;
    assert.ok(finalBar < latest + 1e-9, 'it lands on the next free bar line');
    assert.equal(plan.recipe, 'SUSPENSE');
    assert.ok(Math.abs(plan.b.startCtx + plan.b.lead - plan.T) < 1e-9 && Math.abs(plan.b.offset + plan.b.lead - plan.hook.downbeatSec) < 1e-9, 'B\'s hook downbeat at T');
    assert.ok(plan.events.some((e) => e.kind === 'synth' && e.name === 'impact'), 'an impact on the landing');
    // Only B's own pickup may start before the final bar (a long one plays over the end of the loop).
    for (const e of plan.events) assert.ok(eventStart(e) >= Math.min(finalBar, plan.b.startCtx) - 1e-9, `${e.kind} before the final bar`);
  }
});

test('the drum coasts with near-stops, then brakes onto the card exactly at the landing without turning back', () => {
  for (const cards of [4, 12, 40, 77]) {
    const coast = coastSpin({ cardCount: cards, fromIndex: 3, targetIndex: 1, durationSec: 45, spinUpSec: 3, gap: 9, minLaps: 1, minSpeed: 0.03, maxSpeed: 0.45, periodSec: 3.6 });
    // Where the target comes round after the spin-up: the spin-up stops `ahead` cards before it.
    const ahead = Math.min(9, cards - 1);
    const spinUpEnd = 3 + ((((1 - ahead - 3) % cards) + cards) % cards) + cards;
    const target = spinUpEnd + ahead;
    let previous = 3;
    for (let t = 0.001; t <= 45; t += 0.02) {
      const p = positionAt(coast, t);
      assert.ok(p >= previous - 1e-6, 'never turns back');
      previous = p;
      if (t > 3) assert.ok(velocityAt(coast, t) <= 0.45 + 1e-3, 'a crawl after the spin-up');
    }
    assert.ok(Math.abs(positionAt(coast, 3) - spinUpEnd) < 1e-3, 'the spin-up ends `ahead` cards before the target, after a lap');
    assert.ok(previous < target - 0.4, `${cards} cards: it never reaches the target while coasting`);
  }
  const rng = seededRandom(3);
  for (let n = 0; n < 500; n++) {
    const cards = 5 + Math.floor(rng() * 70);
    const from = rng() * cards;
    const velocity = rng() * 0.45;
    // After the coast's spin-up the target is at most SUSPENSE.coastGap cards ahead.
    const targetIndex = (Math.floor(from) + 1 + Math.floor(rng() * Math.min(SUSPENSE.coastGap, cards - 1))) % cards;
    const D = 1.3 + rng() * 3;
    const s = landingBrake({ cardCount: cards, fromPosition: from, velocity, targetIndex, durationSec: D });
    const rest = from + s.traveled;
    assert.ok(Math.abs(positionAt(s, D) - rest) < 0.05, 'the replay reaches it at the landing');
    assert.ok(Math.abs(rest - Math.round(rest)) < 1e-4, 'rests on a card');
    assert.equal(((Math.round(rest) % cards) + cards) % cards, targetIndex, 'on the target card');
    assert.ok(Math.abs(velocityAt(s, 1e-4) - velocity) < 1e-3, 'the speed is continuous');
    assert.ok(Math.abs(velocityAt(s, D - 1e-4)) < 0.2, 'at rest at the landing');
    for (let t = 1e-4; t <= D; t += D / 50) assert.ok(velocityAt(s, t) >= -1e-4, 'never turns back');
  }
});

test('the show: Suspense starts the next song\'s transition, schedules the loop ahead, and Next lands it on a bar line', () => {
  const h = setup({ seed: 4, settings: { autoAdvance: false } });
  h.send('unlock');
  h.send('next');
  h.until(() => h.show.status === 'playing');
  const position = h.show.position;
  const out = h.send('suspense');
  assert.ok(out.some((e) => e.type === 'startSuspense'));
  assert.equal(h.show.status, 'transition');
  const s = h.show.suspense;
  assert.ok(s);
  assert.equal(h.show.snapshot().suspense?.id, s.id);
  h.advance(6);
  const bars = h.log.filter((e) => e.type === 'suspenseBar');
  assert.ok(bars.length >= 2, 'the loop is running');
  for (const e of bars) if (e.type === 'suspenseBar') assert.ok(s.open.loopStart + e.bar * s.open.bar - SUSPENSE.scheduleAheadSec <= h.clock.t + 1e-9);
  assert.ok(s.open.loopStart + s.nextBar * s.open.bar > h.clock.t, 'not scheduled far ahead');
  const release = h.send('next');
  const start = release.find((e) => e.type === 'startTransition');
  assert.ok(start && start.type === 'startTransition' && start.drum.brake);
  assert.equal(start.plan.recipe, 'SUSPENSE');
  assert.equal(h.show.suspense, null);
  h.until(() => h.show.position === position + 1);
  assert.equal(h.show.status, 'playing');
  assert.equal(h.show.current?.songId, h.show.queue[position + 1]);
  assert.deepEqual(h.show.snapshot().landings.at(-1)?.songId, h.show.queue[position + 1]);
});

test('the show: it releases by itself after SUSPENSE.autoReleaseSec, and is never started automatically', () => {
  const h = setup({ seed: 9, settings: { autoAdvance: true } });
  h.send('unlock');
  h.send('next');
  h.until(() => h.show.status === 'playing');
  h.advance(120);
  assert.equal(h.log.filter((e) => e.type === 'startSuspense').length, 0, 'auto-advance never opens a Suspense');
  h.send('setGame', { autoAdvance: false });
  h.until(() => h.show.status === 'playing' || h.show.status === 'hold');
  const position = h.show.position;
  h.send('suspense', { on: true });
  const opened = h.clock.t;
  h.until(() => h.show.suspense === null, SUSPENSE.autoReleaseSec + 2);
  assert.ok(h.clock.t >= opened + SUSPENSE.autoReleaseSec - 0.03);
  h.until(() => h.show.position === position + 1);
  assert.deepEqual(h.show.snapshot().history.at(-1)?.recipe, 'SUSPENSE');
});

test('the show: Back during a Suspense cancels it like a Spin; suspense off without one is rejected', () => {
  const h = setup({ seed: 6, settings: { autoAdvance: false } });
  h.send('unlock');
  assert.deepEqual(h.send('suspense', { on: false }).filter((e) => e.type === 'reject').map((e) => e.type === 'reject' && e.reason), ['noSuspense']);
  h.send('next');
  h.until(() => h.show.status === 'playing');
  const position = h.show.position;
  h.send('suspense');
  h.advance(4);
  const out = h.send('back');
  assert.ok(out.some((e) => e.type === 'cancelTransition'));
  assert.equal(h.show.suspense, null);
  assert.equal(h.show.status, 'hold');
  assert.equal(h.show.position, position, 'nothing landed');
  const barsBefore = h.log.filter((e) => e.type === 'suspenseBar').length;
  h.advance(10);
  assert.equal(h.log.filter((e) => e.type === 'suspenseBar').length, barsBefore, 'the loop stopped');
  // A new Suspense from the Hold works too, and a second press while one is open does nothing.
  // (Read through a function: assert.equal above narrowed `h.show.suspense` to null for the compiler.)
  const open = () => h.show.suspense;
  h.send('suspense');
  const id = open()?.id;
  assert.ok(id);
  h.send('suspense', { on: true });
  assert.equal(open()?.id, id);
  assert.deepEqual(h.send('next').filter((e) => e.type === 'reject'), []);
  h.until(() => h.show.position === position + 1);
});
