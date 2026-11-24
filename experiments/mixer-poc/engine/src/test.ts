// Landing tests (B11), the DJ techniques' renders (docs/dj-techniques.md) and the flash-and-click calibration.
// Every case plans a transition with the real planner and renders it through the real graph, decks and
// scheduler in an OfflineAudioContext, in three modes:
//  - landing: A is a DC level, B a tiny DC with one click at its hook; B's click must sound at T (±5 ms after
//    the limiter's fixed pre-delay) and A must leave no residual;
//  - mix: noise on both songs (and their stems) with every effect on: no NaN, peaks under +0.5 dBFS;
//  - silence: A is noise, B silent and disconnected (a scratch's needle noise is B's), the effect returns cut: A's
//    own path must be silent after its exit.
// Then the primitive checks: P1 subtraction on a real song's stems (from the relay; skipped without them), P1
// with a lane rate (D15: a braking −lane still cancels its part), and the P3 pre-verb render's shape.
import { AudioGraph } from './audio/graph.ts';
import { Deck } from './audio/deck.ts';
import { applyPlan } from './audio/scheduler.ts';
import { preverbKey, renderPreverb } from './audio/preverb.ts';
import { planTransition } from './plan/planner.ts';
import { PHASES } from './plan/phases.ts';
import { AudioClock } from './clock.ts';
import { metronomeClick } from './audio/synth/clicks.ts';
import { seededRandom } from './rng.ts';
import { ANALYSIS_SCHEMA_VERSION, checkStemsMeta, type Analysis } from './analysis.ts';
import { MOVES } from './config.ts';
import { el as $ } from './dom.ts';
import type { BlendSource, IncomingSong, OutgoingSong, PlanForce } from './plan/planner.ts';
import type { RecipeId, StemName } from './plan/recipes.ts';
import type { StemSlices } from './audio/stems.ts';
import type { ExitName, PhaseName } from '@quina/protocol';

const SR = 48000;
const SONG_SEC = 120;

/**
 * What a case gives the planner and the decks besides A and B: A's stem lanes, B's render (and its stretched
 * voice), B's vocals, B's call and riff, B's pre-verb (and its vocal one), agreeing keys.
 */
interface Kit {
  lanes?: boolean;
  blend?: boolean;
  blendVocals?: boolean;
  vocals?: boolean;
  call?: boolean;
  riff?: boolean;
  preverb?: boolean;
  vocalPreverb?: boolean;
  keys?: boolean;
}

/** One render: A playing from its hook, Next pressed `pressOffset` s later, B's hook `pickupBeats` after its pickup. */
interface RenderCase {
  label: string;
  recipe: RecipeId;
  phase: PhaseName;
  force?: PlanForce;
  kit?: Kit;
  bpmA: number;
  bpmB: number;
  pickupBeats: number;
  pressOffset: number;
}

type Mode = 'landing' | 'mix' | 'silence';

/** One render's measurements. */
interface RenderResult {
  label: string;
  mode: Mode;
  recipe: RecipeId;
  exit: ExitName | null;
  variant: string;
  landing: string;
  phase: PhaseName;
  bpm: string;
  pickupBeats: number;
  D: string;
  /** landing: B's click against T (ms, before the limiter's pre-delay is taken off). */
  clickErrorMs: number;
  /** landing: what is left of A after T; silence: A after its exit. */
  residual: number;
  peakDb: number;
  finite: boolean;
  /** The forced recipe or variant was played (it may fall back when it does not fit). */
  asForced: boolean;
  pass: boolean;
}

/** A primitive check (P1, P3). */
interface CheckResult {
  name: string;
  pass: boolean;
  skipped: boolean;
  detail: string;
}

/** What `window.testResults` holds after a run (read by the browser automation). */
interface TestResults {
  rows: RenderResult[];
  checks: CheckResult[];
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

function buffer(ctx: BaseAudioContext, seconds: number, fill: (data: Float32Array) => void, channels = 1): AudioBuffer {
  const b = ctx.createBuffer(channels, Math.ceil(seconds * SR), SR);
  for (let c = 0; c < channels; c++) fill(b.getChannelData(c));
  return b;
}

const noise = (level: number) => (d: Float32Array) => d.forEach((_, i) => (d[i] = (Math.random() * 2 - 1) * level));

/**
 * A song and its stems, stored at half scale like analysis/stems.py: mix = 2·(drums + bass + vocals) + other.
 * Landing mode uses DC levels (0.5 in all); the other modes noise.
 */
function songWithStems(ctx: BaseAudioContext, mode: Mode | 'quiet'): { mix: AudioBuffer; stems: StemSlices } {
  const level = mode === 'quiet' ? 0 : 1;
  const part = (dc: number, n: number) => buffer(ctx, SONG_SEC, (d) => (mode === 'landing' ? d.fill(dc) : noise(n * level)(d)));
  const drums = part(0.05, 0.08);
  const bass = part(0.05, 0.05);
  const vocals = part(0.1, 0.06);
  const mix = buffer(ctx, SONG_SEC, (d) => {
    const [a, b, c] = [drums, bass, vocals].map((x) => x.getChannelData(0));
    for (let i = 0; i < d.length; i++) d[i] = 2 * (a[i] + b[i] + c[i]) + (mode === 'landing' ? 0.1 : (Math.random() * 2 - 1) * 0.05 * level);
  });
  return { mix, stems: { buffers: { drums, bass, vocals }, startSec: 0, scale: 2 } };
}

async function runCase(c: RenderCase, mode: Mode): Promise<RenderResult> {
  const seconds = 24;
  const ctx = new OfflineAudioContext(1, SR * seconds, SR);
  const graph = new AudioGraph(ctx);
  if (mode !== 'mix') {
    // Measure B (or A) alone: no impacts, risers, rolls or whoosh, and a transparent limiter.
    graph.fxBus.gain.value = 0;
    graph.synthBus.gain.value = 0;
    graph.limiter.threshold.value = 0;
    graph.limiter.ratio.value = 1;
  }
  if (mode === 'silence') {
    // Only A's own path: the echo and the reverb carry its tails on purpose.
    graph.echo.ret.disconnect();
    graph.reverb.ret.disconnect();
  }
  const kit = c.kit ?? {};
  const A = fakeAnalysis({ songId: 1, bpm: c.bpmA, seconds: SONG_SEC, hookBar: 8 });
  const B = fakeAnalysis({ songId: 2, bpm: c.bpmB, seconds: SONG_SEC, hookBar: 16, pickupBeats: c.pickupBeats });
  const hook = B.hooks[0];
  const hookSample = Math.round(hook.downbeatSec * SR);
  const songA = songWithStems(ctx, mode);
  const songB = songWithStems(ctx, mode === 'silence' ? 'quiet' : mode === 'landing' ? 'landing' : 'mix');
  // B: a tiny DC with one click at its hook (landing), noise (mix) or nothing (silence). Its stems never click.
  const bufB = buffer(ctx, SONG_SEC, (d) => {
    if (mode === 'mix') noise(0.35)(d);
    else d.fill(mode === 'landing' ? 0.01 : 0);
  });
  if (mode === 'landing') bufB.getChannelData(0)[hookSample] = 0.9;
  const bStems = { ...songB.stems, buffers: { drums: songB.stems.buffers.drums, bass: songB.stems.buffers.bass, vocals: songB.stems.buffers.vocals } };

  // A has been playing from its hook since ctx time 0.5.
  const deckA = new Deck(graph, { songId: 1, buffer: songA.mix, analysis: A });
  deckA.start(0.5, A.hooks[0].downbeatSec);
  deckA.landedDownbeatIndex = 8;
  if (kit.lanes) deckA.lanes = songA.stems;
  const { startCtx, offset, rate } = deckA;
  if (startCtx == null) throw new Error('deck A did not start');
  const now = 0.5 + c.pressOffset;
  const keys = kit.keys ? { [A.hooks[0].id]: KEY, [hook.id]: KEY } : null;
  const aSong: OutgoingSong = {
    songId: 1, analysis: A, deck: { startCtx, offset, rate }, landedDownbeatIndex: 8,
    lanes: kit.lanes ? { fromSec: A.hooks[0].downbeatSec - 1, toSec: A.hooks[0].downbeatSec + 48, parts: ['drums', 'bass', 'vocals', 'other'] } : null,
    keys,
  };
  const barA = (4 * 60) / c.bpmA;
  const blend: BlendSource | null = kit.blend
    ? { aSongId: 1, hookId: hook.id, toBpm: c.bpmA, firstDownbeatSec: 0.1, hookSec: 0.1 + 8 * barA, barSec: barA, bass: true, vocals: Boolean(kit.blendVocals) }
    : null;
  const callLength = (4.5 * 60) / c.bpmB;
  const riffLength = (8 * 60) / c.bpmB + 0.05;
  const bSong: IncomingSong = {
    songId: 2, analysis: B, blend, keys,
    stems: kit.vocals ? { [hook.id]: { parts: ['drums', 'bass', 'vocals'] } } : null,
    signatures: [
      ...(kit.call ? [{ id: '2-call-0', kind: 'call', durationSec: callLength, anchorSec: (0.5 * 60) / c.bpmB, beats: 4, bpm: c.bpmB, gainDb: -2 } as const] : []),
      ...(kit.riff ? [{ id: '2-riff-0', kind: 'riff', durationSec: riffLength, anchorSec: 0, beats: 8, bpm: c.bpmB, gainDb: -3 } as const] : []),
    ],
    preverbs: kit.preverb ? [hook.id] : null,
    vocalPreverbs: kit.vocalPreverb ? [hook.id] : null,
  };
  const plan = planTransition({ now, A: aSong, B: bSong, phase: PHASES[c.phase], rng: seededRandom(7), recipeOverride: c.recipe, force: c.force ?? null });
  if ('error' in plan) throw new Error(`${c.label}: no plan (${plan.error})`);
  const deckB = new Deck(graph, { songId: 2, buffer: bufB, analysis: B, trimDb: 0 });
  deckB.fader.gain.value = 0;
  deckB.start(plan.b.startCtx, plan.b.offset, plan.b.rate, plan.b.powerUp ?? null);
  if (mode === 'silence') for (const out of [deckB.fader, deckB.stemOut, deckB.signatureOut]) out.disconnect();
  if (kit.vocals) deckB.stems = { ...bStems, parts: ['drums', 'bass', 'vocals'] };
  if (blend) {
    const render = (n: number) => buffer(ctx, blend.hookSec + 2 * barA, (d) => (mode === 'landing' ? d.fill(0.01) : noise(n * (mode === 'silence' ? 0 : 1))(d)));
    deckB.blend = { buffers: { drums: render(0.2), bass: render(0.15), vocals: render(0.12) }, scale: 1 };
  }
  // B's Signatures: a sine call and a riff of two bars of chords (silent in silence mode).
  const tone = (seconds: number, hz: number) => buffer(ctx, seconds, (d) => d.forEach((_, i) => (d[i] = mode === 'silence' ? 0 : 0.3 * Math.sin((2 * Math.PI * hz * i) / SR) * Math.min(1, i / 480))));
  deckB.signatures = new Map([...(kit.call ? [['2-call-0', tone(callLength, 330)] as const] : []), ...(kit.riff ? [['2-riff-0', tone(riffLength, 220)] as const] : [])]);
  if (kit.preverb || kit.vocalPreverb) {
    // Rendered from B without its click, so the swell cannot be mistaken for the hook.
    const source = mode === 'landing' ? buffer(ctx, SONG_SEC, (d) => d.fill(0.01)) : bufB;
    const beat = 60 / c.bpmB;
    const cut = { fromSec: hook.downbeatSec - hook.pickupSec, durSec: beat, rt60: MOVES.preverb.rt60Bars * 4 * beat, fadeInSec: MOVES.preverb.fadeInSec };
    const renders = new Map<string, AudioBuffer>();
    if (kit.preverb) renders.set(preverbKey(hook.id), await renderPreverb(source, cut));
    if (kit.vocalPreverb) renders.set(preverbKey(hook.id, 'vocals'), await renderPreverb(songB.stems.buffers.vocals ?? source, { ...cut, gain: 2 }));
    deckB.preverbs = renders;
  }
  // Schedule at the plan's press time, like the live engine.
  ctx.suspend(now).then(() => {
    applyPlan(plan, { graph, decks: { A: deckA, B: deckB } });
    if (plan.a) deckA.stop(plan.a.stopAt);
    ctx.resume();
  });
  const rendered = (await ctx.startRendering()).getChannelData(0);
  let peak = 0;
  let finite = true;
  for (let k = 0; k < rendered.length; k++) {
    const v = rendered[k];
    if (!Number.isFinite(v)) finite = false;
    else if (Math.abs(v) > peak) peak = Math.abs(v);
  }
  const forcedRecipe = plan.recipe === c.recipe;
  // A forced variant shows as the plan's variant kind, as a flag or a detail of it (R4's pitchUp, D10's juggle,
  // R7's riff), or not at all for an exit's own variant (the spiral's direction under R7).
  const v = c.force?.variant;
  const forcedVariant = !v || plan.variant?.kind === v || plan.variant?.[v] === true || Object.values(plan.variant ?? {}).includes(v) ||
    (plan.recipe === 'R7' && (v === 'up' || v === 'down'));
  const forcedBridge = !c.force?.bridge || plan.variant?.kind === c.force.bridge;
  const forcedLanding = !c.force?.landing || plan.landing === c.force.landing;
  const forcedGhost = (!c.force?.ghost || plan.layers.includes('ghost')) && (!c.force?.ghostVoice || plan.layers.includes('ghostVoice'));
  const forcedExit = !c.force?.exit || plan.exit === c.force.exit;
  const forcedLayers = (!c.force?.riff || plan.layers.includes('riff')) &&
    (!c.force?.gapLayer || plan.layers.includes(c.force.gapLayer === 'chop' ? 'gapChop' : 'gapScratch')) &&
    (!c.force?.preverbSource || plan.events.some((e) => e.kind === 'preverb' && (e.source ?? 'mix') === c.force?.preverbSource));
  const result: RenderResult = {
    label: c.label, mode, recipe: plan.recipe, exit: plan.exit, variant: plan.variant ? String(plan.variant.kind) : '', landing: `${plan.landing}${plan.layers.length ? ` + ${plan.layers.join(', ')}` : ''}`,
    phase: c.phase, bpm: `${c.bpmA}→${c.bpmB}`, pickupBeats: c.pickupBeats, D: plan.D.toFixed(2),
    clickErrorMs: 0, residual: 0, peakDb: 20 * Math.log10(Math.max(peak, 1e-9)), finite,
    asForced: forcedRecipe && forcedVariant && forcedBridge && forcedLanding && forcedGhost && forcedExit && forcedLayers, pass: false,
  };
  const T = Math.round(plan.T * SR);
  if (mode === 'landing') {
    let clickAt = -1;
    let clickPeak = 0;
    for (let i = T - SR * 0.1; i < T + SR * 0.1; i++) {
      if (Math.abs(rendered[i]) > clickPeak) {
        clickPeak = Math.abs(rendered[i]);
        clickAt = i;
      }
    }
    // B's DC is removed by the deck's 20 Hz high-pass, so anything left is A or its echo.
    result.clickErrorMs = ((clickAt - T) / SR) * 1000;
    result.residual = maxAbs(rendered, T + Math.round(0.2 * SR), T + Math.round(0.4 * SR));
  } else if (mode === 'silence' && plan.a) {
    // A's own path from the end of its move (the gap, or the bridge's start) until after the landing.
    const silentAt = plan.shape === 'S2' ? plan.exitAt : plan.T - plan.hook.pickupSec - plan.gapBeats * plan.hook.beat;
    const from = Math.round((Math.max(plan.a.stopAt, silentAt) + 0.03) * SR);
    result.residual = maxAbs(rendered, from, T + Math.round(0.5 * SR));
  }
  return result;
}

/** The largest |sample| in [from, to) (a loop: a spread of half a million samples overflows the call stack). */
function maxAbs(data: Float32Array, from: number, to: number): number {
  let peak = 0;
  for (let k = Math.max(0, from); k < Math.min(data.length, to); k++) peak = Math.max(peak, Math.abs(data[k]));
  return peak;
}

/** Each case's own pass rule (the landing's needs the limiter's pre-delay, measured once). */
function judge(r: RenderResult, latencyMs: number): boolean {
  if (!r.finite || !r.asForced) return false;
  if (r.mode === 'landing') return Math.abs(r.clickErrorMs - latencyMs) <= 5 && r.residual < 0.005;
  if (r.mode === 'silence') return r.residual < 0.001;
  return r.peakDb <= 0.5;
}

/** The render set: every recipe, each new technique per Phase, every variant, bridge, exit, landing and layer. */
function renderSet(): RenderCase[] {
  const cases: RenderCase[] = [];
  const pairs: [number, number][] = [[128, 128], [96, 140], [150, 88]];
  const add = (label: string, recipe: RecipeId, phase: PhaseName, extra: Pick<RenderCase, 'force' | 'kit'> = {}, all = false, bpms: [number, number][] = pairs) => {
    for (const [bpmA, bpmB] of all ? bpms : bpms.slice(0, 1)) {
      for (const pickupBeats of [0, 1]) cases.push({ label, recipe, phase, bpmA, bpmB, pickupBeats, pressOffset: 3.3, ...extra });
    }
  };
  // The first recipes, as before (every tempo pair).
  for (const [recipe, phase] of [['R1', 'early'], ['R2', 'early'], ['R4', 'mid'], ['R5', 'early'], ['R6', 'early'], ['R7', 'late'], ['R10', 'final']] as const) add(recipe, recipe, phase, {}, true);
  // D1, D2, D3 in every Phase; D8 and D10 with A's stem lanes, D10 with B's render too; D11 with B's vocals or call.
  for (const phase of ['early', 'mid', 'late', 'final'] as const) {
    add(`D1 ${phase}`, 'D1', phase, {}, phase === 'mid');
    add(`D2 ${phase}`, 'D2', phase, {}, phase === 'late');
    add(`D3 ${phase}`, 'D3', phase, {}, phase === 'early');
    add(`D8 ${phase}`, 'D8', phase, { kit: { lanes: true } }, phase === 'late');
  }
  for (const variant of ['gate', 'pump', 'gatePump'] as const) add(`D1 ${variant}`, 'D1', 'mid', { force: { variant } });
  for (const variant of ['acapella', 'beat', 'drumsVoice'] as const) add(`D8 ${variant}`, 'D8', 'final', { kit: { lanes: true }, force: { variant } });
  const near: [number, number][] = [[128, 126], [100, 104]];
  add('D10', 'D10', 'mid', { kit: { lanes: true, blend: true } }, true, near);
  add('D10 juggle', 'D10', 'late', { kit: { lanes: true, blend: true }, force: { variant: 'juggle' } }, false, near);
  add('D10 throw', 'D10', 'mid', { kit: { lanes: true, blend: true }, force: { variant: 'throw' } }, false, near);
  add('D11 stem', 'D11', 'mid', { kit: { vocals: true } }, true);
  add('D11 call', 'D11', 'late', { kit: { vocals: true, call: true } });
  // Variants of the older recipes, R7's bridges and new exits, the landings and the Ghost.
  for (const variant of ['lpf', 'stab'] as const) add(`R1 ${variant}`, 'R1', 'early', { force: { variant } });
  add('R2 freeze', 'R2', 'mid', { force: { variant: 'freeze' } });
  add('R2 vocal throw', 'R2', 'mid', { kit: { lanes: true }, force: { variant: 'vocalThrow' } });
  for (const variant of ['triplet', 'pitchUp', 'lastBeat'] as const) add(`R4 ${variant}`, 'R4', 'mid', { force: { variant } });
  for (const variant of ['brake', 'spinback'] as const) add(`R5 ${variant}`, 'R5', 'late', { force: { variant } });
  for (const bridge of ['halftime', 'kickroll', 'clap'] as const) add(`R7 ${bridge}`, 'R7', 'mid', { force: { bridge } });
  add('R7 gate exit', 'R7', 'mid', { force: { exit: 'gate' } });
  add('R7 spiral exit', 'R7', 'late', { force: { exit: 'spiral', variant: 'up' } });
  add('R7 spiral-down exit', 'R7', 'late', { force: { exit: 'spiral', variant: 'down' } });
  add('dry landing', 'R1', 'early', { force: { landing: 'dry' } });
  add('pre-verb landing (S2)', 'R7', 'late', { kit: { preverb: true }, force: { landing: 'preverb' } }, true);
  add('pre-verb landing (S1)', 'D3', 'mid', { kit: { preverb: true }, force: { landing: 'preverb' } });
  add('D9 ghost', 'R2', 'mid', { kit: { vocals: true }, force: { ghost: true } }, true);
  add('D9 ghost on D1', 'D1', 'late', { kit: { vocals: true }, force: { ghost: true } });
  // The second batch: D6, D7, D15, D16, D19 in their Phases and variants; D5's riff bed; D14's tape start; the gap
  // layers; the ghost on a bridge and its voice; D12 from B's voice.
  // D6 needs three of B's bars of bridge: at 88 BPM that is longer than a 14 s Pace's Spin (the planner falls back).
  const fakePairs: [number, number][] = [[128, 128], [96, 140]];
  for (const phase of ['late', 'final'] as const) add(`D6 ${phase}`, 'D6', phase, { kit: { vocals: true } }, phase === 'late', fakePairs);
  for (const variant of ['drums', 'comedy', 'kicks'] as const) add(`D6 ${variant}`, 'D6', 'late', { kit: { vocals: true }, force: { variant } });
  for (const phase of ['mid', 'late'] as const) add(`D7 ${phase}`, 'D7', phase, { force: { variant: 'plain' } }, phase === 'mid');
  add('D7 gate', 'D7', 'late', { force: { variant: 'gate' } }, true);
  for (const phase of ['mid', 'late', 'final'] as const) add(`D15 ${phase}`, 'D15', phase, { kit: { lanes: true } }, phase === 'late');
  for (const phase of ['mid', 'late', 'final'] as const) add(`D16 ${phase}`, 'D16', phase, { kit: { lanes: true, blend: true, blendVocals: true, vocals: true } }, phase === 'mid', near);
  for (const phase of ['mid', 'late', 'final'] as const) add(`D19 ${phase}`, 'D19', phase, { kit: { vocals: true } }, phase === 'late');
  for (const variant of ['baby', 'chirp', 'forward'] as const) add(`D19 ${variant}`, 'D19', 'late', { kit: { vocals: true, call: true }, force: { variant } });
  // Late always Teases: the riff bed plays over B's stem Tease (never under a low-passed B).
  for (const variant of ['dry', 'throw', 'gate'] as const) add(`D5 riff ${variant}`, 'R7', 'late', { kit: { riff: true, vocals: true }, force: { riff: true, variant } }, variant === 'dry');
  add('D14 tape after R5', 'R5', 'late', { force: { landing: 'tape' } }, true);
  add('D14 tape after R10 (stem Tease)', 'R10', 'final', { kit: { vocals: true }, force: { landing: 'tape' } });
  add('D14 tape after D2', 'D2', 'final', { force: { landing: 'tape' } });
  add('gap chop (D11 in S1)', 'R1', 'late', { kit: { vocals: true }, force: { gapLayer: 'chop', landing: 'cymbal' } }, true);
  add('gap scratch (D19 in S1)', 'D3', 'final', { kit: { vocals: true, call: true }, force: { gapLayer: 'scratch', landing: 'cymbal' } });
  add('D9 ghost on a bridge', 'R7', 'late', { kit: { vocals: true }, force: { ghost: true, exit: 'echo' } });
  add('D9 ghost becomes a voice', 'R2', 'late', { kit: { vocals: true, keys: true }, force: { ghost: true, ghostVoice: true } });
  add('D12 from B\'s vocals', 'R7', 'late', { kit: { preverb: true, vocalPreverb: true, vocals: true }, force: { landing: 'preverb', preverbSource: 'vocals' } }, true);
  return cases;
}

/** A confident key, the same for both songs: their hooks agree (D9's voice). */
const KEY = { key: 'C', mode: 'major', camelot: '8B', confidence: 0.9 } as const;

/**
 * P1 with a lane rate (D15): a song whose mix is its voice alone brakes (its rate ramps to 0.02, as A.rate does),
 * and a −vocals lane with the same rate automation removes the voice: the braking mix must be silent. The lane
 * starts half a second before the brake, so the deck's filters have rung out the voice they held by then.
 */
async function laneRateCheck(): Promise<CheckResult> {
  const name = 'P1 lane rate: a braking −lane cancels its part';
  try {
    const seconds = 3;
    const render = async (withLane: boolean) => {
      const ctx = new OfflineAudioContext(1, SR * seconds, SR);
      const graph = new AudioGraph(ctx);
      graph.limiter.threshold.value = 0;
      graph.limiter.ratio.value = 1;
      const vocals = buffer(ctx, 20, noise(0.1));
      const mix = buffer(ctx, 20, (d) => d.set(vocals.getChannelData(0).map((v) => 2 * v)));
      const deck = new Deck(graph, { songId: 9, buffer: mix, analysis: fakeAnalysis({ songId: 9, bpm: 120, seconds: 20, hookBar: 1 }) });
      deck.lanes = { buffers: { vocals }, startSec: 0, scale: 2 };
      deck.start(0.0123456, 5.4321);
      const brake = { t0: 1.0001, t1: 1.8, from: 1, to: 0.02, curve: 'lin' } as const;
      ctx.suspend(0.5).then(() => {
        const param = deck.param('rate');
        param?.setValueAtTime(brake.from, brake.t0);
        param?.linearRampToValueAtTime(brake.to, brake.t1);
        if (withLane) deck.playLane({ part: 'vocals', at: brake.t0 - 0.5, until: 2.5, direct: [[brake.t0 - 0.5, -1]], rate: brake });
        ctx.resume();
      });
      return (await ctx.startRendering()).getChannelData(0);
    };
    const plain = await render(false);
    const cancelled = await render(true);
    const span = [Math.round(1.0 * SR), Math.round(1.75 * SR)];
    const rms = (d: Float32Array) => Math.sqrt(d.slice(span[0], span[1]).reduce((s, v) => s + v * v, 0) / (span[1] - span[0]));
    const db = 20 * Math.log10(Math.max(rms(cancelled), 1e-12) / Math.max(rms(plain), 1e-12));
    return { name, pass: db < -60, skipped: false, detail: `the voice left in the mix while it brakes: ${db.toFixed(1)} dB` };
  } catch (error) {
    return { name, pass: false, skipped: false, detail: String(error) };
  }
}

/** P1 through the real graph, on a real song from the relay: mix with every part removed is silent; mix − drums is exact. */
async function laneCheck(songId = 1): Promise<CheckResult> {
  const name = 'P1 stem-lane subtraction (real stems)';
  try {
    const metaResponse = await fetch(`/data/stems/${songId}.json`, { cache: 'no-store' });
    const meta = metaResponse.ok ? checkStemsMeta(await metaResponse.json()) : null;
    const mixResponse = await fetch(`/audio/${songId}.flac`);
    if (!meta || !mixResponse.ok) return { name, pass: true, skipped: true, detail: `no stems or audio for song ${songId} on this relay` };
    const window = meta.windows[0];
    const seconds = 4;
    const ctx = new OfflineAudioContext(2, SR * seconds, SR);
    const mix = await ctx.decodeAudioData(await mixResponse.arrayBuffer());
    const stems: Partial<Record<StemName, AudioBuffer>> = {};
    for (const part of ['drums', 'bass', 'vocals'] as const) {
      const r = await fetch(`/stems/${songId}/${part}.${window.startSample}.flac`);
      if (!r.ok) return { name, pass: true, skipped: true, detail: `no ${part} stem` };
      stems[part] = await ctx.decodeAudioData(await r.arrayBuffer());
    }
    const render = async (parts: readonly ('drums' | 'bass' | 'vocals' | 'other')[], song: AudioBuffer = mix) => {
      const off = new OfflineAudioContext(2, SR * seconds, SR);
      const graph = new AudioGraph(off);
      graph.limiter.threshold.value = 0;
      graph.limiter.ratio.value = 1;
      const deck = new Deck(graph, { songId, buffer: song, analysis: fakeAnalysis({ songId, bpm: 120, seconds: 10, hookBar: 1 }) });
      deck.lanes = { buffers: stems, startSec: window.startSample / SR, scale: 1 / meta.stemGain };
      // An arbitrary, non-frame start, as a plan gives.
      deck.start(0.0123456, 52.3711 - 0.4123);
      for (const part of parts) deck.playLane({ part, at: 1.0003, until: 3.5, direct: [[1.0003, -1]] });
      return off.startRendering();
    };
    const drums = stems.drums;
    if (!drums) throw new Error('no drums');
    // The truth for mix − drums: the song with its drums subtracted sample by sample, played by a plain deck
    // through the same graph (so the same filters), started the same way.
    const truth = new AudioBuffer({ numberOfChannels: mix.numberOfChannels, length: mix.length, sampleRate: SR });
    for (let c = 0; c < mix.numberOfChannels; c++) {
      const out = truth.getChannelData(c);
      out.set(mix.getChannelData(c));
      const d = drums.getChannelData(Math.min(c, drums.numberOfChannels - 1));
      for (let k = 0; k < d.length && window.startSample + k < out.length; k++) out[window.startSample + k] -= d[k] / meta.stemGain;
    }
    const plain = await render([]);
    const noDrums = await render(['drums']);
    const nothing = await render(['drums', 'bass', 'vocals', 'other']);
    const reference = await render([], truth);
    const span = [Math.round(1.1 * SR), Math.round(3.4 * SR)];
    const rms = (f: (c: number, k: number) => number) => {
      let sum = 0;
      for (let c = 0; c < 2; c++) for (let k = span[0]; k < span[1]; k++) sum += f(c, k) ** 2;
      return Math.sqrt(sum / (2 * (span[1] - span[0])));
    };
    const mixRms = rms((c, k) => plain.getChannelData(c)[k]);
    const leftDb = 20 * Math.log10(Math.max(rms((c, k) => nothing.getChannelData(c)[k]), 1e-12) / mixRms);
    const drumsDb = 20 * Math.log10(Math.max(rms((c, k) => noDrums.getChannelData(c)[k] - reference.getChannelData(c)[k]), 1e-12) / mixRms);
    const pass = leftDb < -60 && drumsDb < -60;
    return { name, pass, skipped: false, detail: `song ${songId}: every part removed ${leftDb.toFixed(1)} dB, drums removed ${drumsDb.toFixed(1)} dB (against the mix)` };
  } catch (error) {
    return { name, pass: false, skipped: false, detail: String(error) };
  }
}

/** P3: the pre-verb of a click swells into its end, finite, as long as the reverb. */
async function preverbCheck(): Promise<CheckResult> {
  const ctx = new OfflineAudioContext(1, SR, SR);
  const source = buffer(ctx, 3, (d) => {
    d[Math.round(1 * SR)] = 0.9;
  }, 2);
  const rt60 = 1.5;
  const swell = await renderPreverb(source, { fromSec: 1, durSec: 0.5, rt60, fadeInSec: 0.02 });
  const data = swell.getChannelData(0);
  const tenth = Math.floor(data.length / 10);
  const rmsOf = (a: number, b: number) => Math.sqrt(data.slice(a, b).reduce((s, v) => s + v * v, 0) / (b - a));
  const rise = 20 * Math.log10(rmsOf(data.length - tenth, data.length) / Math.max(rmsOf(0, tenth), 1e-12));
  const finite = data.every((v) => Number.isFinite(v));
  const lengthOk = data.length === Math.floor(SR * rt60 * 1.2);
  return { name: 'P3 pre-verb render', pass: finite && lengthOk && rise > 30, skipped: false, detail: `${data.length} frames, last tenth ${rise.toFixed(1)} dB over the first, finite ${finite}` };
}

async function runAll(): Promise<TestResults> {
  $('summary').textContent = 'Rendering…';
  // `?only=checks` runs just the primitive checks (P1, P3); `?only=<text>` the cases whose label contains it.
  const only = new URLSearchParams(location.search).get('only');
  const cases = only === 'checks' ? [] : renderSet().filter((c) => !only || c.label.includes(only));
  // The limiter (DynamicsCompressor) adds a fixed pre-delay; measure it once with a bare impulse.
  const latencyMs = await measureLimiterLatency();
  const rows: RenderResult[] = [];
  const mixesDone = new Set<string>();
  for (const c of cases) {
    $('summary').textContent = `Rendering ${c.label} (${rows.length} renders done)…`;
    rows.push(await runCase(c, 'landing'));
    // One mix and one silence render per case label and tempo pair.
    const key = `${c.label} ${c.bpmA}→${c.bpmB}`;
    if (mixesDone.has(key)) continue;
    mixesDone.add(key);
    rows.push(await runCase(c, 'mix'));
    rows.push(await runCase(c, 'silence'));
  }
  for (const r of rows) r.pass = judge(r, latencyMs);
  const checks = [await laneCheck(), await laneRateCheck(), await preverbCheck()];
  const failures = rows.filter((r) => !r.pass).length + checks.filter((c) => !c.pass).length;
  const table = $('results');
  table.innerHTML = '<tr><th>Case</th><th>Mode</th><th>Recipe</th><th>Exit</th><th>Variant</th><th>Landing</th><th>Phase</th><th>BPM</th><th>Pickup</th><th>D s</th><th>Click − T (ms, after pre-delay)</th><th>A residual</th><th>Peak dBFS</th><th></th></tr>';
  for (const r of rows) {
    const tr = document.createElement('tr');
    const click = r.mode === 'landing' ? (r.clickErrorMs - latencyMs).toFixed(2) : '';
    tr.innerHTML = `<td>${r.label}</td><td>${r.mode}</td><td>${r.recipe}</td><td>${r.exit ?? ''}</td><td>${r.variant}</td><td>${r.landing}</td><td>${r.phase}</td><td>${r.bpm}</td><td>${r.pickupBeats}</td><td>${r.D}</td><td>${click}</td><td>${r.mode === 'mix' ? '' : r.residual.toFixed(5)}</td><td>${r.peakDb.toFixed(1)}</td><td class="${r.pass ? 'pass' : 'fail'}">${r.pass ? 'pass' : r.asForced ? 'FAIL' : 'FAIL (fell back)'}</td>`;
    table.append(tr);
  }
  for (const c of checks) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="13">${c.name}: ${c.detail}</td><td class="${c.pass ? 'pass' : 'fail'}">${c.skipped ? 'skipped' : c.pass ? 'pass' : 'FAIL'}</td>`;
    table.append(tr);
  }
  const by = (mode: Mode) => rows.filter((r) => r.mode === mode);
  const passed = (mode: Mode) => by(mode).filter((r) => r.pass).length;
  const worstPeak = Math.max(...by('mix').map((r) => r.peakDb));
  const summary = `${passed('landing')}/${by('landing').length} landings · ${passed('silence')}/${by('silence').length} silent after exit · ${passed('mix')}/${by('mix').length} mixes (worst peak ${worstPeak.toFixed(1)} dBFS) · limiter pre-delay ${latencyMs.toFixed(2)} ms · ${checks.map((c) => `${c.name}: ${c.skipped ? 'skipped' : c.pass ? 'pass' : 'FAIL'}`).join(' · ')}`;
  $('summary').textContent = summary;
  const results: TestResults = { rows, checks, latencyMs, failures, summary };
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
if (new URLSearchParams(location.search).get('run') === '1') {
  // A case that throws still ends the run, so the automation never waits for nothing.
  runAll().catch((error: unknown) => {
    const summary = `run failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`;
    $('summary').textContent = summary;
    window.testResults = { rows: [], checks: [], latencyMs: 0, failures: 1, summary };
  });
}

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
