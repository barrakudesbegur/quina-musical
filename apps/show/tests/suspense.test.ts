// Suspense: the presenters hold a transition open. The loop on B's grid is bar-exact and builds; a release
// lands B's hook on the first free bar line; the show schedules the bars ahead, releases by itself after
// SUSPENSE.autoReleaseSec, and Back or Hold cancel it like a Spin. The drum coasts and brakes onto the card.
import { dataTest as test } from './support/data.ts';
import assert from 'node:assert/strict';
import { barSpan, openSuspense, suspenseBar, suspenseIntensity, suspenseTease, releaseSuspense, type SuspenseOpen } from '../engine/src/plan/suspense.ts';
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

test('over A\'s loop: A keeps playing and repeats the 4-bar phrase it is in; every bar of the build sits on A\'s downbeats, builds up and thins A out', () => {
  const rng = seededRandom(11);
  let loops = 0;
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
    const loop = open.loop;
    assert.ok(loop, 'a song with phrases to count loops');
    loops++;
    assert.equal(open.a, null, 'A does not leave');
    assert.equal((loop.phrase.fromIndex - aHook.downbeatIndex) % SUSPENSE.loopBars, 0, 'a phrase counted from the landed hook');
    assert.ok(open.loopStart >= open.spinStart + PLANNER.afterDuckSec - 1e-9, 'the build starts after the duck');
    const tl = deckTimeline(A, deck, aHook.downbeatIndex);
    assert.ok(Math.abs(tl.ctxAt(A.downbeats[loop.phrase.fromIndex + loop.firstBar]) - open.loopStart) < 1e-9, 'on A\'s first downbeat after the duck');
    for (const e of open.events) assert.ok(eventStart(e) >= open.spinStart - 1e-9);
    for (let k = 0; k < 20; k++) {
      const { t0, t1, pass, j } = barSpan(open, k);
      // On A's downbeat j of its phrase, in pass `pass` (each pass one phrase later on the clock).
      const expected: number = tl.ctxAt(A.downbeats[loop.phrase.fromIndex + j]) + pass * loop.passSec;
      assert.ok(Math.abs(t0 - expected) < 1e-9, `bar ${k} on A's downbeat`);
      const events = suspenseBar(open, k);
      for (const e of events) assert.ok(eventStart(e) >= t0 - 1e-9 && eventEnd(e) <= t1 + 1e-9, `bar ${k}: ${e.kind} outside its bar`);
      assert.ok(events.some((e) => e.kind === 'ramp' && e.target === 'A.hpf'), 'A thins out');
      if (k > 0) assert.ok(suspenseIntensity(open, k) >= suspenseIntensity(open, k - 1));
    }
  }
  assert.equal(loops, 300);
});

test('without phrases to count, A exits on its downbeat after the duck and the build runs on B\'s grid', () => {
  const rng = seededRandom(12);
  for (let n = 0; n < 200; n++) {
    const aId = ids[Math.floor(rng() * ids.length)];
    let bId = ids[Math.floor(rng() * ids.length)];
    if (bId === aId) bId = ids[(ids.indexOf(aId) + 1) % ids.length];
    const A = analysisOf(aId);
    const aHook = usableHooks(A)[0];
    const deck = { startCtx: 100, offset: aHook.downbeatSec, rate: 1 };
    const now = 100 + 2 + rng() * 20;
    const phase = [PHASES.early, PHASES.mid, PHASES.late, PHASES.final][n % 4];
    const open = opened(openSuspense({ now, phase, rng, A: { songId: aId, analysis: A, deck, landedDownbeatIndex: null }, B: { songId: bId, analysis: analysisOf(bId) } }));
    assert.equal(open.loop, null);
    assert.ok(open.loopStart >= open.spinStart + PLANNER.afterDuckSec - 1e-9);
    if (open.exitIndex != null) {
      const tl = deckTimeline(A, deck);
      assert.ok(Math.abs(tl.ctxAt(A.downbeats[open.exitIndex]) - open.loopStart) < 1e-9, 'the loop starts on A\'s exit downbeat');
      assert.ok(open.a && open.a.exitStart >= open.spinStart + PLANNER.afterDuckSec - 1e-9, 'the exit move starts after the duck');
    }
    for (let k = 0; k < 20; k++) {
      const t0 = open.loopStart + k * open.bar;
      for (const e of suspenseBar(open, k)) {
        assert.ok(eventStart(e) >= t0 - 1e-9 && eventEnd(e) <= t0 + open.bar + 1e-9, `bar ${k}: ${e.kind} outside its bar`);
      }
    }
    assert.equal(suspenseIntensity(open, Math.ceil(SUSPENSE.rampSec / open.bar)), 1);
  }
});

test('over A\'s loop a release lands B at the end of a pass, on A\'s phrase boundary, after A\'s exit in the last bar; teases fit before it', () => {
  const rng = seededRandom(13);
  let teases = 0;
  for (let n = 0; n < 300; n++) {
    const aId = ids[Math.floor(rng() * ids.length)];
    let bId = ids[Math.floor(rng() * ids.length)];
    if (bId === aId) bId = ids[(ids.indexOf(aId) + 1) % ids.length];
    const A = analysisOf(aId);
    const aHook = usableHooks(A)[0];
    const deck = { startCtx: 100, offset: aHook.downbeatSec, rate: 1 };
    const B = { songId: bId, analysis: analysisOf(bId) };
    const open = opened(openSuspense({ now: 102, phase: PHASES.late, rng, A: { songId: aId, analysis: A, deck, landedDownbeatIndex: aHook.downbeatIndex }, B }));
    const loop = open.loop;
    assert.ok(loop);
    const releaseAt = open.loopStart + rng() * 3 * loop.passSec;
    let firstFreeBar = 0;
    while (barSpan(open, firstFreeBar).t0 - SUSPENSE.scheduleAheadSec <= releaseAt) firstFreeBar++;
    const plan: Plan = releaseSuspense({ open, releaseAt, firstFreeBar, B, rng });
    // T ends a pass: the phrase's end downbeat on that pass's clock.
    const passes = (plan.T - loop.firstPassAt) / loop.passSec;
    assert.ok(Math.abs(passes - Math.round(passes)) < 1e-9, 'T ends a pass of the phrase');
    assert.equal(plan.landIndex, loop.phrase.fromIndex + loop.phrase.bars);
    assert.notEqual(plan.phraseClass, 'bar', 'B lands on A\'s phrase boundary');
    // Nothing of the release sounds in a bar already scheduled, or before there is time to schedule it.
    const freeFrom = Math.max(releaseAt + SUSPENSE.minReleaseLeadSec, barSpan(open, firstFreeBar).t0);
    for (const e of plan.events) assert.ok(eventStart(e) >= freeFrom - 1e-9, `${e.kind} ${'target' in e ? e.target : ''} in a scheduled bar`);
    assert.ok(plan.b.startCtx >= freeFrom - 1e-9);
    assert.ok(plan.a && plan.a.songId === aId && plan.a.exitStart >= freeFrom - 1e-9 && plan.a.stopAt <= plan.T + 1e-9, 'A leaves before B lands');
    assert.ok(plan.exit && (SUSPENSE.exits as readonly string[]).includes(plan.exit));
    assert.ok(Math.abs(plan.b.startCtx + plan.b.lead - plan.T) < 1e-9, 'B\'s hook downbeat at T');
    // The first such pass: the one before would not have had the room.
    assert.ok(plan.T - loop.passSec < freeFrom + loop.passSec, 'it lands on the first pass that fits');
    // A tease of a hovered song in each pass's second bar, cut before the pass's last bar.
    for (let k = 1; k < 9; k++) {
      const tease = suspenseTease(open, k, { songId: bId, analysis: B.analysis, hook: usableHooks(B.analysis)[0] });
      const { t0, j, pass } = barSpan(open, k);
      if (j !== 1) {
        assert.equal(tease, null);
        continue;
      }
      if (!tease) continue;
      teases++;
      const decoy = tease.events.find((e) => e.kind === 'decoy');
      assert.ok(decoy && decoy.kind === 'decoy' && decoy.at >= t0 && decoy.lpfHz === SUSPENSE.teaseLpfHz);
      const lastBar: number = loop.firstPassAt + pass * loop.passSec + loop.marks[loop.phrase.bars - 1];
      assert.ok(decoy.cutAt + decoy.cutSec <= lastBar + 1e-9, 'cut before the phrase\'s last bar');
    }
  }
  assert.ok(teases > 200, `${teases} teases`);
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

test('the drum spins to a random card unrelated to the target, wanders around it, then brakes onto the target exactly at the landing', () => {
  const rng = seededRandom(9);
  for (const cards of [4, 12, 40, 77]) {
    for (let k = 0; k < 5; k++) {
      const stopIndex = Math.floor(rng() * cards);
      const amp1 = Math.min(3, cards / 3);
      const amp2 = Math.min(1.5, cards / 6);
      const coast = coastSpin({ cardCount: cards, fromIndex: 3, stopIndex, durationSec: 45, spinUpSec: 3, minLaps: 1, amp1, period1: 7.6, amp2, period2: 20.9, phase2: rng() * 6.28 });
      const stop = positionAt(coast, 3);
      assert.equal(((Math.round(stop) % cards) + cards) % cards, stopIndex, 'the spin-up stops on the chosen card');
      assert.ok(stop - 3 >= cards - 1e-6, 'after at least a lap');
      // Continuous by construction (the spin-up ends at the wander's speed); the replay samples every 4 ms while
      // the spin-up still brakes hard, hence the tolerance.
      assert.ok(Math.abs(velocityAt(coast, 2.999) - velocityAt(coast, 3.001)) < 1, 'the speed is continuous into the wander');
      for (let t = 3; t <= 45; t += 0.05) {
        assert.ok(Math.abs(positionAt(coast, t) - stop) <= amp1 + 2 * amp2 + 1e-6, 'it wanders around the stop card');
      }
    }
  }
  for (let n = 0; n < 500; n++) {
    const cards = 5 + Math.floor(rng() * 70);
    const from = rng() * cards;
    const velocity = (rng() - 0.5) * 5; // caught mid-wander, either way
    const targetIndex = Math.floor(rng() * cards); // anywhere: the wander has nothing to do with it
    const D = 1.3 + rng() * 3;
    const s = landingBrake({ cardCount: cards, fromPosition: from, velocity, targetIndex, durationSec: D });
    const rest = from + s.traveled;
    assert.ok(Math.abs(positionAt(s, D) - rest) < 0.05, 'the replay reaches it at the landing');
    assert.ok(Math.abs(rest - Math.round(rest)) < 1e-4, 'rests on a card');
    assert.equal(((Math.round(rest) % cards) + cards) % cards, targetIndex, 'on the target card');
    assert.ok(Math.abs(velocityAt(s, 1e-4) - velocity) < 1e-2, 'the speed is continuous');
    // It turns round at most once (a backward wander), then only moves forward into the card.
    let turns = 0;
    let sign = Math.sign(velocityAt(s, 1e-4));
    for (let t = 1e-4; t < D - 0.01; t += D / 200) {
      const v = velocityAt(s, t);
      if (Math.abs(v) > 1e-3 && Math.sign(v) !== sign) {
        turns++;
        sign = Math.sign(v);
      }
    }
    assert.ok(turns <= 1, `turned ${turns} times`);
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
  // A keeps playing and repeats its phrase; the drum hovers over a few pending songs, the next one among them.
  const aId = h.show.queue[position];
  assert.ok(s.open.loop && s.open.loop.songId === aId);
  assert.equal(h.show.current?.songId, aId, 'A is still the playing song');
  assert.ok(s.hover.length >= 2 && s.hover.length <= SUSPENSE.hoverSongs && s.hover.includes(s.songId));
  const pending = new Set(h.show.queue.slice(position + 1));
  assert.ok(s.hover.every((id) => pending.has(id)), 'only songs still to play');
  h.advance(2.2 * s.open.loop.passSec);
  const bars = h.log.filter((e) => e.type === 'suspenseBar');
  assert.ok(bars.length >= 2, 'the build is running');
  for (const e of bars) if (e.type === 'suspenseBar') assert.ok(barSpan(s.open, e.bar).t0 - SUSPENSE.scheduleAheadSec <= h.clock.t + 1e-9);
  assert.ok(barSpan(s.open, s.nextBar).t0 > h.clock.t, 'not scheduled far ahead');
  assert.ok(h.log.some((e) => e.type === 'cue' && e.songId === aId), 'A\'s phrase repeats');
  const hovers = h.log.filter((e) => e.type === 'suspenseHover');
  assert.ok(hovers.length >= 1 && hovers.every((e) => e.type === 'suspenseHover' && s.hover.includes(e.cardId)), 'the drum hovers over the teased songs');
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
