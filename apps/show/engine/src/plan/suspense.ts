// Suspense (GLOSSARY): a transition the presenters hold open on purpose. Pure functions, like the planner:
// - openSuspense: the outgoing song A keeps playing and repeats the 4-bar phrase it is in (plan/loop.ts) while
//   the build grows over it, bar by bar on A's own downbeats. Without A's phrases to count (nothing playing, or no
//   landed hook) A exits on one of its downbeats and the loop runs on B's grid instead, without B itself.
// - suspenseBar: one bar of the build: riser, snare roll and heartbeat kicks, more intense the longer it runs;
//   over A's loop, A thins out too (its high-pass climbs, it dips a little). Each bar is self-contained, so the
//   build can stop at any bar line.
// - suspenseTease: over A's loop, a Decoy tease of one of the songs the drum hovers over (GLOSSARY: Decoy): its
//   hook, low-passed, cut by a tape stop before the phrase's last bar. A tease never counts.
// - releaseSuspense: the final bar (the Suspense recipe's build, with its silence) and the landing: over A's loop
//   at the end of a pass of its phrase (A leaves by an exit move in that last bar, and B lands on A's phrase
//   boundary), else on the next free bar line of B's grid. An ordinary Plan, so the show lands it like any other.
import { DECOYS, PLANNER, SUSPENSE } from '../config.ts';
import { EXITS, RECIPES, pick, ramp, sfx, synth } from './recipes.ts';
import { deckTimeline, hookGrid, dbToGain } from './timeline.ts';
import { currentPhraseLoop, type PhraseLoop } from './loop.ts';
import { pickHook } from './hooks.ts';
import { classicLanding, impactName } from './landing.ts';
import { LOOKAHEAD_SEC, eventStart, signatureLayer, trimDbFor, type IncomingSong, type OutgoingSong, type Plan, type PlanError, type PlanSummary } from './planner.ts';
import type { Analysis, Hook } from '../analysis.ts';
import type { PhaseEffects } from '../config.ts';
import type { DecoyEvent, ExitName, PlanEvent } from './recipes.ts';

const AFTER_DUCK = PLANNER.afterDuckSec;
const DECLICK_SEC = PLANNER.declickSec;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export interface SuspenseRequest {
  /** AudioContext currentTime at the press. */
  now: number;
  A: OutgoingSong | null;
  B: IncomingSong;
  phase: PhaseEffects;
  rng: () => number;
  history?: readonly PlanSummary[];
  /** Land this hook instead of picking one. */
  hookOverride?: Hook | null;
}

/** A Suspense over A's own phrase: A keeps playing and repeats it under the build. */
export interface SuspenseLoop {
  songId: number;
  analysis: Analysis;
  landedDownbeatIndex: number | null;
  phrase: PhraseLoop;
  rate: number;
  /** When the phrase's first pass started (it was playing as the Suspense opened). */
  firstPassAt: number;
  /** One pass of the phrase on the context clock. */
  passSec: number;
  /** Where each of the phrase's bars starts within a pass (bars + 1 marks; the last is the pass's end). */
  marks: number[];
  /** The phrase's bar where the build's bar 0 is (the first downbeat after the spin-start duck). */
  firstBar: number;
}

/** An open Suspense. Times are AudioContext seconds. */
export interface SuspenseOpen {
  phase: PhaseEffects;
  spinStart: number;
  /** Where the loop starts: A's exit downbeat, or a moment after the press when nothing plays. */
  loopStart: number;
  /** B's grid at the hook: the loop's bar and beat. */
  bar: number;
  beat: number;
  bpb: number;
  hook: Hook;
  exit: ExitName | null;
  exitIndex: number | null;
  /** A's exit, if A was playing: it stops at `stopAt`; until `exitStart` a cancel can keep it. */
  a: { songId: number; stopAt: number; exitStart: number } | null;
  /** A's duck and exit (and the whoosh). */
  events: PlanEvent[];
  /** Over A's own phrase (A keeps playing), or null: A left, and the build runs on B's grid. */
  loop: SuspenseLoop | null;
}

/** Start a Suspense: A exits on its first downbeat that leaves room for the exit move after the duck. */
export function openSuspense({ now, A, B, phase, rng, history = [], hookOverride = null }: SuspenseRequest): SuspenseOpen | PlanError {
  const spinStart = now + LOOKAHEAD_SEC;
  const hook = hookOverride || pickHook(B.analysis, phase, history, rng, { minTailSec: 12 });
  if (!hook) return { error: 'noHook' };
  const grid = hookGrid(B.analysis, hook);
  const events: PlanEvent[] = [sfx('whoosh', spinStart, phase.dress.whooshDb)];
  // A keeps playing: its phrase repeats under the build, which starts on its first downbeat after the duck.
  const at = A ? currentPhraseLoop(A, spinStart + AFTER_DUCK, SUSPENSE.loopBars) : null;
  if (A && at) {
    const { phrase, downbeat } = at;
    const rate = A.deck.rate || 1;
    const tl = deckTimeline(A.analysis, A.deck, A.landedDownbeatIndex);
    const marks = A.analysis.downbeats.slice(phrase.fromIndex, phrase.fromIndex + phrase.bars + 1).map((d) => (d - phrase.fromSec) / rate);
    const passSec = marks[phrase.bars];
    const bar = passSec / phrase.bars;
    const bpb = A.analysis.tempo?.beatsPerBar || 4;
    return {
      phase, spinStart, loopStart: tl.ctxAt(A.analysis.downbeats[downbeat]), bar, beat: bar / bpb, bpb, hook, exit: null, exitIndex: null, a: null, events,
      loop: {
        songId: A.songId, analysis: A.analysis, landedDownbeatIndex: A.landedDownbeatIndex ?? null, phrase, rate,
        firstPassAt: tl.ctxAt(phrase.fromSec), passSec, marks, firstBar: downbeat - phrase.fromIndex,
      },
    };
  }
  if (A) {
    const tl = deckTimeline(A.analysis, A.deck, A.landedDownbeatIndex);
    const lastExit = history.map((h) => h.exit).filter(Boolean).pop();
    const exits = SUSPENSE.exits.filter((x) => x !== lastExit);
    const exit: ExitName = pick(exits.length ? exits : SUSPENSE.exits, rng);
    const level = dbToGain(phase.duckDb ?? -3);
    for (const d of tl.downbeatsBetween(spinStart + AFTER_DUCK, spinStart + 30)) {
      const lead = EXITS[exit].lead(tl, d.index);
      if (d.ctxTime - lead < spinStart + AFTER_DUCK) continue;
      if (tl.posAt(d.ctxTime) > tl.durationSec - 0.25) break;
      const out = EXITS[exit].build({ A: { tl, level }, i: d.index, end: d.ctxTime, rng, bars: 1, tailBeats: 2 });
      events.push(ramp('A.gain', spinStart, spinStart + 0.4, 1, level, 'lin'), ...out.events);
      return {
        phase, spinStart, loopStart: d.ctxTime, ...grid, hook, exit, exitIndex: d.index, events,
        a: { songId: A.songId, stopAt: out.aStopAt, exitStart: d.ctxTime - lead }, loop: null,
      };
    }
    // No downbeat left in A (it is about to end): it fades under the whoosh and the loop starts.
    const end = spinStart + AFTER_DUCK + 0.6;
    events.push(ramp('A.gain', spinStart, end, 1, 0.0001, 'lin'));
    return { phase, spinStart, loopStart: end, ...grid, hook, exit: null, exitIndex: null, events, a: { songId: A.songId, stopAt: end + 0.05, exitStart: spinStart }, loop: null };
  }
  return { phase, spinStart, loopStart: spinStart + 0.3, ...grid, hook, exit: null, exitIndex: null, events, a: null, loop: null };
}

/**
 * A Spin turned into a Suspense after A's exit had started (D177): A can't come back, so its exit plays out as the Spin
 * planned it, and the build runs on B's grid from where A's move ends (S2: where the bridge would start), without B.
 * Nothing new is scheduled before then: the runtime cuts the rest of the Spin there (`fromSpin.cutAt`).
 * @returns null when the Spin's hook isn't B's (it always is)
 */
export function suspenseFromExit({ now, plan, B, phase }: { now: number; plan: Pick<Plan, 'spinStart' | 'exitAt' | 'exit' | 'exitIndex' | 'a' | 'hook'>; B: IncomingSong; phase: PhaseEffects }): SuspenseOpen | null {
  const hook = B.analysis.hooks.find((h) => h.id === plan.hook.id);
  if (!hook) return null;
  return {
    phase, spinStart: plan.spinStart, loopStart: Math.max(plan.exitAt, now + LOOKAHEAD_SEC), ...hookGrid(B.analysis, hook), hook,
    exit: plan.exit, exitIndex: plan.exitIndex, a: plan.a, events: [], loop: null,
  };
}

/** How intense bar `k` of the loop is: 0 at the start, 1 after SUSPENSE.rampSec. */
export function suspenseIntensity(open: SuspenseOpen, k: number): number {
  return clamp((k * open.bar) / SUSPENSE.rampSec, 0, 1);
}

/**
 * Where the build's bar `k` starts and ends (k = 0 at loopStart): over A's loop, on A's own downbeats of the
 * pass it falls in, else on B's even grid.
 */
export function barSpan(open: SuspenseOpen, k: number): { t0: number; t1: number; pass: number; j: number } {
  const loop = open.loop;
  if (!loop) return { t0: open.loopStart + k * open.bar, t1: open.loopStart + (k + 1) * open.bar, pass: 0, j: k };
  const g = loop.firstBar + k;
  const pass = Math.floor(g / loop.phrase.bars);
  const j = g % loop.phrase.bars;
  const passAt = loop.firstPassAt + pass * loop.passSec;
  return { t0: passAt + loop.marks[j], t1: passAt + loop.marks[j + 1], pass, j };
}

/** Over A's loop: A's high-pass (Hz) and level as the build reaches intensity `u`. */
const aThin = (u: number) => ({ hpf: 20 * (SUSPENSE.aHpfTopHz / 20) ** u, gain: dbToGain(SUSPENSE.aDipDb * u) });

/** Bar `k` of the loop (k = 0 starts at loopStart). Every event ends by the bar line. */
export function suspenseBar(open: SuspenseOpen, k: number): PlanEvent[] {
  const { bpb, phase } = open;
  const { t0, t1 } = barSpan(open, k);
  const beat = (t1 - t0) / bpb; // this bar's own beat (over A's loop its bars follow A's downbeats)
  const u = suspenseIntensity(open, k);
  const loud = { early: -14, mid: -12, late: -10, final: -8 }[phase.name] ?? -12;
  const stages = u < 0.34 ? [1, 0.5] : u < 0.67 ? [0.5, 0.25] : [0.25, 0.125];
  const beats = Array.from({ length: bpb }, (_, j) => t0 + j * beat);
  const events: PlanEvent[] = [
    synth('riser', { t0, t1, fromHz: 500 + 600 * u, toHz: 2500 + 6500 * u, fromDb: loud - 26 + 6 * u, toDb: loud - 10 + 6 * u, tone: true }),
    synth('snareRoll', { t0, t1, beat, pitchTo: (phase.snarePitch ?? 5) * (0.4 + 0.6 * u), stages, velFrom: 40 + 40 * u, velTo: 70 + 50 * u }),
    // A heartbeat: the first beat only at first, every beat once it builds.
    synth('kicks', { times: u < 0.5 ? beats.filter((_, j) => j % 2 === 0) : beats, level: 0.25 + 0.5 * u }),
  ];
  if (k % 4 === 3) events.push(synth('swell', { t0: t1 - 2 * beat, t1, peakDb: loud - 6 + 4 * u }));
  if (open.loop) {
    // A thins out as the build grows over it: its high-pass climbs, its level dips a little.
    const from = aThin(u);
    const to = aThin(suspenseIntensity(open, k + 1));
    events.push(ramp('A.hpf', t0, t1, from.hpf, to.hpf, 'exp'), ramp('A.gain', t0, t1, from.gain, to.gain, 'lin'));
  }
  return events;
}

/** A song the drum hovers over, teased over A's loop. */
export interface TeaseSource {
  songId: number;
  analysis: Analysis;
  hook: Hook;
}

/**
 * Over A's loop, bar `k` brings a Decoy tease (GLOSSARY: Decoy) of `song`: its hook, low-passed, from half a beat
 * into the bar, cut by a tape stop before the phrase's last bar so the build keeps it. A tease never counts.
 * @returns null when bar `k` is not a pass's second bar, or the tease would not fit
 */
export function suspenseTease(open: SuspenseOpen, k: number, song: TeaseSource): { events: PlanEvent[]; at: number; until: number } | null {
  const loop = open.loop;
  if (!loop || k < 1) return null;
  const { t0, j, pass } = barSpan(open, k);
  if (j !== 1) return null;
  const lastBar = loop.firstPassAt + pass * loop.passSec + loop.marks[loop.phrase.bars - 1];
  const at = t0 + open.beat / 2;
  const cutAt = Math.min(at + DECOYS.maxSec, lastBar - DECOYS.cutSec);
  if (cutAt - at < DECOYS.minSec) return null;
  const pickup = Math.min(song.hook.pickupSec || 0, song.hook.downbeatSec);
  const tease: DecoyEvent = {
    kind: 'decoy', songId: song.songId, at, offset: song.hook.downbeatSec - pickup, cutAt, cutSec: DECOYS.cutSec,
    gainDb: SUSPENSE.teaseGainDb + clamp(song.hook.gainToTargetDb ?? song.analysis.loudness?.gainToTargetDb ?? 0, -12, 6), lpfHz: SUSPENSE.teaseLpfHz,
  };
  return { events: [tease, sfx(DECOYS.cutSfx, cutAt + DECOYS.cutSec * 0.6, -8)], at, until: lastBar };
}

/** The bar line the loop has reached at `at` (bars whose start is before it). */
export function barsBefore(open: SuspenseOpen, at: number): number {
  return Math.max(0, Math.ceil((at - open.loopStart) / open.bar - 1e-9));
}

export interface ReleaseRequest {
  open: SuspenseOpen;
  /** AudioContext time of the release. */
  releaseAt: number;
  /** The first loop bar not yet scheduled: the final bar can start there at the earliest. */
  firstFreeBar: number;
  B: IncomingSong;
  rng: () => number;
  id?: string | null;
}

/**
 * Release: the final bar, then B lands. Over A's loop, at the end of the first pass whose last bar is still free
 * and at least SUSPENSE.minReleaseLeadSec away: A leaves by an exit move in that bar, and B lands on A's phrase
 * boundary. Otherwise on B's grid, on the first free bar line that far away.
 */
export function releaseSuspense(request: ReleaseRequest): Plan {
  return request.open.loop ? releaseOverLoop(request, request.open.loop) : releaseOnGrid(request);
}

function releaseOverLoop({ open, releaseAt, firstFreeBar, B, rng, id = null }: ReleaseRequest, loop: SuspenseLoop): Plan {
  const { hook, phase } = open;
  const pickup = Math.min(hook.pickupSec || 0, hook.downbeatSec);
  const lead = Math.min(hook.downbeatSec, pickup + DECLICK_SEC);
  const gB = hookGrid(B.analysis, hook);
  const ready = releaseAt + SUSPENSE.minReleaseLeadSec;
  const bars = loop.phrase.bars;
  const gapBeats = pickup > gB.beat ? 0 : pick(phase.gapBeats, rng);
  const exit: ExitName = pick(SUSPENSE.exits, rng);
  const i = loop.phrase.fromIndex + bars;
  /** A's clock in pass `p`, so its exit move sits on its own downbeats; B lands on the phrase's end. */
  const passClock = (p: number) => deckTimeline(loop.analysis, { startCtx: loop.firstPassAt + p * loop.passSec, offset: loop.phrase.fromSec, rate: loop.rate }, loop.landedDownbeatIndex);
  // The first pass whose end leaves room after `ready` for A's exit, the final bar and B's start, all in bars not
  // yet scheduled (the build stops scheduling bars at the release).
  const freeFrom = Math.max(ready, barSpan(open, firstFreeBar).t0);
  let pass = 0;
  for (;; pass++) {
    const { t0, t1 } = barSpan(open, pass * bars + bars - 1 - loop.firstBar);
    const gapStart = t1 - pickup - gapBeats * gB.beat;
    if (Math.min(t0, gapStart - EXITS[exit].lead(passClock(pass), i), t1 - lead) >= freeFrom - 1e-9) break;
  }
  const tl = passClock(pass);
  const k = pass * bars + bars - 1 - loop.firstBar;
  const { t0: finalBar, t1: T } = barSpan(open, k);
  const beatA = (T - finalBar) / open.bpb;
  const pickupAt = T - pickup;
  const gapStart = pickupAt - gapBeats * gB.beat;
  const bStart = T - lead;
  const level = aThin(suspenseIntensity(open, k)).gain;
  const out = EXITS[exit].build({ A: { tl, level }, i, end: gapStart, rng, bars: 1, tailBeats: 2 });
  const exitStart = gapStart - EXITS[exit].lead(tl, i);
  const recipe = RECIPES.SUSPENSE;
  const grid = { bar: T - finalBar, beat: beatA, bpb: open.bpb };
  const built = recipe.build({ A: null, i: null, e: finalBar, T, pickupAt, gapStart, bStart, tease: false, teaseStems: null, gB: grid, phase, rng, exit: null, blend: null });
  const events = [...out.events, ...built.events];
  const signature = signatureLayer({ shape: 'S2', tl: null, A: null, B, gB, spinStart: releaseAt, e: finalBar, T, pickupAt, keysMatch: false, teased: false, phase, rng });
  if (signature) events.push(signature);
  return {
    id, kind: 'suspense', recipe: recipe.id, recipeName: recipe.name, family: recipe.family, shape: recipe.shape, exit, variant: null,
    phase: phase.name, now: releaseAt, spinStart: open.spinStart, T, D: T - open.spinStart,
    window: { dMin: 0, dTarget: T - open.spinStart, dMax: T - open.spinStart },
    exitAt: exitStart, exitIndex: i, landIndex: i, bridgeBars: 0, gapBeats, teaseBars: 0, teaseStyle: null, blend: null,
    signature: signature ? { deck: signature.deck, id: signature.id, at: signature.at, rate: signature.rate } : null,
    landing: 'cymbal', impact: impactName(classicLanding(phase)), layers: [], phraseClass: tl.phraseClass(i), relaxed: false, cost: null, candidates: 0,
    hook: { id: hook.id, tag: hook.tag, downbeatSec: hook.downbeatSec, downbeatIndex: hook.downbeatIndex, pickupSec: pickup, bar: gB.bar, beat: gB.beat },
    a: { songId: loop.songId, stopAt: out.aStopAt, exitStart },
    b: { songId: B.songId, startCtx: bStart, offset: hook.downbeatSec - lead, rate: 1, lead, trimDb: trimDbFor(B.analysis, hook), bpm: B.analysis.tempo?.bpm },
    events: events.sort((x, y) => eventStart(x) - eventStart(y)),
  };
}

/** Release on B's grid (A left as the Suspense opened): the final bar on the first free bar line, then B lands. */
function releaseOnGrid({ open, releaseAt, firstFreeBar, B, rng, id = null }: ReleaseRequest): Plan {
  const { hook, bar, beat, phase } = open;
  const pickup = Math.min(hook.pickupSec || 0, hook.downbeatSec);
  const lead = Math.min(hook.downbeatSec, pickup + DECLICK_SEC);
  // The final bar must not be a loop bar already scheduled, and both it and B's start (a long pickup can
  // begin before the final bar) need a moment after the release to be scheduled.
  const ready = releaseAt + SUSPENSE.minReleaseLeadSec;
  const m = Math.max(firstFreeBar, barsBefore(open, ready), barsBefore(open, ready + lead - bar));
  const finalBar = open.loopStart + m * bar;
  const T = finalBar + bar;
  const gapBeats = pickup > beat ? 0 : pick(phase.gapBeats, rng);
  const pickupAt = T - pickup;
  const gapStart = pickupAt - gapBeats * beat;
  const bStart = T - lead;
  const gB = { bar, beat, bpb: open.bpb };
  const recipe = RECIPES.SUSPENSE;
  const built = recipe.build({ A: null, i: null, e: finalBar, T, pickupAt, gapStart, bStart, tease: false, teaseStems: null, gB, phase, rng, exit: null, blend: null });
  const events = [...built.events];
  const signature = signatureLayer({ shape: 'S2', tl: null, A: null, B, gB, spinStart: releaseAt, e: finalBar, T, pickupAt, keysMatch: false, teased: false, phase, rng });
  if (signature) events.push(signature);
  return {
    id,
    kind: 'suspense',
    recipe: recipe.id,
    recipeName: recipe.name,
    family: recipe.family,
    shape: recipe.shape,
    exit: open.exit,
    variant: null,
    phase: phase.name,
    now: releaseAt,
    spinStart: open.spinStart,
    T,
    D: T - open.spinStart,
    window: { dMin: 0, dTarget: T - open.spinStart, dMax: T - open.spinStart },
    exitAt: open.loopStart,
    exitIndex: open.exitIndex,
    // B lands on its own loop's grid after A has gone, not on a bar of A.
    landIndex: null,
    bridgeBars: m + 1,
    gapBeats,
    teaseBars: 0,
    teaseStyle: null,
    blend: null,
    signature: signature ? { deck: signature.deck, id: signature.id, at: signature.at, rate: signature.rate } : null,
    landing: 'cymbal',
    impact: impactName(classicLanding(phase)),
    layers: [],
    phraseClass: null,
    relaxed: false,
    cost: null,
    candidates: 0,
    hook: { id: hook.id, tag: hook.tag, downbeatSec: hook.downbeatSec, downbeatIndex: hook.downbeatIndex, pickupSec: pickup, bar, beat },
    // A left when the Suspense opened (its exit is in the opening events).
    a: null,
    b: { songId: B.songId, startCtx: bStart, offset: hook.downbeatSec - lead, rate: 1, lead, trimDb: trimDbFor(B.analysis, hook), bpm: B.analysis.tempo?.bpm },
    events: events.sort((x, y) => eventStart(x) - eventStart(y)),
  };
}
