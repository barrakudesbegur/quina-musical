// The phone's drum is the projector's (D237; §8 Y1, the user's second production test; D277: the target public from the
// Spin's start). On the real engine, Spin after
// Spin: the phone's tiles and start tile (apps/player/logic/drum.ts, from public fields only) equal the projector's drum
// as main.ts and wheel/drum.ts build it from the engine's effects; the phone's solved Spin for the landed tile is the
// projector's very trajectory (the same solveSpin call with the public spinSeed); and before the landing is public the
// phone shows nothing the projector doesn't: the same songs, never at rest, nothing selected.
import test from 'node:test';
import assert from 'node:assert/strict';
import { drumRandom, type PublicLanding, type PublicSpin } from '@quina/protocol';
import { dataTest } from './support/data.ts';
import { setup } from './support/harness.ts';
import { FLOW } from '../engine/src/config.ts';
import { seededRandom } from '../engine/src/rng.ts';
import type { Effect } from '../engine/src/show/show.ts';
import { solveSpin, positionAt } from '../engine/src/wheel/solver.ts';
import { DRUM, PhoneDrum, roundOrder, roundSongs, spinSolution, spinStart } from '../../player/logic/drum.ts';
import { parseCards } from '../../../packages/ui/data/catalog.ts';

type EffectOf<T extends Effect['type']> = Extract<Effect, { type: T }>;

/** The projector's drum (wheel/drum.ts) as its card list and rest: drumReset's setCards, and a Spin's settle and removeCard. */
class ProjectorDrum {
  cards: number[] = [];
  rest = 0;
  reset(e: EffectOf<'drumReset'>): void {
    this.cards = [...e.ids];
    this.rest = Math.max(0, e.selectId == null ? 0 : this.cards.indexOf(e.selectId));
  }
  get currentIndex(): number {
    const n = this.cards.length;
    return n ? ((Math.round(this.rest) % n) + n) % n : 0;
  }
  /** removeCard, verbatim in effect. */
  remove(id: number): void {
    const index = this.cards.indexOf(id);
    if (index < 0) return;
    const n = this.cards.length;
    const local = ((Math.round(this.rest) % n) + n) % n;
    this.cards.splice(index, 1);
    const m = this.cards.length;
    this.rest = m ? (index < local ? local - 1 : local) % m : 0;
  }
}

test("drumRandom is the engine's seededRandom: the shared solver draws the same seeds", () => {
  for (const seed of [0, 1, 42, 2 ** 31, 4_294_967_295]) {
    const a = drumRandom(seed);
    const b = seededRandom(seed);
    for (let i = 0; i < 50; i++) assert.equal(a(), b());
  }
});

test("roundSongs: the songs printed on that side of the round's card type", () => {
  const catalog = parseCards([
    { id: 1, type: 'normal', sides: [{ side: 1, lines: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]] }, { side: 2, lines: [[21, 22, 23, 24], [25, 26, 27, 28], [29, 30, 31, 32]] }] },
    { id: 2, type: 'normal', sides: [{ side: 1, lines: [[12, 13, 14, 15], [1, 2, 3, 4], [5, 6, 7, 8]] }] },
    { id: 3, type: 'especial', sides: [{ side: 1, lines: [[40, 41, 42, 43], [44, 45, 46, 47], [48, 49, 50, 51]] }] },
  ]);
  assert.deepEqual(roundSongs(catalog, 'normal', 1), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  assert.deepEqual(roundSongs(catalog, 'normal', 2), [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]);
  assert.deepEqual(roundSongs(catalog, 'especial', 2), []);
  assert.deepEqual(roundSongs(null, 'normal', 1), []);
});

dataTest("Spin after Spin, the phone's drum is the projector's: the same tiles, start tile, landed tile and trajectory, and nothing before the landing", () => {
  for (const seed of [3, 11]) {
    const h = setup({ seed, settings: { autoAdvance: false } });
    h.send('unlock');
    h.send('roundIntro');
    h.send('newRound');
    h.advance(FLOW.shuffleSec + 0.1);
    const started = h.log.flatMap((e) => (e.type === 'journal' && e.entry.kind === 'round.started' ? [e.entry] : [])).at(-1);
    assert.ok(started?.kind === 'round.started' && started.drumSeed != null);
    // The phone knows the round's songs (its pool, printed on the cards: here the Queue's songs, sorted) and the seed.
    const order = roundOrder([...started.queue].sort((a, b) => a - b), started.drumSeed, started.round);
    const projector = new ProjectorDrum();
    for (const e of h.log) if (e.type === 'drumReset') projector.reset(e);
    assert.deepEqual(order, projector.cards, 'the round starts with the same drum');
    const landings: PublicLanding[] = [];
    for (let spinNo = 0; spinNo < 6; spinNo++) {
      const out = h.send('next');
      const start = out.find((e): e is EffectOf<'startTransition'> => e.type === 'startTransition');
      const scheduled = out.flatMap((e) => (e.type === 'emit' && e.message.type === 'transition.scheduled' ? [e.message] : []))[0];
      assert.ok(start && scheduled, `spin ${spinNo}`);
      // The projector (main.ts startTransition): settle, removeCard, then solveSpin with the public seed.
      if (spinNo > 0) projector.rest = projector.cards.indexOf(landings.at(-1)!.songId);
      if (start.drum.removeId != null) projector.remove(start.drum.removeId);
      const fromIndex = projector.currentIndex;
      const targetIndex = projector.cards.indexOf(start.drum.targetId);
      const projectorSpin = solveSpin({
        cardCount: projector.cards.length, fromIndex, targetIndex, durationSec: start.plan.D, isCalm: false,
        minLaps: projector.cards.length < 3 ? 0 : start.drum.minLaps, random: seededRandom(start.drum.seed),
      });
      // The phone, from public fields only.
      const phone = spinStart(order, landings);
      assert.deepEqual(phone.ring, projector.cards, `spin ${spinNo}: the same tiles, in the same order`);
      assert.equal(phone.fromIndex, fromIndex, `spin ${spinNo}: the same start tile`);
      // D277: the Spin's landing song is public from its start (the cloud and project.ts copy drum.targetId).
      const spin: PublicSpin = { startAtMs: scheduled.spinStartAtMs, landAtMs: scheduled.landAtMs, spinSeed: scheduled.spinSeed, targetId: scheduled.drum.targetId };
      const durationSec = (scheduled.landAtMs - scheduled.spinStartAtMs) / 1000;
      // The phone's solved Spin for the public target's tile is the projector's trajectory.
      const exact = spinSolution({ cardCount: phone.ring.length, fromIndex: phone.fromIndex, durationSec, spinSeed: scheduled.spinSeed, targetIndex: phone.ring.indexOf(scheduled.drum.targetId) });
      assert.equal(exact.seed, projectorSpin.seed, 'the same physics seed');
      assert.equal(exact.traveled, projectorSpin.traveled, 'the same travel');
      assert.equal(exact.method, projectorSpin.method);
      for (let t = 0; t <= durationSec + 0.5; t += 0.05) {
        assert.ok(Math.abs(positionAt(exact, t) - positionAt(projectorSpin, t)) < 1e-3, `spin ${spinNo}: the same keyframe at ${t.toFixed(2)} s`);
      }
      // The phone's drum, frame by frame, with the target: the projector's position up to the landing, nothing
      // selected, the words' phase still turning; at landAtMs on the target's tile.
      const exactDrum = new PhoneDrum();
      exactDrum.frame({ order, landings, spin: null, nowMs: spin.startAtMs - 1000, reduced: false });
      let g = exactDrum.frame({ order, landings, spin, nowMs: spin.startAtMs, reduced: false });
      for (let ms = spin.startAtMs; ms <= scheduled.landAtMs + 100; ms += 20) {
        g = exactDrum.frame({ order, landings, spin, nowMs: ms, reduced: false });
        const t = (ms - spin.startAtMs) / 1000;
        assert.ok(Math.abs(g.position - positionAt(projectorSpin, t)) < 1e-3, `spin ${spinNo}: the projector's position at ${t.toFixed(2)} s (${g.position} vs ${positionAt(projectorSpin, t)})`);
        assert.equal(g.selectedId, null, 'nothing selected before the landing is public');
        assert.equal(g.phase, 'spinning');
      }
      const n = g.ring.length;
      assert.equal(g.ring[((Math.round(g.position) % n) + n) % n], scheduled.drum.targetId, 'on the target at landAtMs');
      // The landing goes public 100 ms after landAtMs: the drum rests there at once (no glide), selected.
      const landedTarget: PublicLanding[] = [...landings, { position: scheduled.position, songId: scheduled.drum.targetId, atMs: scheduled.landAtMs }];
      const before = g.position;
      g = exactDrum.frame({ order, landings: landedTarget, spin: null, nowMs: scheduled.landAtMs + 120, reduced: false });
      assert.equal(g.phase, 'landed');
      assert.equal(g.selectedId, scheduled.drum.targetId);
      assert.ok(Math.abs(g.position - before) < 0.05, 'it settles where it is: no jump');
      // Without a target (an older feed, a Spin turned Suspense): the stand-in by the public seed alone, the
      // projector's songs, nothing selected, never at rest, blurred at least the veil.
      const { targetId: _target, ...noTarget } = spin;
      const drum = new PhoneDrum();
      drum.frame({ order, landings, spin: null, nowMs: spin.startAtMs - 1000, reduced: false });
      for (let ms = spin.startAtMs; ms <= scheduled.landAtMs + 3000; ms += 40) {
        const f = drum.frame({ order, landings, spin: noTarget, nowMs: ms, reduced: false });
        assert.deepEqual(f.ring, projector.cards);
        assert.equal(f.selectedId, null, 'nothing selected before the landing is public');
        assert.ok(f.phase === 'spinning' || f.phase === 'waiting');
        assert.ok(ms < spin.startAtMs + 1000 || Math.abs(f.velocity) >= DRUM.creepFloor - 1e-9, 'never at rest once under way');
        assert.ok(f.blurPx >= DRUM.veilPx);
      }
      // The landing arrives (300 ms late): the phone glides to the landed tile and rests on it, selected.
      h.until(() => h.show.status === 'playing');
      const landed = h.show.landings.at(-1)!;
      landings.push({ position: landed.position, songId: landed.songId, atMs: landed.atMs });
      const seenAt = scheduled.landAtMs + 3300;
      let f = drum.frame({ order, landings, spin: noTarget, nowMs: seenAt, reduced: false });
      assert.equal(f.phase, 'gliding');
      let prev = f.position;
      for (let ms = seenAt; ms <= seenAt + 1600; ms += 16) {
        f = drum.frame({ order, landings, spin: null, nowMs: ms, reduced: false });
        assert.ok(Math.abs(f.position - prev) < 1.5, 'no jump: at most a tile and a half per frame');
        prev = f.position;
      }
      assert.equal(f.phase, 'landed');
      assert.ok(Number.isInteger(f.position) && f.velocity === 0, 'at rest on a whole tile');
      assert.equal(f.ring[((f.position % f.ring.length) + f.ring.length) % f.ring.length], start.drum.targetId, `spin ${spinNo}: at rest on the landed tile`);
      assert.equal(f.selectedId, start.drum.targetId);
    }
  }
});
