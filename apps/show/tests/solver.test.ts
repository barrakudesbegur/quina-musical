import test from 'node:test';
import assert from 'node:assert/strict';
import { solveSpin, landedIndex, positionAt, tickTimes, SCALE_RANGE } from '../engine/src/wheel/solver.ts';
import { seededRandom } from '../engine/src/rng.ts';

const CASES = Number(process.env.SOLVER_CASES || 2000);

test(`${CASES} random spins land on the target at exactly D, with a plausible time scale`, () => {
  const random = seededRandom(20261123);
  const times: number[] = [];
  let analytic = 0;
  for (let i = 0; i < CASES; i++) {
    const cardCount = 10 + Math.floor(random() * 68);
    const fromIndex = Math.floor(random() * cardCount);
    const targetIndex = Math.floor(random() * cardCount);
    const durationSec = 5 + random() * 6;
    const isCalm = random() < 0.1;
    // CPU time, not the wall clock: on a laptop busy with other work a solve waits for the CPU, which says nothing
    // about the solver (27 Nov: a wall-clock p95 of 69–93 ms at a load average of 69).
    const t0 = process.cpuUsage();
    const s = solveSpin({ cardCount, fromIndex, targetIndex, durationSec, isCalm, random });
    const used = process.cpuUsage(t0);
    times.push((used.user + used.system) / 1000);
    assert.equal(landedIndex(s), targetIndex, `case ${i}`);
    if (s.method === 'analytic') {
      analytic++;
      continue;
    }
    assert.ok(Math.abs(s.scale * s.lockTime - durationSec) < 1e-6, `case ${i}: lock ${s.scale * s.lockTime} vs ${durationSec}`);
    assert.ok(s.scale >= SCALE_RANGE[0] && s.scale <= SCALE_RANGE[1], `case ${i}: scale ${s.scale}`);
    assert.ok(Math.abs(s.traveled) > cardCount, `case ${i}: traveled ${s.traveled} of ${cardCount}`);
    // At the lock moment the wheel is within the lock tolerance of the final card center.
    const atLock = positionAt(s, durationSec);
    assert.ok(Math.abs(atLock - (fromIndex + s.traveled)) < 0.06, `case ${i}: off-center at lock ${atLock}`);
    // No border crossing after the lock.
    const ticks = tickTimes(s);
    assert.ok(ticks[ticks.length - 1].t <= durationSec + 1e-9, `case ${i}: tick after lock`);
  }
  times.sort((a, b) => a - b);
  const p95 = times[Math.floor(times.length * 0.95)];
  assert.ok(analytic / CASES < 0.01, `analytic fallbacks ${analytic}/${CASES}`);
  assert.ok(p95 < 60, `p95 solve CPU time ${p95.toFixed(1)} ms`);
});

test('reverse (back) spins may travel less than a lap but still land', () => {
  const random = seededRandom(7);
  for (let i = 0; i < 200; i++) {
    const cardCount = 10 + Math.floor(random() * 68);
    const fromIndex = Math.floor(random() * cardCount);
    const targetIndex = Math.floor(random() * cardCount);
    const s = solveSpin({ cardCount, fromIndex, targetIndex, durationSec: 5 + random() * 2, minLaps: 0, random });
    assert.equal(landedIndex(s), targetIndex);
  }
});

test('the drawn spins are not all alike (direction and top speed vary)', () => {
  const random = seededRandom(3);
  const directions = new Set<number>();
  const speeds: number[] = [];
  for (let i = 0; i < 100; i++) {
    const s = solveSpin({ cardCount: 40, fromIndex: 0, targetIndex: i % 40, durationSec: 7, random });
    directions.add(s.direction);
    assert.ok(s.topSpeed != null, 'a solved spin has a top speed');
    speeds.push(s.topSpeed);
  }
  assert.equal(directions.size, 2);
  assert.ok(Math.max(...speeds) / Math.min(...speeds) > 1.5);
});

import { glideSpin, brakeSpin, brakeRest } from '../engine/src/wheel/solver.ts';

test('glide and brake motions end exactly on a card and start where the drum is', () => {
  const g = glideSpin({ cardCount: 40, fromIndex: 12, delta: -1, durationSec: 0.9 });
  assert.equal(positionAt(g, 0), 12);
  assert.equal(positionAt(g, 5), 11);
  assert.equal(tickTimes(g).length, 1);
  for (const [p, v] of [[10.37, 30], [10.37, -30], [3.9, 4], [7.2, 0.1], [50.5, 60], [-2.4, -12], [3, 0], [12, 0.2]]) {
    const rest = brakeRest(p, v);
    assert.ok(Number.isInteger(rest));
    if (Math.abs(v) >= 0.5) assert.ok(Math.sign(rest - p) === Math.sign(v), `brake goes backwards ${p} ${v} → ${rest}`);
    const b = brakeSpin({ cardCount: 40, fromPosition: p, velocity: v, restPosition: rest });
    assert.ok(Math.abs(positionAt(b, 0) - p) < 1e-6);
    assert.ok(Math.abs(positionAt(b, 10) - rest) < 1e-3, `rest ${positionAt(b, 10)} vs ${rest}`);
    assert.ok(b.durationSec >= 0.35 && b.durationSec <= 4);
    assert.ok(Number.isFinite(b.traveled) && b.positions.length > 1, `degenerate brake from ${p} at ${v}`);
  }
});
