// Decoys (experiment, off by default): a song that already landed teases in the first bars of an S2 bridge
// and is cut off by a tape stop before anything of the song that lands; with the flag off nothing changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decoyLayer, firstSoundOfB } from '../engine/src/plan/decoys.ts';
import { planTransition } from '../engine/src/plan/planner.ts';
import { PHASES } from '../engine/src/plan/phases.ts';
import { spinWindow } from '../engine/src/plan/pace.ts';
import { usableHooks } from '../engine/src/plan/hooks.ts';
import { DECOYS, type DecoyConfig } from '../engine/src/config.ts';
import { seededRandom } from '../engine/src/rng.ts';
import type { DecoyEvent } from '../engine/src/plan/recipes.ts';
import { setup, analyses } from './support/harness.ts';

const ON: DecoyConfig = { ...DECOYS, enabled: true, chance: { early: 1, mid: 1, late: 1, final: 1 } };
const ids = [...analyses.keys()];
const analysisOf = (id: number) => {
  const a = analyses.get(id);
  assert.ok(a);
  return a;
};

test('a Decoy sits in the first bars of an S2 bridge, is cut off before anything of B, and never is B', () => {
  const rng = seededRandom(17);
  let placed = 0;
  let s2 = 0;
  for (let n = 0; n < 1500; n++) {
    const [aId, bId, dId] = [0, 1, 2].map(() => ids[Math.floor(rng() * ids.length)]);
    if (new Set([aId, bId, dId]).size < 3) continue;
    const A = analysisOf(aId);
    const aHook = usableHooks(A)[0];
    const phase = [PHASES.early, PHASES.mid, PHASES.late][n % 3];
    const result = planTransition({
      now: 100 + 2 + rng() * 20, phase, spin: spinWindow({ pace: 22, phase: phase.name }), rng, history: [], recipeOverride: 'R7',
      A: { songId: aId, analysis: A, deck: { startCtx: 100, offset: aHook.downbeatSec, rate: 1 }, landedDownbeatIndex: aHook.downbeatIndex },
      B: { songId: bId, analysis: analysisOf(bId) },
    });
    if ('error' in result || result.shape !== 'S2') continue;
    s2++;
    const D = analysisOf(dId);
    const hook = usableHooks(D)[0];
    const events = decoyLayer({ plan: result, source: { songId: dId, analysis: D, hook }, phase: phase.name, rng, config: ON });
    assert.equal(decoyLayer({ plan: result, source: { songId: bId, analysis: analysisOf(bId), hook: usableHooks(analysisOf(bId))[0] }, phase: phase.name, rng, config: ON }), null, 'never the song that lands');
    if (result.bridgeBars < ON.minBridgeBars) {
      assert.equal(events, null);
      continue;
    }
    if (!events) continue;
    placed++;
    const decoy = events.find((e): e is DecoyEvent => e.kind === 'decoy');
    assert.ok(decoy);
    assert.equal(decoy.songId, dId);
    assert.ok(decoy.at >= result.exitAt + result.hook.beat - 1e-9, 'a beat after A\'s exit downbeat, as its tail fades');
    assert.ok(decoy.cutAt - decoy.at >= ON.minSec - 1e-9 && decoy.cutAt - decoy.at <= ON.maxSec + 1e-9);
    const bFirst = firstSoundOfB(result);
    assert.ok(decoy.cutAt + decoy.cutSec < bFirst, 'cut off before anything of B');
    assert.ok(decoy.cutAt + decoy.cutSec <= result.T - result.hook.bar + 1e-9, 'the last bar belongs to the real build');
    assert.ok(Math.abs(decoy.offset - (hook.downbeatSec - Math.min(hook.pickupSec || 0, hook.downbeatSec))) < 1e-9, 'from its hook');
  }
  assert.ok(s2 > 300 && placed > 100, `enough cases: ${s2} S2 plans, ${placed} with a Decoy`);
});

test('the Decoy flag is off by default, and off changes nothing in the show', () => {
  assert.equal(DECOYS.enabled, false);
  const plain = setup({ seed: 12, settings: { autoAdvance: false } });
  const off = setup({ seed: 12, settings: { autoAdvance: false }, decoys: { enabled: false, chance: ON.chance } });
  for (const h of [plain, off]) {
    h.send('unlock');
    for (let i = 0; i < 4; i++) {
      h.send('overrideNextRecipe', { recipe: 'R7' });
      h.send('next');
      h.until(() => h.show.status === 'playing');
      h.advance(3);
    }
  }
  // Identical apart from the request ids makeCommand draws.
  const normal = (log: unknown[]) => JSON.stringify(log).replace(/"reqId":"[^"]*"/g, '"reqId":"r"');
  assert.equal(normal(off.log), normal(plain.log));
  assert.ok(!off.log.some((e) => e.type === 'startTransition' && e.plan.events.some((x) => x.kind === 'decoy')));
});

test('with Decoys on, the teased song is one that already counted, and only the real songs land', () => {
  const on = setup({ seed: 3, settings: { autoAdvance: false, phaseOverride: 'mid' }, decoys: { enabled: true, chance: ON.chance } });
  on.send('unlock');
  let decoys = 0;
  for (let i = 0; i < 12; i++) {
    on.send('overrideNextRecipe', { recipe: 'R7' });
    on.send('next');
    on.until(() => on.show.status === 'playing');
    on.advance(2);
  }
  const landed = on.show.landings.filter((l) => !l.undone).map((l) => l.songId);
  assert.deepEqual(landed, on.show.queue.slice(0, landed.length), 'only the Queue\'s songs land, in order');
  for (const e of on.log) {
    if (e.type !== 'startTransition') continue;
    for (const d of e.plan.events.filter((x): x is DecoyEvent => x.kind === 'decoy')) {
      decoys++;
      const before = on.show.queue.slice(0, e.plan.targetPos);
      assert.ok(before.includes(d.songId), 'a song that already landed');
      assert.notEqual(d.songId, e.plan.b.songId);
      assert.notEqual(d.songId, e.plan.a?.songId, 'not the song that is leaving');
    }
  }
  assert.ok(decoys > 0, 'some transitions had a Decoy');
});
