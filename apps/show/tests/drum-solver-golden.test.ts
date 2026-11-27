// The shared drum solver (packages/rules/drum-solver.ts: the projector's Spins and the phones' copy of them, D237) gives
// exactly the results it gave when it moved to packages/rules (6128a700): every solved Spin, natural run and phone
// stand-in below hashes, byte for byte (positions and velocities as stored, ticks, every scalar), to the value recorded
// in support/drum-solver-golden.json. A faster solver must keep them all; a change to the physics is a change to the
// show and needs Sound engine's agreement before the file is rewritten (QUINA_WRITE_GOLDEN=1 rewrites it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { drumRandom } from '@quina/protocol';
import { simulate, solveSpin, type SimRun, type Solution } from '../../../packages/rules/drum-solver.ts';
import { spinSolution } from '../../player/logic/drum.ts';

const FILE = path.join(import.meta.dirname, 'support', 'drum-solver-golden.json');

function hashSolution(s: Solution): string {
  const h = createHash('sha256');
  h.update(new Uint8Array(s.positions.buffer, s.positions.byteOffset, s.positions.byteLength));
  h.update(new Uint8Array(s.velocities.buffer, s.velocities.byteOffset, s.velocities.byteLength));
  h.update(new Uint8Array(Float64Array.from(s.ticks.flatMap((t) => [t.t, t.speed, t.direction])).buffer));
  h.update(new Uint8Array(Float64Array.from([s.dt, s.scale, s.lockTime, s.durationSec, s.fromIndex, s.traveled, s.direction, s.cardCount, s.seed ?? -1, s.topSpeed ?? -1, s.drag ?? -1, s.attempts]).buffer));
  h.update(s.method);
  return h.digest('hex').slice(0, 16);
}

function hashRun(r: SimRun): string {
  const h = createHash('sha256');
  h.update(new Uint8Array(Float64Array.from([r.traveled, r.finalPosition, r.stopTime, r.direction, r.settled ? 1 : 0, ...Object.values(r.spin).flatMap((v) => (typeof v === 'number' ? [v] : [v.rate, v.phase]))]).buffer));
  if (r.positions && r.velocities) h.update(new Uint8Array(Float64Array.from([...r.positions, ...r.velocities, ...r.ticks.flatMap((t) => [t.t, t.speed, t.direction])]).buffer));
  return h.digest('hex').slice(0, 16);
}

/** The cases: Spins of every drum size the show has (1 to 77 tiles), every length, calm or not, with and without laps. */
function cases(): { name: string; hash: () => string }[] {
  const random = drumRandom(20261127);
  const out: { name: string; hash: () => string }[] = [];
  for (let i = 0; i < 160; i++) {
    const cardCount = i < 6 ? i + 1 : 1 + Math.floor(random() * 77);
    const fromIndex = Math.floor(random() * cardCount);
    const targetIndex = Math.floor(random() * cardCount);
    const durationSec = i % 17 === 0 ? 0.5 + random() * 3 : 3 + random() * 9;
    const isCalm = random() < 0.15;
    const minLaps = cardCount < 3 || random() < 0.1 ? 0 : 1;
    const seed = Math.floor(random() * 2 ** 32) >>> 0;
    out.push({ name: `solveSpin ${cardCount} ${fromIndex}→${targetIndex} ${durationSec.toFixed(2)} s${isCalm ? ' calm' : ''} laps ${minLaps}`, hash: () => hashSolution(solveSpin({ cardCount, fromIndex, targetIndex, durationSec, isCalm, minLaps, random: drumRandom(seed) })) });
  }
  for (let i = 0; i < 60; i++) {
    const cardCount = 1 + Math.floor(random() * 77);
    const spinSeed = Math.floor(random() * 2 ** 32) >>> 0;
    const fromIndex = Math.floor(random() * cardCount);
    const durationSec = 4 + random() * 8;
    out.push({ name: `spinSolution stand-in ${cardCount} from ${fromIndex} ${durationSec.toFixed(2)} s`, hash: () => hashSolution(spinSolution({ cardCount, fromIndex, durationSec, spinSeed })) });
  }
  for (let i = 0; i < 80; i++) {
    const cardCount = 1 + Math.floor(random() * 77);
    const seed = Math.floor(random() * 2 ** 32) >>> 0;
    const isCalm = random() < 0.2;
    const topSpeed = random() < 0.3 ? null : 5 + random() * 120;
    const drag = random() < 0.3 ? null : 0.08 + random() * 1.52;
    const record = i % 4 === 0;
    out.push({ name: `simulate ${cardCount} seed ${seed}${isCalm ? ' calm' : ''} top ${topSpeed?.toFixed(2)} drag ${drag?.toFixed(3)}${record ? ' recorded' : ''}`, hash: () => hashRun(simulate({ cardCount, seed, isCalm, topSpeed, drag, record })) });
  }
  return out;
}

test('the shared drum solver gives exactly its recorded results (Spins, stand-ins, natural runs)', () => {
  const all = cases();
  const hashes = all.map((c) => c.hash());
  if (process.env.QUINA_WRITE_GOLDEN === '1') {
    fs.writeFileSync(FILE, `${JSON.stringify({ about: 'drum-solver-golden.test.ts: the solver results as of 6128a700', hashes }, null, 0)}\n`);
    return;
  }
  const { hashes: expected } = JSON.parse(fs.readFileSync(FILE, 'utf8')) as { hashes: string[] };
  assert.equal(expected.length, all.length);
  const differ = all.filter((_, i) => hashes[i] !== expected[i]).map((c) => c.name);
  assert.deepEqual(differ, [], `${differ.length} of ${all.length} results changed`);
});
