import { HAS_DATA, dataTest as test } from './support/data.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { planTransition, eventStart } from '../engine/src/plan/planner.ts';
import { PHASES } from '../engine/src/plan/phases.ts';
import { spinWindow, SPIN_LIMITS, PACE_PRESETS } from '../engine/src/plan/pace.ts';
import { deckTimeline } from '../engine/src/plan/timeline.ts';
import { usableHooks } from '../engine/src/plan/hooks.ts';
import { seededRandom } from '../engine/src/rng.ts';
import type { Analysis, Hook, IndexSong } from '../engine/src/analysis.ts';
import type { KeyInfo } from '../engine/src/plan/keys.ts';
import type { BlendSource, Plan, PlanError, PlanSummary, SignatureSource } from '../engine/src/plan/planner.ts';
import { PLANNER, SIGNATURES } from '../engine/src/config.ts';
import type { PlanEvent } from '../engine/src/plan/recipes.ts';
import { OUT } from '../relay/pool.ts';

const DIR = path.join(OUT, 'analysis');
const readJson = (file: string): unknown => JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
const index = HAS_DATA ? (readJson('index.json') as { songs: IndexSong[] }).songs.filter((s) => !s.excluded) : [];
const analyses = new Map(index.map((s) => [s.id, readJson(`${s.id}.json`) as Analysis] as const));
const PAIRS = Number(process.env.PLANNER_PAIRS || 3000);

/** A song's analysis; every id the tests use comes from `analyses` itself. */
function analysisOf(id: number): Analysis {
  const analysis = analyses.get(id);
  assert.ok(analysis, `no analysis for song ${id}`);
  return analysis;
}

/** The plan, after asserting the planner did not fail. */
function planned(result: Plan | PlanError, what = 'plan'): Plan {
  assert.ok(!('error' in result), `${what}: ${'error' in result ? result.error : ''}`);
  return result;
}

/** The parameter an event sets or ramps, or '' for events without one. */
const targetOf = (e: PlanEvent): string => ('target' in e ? e.target : '');


test(`planner invariants over ${PAIRS} random pairs × press times × phases × paces`, () => {
  const rng = seededRandom(42);
  const ids = [...analyses.keys()];
  const recipes: Record<string, number> = {};
  let fallbacks = 0;
  let relaxed = 0;
  let onPhrase = 0;
  for (let n = 0; n < PAIRS; n++) {
    const aId = ids[Math.floor(rng() * ids.length)];
    let bId = ids[Math.floor(rng() * ids.length)];
    if (bId === aId) bId = ids[(ids.indexOf(aId) + 1) % ids.length];
    const A = analysisOf(aId);
    const B = analysisOf(bId);
    const aHook = usableHooks(A)[0];
    const phase = [PHASES.early, PHASES.mid, PHASES.late, PHASES.final][n % 4];
    const pace = PACE_PRESETS[Math.floor(rng() * PACE_PRESETS.length)];
    const spin = spinWindow({ pace, phase: phase.name });
    // A landed on its hook at ctx 100 − lead; press somewhere 2–30 s into the clip.
    const deck = { startCtx: 100, offset: aHook.downbeatSec, rate: 1 };
    const now = 100 + 2 + rng() * 28;
    const plan = planned(planTransition({
      now, phase, spin, rng, history: [],
      A: { songId: aId, analysis: A, deck, landedDownbeatIndex: aHook.downbeatIndex },
      B: { songId: bId, analysis: B },
    }), `pair ${aId}→${bId}`);
    recipes[plan.recipe] = (recipes[plan.recipe] || 0) + 1;
    const D = plan.T - plan.spinStart;
    if (plan.recipe === 'FADE') {
      fallbacks++;
      assert.ok(Math.abs(D - spin.dTarget) < 1e-9);
    } else {
      const [lo, hi] = plan.relaxed ? SPIN_LIMITS : [spin.dMin, spin.dMax];
      if (plan.relaxed) relaxed++;
      assert.ok(D >= lo - 1e-9 && D <= hi + 1e-9, `D ${D} outside ${lo}–${hi}`);
      const tl = deckTimeline(A, deck);
      const onA = (t: number) => A.downbeats.some((d) => Math.abs(tl.ctxAt(d) - t) < 1e-9);
      if (plan.shape === 'S1') assert.ok(onA(plan.T), 'S1: T not on an A downbeat');
      else {
        // S2: A exits on its downbeat; the bridge is a whole number of B's bars.
        assert.ok(onA(plan.exitAt), 'S2: exit not on an A downbeat');
        assert.ok(Math.abs(plan.T - plan.exitAt - plan.bridgeBars * plan.hook.bar) < 1e-9, 'S2: bridge not N·barB');
      }
      // The landing counts in A's bars: S2's bridge takes the place of A's last bars. Its phrase is the
      // landing's, or (S2, when B's bars cannot reach A's boundary) the exit's after A's completed phrase.
      assert.ok(plan.exitIndex != null && plan.landIndex === plan.exitIndex + (plan.shape === 'S2' ? plan.bridgeBars : 0), `landIndex ${plan.landIndex}`);
      const phrases = deckTimeline(A, deck, aHook.downbeatIndex);
      const atLanding = phrases.phraseClass(plan.landIndex);
      assert.equal(plan.phraseClass, atLanding !== 'bar' || plan.shape !== 'S2' ? atLanding : phrases.phraseClass(plan.exitIndex));
      if (plan.phraseClass !== 'bar') onPhrase++;
      // Every transition carries effects: at least one synth layer or deck move besides gain, and the hit the
      // landing drew (none on many early landings).
      if (plan.impact !== 'none') assert.ok(plan.events.some((e) => e.kind === 'synth' && e.name === 'impact'), `${plan.recipe}: no impact`);
      assert.ok(plan.events.filter((e) => e.kind !== 'sfx' && !targetOf(e).endsWith('.gain')).length >= 1, `${plan.recipe}: no effects`);
    }
    for (const e of plan.events) assert.ok(eventStart(e) >= plan.spinStart - 0.03 - 1e-9, `event ${e.kind} ${targetOf(e) || ('name' in e ? e.name : undefined)} before spinStart: ${plan.recipe} ${plan.exit} D=${plan.D.toFixed(2)} pace ${pace} ${phase.name} n=${plan.bridgeBars} at ${(eventStart(e) - plan.spinStart).toFixed(2)}`);
    // B: hook downbeat sounds at T exactly.
    assert.ok(Math.abs(plan.b.startCtx + (plan.hook.downbeatSec - plan.b.offset) - plan.T) < 1e-9);
    assert.ok(plan.b.offset >= 0);
    assert.ok(plan.b.startCtx >= plan.spinStart);
    const volDb = 0;
    assert.ok(plan.b.trimDb <= 6 + volDb + 1e-9 && plan.b.trimDb >= -12 + volDb - 1e-9, `trim ${plan.b.trimDb}`);
    // A cancelled Spin may keep A only before its exit move starts; that moment is inside the Spin.
    if (plan.a) assert.ok(plan.a.exitStart >= plan.spinStart + 0.4 - 1e-9 && plan.a.exitStart <= plan.T + 1e-9, `exitStart ${plan.a.exitStart}`);
  }
  console.log('recipes', recipes, 'fallbacks', fallbacks, 'relaxed', relaxed, 'on a phrase', `${((100 * onPhrase) / (PAIRS - fallbacks)).toFixed(1)}%`);
  assert.ok(fallbacks / PAIRS < 0.02, `fallbacks ${fallbacks}/${PAIRS}`);
  // A Next at any moment (a presenter's press) still waits, up to the Spin's 11 s, for one of A's phrases.
  assert.ok(onPhrase / (PAIRS - fallbacks) > 0.85, `on a phrase ${onPhrase}/${PAIRS - fallbacks}`);
  for (const r of ['R1', 'R2', 'R4', 'R5', 'R6', 'R7', 'R10']) assert.ok(recipes[r] > 0, `never chose ${r}: ${JSON.stringify(recipes)}`);
});

test('no A (round opener, or out of Hold music) lands from silence after dTarget', () => {
  const [bId] = analyses.keys();
  const spin = spinWindow({ pace: 22, phase: 'late' });
  const plan = planned(planTransition({ now: 5, A: null, B: { songId: bId, analysis: analysisOf(bId) }, phase: PHASES.late, spin, rng: seededRandom(1) }));
  assert.equal(plan.recipe, 'R7');
  assert.ok(Math.abs(plan.D - spin.dTarget) < 1e-9);
  assert.equal(plan.a, null);
});

test('history: the previous recipe is penalised and hooks rotate in later phases', () => {
  const rng = seededRandom(9);
  const ids = [...analyses.keys()];
  const history: PlanSummary[] = [];
  let repeats = 0;
  for (let n = 0; n < 400; n++) {
    const A = analysisOf(ids[n % ids.length]);
    const B = analysisOf(ids[(n + 1) % ids.length]);
    const aHook = usableHooks(A)[0];
    const plan = planned(planTransition({
      now: 110, phase: PHASES.early, rng, history,
      A: { songId: A.songId, analysis: A, deck: { startCtx: 100, offset: aHook.downbeatSec, rate: 1 }, landedDownbeatIndex: aHook.downbeatIndex },
      B: { songId: B.songId, analysis: B },
    }));
    if (history.length && history[history.length - 1].recipe === plan.recipe) repeats++;
    history.push({ recipe: plan.recipe, family: plan.family, exit: plan.exit, songId: B.songId, hookId: plan.hook.id });
  }
  assert.ok(repeats / 400 < 0.45, `repeat rate ${repeats / 400}`);
});

test('a Tease uses B\'s own stems when they cover the hook: drums first, bass in the last bar, cut before the pickup', () => {
  const rng = seededRandom(77);
  const ids = [...analyses.keys()];
  let stemTeases = 0;
  for (let n = 0; n < 300; n++) {
    const A = analysisOf(ids[n % ids.length]);
    const B = analysisOf(ids[(n * 7 + 3) % ids.length]);
    if (A === B) continue;
    const aHook = usableHooks(A)[0];
    const stems = Object.fromEntries(B.hooks.map((h) => [h.id, { parts: ['drums', 'bass'] }] as const));
    const phase = n % 2 ? PHASES.late : PHASES.final;
    const plan = planned(planTransition({
      now: 110, phase, spin: spinWindow({ pace: 22, phase: phase.name }), rng, history: [],
      A: { songId: A.songId, analysis: A, deck: { startCtx: 100, offset: aHook.downbeatSec, rate: 1 }, landedDownbeatIndex: aHook.downbeatIndex },
      B: { songId: B.songId, analysis: B, stems },
    }));
    // D6's fake bar may play B's drums alone, a bar before its re-build (tests/recipes.test.ts checks it).
    if (plan.recipe === 'D6') continue;
    const stemEvents = plan.events.filter((e) => e.kind === 'stems');
    if (plan.teaseStyle !== 'stems') {
      assert.equal(stemEvents.length, 0);
      continue;
    }
    stemTeases++;
    assert.equal(stemEvents.length, 1);
    const [st] = stemEvents;
    // With a tape start (D14) B's own source starts later, in the gap; the Tease keeps its lead.
    const teaseFrom = plan.landing === 'tape' ? plan.T - Math.max(plan.hook.pickupSec, plan.teaseBars * plan.hook.bar) : plan.b.startCtx;
    assert.ok(Math.abs(st.at - teaseFrom) < 1e-9, 'stems start with B');
    assert.ok(st.until <= plan.T - plan.hook.pickupSec + 1e-9, 'stems stop before the pickup');
    assert.ok(st.parts.drums && st.parts.drums.t0 >= st.at - 1e-9);
    if (st.parts.bass) assert.ok(st.parts.bass.t0 > st.parts.drums.t0, 'bass comes in after the drums');
    // (A tape start opens B's own low-pass from where B starts, in the gap: that is not a Tease.)
    assert.ok(!plan.events.some((e) => targetOf(e) === 'B.lpf' && (plan.landing !== 'tape' || eventStart(e) < plan.b.startCtx - 1e-9)), 'no low-pass Tease on top');
    const bGain = plan.events.filter((e) => targetOf(e) === 'B.gain');
    assert.ok(bGain.some((e) => e.kind === 'ramp' && Math.abs(e.t1 - (plan.T - plan.hook.pickupSec)) < 1e-9 && e.to === 1), 'full mix opens on the pickup');
  }
  assert.ok(stemTeases > 50, `only ${stemTeases} stem Teases`);
});

// A synthetic render of B's 8 bars before its hook at A's tempo, like tools/prep/stretch.py's meta.json.
function blendSourceFor(A: Analysis, B: Analysis, hook: Hook, bass = true): BlendSource {
  const barSec = (60 / A.tempo.bpm) * (A.tempo.beatsPerBar || 4);
  const firstDownbeatSec = 0.1;
  return { aSongId: A.songId, hookId: hook.id, toBpm: A.tempo.bpm, firstDownbeatSec, hookSec: firstDownbeatSec + 8 * barSec, barSec, bass };
}

test('R8 Blend: B\'s stretched layer starts on an A downbeat inside the Spin, its hook lands at T on an A downbeat', () => {
  const rng = seededRandom(5150);
  const ids = [...analyses.keys()];
  let blends = 0;
  let fellBack = 0;
  for (let n = 0; n < 600; n++) {
    const A = analysisOf(ids[n % ids.length]);
    const B = analysisOf(ids[(n * 11 + 5) % ids.length]);
    if (A === B || !A.tempo.isStable) continue;
    const aHook = usableHooks(A)[0];
    const hook = usableHooks(B).find((h) => h.tag === 'best') ?? usableHooks(B)[0];
    const phase = [PHASES.early, PHASES.mid, PHASES.late][n % 3];
    const pace = [14, 18, 22][n % 3];
    const deck = { startCtx: 100, offset: aHook.downbeatSec, rate: 1 };
    const plan = planned(planTransition({
      now: 100 + 3 + rng() * 8, phase, spin: spinWindow({ pace, phase: phase.name }), rng, history: [], hookOverride: hook, recipeOverride: 'R8',
      A: { songId: A.songId, analysis: A, deck, landedDownbeatIndex: aHook.downbeatIndex },
      B: { songId: B.songId, analysis: B, blend: blendSourceFor(A, B, hook, n % 2 === 0) },
    }));
    if (plan.recipe !== 'R8') {
      fellBack++;
      assert.notEqual(plan.recipe, 'FADE', 'a blend that does not fit falls back to a real move');
      continue;
    }
    blends++;
    const tl = deckTimeline(A, deck);
    const onA = (t: number) => A.downbeats.some((d) => Math.abs(tl.ctxAt(d) - t) < 1e-9);
    const ev = plan.events.find((e) => e.kind === 'blend');
    assert.ok(ev, 'R8 plays a blend layer');
    assert.ok(onA(plan.T), 'T on an A downbeat');
    assert.ok(onA(ev.at), 'layer starts on an A downbeat');
    assert.ok(ev.at >= plan.spinStart + 0.45 - 1e-9, 'layer starts after the duck');
    assert.ok(Math.abs(ev.fileAt + (plan.T - ev.at) - blendSourceFor(A, B, hook).hookSec) < 1e-9, 'render hook lands at T');
    assert.ok(Math.abs(ev.until - (plan.T - plan.hook.pickupSec)) < 1e-9, 'layer hands over on the pickup');
    assert.ok(plan.blend && plan.blend.bars >= 2 && plan.blend.bars <= 8);
    if (ev.parts.bass) assert.ok(plan.events.some((e) => e.kind === 'ramp' && e.target === 'A.hpf' && e.to >= 250), 'bass swap cuts A\'s bass');
    if (n % 2 === 1) assert.ok(!ev.parts.bass, 'no bass layer when the keys or tempos do not allow it');
    if (plan.impact !== 'none') assert.ok(plan.events.some((e) => e.kind === 'synth' && e.name === 'impact'));
  }
  console.log('blends', blends, 'fell back', fellBack);
  assert.ok(blends > 200, `only ${blends} blends`);
});

test('R8 is never chosen without a render for this hook and this outgoing song', () => {
  const rng = seededRandom(3);
  const ids = [...analyses.keys()];
  for (let n = 0; n < 200; n++) {
    const A = analysisOf(ids[n % ids.length]);
    const B = analysisOf(ids[(n + 9) % ids.length]);
    const aHook = usableHooks(A)[0];
    const other = { ...blendSourceFor(A, B, usableHooks(B)[0]), aSongId: -1 };
    const plan = planned(planTransition({
      now: 110, phase: PHASES.early, rng, history: [],
      A: { songId: A.songId, analysis: A, deck: { startCtx: 100, offset: aHook.downbeatSec, rate: 1 }, landedDownbeatIndex: aHook.downbeatIndex },
      B: { songId: B.songId, analysis: B, blend: other },
    }));
    assert.notEqual(plan.recipe, 'R8');
  }
});

/** Made-up approved Signatures for a song: its intro riff, a build into its chorus and its chorus motif, two bars each. */
function signaturesFor(id: number, analysis: Analysis): SignatureSource[] {
  const bpm = analysis.tempo.bpm;
  const beats = 2 * analysis.tempo.beatsPerBar;
  const durationSec = (beats * 60) / bpm + 0.03;
  return (['riff', 'build', 'motif'] as const).map((kind, k) => ({ id: `${id}-${kind}-0`, kind, durationSec, anchorSec: 0, beats, bpm, gainDb: -2 - k }));
}

/** The same confident key for every hook of a song: A's and B's then agree. */
const sameKeys = (analysis: Analysis): Record<string, KeyInfo> =>
  Object.fromEntries(analysis.hooks.map((h) => [h.id, { key: 'C', mode: 'major', camelot: '8B', confidence: 0.9 }] as const));

test('Signatures: B\'s only, teased just before it lands, ending on the landing; over A only with agreeing keys and tempos; plans without any are unchanged', () => {
  const rng = seededRandom(7);
  const ids = [...analyses.keys()];
  const seen = { B: 0, rate: 0, cut: 0, shape: new Set<string>(), kinds: new Set<string>() };
  const AFTER_DUCK = PLANNER.afterDuckSec;
  for (let n = 0; n < 1500; n++) {
    const aId = ids[Math.floor(rng() * ids.length)];
    let bId = ids[Math.floor(rng() * ids.length)];
    if (bId === aId) bId = ids[(ids.indexOf(aId) + 1) % ids.length];
    const A = analysisOf(aId);
    const B = analysisOf(bId);
    const aHook = usableHooks(A)[0];
    const phase = [PHASES.early, PHASES.mid, PHASES.late, PHASES.final][n % 4];
    const spin = spinWindow({ pace: PACE_PRESETS[n % PACE_PRESETS.length], phase: phase.name });
    const deck = { startCtx: 100, offset: aHook.downbeatSec, rate: 1 };
    const now = 100 + 2 + rng() * 28;
    const seed = Math.floor(rng() * 2 ** 32);
    const keys = n % 2 === 0;
    const request = (withSignatures: boolean) => ({
      now, phase, spin, rng: seededRandom(seed), history: [],
      A: { songId: aId, analysis: A, deck, landedDownbeatIndex: aHook.downbeatIndex, signatures: withSignatures ? signaturesFor(aId, A) : null, keys: keys ? sameKeys(A) : null },
      B: { songId: bId, analysis: B, signatures: withSignatures ? signaturesFor(bId, B) : [], keys: keys ? sameKeys(B) : null },
    });
    const plain = planned(planTransition(request(false)));
    const plan = planned(planTransition(request(true)));
    assert.equal(plain.signature, null);
    // D5's riff bed loops B's riff Signature under R7's bridge: that plan differs by design (recipes.test.ts).
    if (plan.layers.includes('riff')) continue;
    // The Signature draws come last, so everything else about the plan is the same.
    const { signature, events, ...rest } = plan;
    const { signature: _none, events: plainEvents, ...plainRest } = plain;
    assert.deepEqual(rest, plainRest);
    assert.deepEqual(events.filter((e) => e.kind !== 'signature'), plainEvents);
    const sigEvents = events.filter((e) => e.kind === 'signature');
    assert.ok(sigEvents.length <= 1, 'at most one Signature per transition');
    const e = sigEvents[0];
    if (!e || !signature) continue;
    seen.B++;
    seen.shape.add(plan.shape);
    assert.equal(e.deck, 'B', 'only the song that lands is teased');
    const s = signaturesFor(bId, B).find((x) => x.id === e.id);
    assert.ok(s);
    seen.kinds.add(s.kind);
    if (s.kind === 'build') assert.equal(plan.teaseBars, 0, 'a build never doubles B\'s own Tease');
    const bars = (s.beats * 60) / s.bpm / e.rate;
    const start = e.at - e.anchorSec / e.rate;
    const heard = Math.max(start, e.from ?? start);
    if (heard > start + 1e-9) seen.cut++;
    assert.ok(Math.abs(e.at + bars - plan.T) < 1e-6, 'its last bar ends on the landing');
    assert.ok(heard >= plan.spinStart + AFTER_DUCK - 1e-9, 'heard after the spin-start duck');
    assert.ok(e.until <= plan.T - plan.hook.pickupSec + 1e-9, 'faded by B\'s pickup: never after the landing');
    assert.ok(e.until - heard >= SIGNATURES.minFit * bars - 1e-9, 'enough of it plays');
    assert.ok(Math.abs(e.rate - 1) <= SIGNATURES.maxRateShift + 1e-9, 'resampled by at most a few percent');
    if (e.rate !== 1) seen.rate++;
    assert.equal(e.echo, 0);
    if (plan.shape === 'S2') assert.ok(heard >= plan.exitAt - 1e-9, 'S2: on B\'s bridge, after A has gone');
    else {
      assert.ok(keys, `${plan.shape}: over A only when the keys agree`);
      const tl = deckTimeline(A, deck);
      assert.ok(A.downbeats.some((d) => Math.abs(tl.ctxAt(d) - e.at) < 1e-6), `${plan.shape}: on one of A's downbeats`);
    }
  }
  assert.ok(seen.B > 100 && seen.rate > 0 && seen.cut > 0, `enough of each case: ${JSON.stringify({ ...seen, shape: [...seen.shape], kinds: [...seen.kinds] })}`);
  assert.ok(seen.shape.has('S1') && seen.shape.has('S2'));
  assert.deepEqual([...seen.kinds].sort(), ['build', 'motif', 'riff']);
});

test('vocals: a sudden vocal entry gets a quick move straight into the voice; a line of A is answered by B\'s on the downbeat', () => {
  const rng = seededRandom(77);
  const ids = [...analyses.keys()];
  const bars = (n: number, f: (k: number) => number) => Array.from({ length: n }, (_, k) => f(k));
  const count = { entry: 0, call: 0, entryR1: 0, plainR1: 0, plain: 0 };
  for (let n = 0; n < 1200; n++) {
    const aId = ids[Math.floor(rng() * ids.length)];
    let bId = ids[Math.floor(rng() * ids.length)];
    if (bId === aId) bId = ids[(ids.indexOf(aId) + 1) % ids.length];
    const A = analysisOf(aId);
    const B = analysisOf(bId);
    const aHook = usableHooks(A)[0];
    const hook = usableHooks(B)[0];
    const phase = [PHASES.early, PHASES.mid][n % 2];
    const deck = { startCtx: 100, offset: aHook.downbeatSec, rate: 1 };
    const now = 100 + 2 + rng() * 20;
    const k = hook.downbeatIndex;
    if (k < 2) continue; // a hook on the song's first bars has no bars before it to be silent
    const mode = n % 3; // 0: B's singer comes in suddenly; 1: both sing (call and response); 2: B's hook is instrumental
    const bVocals = bars(B.downbeats.length, (j) => (mode === 2 ? -60 : mode === 0 && j < k && j >= k - 2 ? -60 : -18));
    const aVocals = bars(A.downbeats.length, () => (mode === 1 ? -16 : -60));
    const plan = planned(planTransition({
      now, phase, spin: spinWindow({ pace: 14, phase: phase.name }), rng, history: [],
      A: { songId: aId, analysis: A, deck, landedDownbeatIndex: aHook.downbeatIndex, stemBars: { vocals: aVocals } },
      B: { songId: bId, analysis: B, stemBars: { vocals: bVocals } }, hookOverride: hook,
    }));
    if (mode === 0) {
      assert.equal(plan.vocal, 'entry');
      count.entry++;
      if (plan.recipe === 'R1') count.entryR1++;
      // Straight into the voice: no more silence than half a beat, unless the move itself needs its gap (D2's crowd
      // gap, D7's rush, D11's chops, D19's scratch).
      if (hook.pickupSec <= plan.hook.beat && !['D2', 'D7', 'D11', 'D19'].includes(plan.recipe)) assert.ok(plan.gapBeats <= 0.5 + 1e-9, `straight into the voice (${plan.recipe} ${plan.gapBeats})`);
    } else if (mode === 1) {
      assert.equal(plan.vocal, 'callResponse');
      count.call++;
    } else {
      assert.equal(plan.vocal ?? null, null);
      count.plain++;
      if (plan.recipe === 'R1') count.plainR1++;
    }
  }
  // A cut on the one is much more likely before a sudden vocal entry.
  assert.ok(count.entryR1 / count.entry > 1.3 * (count.plainR1 / count.plain), JSON.stringify(count));
});
