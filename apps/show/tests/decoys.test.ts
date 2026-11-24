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
import { setup, analyses, type Harness } from './support/harness.ts';

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

/**
 * A show driven like the app: only the songs the show's last `prefetch` asked the runtime to keep are
 * decoded (main.ts drops the rest), so a Decoy can only use a song that really is in memory.
 */
function realShow(decoys: Partial<DecoyConfig>, seed = 3) {
  const holder: { h?: Harness } = {};
  const kept = (id: number) => {
    const prefetches = holder.h?.log.filter((e) => e.type === 'prefetch') ?? [];
    const last = prefetches.at(-1);
    return last?.type === 'prefetch' ? last.ids.includes(id) : true; // before the first prefetch: the constructor's songs
  };
  const h = setup({ seed, decoded: kept, settings: { autoAdvance: false, phaseOverride: 'mid' }, decoys });
  holder.h = h;
  h.send('unlock');
  h.advance(9); // past the Shuffle
  const recipes = ['R7', 'R7', 'R2', 'R7', 'R6', 'R7', 'R4', 'R7', 'R7', 'R1', 'R7', 'R7'] as const;
  for (const recipe of recipes) {
    h.send('overrideNextRecipe', { recipe });
    h.send('next');
    h.until(() => h.show.status === 'playing');
    h.advance(2);
  }
  return h;
}

const decoyEvents = (h: Harness) => h.log.flatMap((e) => (e.type === 'startTransition' ? e.plan.events.filter((x): x is DecoyEvent => x.kind === 'decoy') : []));
/** The log without what Decoys may change: the Decoy itself and its cut sound, and the prefetch keep set. */
function withoutDecoys(h: Harness, cutSfx: string) {
  return JSON.stringify(
    h.log
      .filter((e) => e.type !== 'prefetch')
      .map((e) => {
        if (e.type !== 'startTransition') return e;
        const cuts = new Set(e.plan.events.filter((x): x is DecoyEvent => x.kind === 'decoy').map((d) => d.cutAt + DECOYS.cutSec * 0.6));
        return { ...e, plan: { ...e.plan, events: e.plan.events.filter((x) => x.kind !== 'decoy' && !(x.kind === 'sfx' && x.name === cutSfx && cuts.has(x.at))) } };
      }),
  ).replace(/"reqId":"[^"]*"/g, '"reqId":"r"');
}

test('with Decoys on, the song to tease stays decoded, so Decoys really play (the app\'s real decode window)', () => {
  const off = realShow({ enabled: false });
  const on = realShow({ enabled: true, chance: ON.chance });
  assert.equal(decoyEvents(off).length, 0);
  assert.ok(decoyEvents(on).length >= 3, `Decoys played: ${decoyEvents(on).length}`);
  for (const e of on.log) {
    if (e.type !== 'prefetch' || on.show.position < 1) continue;
    assert.ok(e.ids.length <= 4, 'at most one extra song kept');
  }
});

test('the Decoy flag is off by default, and enabled with no chance changes nothing but the keep set', () => {
  assert.equal(DECOYS.enabled, false);
  const off = realShow({ enabled: false });
  const zero = realShow({ enabled: true, chance: { early: 0, mid: 0, late: 0, final: 0 } });
  assert.equal(withoutDecoys(zero, DECOYS.cutSfx), withoutDecoys(off, DECOYS.cutSfx));
});

test('with Decoys on, everything but the Decoy is the same show: same plans, events and journal; only real songs land', () => {
  const off = realShow({ enabled: false });
  const on = realShow({ enabled: true, chance: ON.chance });
  assert.ok(decoyEvents(on).length > 0);
  // Everything the show tells the world is the same: emitted events and journal entries (so a Decoy can never
  // look as if it counted).
  const told = (h: Harness) => JSON.stringify(h.log.filter((e) => e.type === 'emit' || e.type === 'journal')).replace(/"reqId":"[^"]*"/g, '"reqId":"r"');
  assert.equal(told(on), told(off));
  // Transitions without a Decoy have the same plan; one with a Decoy lands the same way (its Decoy replaced B's Tease).
  const plans = (h: Harness) => h.log.flatMap((e) => (e.type === 'startTransition' ? [e.plan] : []));
  const [onPlans, offPlans] = [plans(on), plans(off)];
  assert.equal(onPlans.length, offPlans.length);
  onPlans.forEach((p, i) => {
    const q = offPlans[i];
    const hasDecoy = p.events.some((e) => e.kind === 'decoy');
    // Rounded to 6 decimals: a Decoy's plan starts B through a different lead, so later times differ by ~1e-13.
    const round = (x: object) => JSON.stringify({ ...x, reqId: 'r' }, (_k, v: unknown) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v));
    if (!hasDecoy) assert.equal(round(p), round(q), `plan ${p.id}`);
    else {
      assert.deepEqual([p.recipe, p.hook.id, p.exit, p.shape], [q.recipe, q.hook.id, q.exit, q.shape], `plan ${p.id} lands the same way`);
      assert.ok(Math.abs(p.T - q.T) < 1e-6, `plan ${p.id} lands at the same time`);
      assert.equal(p.teaseBars, 0, 'the Decoy took the place of the Tease');
    }
  });
  const landed = on.show.landings.filter((l) => !l.undone).map((l) => l.songId);
  assert.deepEqual(landed, on.show.queue.slice(0, landed.length), 'only the Queue\'s songs land, in order');
  for (const e of on.log) {
    if (e.type !== 'startTransition') continue;
    for (const d of e.plan.events.filter((x): x is DecoyEvent => x.kind === 'decoy')) {
      assert.ok(on.show.queue.slice(0, e.plan.targetPos).includes(d.songId), 'a song that already landed');
      assert.notEqual(d.songId, e.plan.b.songId);
      assert.notEqual(d.songId, e.plan.a?.songId, 'not the song that is leaving');
    }
  }
});
