// The DJ techniques of docs/dj-techniques.md (D1–D12) and the variants of the older recipes, forced one by
// one over random real pairs, press times, Phases and Paces. Every plan must keep the landing invariants:
// B's hook downbeat at T exactly, nothing before the Spin starts, A silent after its exit, an audible
// produced effect, stem lanes inside their stems; plus each technique's own shape.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planTransition, chooseRecipe, eventStart } from '../engine/src/plan/planner.ts';
import { PHASES } from '../engine/src/plan/phases.ts';
import { spinWindow, PACE_PRESETS } from '../engine/src/plan/pace.ts';
import { deckTimeline } from '../engine/src/plan/timeline.ts';
import { usableHooks } from '../engine/src/plan/hooks.ts';
import { seededRandom } from '../engine/src/rng.ts';
import { MOVES, PLANNER, STEMS } from '../engine/src/config.ts';
import { RECIPES, SILENT, familyGroup } from '../engine/src/plan/recipes.ts';
import { BRIDGE_PATTERNS } from '../engine/src/plan/bridges.ts';
import { analyses } from './support/harness.ts';
import type { Analysis, Hook } from '../engine/src/analysis.ts';
import type { BlendSource, IncomingSong, OutgoingSong, Plan, PlanError, PlanForce, PlanSummary, SignatureSource } from '../engine/src/plan/planner.ts';
import type { PhaseEffects, PhaseName } from '../engine/src/config.ts';
import type { LanePoints, PlanEvent, RampEvent, RecipeId, SetEvent, StemLaneEvent } from '../engine/src/plan/recipes.ts';

const ids = [...analyses.keys()];
const analysisOf = (id: number): Analysis => {
  const a = analyses.get(id);
  assert.ok(a, `no analysis for ${id}`);
  return a;
};
const planned = (result: Plan | PlanError, what: string): Plan => {
  assert.ok(!('error' in result), `${what}: ${'error' in result ? result.error : ''}`);
  return result;
};
const targetOf = (e: PlanEvent): string => ('target' in e ? e.target : '');
const PHASE_LIST = [PHASES.early, PHASES.mid, PHASES.late, PHASES.final];
const ALL_PARTS = ['drums', 'bass', 'vocals', 'other'] as const;

/** B's 8 bars before its hook rendered at A's tempo (as analysis/stretch.py's meta), for R8 and D10. */
function blendSourceFor(A: Analysis, hook: Hook, bass: boolean): BlendSource {
  const barSec = (60 / A.tempo.bpm) * (A.tempo.beatsPerBar || 4);
  return { aSongId: A.songId, hookId: hook.id, toBpm: A.tempo.bpm, firstDownbeatSec: 0.1, hookSec: 0.1 + 8 * barSec, barSec, bass };
}

/** A one-bar call, for D11's grain. */
function callOf(B: Analysis): SignatureSource {
  const beat = 60 / B.tempo.bpm;
  return { id: `${B.songId}-call-0`, kind: 'call', durationSec: 4.5 * beat, anchorSec: 0.5 * beat, beats: 4, bpm: B.tempo.bpm, gainDb: -2 };
}

interface Scenario {
  plan: Plan;
  A: OutgoingSong;
  B: IncomingSong;
  aHook: Hook;
  phase: PhaseEffects;
}

/**
 * One random pair with everything a technique may use: A's stem lanes from its landed hook to 48 s after it,
 * B's drums, bass and vocals around every hook, B's render at A's tempo, B's call, pre-verbs for every hook.
 */
function scenario(n: number, rng: () => number, { recipe = null, force = null, phase: forcedPhase = null, rate = 1, withCall = false, history = [] }: {
  recipe?: RecipeId | null; force?: PlanForce | null; phase?: PhaseEffects | null; rate?: number; withCall?: boolean; history?: PlanSummary[];
} = {}): Scenario {
  const aId = ids[Math.floor(rng() * ids.length)];
  let bId = ids[Math.floor(rng() * ids.length)];
  if (bId === aId) bId = ids[(ids.indexOf(aId) + 1) % ids.length];
  const A0 = analysisOf(aId);
  const B0 = analysisOf(bId);
  const aHook = usableHooks(A0)[0];
  const bHook = usableHooks(B0).find((h) => h.tag === 'best') ?? usableHooks(B0)[0];
  const phase = forcedPhase ?? PHASE_LIST[n % 4];
  const pace = PACE_PRESETS[Math.floor(rng() * PACE_PRESETS.length)];
  const deck = { startCtx: 100, offset: aHook.downbeatSec, rate };
  const A: OutgoingSong = {
    songId: aId, analysis: A0, deck, landedDownbeatIndex: aHook.downbeatIndex,
    lanes: { fromSec: aHook.downbeatSec - 1, toSec: Math.min(A0.source.durationSec, aHook.downbeatSec + 48), parts: ALL_PARTS },
  };
  const B: IncomingSong = {
    songId: bId, analysis: B0,
    stems: Object.fromEntries(B0.hooks.map((h) => [h.id, { parts: ['drums', 'bass', 'vocals'] }] as const)),
    blend: A0.tempo.isStable ? blendSourceFor(A0, bHook, n % 2 === 0) : null,
    signatures: withCall ? [callOf(B0)] : [],
    preverbs: B0.hooks.map((h) => h.id),
  };
  const plan = planned(planTransition({
    now: 100 + 2 + rng() * 26, phase, spin: spinWindow({ pace, phase: phase.name }), rng, history,
    A, B, recipeOverride: recipe, hookOverride: bHook, force,
  }), `${recipe ?? 'auto'} ${aId}→${bId}`);
  return { plan, A, B, aHook, phase };
}

/** The value an A or bus param holds at `t`, applying set and ramp events in start order (as the scheduler does). */
function valueAt(events: readonly PlanEvent[], target: string, t: number, initial = 1): number {
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

/** The invariants every plan keeps, whatever its recipe. */
function checkLanding({ plan, A }: Scenario): void {
  const what = `${plan.recipe}${plan.variant ? `/${plan.variant.kind}` : ''} ${plan.phase}`;
  // B's hook downbeat sounds exactly at T.
  assert.ok(Math.abs(plan.b.startCtx + (plan.hook.downbeatSec - plan.b.offset) - plan.T) < 1e-9, `${what}: hook not at T`);
  assert.ok(plan.b.startCtx >= plan.spinStart && plan.b.offset >= 0);
  // Nothing starts before the Spin.
  for (const e of plan.events) assert.ok(eventStart(e) >= plan.spinStart - 0.03 - 1e-9, `${what}: ${e.kind} ${targetOf(e)} before the Spin`);
  // An audible produced effect: an impact, and at least two moves that are not just gain.
  assert.ok(plan.events.some((e) => e.kind === 'synth' && e.name === 'impact'), `${what}: no impact`);
  assert.ok(plan.events.filter((e) => e.kind !== 'sfx' && !targetOf(e).endsWith('.gain')).length >= 2, `${what}: no effects`);
  if (!plan.a) return;
  // A is silent from the end of its move (the gap, or the bridge's start) and stays silent.
  const silentAt = (plan.shape === 'S2' ? plan.exitAt : plan.T - plan.hook.pickupSec - plan.gapBeats * plan.hook.beat) + 0.03;
  assert.ok(valueAt(plan.events, 'A.gain', silentAt) <= 0.001, `${what}: A not silent after its exit (${valueAt(plan.events, 'A.gain', silentAt)})`);
  for (const e of plan.events) {
    if (targetOf(e) !== 'A.gain' || eventStart(e) <= silentAt) continue;
    assert.ok((e.kind === 'set' ? e.value : e.kind === 'ramp' ? Math.max(e.from, e.to) : 0) <= 0.001, `${what}: A re-opens after its exit`);
  }
  // A's lanes play only inside its decoded stems (less the margin), at rate 1, and stop with A.
  const tl = deckTimeline(A.analysis, A.deck, A.landedDownbeatIndex);
  for (const e of plan.events.filter((x): x is StemLaneEvent => x.kind === 'stemLane' && x.deck === 'A')) {
    assert.equal(A.deck.rate ?? 1, 1, `${what}: a lane on a resampled deck`);
    const lanes = A.lanes;
    assert.ok(lanes);
    assert.ok(tl.posAt(e.at) >= lanes.fromSec + STEMS.laneMarginSec - 1e-6 && tl.posAt(e.until) <= lanes.toSec - STEMS.laneMarginSec + 1e-6, `${what}: lane ${e.part} outside A's stems`);
    assert.ok(e.until <= plan.a.stopAt + 1e-9, `${what}: lane ${e.part} outlives A`);
  }
}

test('every new technique keeps the landing invariants over random pairs, phases and paces', () => {
  const rng = seededRandom(2026);
  const seen: Record<string, number> = {};
  const forcedTo: RecipeId[] = ['D1', 'D2', 'D3', 'D8', 'D10', 'D11', 'R1', 'R2', 'R4', 'R5', 'R7', 'R10'];
  for (let n = 0; n < 2400; n++) {
    const recipe = forcedTo[n % forcedTo.length];
    const s = scenario(n, rng, { recipe, withCall: n % 3 === 0, phase: PHASE_LIST[Math.floor(n / forcedTo.length) % 4] });
    checkLanding(s);
    const key = `${s.plan.recipe}:${s.plan.phase}`;
    seen[key] = (seen[key] ?? 0) + 1;
  }
  // Each technique actually plays in each Phase it is meant for (a forced recipe may fall back when it does not fit).
  for (const id of ['D1', 'D2', 'D3', 'D8', 'D11']) for (const p of ['early', 'mid', 'late', 'final']) assert.ok((seen[`${id}:${p}`] ?? 0) > 5, `${id} rarely fits in ${p}: ${JSON.stringify(seen)}`);
  for (const p of ['early', 'mid', 'late']) assert.ok((seen[`D10:${p}`] ?? 0) > 5, `D10 rarely fits in ${p}`);
});

test('D1 trans gate: 2 ms edges on A\'s grid, a closed gate early is partial, the high-pass is up before the fast stages', () => {
  const rng = seededRandom(11);
  const modes = new Set<string>();
  for (let n = 0; n < 400; n++) {
    const { plan } = scenario(n, rng, { recipe: 'D1' });
    if (plan.recipe !== 'D1') continue;
    const kind = String(plan.variant?.kind);
    modes.add(kind);
    const edges = plan.events.filter((e): e is RampEvent => e.kind === 'ramp' && e.target === 'A.gain' && e.t0 > plan.spinStart + 0.41);
    for (const e of edges) assert.ok(e.t1 - e.t0 >= 0.0019, 'no gain edge faster than 2 ms');
    if (kind === 'gate') {
      assert.ok(edges.length >= 8, 'a ladder of steps');
      // The gate's closing edges, without the final cut to silence.
      const closed = edges.filter((e) => e.to < e.from).slice(0, -1).map((e) => e.to);
      const level = 10 ** ((PHASES[plan.phase].duckDb ?? -3) / 20);
      if (plan.phase === 'early') assert.ok(closed.every((v) => v > SILENT * 10 && v < level), 'early: a partial gate');
      if (plan.phase === 'late' || plan.phase === 'final') assert.ok(closed.some((v) => v <= SILENT), 'late: the gate closes fully');
    }
    if (kind !== 'gate') assert.ok(plan.events.some((e) => e.kind === 'synth' && e.name === 'kicks'), 'the pump kicks');
    const hpf = plan.events.filter((e): e is RampEvent => e.kind === 'ramp' && e.target === 'A.hpf');
    assert.ok(hpf.length && Math.max(...hpf.map((e) => e.to)) >= MOVES.gate.fastStageHpfHz, 'A high-passed');
    if (plan.phase === 'final') {
      assert.ok(plan.events.some((e) => e.kind === 'ramp' && e.target === 'bus.hpf'), 'final: the bus high-pass');
      assert.ok(valueAt(plan.events, 'bus.hpf', plan.T - plan.hook.pickupSec, 10) <= 10, 'bus high-pass off by the pickup');
    }
  }
  assert.deepEqual([...modes].sort(), ['gate', 'gatePump', 'pump']);
});

test('D3 spiral: the delay shrinks exponentially, feedback ≤ 0.85, the echo\'s high-pass ends ≥ 1.5 kHz, cut dead and flushed at the gap', () => {
  const rng = seededRandom(12);
  let count = 0;
  for (let n = 0; n < 300; n++) {
    const { plan } = scenario(n, rng, { recipe: 'D3' });
    if (plan.recipe !== 'D3') continue;
    count++;
    const time = plan.events.find((e): e is RampEvent => e.kind === 'ramp' && e.target === 'echo.time');
    assert.ok(time && time.curve === 'exp' && time.to < time.from / 4, 'the repeats climb');
    const gapStart = plan.T - plan.hook.pickupSec - plan.gapBeats * plan.hook.beat;
    assert.ok(time.t1 <= gapStart + 1e-9);
    for (const e of plan.events) if (targetOf(e) === 'echo.feedback') assert.ok((e.kind === 'set' ? e.value : e.kind === 'ramp' ? e.to : 0) <= 0.85);
    const hpf = plan.events.filter((e): e is RampEvent => e.kind === 'ramp' && e.target === 'echo.hpf');
    assert.ok(hpf.some((e) => e.to >= 1500));
    assert.ok(valueAt(plan.events, 'echo.return', time.t1 + 0.006) <= 0.001, 'the swirl is cut at the gap');
    assert.ok(valueAt(plan.events, 'echo.feedback', time.t1 + 0.02) === 0, 'and the loop flushed');
    assert.ok(valueAt(plan.events, 'echo.return', plan.T + 1) === 1, 'the return is back after the landing');
  }
  assert.ok(count > 200);
});

test('D2 stop-time hits: stabs on A\'s beats, all over before the gap of at least a beat, the last one rings; at most one in six', () => {
  const rng = seededRandom(13);
  let count = 0;
  for (let n = 0; n < 400; n++) {
    const { plan } = scenario(n, rng, { recipe: 'D2' });
    if (plan.recipe !== 'D2') continue;
    count++;
    const kicks = plan.events.find((e) => e.kind === 'synth' && e.name === 'kicks');
    assert.ok(kicks && kicks.kind === 'synth' && kicks.name === 'kicks' && kicks.params.times.length >= 1);
    const gapStart = plan.T - plan.hook.pickupSec - plan.gapBeats * plan.hook.beat;
    if (plan.hook.pickupSec <= plan.hook.beat) assert.ok(plan.gapBeats >= MOVES.hits.minGapBeats[plan.phase], 'the crowd gap');
    assert.ok(Math.max(...kicks.params.times) < gapStart, 'stabs before the gap');
    assert.equal(plan.events.filter((e) => e.kind === 'sfx' && e.name === 'thunk').length, kicks.params.times.length, 'a thunk per stab');
    assert.ok(valueAt(plan.events, 'reverb.return', plan.T - plan.hook.pickupSec) <= 0.001, 'the ring is out by the pickup');
    assert.ok(valueAt(plan.events, 'reverb.return', plan.T + 2) === 1, 'the reverb comes back for later');
  }
  assert.ok(count > 300);
  // The rotation keeps it rare: never within five of the last one.
  const recent: PlanSummary[] = [{ recipe: 'D2', family: 'hits', exit: null, songId: 1, hookId: 'x' }];
  for (let n = 0; n < 4; n++) recent.unshift({ recipe: 'R7', family: 'build', exit: 'echo', songId: 1, hookId: 'x' });
  for (let k = 0; k < 200; k++) assert.notEqual(chooseRecipe({ hasA: true, phase: PHASES.final, history: recent, rng }).id, 'D2');
});

test('D8 stem peel: parts removed one after another inside A\'s stems, then the voice thrown into the echo', () => {
  const rng = seededRandom(14);
  const orders = new Set<string>();
  for (let n = 0; n < 400; n++) {
    const s = scenario(n, rng, { recipe: 'D8' });
    const { plan } = s;
    if (plan.recipe !== 'D8') continue;
    orders.add(String(plan.variant?.kind));
    const lanes = plan.events.filter((e): e is StemLaneEvent => e.kind === 'stemLane');
    const removed = lanes.filter((e) => !e.echo);
    assert.ok(removed.length >= 2 && removed.every((e) => e.direct[e.direct.length - 1][1] === -1), 'removal lanes end at −1');
    const starts = removed.map((e) => e.at);
    assert.ok(new Set(starts).size >= 2, 'one after another');
    const thrown = lanes.find((e) => e.part === 'vocals' && e.echo);
    assert.ok(thrown && thrown.echo, 'the vocal throw');
    assert.equal(thrown.echo[thrown.echo.length - 1][1], 1);
    assert.equal(thrown.direct[thrown.direct.length - 1][1], -1, 'the dry voice stops at the throw');
  }
  assert.deepEqual([...orders].sort(), ['acapella', 'beat', 'drumsVoice']);
});

test('lanes need A at rate 1 and inside its stems: otherwise D8 and D10 are never played', () => {
  const rng = seededRandom(15);
  for (let n = 0; n < 200; n++) {
    const resampled = scenario(n, rng, { recipe: n % 2 ? 'D8' : 'D10', rate: 1.02 });
    assert.ok(!['D8', 'D10'].includes(resampled.plan.recipe), 'no lanes on a resampled A');
    assert.ok(!resampled.plan.events.some((e) => e.kind === 'stemLane' && e.deck === 'A'));
  }
});

test('D10 drum swap: A\'s drums out on one of its downbeats as B\'s stretched drums come in, never two kits at once', () => {
  const rng = seededRandom(16);
  let count = 0;
  let juggles = 0;
  for (let n = 0; n < 600; n++) {
    const s = scenario(n, rng, { recipe: 'D10', phase: [PHASES.early, PHASES.mid, PHASES.late][n % 3] });
    const { plan, A } = s;
    if (plan.recipe !== 'D10') continue;
    count++;
    const tl = deckTimeline(A.analysis, A.deck, A.landedDownbeatIndex);
    const onA = (t: number) => A.analysis.downbeats.some((d) => Math.abs(tl.ctxAt(d) - t) < 1e-9);
    const out = plan.events.find((e): e is StemLaneEvent => e.kind === 'stemLane' && e.part === 'drums');
    assert.ok(out && onA(out.at), 'the swap is on A\'s downbeat');
    const layers = plan.events.filter((e) => e.kind === 'blend');
    assert.ok(layers.length >= 1);
    // B's drums never play while A's own are in: every layer starts where A's drums lane is at −1.
    for (const l of layers) {
      if (l.kind !== 'blend') continue;
      const lane: LanePoints = out.direct;
      const at: number = l.parts.drums?.t1 ?? l.at;
      const v = lane.reduce<number>((value, [t, x]) => (t <= at + 0.011 ? x : value), 0);
      assert.equal(v, -1, 'A\'s drums are out when B\'s are in');
      // The render's hook still lands at T.
      assert.ok(Math.abs(l.fileAt + (plan.T - l.at) - (0.1 + 8 * ((60 / A.analysis.tempo.bpm) * (A.analysis.tempo.beatsPerBar || 4)))) < 1e-9);
    }
    if (plan.variant?.juggle) juggles++;
  }
  assert.ok(count > 150 && juggles > 5, `${count} swaps, ${juggles} juggles`);
});

test('D9 Ghost Tease: B\'s voice only through the reverb on S1 moves that leave the reverb alone, inside B\'s stems', () => {
  const rng = seededRandom(17);
  let ghosts = 0;
  const hosts = Object.values(RECIPES).filter((r) => r.ghostHost).map((r) => r.id);
  for (let n = 0; n < 900; n++) {
    const recipe = hosts[n % hosts.length];
    const { plan } = scenario(n, rng, { recipe, phase: [PHASES.mid, PHASES.late, PHASES.final][n % 3] });
    const lanes = plan.events.filter((e): e is StemLaneEvent => e.kind === 'stemLane' && e.deck === 'B');
    if (!plan.layers.includes('ghost')) {
      assert.equal(lanes.length, 0);
      continue;
    }
    ghosts++;
    assert.ok(RECIPES[plan.recipe].ghostHost && plan.shape === 'S1');
    const [g] = lanes;
    assert.ok(g && g.part === 'vocals' && g.direct.every(([, v]) => v === 0), 'no dry voice');
    assert.ok(g.reverb && Math.max(...g.reverb.map(([, v]) => v)) <= MOVES.ghost.airSend + 1e-9, 'unknown keys: air, not pitch');
    const gapStart = plan.T - plan.hook.pickupSec - plan.gapBeats * plan.hook.beat;
    assert.ok(g.until <= gapStart + 1e-9, 'cut at the gap');
    const stemsFrom = plan.T - (plan.hook.downbeatSec - Math.max(0, plan.hook.downbeatSec - STEMS.leadSec));
    assert.ok(g.at >= stemsFrom + STEMS.laneMarginSec - 1e-9, 'inside B\'s stems');
    assert.ok(plan.events.some((e) => e.kind === 'ramp' && e.target === 'reverb.hpf' && e.to >= MOVES.ghost.airHpfHz));
    assert.ok(!['R6', 'D2', 'D8'].includes(plan.recipe));
  }
  assert.ok(ghosts > 150, `${ghosts} ghosts`);
  // Early never has one.
  for (let n = 0; n < 100; n++) assert.ok(!scenario(n, rng, { recipe: 'R2', phase: PHASES.early }).plan.layers.includes('ghost'));
});

test('D11 vocal-chop build: B\'s syllable chopped on B\'s grid in the last bars, faster and higher, before the gap', () => {
  const rng = seededRandom(18);
  const sources = new Set<string>();
  for (let n = 0; n < 400; n++) {
    const { plan } = scenario(n, rng, { recipe: 'D11', withCall: n % 2 === 0 });
    if (plan.recipe !== 'D11') continue;
    const chops = plan.events.find((e) => e.kind === 'slices' && e.deck === 'B');
    if (!chops || chops.kind !== 'slices') continue;
    sources.add(chops.source?.from ?? 'mix');
    assert.ok(chops.direct && chops.hpfHz === MOVES.chop.hpfHz && chops.snap, 'past B\'s fader, high-passed, onset-snapped');
    const gapStart = plan.T - plan.hook.pickupSec - plan.gapBeats * plan.hook.beat;
    for (const s of chops.slices) {
      assert.ok(s.at >= plan.exitAt - 1e-6 && s.at + s.dur <= gapStart + 1e-6, 'inside the bridge, before the gap');
      const k = (gapStart - s.at) / (plan.hook.beat / 8);
      assert.ok(Math.abs(k - Math.round(k)) < 1e-6, 'on B\'s grid');
    }
    const rates = chops.slices.map((s) => s.rate ?? 1);
    assert.ok(Math.max(...rates) <= 2 * MOVES.chop.rateTo[plan.phase] + 1e-9 && Math.min(...rates) >= 1 - 1e-9);
    if (plan.hook.pickupSec <= plan.hook.beat) assert.ok(plan.gapBeats >= MOVES.chop.minGapBeats[plan.phase]);
    // One B Signature at most: the call is the chop, nothing else of B.
    if (chops.source?.from === 'signature') assert.ok(!plan.events.some((e) => e.kind === 'signature' && e.deck === 'B'));
  }
  assert.deepEqual([...sources].sort(), ['signature', 'stem']);
});

test('landing layers rotate: cymbal, dry (no swell, no samples) and the pre-verb, which ends a breath before the pickup', () => {
  const rng = seededRandom(19);
  const styles: Record<string, number> = {};
  for (let n = 0; n < 1200; n++) {
    const { plan } = scenario(n, rng);
    styles[plan.landing] = (styles[plan.landing] ?? 0) + 1;
    const swells = plan.events.filter((e) => e.kind === 'synth' && e.name === 'swell');
    const pre = plan.events.filter((e) => e.kind === 'preverb');
    if (plan.landing !== 'cymbal' && plan.recipe !== 'FADE') assert.equal(swells.length, 0, `${plan.recipe} ${plan.landing}: no cymbal`);
    if (plan.landing === 'dry') assert.ok(!plan.events.some((e) => e.kind === 'sfx' && e.name !== 'whoosh' && e.name !== 'thunk'), 'dry: no samples');
    if (plan.landing === 'preverb') {
      assert.equal(pre.length, 1);
      const [p] = pre;
      assert.ok(p.kind === 'preverb' && p.until <= plan.T - plan.hook.pickupSec - MOVES.preverb.breathSec[0] + 1e-9 && p.until - p.at >= MOVES.preverb.minSec - 1e-9);
      assert.ok(p.at >= plan.spinStart + (plan.a ? PLANNER.afterDuckSec : 0.1) - 1e-9);
    } else assert.equal(pre.length, 0);
    if (plan.phase === 'final') assert.notEqual(plan.landing, 'dry');
  }
  assert.ok(styles.cymbal > 100 && styles.dry > 50 && styles.preverb > 100, JSON.stringify(styles));
});

test('R7\'s bridge patterns: each one stays on its bridge, before the gap', () => {
  const rng = seededRandom(20);
  for (const bridge of BRIDGE_PATTERNS) {
    let played = 0;
    for (let n = 0; n < 120; n++) {
      const { plan } = scenario(n, rng, { recipe: 'R7', force: { bridge }, phase: [PHASES.mid, PHASES.late][n % 2] });
      if (plan.recipe !== 'R7' || plan.variant?.kind !== bridge) continue;
      played++;
      const gapStart = plan.T - plan.hook.pickupSec - plan.gapBeats * plan.hook.beat;
      for (const e of plan.events) {
        if (e.kind !== 'synth' || e.name === 'impact' || e.name === 'downlifter') continue;
        const times = 'times' in e.params ? e.params.times : 't0' in e.params ? [e.params.t0, e.params.t1] : [];
        if (e.name === 'kicks' && Math.min(...times) < plan.exitAt - 1e-6) continue; // an exit's own kicks (the gate's pump)
        for (const t of times) assert.ok(t <= gapStart + 1e-6, `${bridge}: ${e.name} after the gap`);
      }
      if (bridge === 'clap') assert.ok(plan.events.some((e) => e.kind === 'synth' && e.name === 'claps'));
      if (bridge === 'kickroll' || bridge === 'halftime') assert.ok(plan.events.some((e) => e.kind === 'synth' && e.name === 'kicks'));
    }
    assert.ok(played > 20, `${bridge} played ${played} times`);
  }
});

test('R7 rotates the gate and the spiral as exits too', () => {
  const rng = seededRandom(21);
  const exits = new Set<string>();
  for (let n = 0; n < 300; n++) {
    const s = scenario(n, rng, { recipe: 'R7' });
    checkLanding(s);
    if (s.plan.exit) exits.add(s.plan.exit);
  }
  for (const x of ['echo', 'roll', 'brake', 'spinback', 'wash', 'gate', 'spiral']) assert.ok(exits.has(x), `exit ${x} never drawn`);
});

test('variants of the older recipes: R1 low-pass dive and stab, R2 freeze and vocal throw, R4 triplets and pitch-up, R5 lengths', () => {
  const rng = seededRandom(22);
  const kinds: Record<string, Set<string>> = { R1: new Set(), R2: new Set(), R4: new Set(), R5: new Set() };
  for (let n = 0; n < 800; n++) {
    const recipe = (['R1', 'R2', 'R4', 'R5'] as const)[n % 4];
    const s = scenario(n, rng, { recipe });
    const { plan } = s;
    if (plan.recipe !== recipe) continue;
    checkLanding(s);
    kinds[recipe].add(String(plan.variant?.kind));
    if (plan.variant?.kind === 'lpf') assert.ok(plan.events.some((e) => e.kind === 'ramp' && e.target === 'A.lpf' && e.to <= 300));
    if (plan.variant?.kind === 'freeze') assert.ok(plan.events.some((e) => e.kind === 'set' && e.target === 'echo.feedback' && e.value >= 0.9));
    if (plan.variant?.kind === 'vocalThrow') assert.ok(plan.events.some((e) => e.kind === 'stemLane' && e.part === 'vocals' && e.echo));
    if (recipe === 'R4' && plan.variant?.pitchUp) {
      const roll = plan.events.find((e) => e.kind === 'slices');
      assert.ok(roll && roll.kind === 'slices' && Math.max(...roll.slices.map((x) => x.rate ?? 1)) > 1.1);
    }
  }
  assert.deepEqual([...kinds.R1].sort(), ['hpf', 'lpf', 'stab']);
  assert.deepEqual([...kinds.R2].sort(), ['echo', 'freeze', 'vocalThrow']);
  assert.deepEqual([...kinds.R4].sort(), ['straight', 'triplet']);
  assert.deepEqual([...kinds.R5].sort(), ['brake', 'spinback']);
});

test('the rotation over a long show: every technique plays, no family three times running, D2 at most one in six', () => {
  const rng = seededRandom(23);
  const history: PlanSummary[] = [];
  const counts: Record<string, number> = {};
  for (let n = 0; n < 1600; n++) {
    const phase = PHASE_LIST[Math.floor(n / 25) % 4];
    const s = scenario(n, rng, { phase, history, withCall: n % 2 === 0 });
    checkLanding(s);
    const { plan } = s;
    counts[plan.recipe] = (counts[plan.recipe] ?? 0) + 1;
    const lastTwo = history.slice(-2);
    if (lastTwo.length === 2 && plan.recipe !== 'FADE') {
      assert.ok(!lastTwo.every((h) => familyGroup(h.family) === familyGroup(plan.family)), `three ${plan.family} in a row`);
    }
    if (plan.recipe === 'D2') assert.ok(!history.slice(-MOVES.hits.cooldown).some((h) => h.recipe === 'D2'), 'D2 too soon');
    history.push({ recipe: plan.recipe, family: plan.family, exit: plan.exit, songId: s.B.songId, hookId: plan.hook.id });
  }
  for (const id of ['D1', 'D2', 'D3', 'D8', 'D10', 'D11', 'R1', 'R2', 'R4', 'R5', 'R6', 'R7', 'R8', 'R10']) assert.ok((counts[id] ?? 0) > 0, `never chose ${id}: ${JSON.stringify(counts)}`);
  console.log('rotation', counts);
});

test('overrideNextRecipe: every new recipe can be forced when it is possible', () => {
  const rng = seededRandom(24);
  for (const id of ['D1', 'D2', 'D3', 'D8', 'D10', 'D11'] as const) {
    const phase: PhaseName = id === 'D10' ? 'mid' : 'late';
    let hits = 0;
    for (let n = 0; n < 40; n++) if (scenario(n, rng, { recipe: id, phase: PHASES[phase] }).plan.recipe === id) hits++;
    assert.ok(hits > 20, `${id} forced only ${hits}/40 times`);
  }
});
