// Suspense (GLOSSARY): a transition the presenters hold open on purpose. Pure functions, like the planner:
// - openSuspense: the outgoing song exits on one of its downbeats; from there a loop runs on the incoming
//   song's grid (its hook's bar), without B itself.
// - suspenseBar: one bar of that loop: riser, snare roll and heartbeat kicks, more intense the longer it runs.
//   Each bar is self-contained, so the loop can stop at any bar line.
// - releaseSuspense: the final bar (the Suspense recipe's build, with its silence) and the landing on the next
//   free bar line, as an ordinary Plan, so the show lands it like any other transition.
import { PLANNER, SUSPENSE } from '../config.ts';
import { EXITS, RECIPES, pick, ramp, sfx, synth } from './recipes.ts';
import { deckTimeline, hookGrid, dbToGain } from './timeline.ts';
import { pickHook } from './hooks.ts';
import { classicLanding, impactName } from './landing.ts';
import { LOOKAHEAD_SEC, eventStart, signatureLayer, trimDbFor, type IncomingSong, type OutgoingSong, type Plan, type PlanError, type PlanSummary } from './planner.ts';
import type { Hook } from '../analysis.ts';
import type { PhaseEffects } from '../config.ts';
import type { ExitName, PlanEvent } from './recipes.ts';

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
}

/** Start a Suspense: A exits on its first downbeat that leaves room for the exit move after the duck. */
export function openSuspense({ now, A, B, phase, rng, history = [], hookOverride = null }: SuspenseRequest): SuspenseOpen | PlanError {
  const spinStart = now + LOOKAHEAD_SEC;
  const hook = hookOverride || pickHook(B.analysis, phase, history, rng, { minTailSec: 12 });
  if (!hook) return { error: 'noHook' };
  const grid = hookGrid(B.analysis, hook);
  const events: PlanEvent[] = [sfx('whoosh', spinStart, phase.name === 'early' ? -8 : -5)];
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
        a: { songId: A.songId, stopAt: out.aStopAt, exitStart: d.ctxTime - lead },
      };
    }
    // No downbeat left in A (it is about to end): it fades under the whoosh and the loop starts.
    const end = spinStart + AFTER_DUCK + 0.6;
    events.push(ramp('A.gain', spinStart, end, 1, 0.0001, 'lin'));
    return { phase, spinStart, loopStart: end, ...grid, hook, exit: null, exitIndex: null, events, a: { songId: A.songId, stopAt: end + 0.05, exitStart: spinStart } };
  }
  return { phase, spinStart, loopStart: spinStart + 0.3, ...grid, hook, exit: null, exitIndex: null, events, a: null };
}

/** How intense bar `k` of the loop is: 0 at the start, 1 after SUSPENSE.rampSec. */
export function suspenseIntensity(open: SuspenseOpen, k: number): number {
  return clamp((k * open.bar) / SUSPENSE.rampSec, 0, 1);
}

/** Bar `k` of the loop (k = 0 starts at loopStart). Every event ends by the bar line. */
export function suspenseBar(open: SuspenseOpen, k: number): PlanEvent[] {
  const { bar, beat, bpb, phase } = open;
  const t0 = open.loopStart + k * bar;
  const t1 = t0 + bar;
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
  return events;
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

/** Release: the final bar on the first free bar line at least SUSPENSE.minReleaseLeadSec away, then B lands. */
export function releaseSuspense({ open, releaseAt, firstFreeBar, B, rng, id = null }: ReleaseRequest): Plan {
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
