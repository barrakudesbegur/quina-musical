// Landing tests (B11) and the flash-and-click calibration.
import { AudioGraph } from './audio/graph.ts';
import { Deck } from './audio/deck.ts';
import { applyPlan } from './audio/scheduler.ts';
import { planTransition } from './plan/planner.ts';
import { PHASES } from './plan/phases.ts';
import { AudioClock } from './clock.ts';
import { metronomeClick } from './audio/synth/clicks.ts';
import { seededRandom } from './rng.ts';
import { ANALYSIS_SCHEMA_VERSION, type Analysis } from './analysis.ts';
import { el as $ } from './dom.ts';
import type { RecipeId } from './plan/recipes.ts';
import type { ExitName, PhaseName } from '@quina/protocol';

const SR = 48000;

/** One landing render: A playing from its hook, Next pressed `pressOffset` s later, B's hook `pickupBeats` after its pickup. */
interface LandingCase {
  recipe: RecipeId;
  phase: PhaseName;
  bpmA: number;
  bpmB: number;
  pickupBeats: number;
  pressOffset: number;
}

/** Where B's hook click landed against T, and what was left of A after its exit. */
interface LandingResult {
  recipe: RecipeId;
  exit: ExitName | null;
  phase: PhaseName;
  bpm: string;
  pickupBeats: number;
  D: string;
  T: string;
  lead: string;
  clickErrorMs: number;
  residual: number;
  expectStart: number;
  planStartSample: number;
}

/** A full-mix render's peak level. */
interface MixResult {
  recipe: RecipeId;
  exit: ExitName | null;
  phase: PhaseName;
  bpm: string;
  peakDb: number;
  finite: boolean;
  events: number;
}

/** What `window.testResults` holds after a run (read by the browser automation). */
interface TestResults {
  rows: LandingResult[];
  mixes: MixResult[];
  latencyMs: number;
  failures: number;
  summary: string;
}

declare global {
  interface Window {
    testResults?: TestResults;
    runLandingTests?: () => Promise<TestResults>;
  }
}

// A minimal analysis object with a steady grid: beats from 0, downbeats every bpb beats.
function fakeAnalysis({ songId, bpm, seconds, hookBar, pickupBeats = 0 }: { songId: number; bpm: number; seconds: number; hookBar: number; pickupBeats?: number }): Analysis {
  const beat = 60 / bpm;
  const beats: number[] = [];
  for (let t = 0; t < seconds; t += beat) beats.push(Number(t.toFixed(6)));
  const downbeats = beats.filter((_, i) => i % 4 === 0);
  const hookDownbeat = downbeats[hookBar];
  return {
    schemaVersion: ANALYSIS_SCHEMA_VERSION,
    songId,
    title: `fake ${songId}`,
    artist: 'test',
    source: { durationSec: seconds, sampleRate: SR },
    tempo: { bpm, beatsPerBar: 4, barSecMedian: 4 * beat },
    beats,
    downbeats,
    hooks: [{ id: `${songId}-best-0`, tag: 'best', valid: true, downbeatSec: hookDownbeat, downbeatIndex: hookBar, pickupSec: pickupBeats * beat, barSecLocal: 4 * beat, gainToTargetDb: 0 }],
    loudness: { gainToTargetDb: 0 },
  };
}

function buffer(ctx: BaseAudioContext, seconds: number, fill: (data: Float32Array) => void): AudioBuffer {
  const b = ctx.createBuffer(1, Math.ceil(seconds * SR), SR);
  fill(b.getChannelData(0));
  return b;
}

async function runCase(c: LandingCase & { fullMix: true }): Promise<MixResult>;
async function runCase(c: LandingCase & { fullMix?: false }): Promise<LandingResult>;
// fullMix: noise on both songs with every effect on, to check the peaks instead of the landing.
async function runCase({ recipe, phase, bpmA, bpmB, pickupBeats, pressOffset, fullMix = false }: LandingCase & { fullMix?: boolean }): Promise<LandingResult | MixResult> {
  const seconds = 22;
  const ctx = new OfflineAudioContext(1, SR * seconds, SR);
  const graph = new AudioGraph(ctx);
  if (!fullMix) {
    // Measure B alone: no impacts, risers, rolls or whoosh, and a transparent limiter.
    graph.fxBus.gain.value = 0;
    graph.synthBus.gain.value = 0;
    graph.limiter.threshold.value = 0;
    graph.limiter.ratio.value = 1;
  }
  const A = fakeAnalysis({ songId: 1, bpm: bpmA, seconds: 120, hookBar: 8 });
  const B = fakeAnalysis({ songId: 2, bpm: bpmB, seconds: 120, hookBar: 16, pickupBeats });
  const hookSample = Math.round(B.hooks[0].downbeatSec * SR);
  // Landing mode: A is DC (any leftover is easy to see), B is a tiny DC plus one click at the hook.
  // Full-mix mode: both are noise at a pop-like level, to check peaks with every effect on.
  const bufA = buffer(ctx, 120, (d) => (fullMix ? d.forEach((_, i) => (d[i] = (Math.random() * 2 - 1) * 0.35)) : d.fill(0.5)));
  const bufB = buffer(ctx, 120, (d) => {
    if (fullMix) d.forEach((_, i) => (d[i] = (Math.random() * 2 - 1) * 0.35));
    else d.fill(0.01);
    d[hookSample] = 0.9;
  });

  // A has been playing from its hook since ctx time 0.5.
  const deckA = new Deck(graph, { songId: 1, buffer: bufA, analysis: A });
  deckA.start(0.5, A.hooks[0].downbeatSec);
  deckA.landedDownbeatIndex = 8;
  // The planner reads A's clock (DeckClock), which a started deck has.
  const { startCtx, offset, rate } = deckA;
  if (startCtx == null) throw new Error('deck A did not start');
  const now = 0.5 + pressOffset;
  const plan = planTransition({
    now,
    A: { songId: 1, analysis: A, deck: { startCtx, offset, rate }, landedDownbeatIndex: 8 },
    B: { songId: 2, analysis: B },
    phase: PHASES[phase],
    rng: seededRandom(7),
    recipeOverride: recipe,
  });
  if ('error' in plan) throw new Error(`${recipe}: no plan (${plan.error})`);
  const deckB = new Deck(graph, { songId: 2, buffer: bufB, analysis: B, trimDb: 0 });
  deckB.fader.gain.value = 0;
  deckB.start(plan.b.startCtx, plan.b.offset);
  // Schedule at the plan's press time, like the live engine.
  ctx.suspend(now).then(() => {
    applyPlan(plan, { graph, decks: { A: deckA, B: deckB } });
    if (plan.a) deckA.stop(plan.a.stopAt);
    ctx.resume();
  });
  const rendered = (await ctx.startRendering()).getChannelData(0);
  if (fullMix) {
    let peak = 0;
    let finite = true;
    for (let k = 0; k < rendered.length; k++) {
      const v = rendered[k];
      if (!Number.isFinite(v)) finite = false;
      else if (Math.abs(v) > peak) peak = Math.abs(v);
    }
    return { recipe: plan.recipe, exit: plan.exit, phase, bpm: `${bpmA}→${bpmB}`, peakDb: 20 * Math.log10(peak), finite, events: plan.events.length };
  }

  // Measurements. A is 0.5 DC; after the exit only B (0.01 DC + click) should remain.
  const expectStart = Math.round(plan.b.startCtx * SR);
  const T = Math.round(plan.T * SR);
  let clickAt = -1;
  let clickPeak = 0;
  for (let i = T - SR * 0.1; i < T + SR * 0.1; i++) {
    if (Math.abs(rendered[i]) > clickPeak) {
      clickPeak = Math.abs(rendered[i]);
      clickAt = i;
    }
  }
  const afterCut = rendered.slice(T + Math.round(0.2 * SR), T + Math.round(0.4 * SR));
  // B's DC is removed by the deck's 20 Hz high-pass, so anything left is A or its echo.
  const residual = Math.max(...afterCut.map((v) => Math.abs(v)));
  return {
    recipe: plan.recipe,
    exit: plan.exit,
    phase,
    bpm: `${bpmA}→${bpmB}`,
    pickupBeats,
    D: plan.D.toFixed(2),
    T: plan.T.toFixed(4),
    lead: plan.b.lead.toFixed(4),
    clickErrorMs: ((clickAt - T) / SR) * 1000,
    residual,
    expectStart,
    planStartSample: plan.b.startCtx * SR,
  };
}

async function runAll(): Promise<TestResults> {
  $('summary').textContent = 'Rendering…';
  const cases: LandingCase[] = [];
  const recipePhases: [RecipeId, PhaseName][] = [['R1', 'early'], ['R2', 'early'], ['R4', 'mid'], ['R5', 'early'], ['R6', 'early'], ['R7', 'late'], ['R10', 'final']];
  for (const [recipe, phase] of recipePhases) {
    for (const [bpmA, bpmB] of [[128, 128], [96, 140], [150, 88]]) {
      for (const pickupBeats of [0, 1]) cases.push({ recipe, phase, bpmA, bpmB, pickupBeats, pressOffset: 3.3 });
    }
  }
  const rows: LandingResult[] = [];
  for (const c of cases) rows.push(await runCase(c));
  const mixes: MixResult[] = [];
  for (const [recipe, phase] of recipePhases) mixes.push(await runCase({ recipe, phase, bpmA: 124, bpmB: 100, pickupBeats: 0, pressOffset: 3.3, fullMix: true }));
  // The limiter (DynamicsCompressor) adds a fixed pre-delay; measure it once with a bare impulse.
  const latencyMs = await measureLimiterLatency();
  let failures = 0;
  const table = $('results');
  table.innerHTML = '<tr><th>Recipe</th><th>Exit</th><th>Phase</th><th>BPM</th><th>Pickup</th><th>D s</th><th>Click − T (ms)</th><th>after limiter latency</th><th>A residual</th><th></th></tr>';
  for (const r of rows) {
    const corrected = r.clickErrorMs - latencyMs;
    const pass = Math.abs(corrected) <= 5 && r.residual < 0.005;
    if (!pass) failures++;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.recipe}</td><td>${r.exit ?? ''}</td><td>${r.phase}</td><td>${r.bpm}</td><td>${r.pickupBeats}</td><td>${r.D}</td><td>${r.clickErrorMs.toFixed(2)}</td><td>${corrected.toFixed(2)}</td><td>${r.residual.toFixed(4)}</td><td class="${pass ? 'pass' : 'fail'}">${pass ? 'pass' : 'FAIL'}</td>`;
    table.append(tr);
  }
  const badMix = mixes.filter((m) => !m.finite || m.peakDb > 0.5);
  const summary = `${rows.length - failures}/${rows.length} landings pass · limiter pre-delay ${latencyMs.toFixed(2)} ms · full-mix peaks ${mixes.map((m) => `${m.recipe} ${m.peakDb.toFixed(1)} dBFS`).join(', ')}${badMix.length ? ' · BAD MIX' : ''}`;
  $('summary').textContent = summary;
  const results: TestResults = { rows, mixes, latencyMs, failures: failures + badMix.length, summary };
  window.testResults = results;
  return results;
}

async function measureLimiterLatency(): Promise<number> {
  const ctx = new OfflineAudioContext(1, SR, SR);
  const graph = new AudioGraph(ctx);
  const src = ctx.createBufferSource();
  src.buffer = buffer(ctx, 0.5, (d) => (d[Math.round(0.1 * SR)] = 0.5));
  src.connect(graph.musicBus);
  src.start(0);
  const out = (await ctx.startRendering()).getChannelData(0);
  let at = 0;
  let peak = 0;
  out.forEach((v, i) => {
    if (Math.abs(v) > peak) {
      peak = Math.abs(v);
      at = i;
    }
  });
  return ((at - Math.round(0.1 * SR)) / SR) * 1000;
}

$('run').addEventListener('click', runAll);
window.runLandingTests = runAll;
if (new URLSearchParams(location.search).get('run') === '1') runAll();

// ---------------------------------------------------------------------------- flash-and-click
let live: { ctx: AudioContext; clock: AudioClock } | null = null;
function startFlash(): void {
  if (live) return;
  const ctx = new AudioContext({ sampleRate: SR, latencyHint: 'interactive' });
  const clock = new AudioClock(ctx);
  const clicks: number[] = [];
  let next = ctx.currentTime + 0.5;
  live = { ctx, clock };
  $('offset').textContent = `display offset ${clock.displayOffsetMs} ms · output latency ${Math.round((ctx.outputLatency || 0) * 1000)} ms`;
  setInterval(() => {
    while (next < ctx.currentTime + 0.3) {
      metronomeClick(ctx, ctx.destination, next, { accent: true, level: 2 });
      clicks.push(next);
      next += 1.5;
    }
  }, 25);
  const loop = () => {
    const audible = clock.audible();
    const on = clicks.some((t) => audible >= t && audible < t + 1 / 60);
    $('flash-area').classList.toggle('on', on);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
$('flash-start').addEventListener('click', startFlash);
for (const [id, delta] of [['offset-down', -5], ['offset-up', 5]] as const) {
  $(id).addEventListener('click', () => {
    if (!live) return;
    live.clock.setDisplayOffsetMs(live.clock.displayOffsetMs + delta);
    $('offset').textContent = `display offset ${live.clock.displayOffsetMs} ms`;
  });
}
