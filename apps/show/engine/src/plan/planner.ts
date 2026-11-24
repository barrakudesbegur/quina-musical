// The transition planner: a pure function from (analysis, deck state, phase, history) to a plan of
// timed events plus the landing time T. Only scheduler.ts touches Web Audio, so this runs in Node tests.
//
// Two shapes:
//  S1 "ride A, then land": T is one of A's downbeats; A's exit move ends at T (minus pickup and gap).
//  S2 "exit, bridge, land": A exits on its downbeat e; a build of N bars on B's grid fills [e, T],
//     so T = e + N·barB. B's timeline is the clock during the bridge, so the riser, roll and B's
//     low-passed Tease are phase-locked to the hook without any time-stretching.
// The Spin window (dMin, dTarget, dMax) comes from the Pace (pace.ts); the phase sets the effects.
import { RECIPES, THEATRICAL, DEFAULT_WEIGHTS, NO_CAPS, familyGroup, ramp, sfx, SILENT, pick, eventStart } from './recipes.ts';
import { deckTimeline, hookGrid, dbToGain } from './timeline.ts';
import { pickHook } from './hooks.ts';
import { SPIN_LIMITS, spinWindow } from './pace.ts';
import { compatible } from './keys.ts';
import { chooseLanding, impactName, preverbEvent } from './landing.ts';
import type { ImpactKind } from './landing.ts';
import { gapChopSlices, ghostLayer, scratchMove } from './layers.ts';
import { freshNumber, freshWeights, memoryOf, recency } from './variety.ts';
import { weightedPick } from '../rng.ts';
import { PLANNER, LAYERING, MOVES, SIGNATURES, STEMS, VARIETY } from '../config.ts';
import type { Analysis, Hook, SignatureKind } from '../analysis.ts';
import type { PhaseEffects, PhaseName } from '../config.ts';
import type { KeyInfo } from './keys.ts';
import type { SpinWindow } from './pace.ts';
import type { DeckClock, HookGrid, PhraseClass, Timeline } from './timeline.ts';
import type { BridgePattern } from './bridges.ts';
import type { LandingStyle } from './landing.ts';
import type { ChopSource, LayerName, RiffSource } from './layers.ts';
import type { Memory, Remembered } from './variety.ts';
import type {
  BlendLayer, Caps, ExitName, LanePart, LaneWindow, OutgoingDeck, PlanEvent, PreverbSource, Recipe, RecipeFamily, RecipeId, RecipeShape,
  RecipeVariant, SignatureEvent, StemBars, StemName,
} from './recipes.ts';

export const LOOKAHEAD_SEC = PLANNER.lookaheadSec;
const DECLICK_SEC = PLANNER.declickSec;
const AFTER_DUCK = PLANNER.afterDuckSec;
const PHRASE_COST = PLANNER.phraseCost;
const DRIFT_COST_PER_SEC = PLANNER.driftCostPerSec;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
/** RECIPES by any string: phase weights and history entries may name a recipe that does not exist (yet). */
const RECIPE_LOOKUP: Readonly<Partial<Record<string, Recipe>>> = RECIPES;

/** The song that is playing when Next is pressed. */
export interface OutgoingSong {
  songId: number;
  analysis: Analysis;
  deck: DeckClock;
  landedDownbeatIndex?: number | null;
  /** Its approved Signatures whose audio is decoded (runtime SignatureStore). */
  signatures?: readonly SignatureSource[] | null;
  /** Its stem lanes (P1), decoded around the hook it landed on (runtime StemStore.laneSummary). */
  lanes?: LaneCoverage | null;
  /** Its stems' per-bar levels (data/stems `bars`), by downbeat index. */
  stemBars?: StemBars | null;
  /** Its hooks' keys, by hook id (data/keys). */
  keys?: Readonly<Record<string, KeyInfo>> | null;
}

/** The part of a song its decoded stem lanes cover, in song seconds, and the parts they can play. */
export interface LaneCoverage {
  fromSec: number;
  toSec: number;
  parts: readonly LanePart[];
}

/** An approved, decoded Signature as the planner sees it (analysis.ts SignatureMeta, without the audio). */
export interface SignatureSource {
  id: string;
  kind: SignatureKind;
  durationSec: number;
  /** Where its first downbeat (or a shout's attack) is in its file. */
  anchorSec: number;
  beats: number;
  bpm: number;
  gainDb: number;
}

/**
 * The song to land. `stems` lists, per hook id, the stems decoded around that hook (runtime StemStore);
 * `blend` is B's render stretched to A's tempo for one hook (runtime BlendStore), if ready.
 */
export interface IncomingSong {
  songId: number;
  analysis: Analysis;
  stems?: Readonly<Record<string, { readonly parts: readonly StemName[] }>> | null;
  blend?: BlendSource | null;
  /** Its approved Signatures whose audio is decoded (runtime SignatureStore). */
  signatures?: readonly SignatureSource[] | null;
  /** Its stems' per-bar levels (data/stems `bars`), by downbeat index. */
  stemBars?: StemBars | null;
  /** Hook ids whose pre-verb swell is rendered (P3, runtime PreverbStore). */
  preverbs?: readonly string[] | null;
  /** Hook ids whose pre-verb is also rendered from the vocal stem (D12 from B's voice). */
  vocalPreverbs?: readonly string[] | null;
  /** Its hooks' keys, by hook id (data/keys). */
  keys?: Readonly<Record<string, KeyInfo>> | null;
}

/**
 * B's bars before a hook, stretched onto a constant grid at A's tempo (tools/prep/stretch.py). Times are in
 * the rendered file: `hookSec` is the hook downbeat, `barSec` the grid's bar. `bass` = B's bass may layer
 * too (tempos within ±4% and compatible keys); `vocals` = B's stretched voice is decoded and may sing over A
 * (D16: the same rule as the bass).
 */
export interface BlendSource {
  aSongId: number;
  hookId: string;
  toBpm: number;
  hookSec: number;
  firstDownbeatSec: number;
  barSec: number;
  bass: boolean;
  vocals?: boolean;
}

/**
 * P5: B starts at this rate and climbs exponentially to its own rate by `until` (D14's tape start, ending on the
 * pickup). The plan's `startCtx` and `offset` stay the clock B lands on (where it would be had it run at its
 * rate all along), so its hook still sounds at T; the Deck works out the real start offset.
 */
export interface PowerUp {
  from: number;
  until: number;
}

/** A landing candidate. `blend`: where B's stretched layer goes, for S3. */
export interface Candidate {
  T: number;
  i: number | null;
  /** A's bar where B lands (S2: the exit downbeat plus the bridge's bars); null without A. */
  land: number | null;
  e: number;
  phraseClass: PhraseClass | null;
  cost: number | null;
  lead: number;
  n: number;
  teaseBars: number;
  relaxed: boolean;
  blend: BlendLayer | null;
}

/** One sweep of the landing search: the Spin lengths it tries, and whether only phrase boundaries count. */
interface SearchPass {
  window: readonly [number, number];
  phraseOnly: boolean;
  /** True when the window is the Spin's limits rather than the Pace's. */
  relaxed: boolean;
  /** S2 bridge lengths: the Phase's, those up to the Phase's longest (a slower B's bars still reach A's
   * boundary in one), or any (1–4 bars). */
  bridges: 'phase' | 'shorter' | 'any';
}

/** How far A's real bars may drift from the render's constant grid over the blend. */
const MAX_BLEND_DRIFT_SEC = 0.03;

/**
 * What the planner remembers of an earlier landing, oldest first (show.ts keeps these, from `summarize`): the
 * song and hook it landed (hook rotation), and what it sounded like (plan/variety.ts, the rotation memory). Typed
 * loosely (string, not RecipeId) because the history is kept outside the planner.
 */
export interface PlanSummary extends Remembered {
  songId: number;
  hookId: string;
}

/** A plan's summary, typed by the transition vocabulary (what `summarize` returns). */
export interface PlanMemory extends PlanSummary {
  recipe: RecipeId;
  family: RecipeFamily;
  exit: ExitName | null;
}

/**
 * A successful plan: the landing time T, the recipe and its timed events, and how to start B.
 * Times are AudioContext seconds.
 */
export interface Plan {
  id: string | null;
  /** 'next' unless the caller says otherwise. */
  kind: string;
  recipe: RecipeId;
  recipeName: string;
  family: RecipeFamily;
  shape: RecipeShape;
  /** The exit move, for S2 recipes with A playing. */
  exit: ExitName | null;
  variant: RecipeVariant | null;
  phase: PhaseName;
  /** The press. */
  now: number;
  spinStart: number;
  /** The landing: B's hook downbeat sounds and the drum locks. */
  T: number;
  /** T − spinStart, the Spin's length. */
  D: number;
  window: { dMin: number; dTarget: number; dMax: number };
  /** Where A's move ends (S2: where the bridge starts). */
  exitAt: number;
  /** A's exit downbeat; null in the opener and FADE fallbacks. */
  exitIndex: number | null;
  /** A's bar where B lands, counted like A's downbeats (S2: exitIndex + bridgeBars); null without A. */
  landIndex: number | null;
  /** S2 bridge length in B's bars (0 for S1 and FADE). */
  bridgeBars: number;
  /** Silence before the pickup, in B's beats. */
  gapBeats: number;
  teaseBars: number;
  /** How B is teased before landing, if it is. */
  teaseStyle: 'stems' | 'lpf' | null;
  /** The R8 layer, if any. */
  blend: { bars: number; bass: boolean; at: number; fileAt: number; toBpm: number } | null;
  /** The Signature layered into this transition, if any: B's call before it lands, or A's echoing out. */
  signature: { deck: 'A' | 'B'; id: string; at: number; rate: number } | null;
  /** The landing layer (plan/landing.ts). */
  landing: LandingStyle;
  /** The impact's samples by name ('dry' for a dry landing). */
  impact: string;
  /** Layers of B decorating the recipe (D9's Ghost Tease and its voice, D5's riff bed, a gap chop or scratch). */
  layers: readonly LayerName[];
  /** Where the landing sits in A's phrases (of `landIndex`). */
  phraseClass: PhraseClass | null;
  /** True when no candidate fit the Pace window and SPIN_LIMITS was used. */
  relaxed: boolean;
  /** Null in the fallbacks. */
  cost: number | null;
  candidates: number;
  hook: { id: string; tag: string; downbeatSec: number; downbeatIndex: number; pickupSec: number; bar: number; beat: number };
  /** Null when nothing was playing. */
  a: { songId: number; stopAt: number; exitStart: number } | null;
  b: { songId: number; startCtx: number; offset: number; rate: number; lead: number; trimDb: number; bpm: number; powerUp?: PowerUp | null };
  /** Sorted by start time. */
  events: PlanEvent[];
}

/** The planner could not plan: B has no usable hook. */
export interface PlanError {
  error: 'noHook';
}

/** What chooseRecipe weighs. */
export interface RecipeChoice {
  /** A is still sounding when the spin starts. */
  hasA: boolean;
  phase: PhaseEffects;
  history?: readonly PlanSummary[];
  rng: () => number;
  /** Used when implemented and possible (at runtime an unknown id is ignored). */
  override?: RecipeId | null;
  /** What this transition could layer (B's render, A's stem lanes, B's vocals); none when left out. */
  caps?: Caps;
}

/** What fills an S1 gap of at least a beat: D11's one-beat chop or D19's one-beat scratch. */
export type GapLayerKind = 'chop' | 'scratch';

/**
 * Variants a test or the audition page may force (never the show): the landing, R7's bridge, a recipe's variant,
 * the Ghost and its voice, the riff bed, a gap layer, the pre-verb's source. Each wins only when it is possible.
 */
export interface PlanForce {
  landing?: LandingStyle | null;
  /** What hits on the landing. */
  impact?: ImpactKind | null;
  /** Keep (true) or drop (false) an S1 or S3 move's riser, whatever the Phase's dress draws. */
  riser?: boolean | null;
  /** The exit move of an S2 recipe, when it is one of the recipe's exits. */
  exit?: ExitName | null;
  bridge?: BridgePattern | null;
  variant?: string | null;
  ghost?: boolean | null;
  ghostVoice?: boolean | null;
  riff?: boolean | null;
  gapLayer?: GapLayerKind | null;
  preverbSource?: PreverbSource | null;
}

/** What planTransition needs. */
export interface PlanRequest {
  /** AudioContext currentTime at the press. */
  now: number;
  /** The playing song, or null when nothing plays. */
  A: OutgoingSong | null;
  B: IncomingSong;
  /** A PHASES entry. */
  phase: PhaseEffects;
  /** From pace.ts spinWindow (default: a 14 s Pace). */
  spin?: SpinWindow | null;
  /** Previous plans' summaries. */
  history?: readonly PlanSummary[];
  /** Seeded random. */
  rng: () => number;
  /** Force a recipe when it is implemented and possible. */
  recipeOverride?: RecipeId | null;
  /** Force variants (tests). */
  force?: PlanForce | null;
  /** Land this hook instead of picking one. */
  hookOverride?: Hook | null;
  /** Copied to the plan ('next' by default). */
  kind?: string;
  /** Copied to the plan. */
  id?: string | null;
  /** false: no Tease of B this time (a Decoy takes its place). The random draws stay the same. */
  allowTease?: boolean;
}

// Loudness: hook LUFS → target. songs.json `volume` was the old player's manual loudness fix; stacking it
// on LUFS normalization double-compensates (YMCA is −7.9 LUFS with volume 1.77), so it is off by default.
/** @returns dB */
export function trimDbFor(analysis: Analysis, hook: Hook): number {
  const gain = hook.gainToTargetDb ?? analysis.loudness?.gainToTargetDb ?? 0;
  const volume = PLANNER.useLegacyVolume ? analysis.volume || 1 : 1;
  return clamp(gain, PLANNER.trimLimitsDb[0], PLANNER.trimLimitsDb[1]) + 20 * Math.log10(volume);
}

/** True when the recipe can play with what this transition has (an opener only plays S2 recipes). */
function possible(recipe: Recipe, hasA: boolean, caps: Caps): boolean {
  if (!recipe.implemented || recipe.shape === 'S0' || (!hasA && recipe.shape !== 'S2')) return false;
  return recipe.needs?.(caps) ?? true;
}

/**
 * The recipe: the Phase's weights for what this transition can play, the recipes and families of the last
 * transitions turned down (plan/variety.ts), then the hard rules: never one family three times in a row, two
 * theatrical moves never back to back, a cooldown waits its turn. Without A (a build from silence) one of the
 * Phase's openers (VARIETY.openers) under the same rules.
 */
export function chooseRecipe({ hasA, phase, history = [], rng, override = null, caps = NO_CAPS }: RecipeChoice): Recipe {
  const forced = override && RECIPES[override];
  if (forced && possible(forced, hasA, caps)) return forced;
  const memory = memoryOf(history);
  const families = memory.families.map((f) => (f == null ? f : familyGroup(f)));
  const last = history[history.length - 1];
  const lastTwo = history.slice(-2);
  const table = hasA ? phase.weights : VARIETY.openers[phase.name];
  const many = Object.keys(table).length > 1;
  const weights: Partial<Record<RecipeId, number>> = {};
  for (const [id, w] of Object.entries(table)) {
    // The weights may name a recipe that does not exist (yet): the lookup can miss.
    const recipe = RECIPE_LOOKUP[id];
    if (!recipe || !possible(recipe, hasA, caps)) continue;
    let weight = w;
    if (many) weight *= recency(id, memory.recipes, VARIETY.recipe) * recency(familyGroup(recipe.family), families, VARIETY.family);
    if (many && id !== 'R10' && THEATRICAL.has(id) && last && THEATRICAL.has(last.recipe)) weight = 0;
    // Never one family (the spiral counts as an echo) three times in a row.
    if (many && lastTwo.length === 2 && lastTwo.every((h) => familyGroup(h.family) === familyGroup(recipe.family))) weight = 0;
    // A gimmick (D2) waits its turn.
    if (recipe.cooldown && history.slice(-recipe.cooldown).some((h) => h.recipe === id)) weight = 0;
    weights[recipe.id] = weight; // RECIPES are keyed by their id, so this is `id`, typed
  }
  if (!hasA) return RECIPES[weightedPick(weights, rng) ?? (phase.name === 'final' ? 'R10' : 'R7')];
  // DEFAULT_WEIGHTS are all positive, so a recipe is always drawn.
  const id = weightedPick(weights, rng) ?? weightedPick(DEFAULT_WEIGHTS, rng)!;
  return RECIPES[id];
}

/**
 * The exit move for an S2 recipe, the ways A left in the last transitions turned down (an R7 echo-out right
 * after R2's echo sounds like the same move).
 * @returns null when the recipe has no exit moves
 */
function chooseExit(recipe: Recipe, memory: Memory, rng: () => number): ExitName | null {
  if (!recipe.exits) return null;
  const weights: Partial<Record<ExitName, number>> = {};
  for (const x of recipe.exits) weights[x] = 1;
  return weightedPick(freshWeights<ExitName>(weights, memory.moves, VARIETY.move), rng) ?? pick(recipe.exits, rng);
}

/** Variants that say how A left (an S1 or S3 move's own exit), as `moveOf` reports them. */
const HEARD_VARIANTS: ReadonlySet<string> = new Set(['echo', 'wash', 'throw', 'vocalThrow', 'freeze', 'brake', 'spinback', 'stab']);

/**
 * How A left, as heard: the S2 exit; else the S1 or S3 move's exit when its variant names one (R8's echo or
 * wash, R5's brake or spinback, R2's freeze or vocal throw), else its family (gate, spiral, roll, hits…).
 * @returns null without A
 */
export function moveOf(plan: Pick<Plan, 'a' | 'exit' | 'variant' | 'family'>): string | null {
  if (!plan.a) return null;
  if (plan.exit) return plan.exit;
  const kind = plan.variant?.kind;
  if (kind && HEARD_VARIANTS.has(kind)) return kind === 'vocalThrow' ? 'throw' : kind;
  return plan.family;
}

/** The flavour of a plan's first riser: 'noise', or 'tone' (the synth's default adds a climbing saw); null without one. */
function riserOf(events: readonly PlanEvent[]): string | null {
  for (const e of events) if (e.kind === 'synth' && e.name === 'riser') return e.params.tone === false ? 'noise' : 'tone';
  return null;
}

/** What the planner remembers of a plan once it has landed (show.ts keeps these as its history). */
export function summarize(plan: Plan): PlanMemory {
  const s2 = plan.shape === 'S2';
  const pattern = plan.variant?.kind;
  const bars = plan.variant?.bars;
  return {
    recipe: plan.recipe,
    family: plan.family,
    exit: plan.exit,
    songId: plan.b.songId,
    hookId: plan.hook.id,
    move: moveOf(plan),
    landing: plan.landing,
    impact: plan.impact,
    riser: riserOf(plan.events),
    // R7 reports its bridge pattern; the other S2 builds play the classic roll.
    bridge: s2 ? (plan.recipe === 'R7' && typeof pattern === 'string' ? pattern : 'roll') : null,
    bridgeBars: s2 ? plan.bridgeBars : null,
    bars: !s2 && typeof bars === 'number' ? bars : null,
    gapBeats: plan.gapBeats,
  };
}

/**
 * The Phase's dress over a recipe's events: an S1 or S3 move keeps its riser only when `keepRiser` (drawn at the
 * Phase's chance; early moves are mostly clean), and every riser sits at the Phase's level. An S2 build keeps
 * its riser, which is the build.
 */
function dress(events: readonly PlanEvent[], recipe: Recipe, phase: PhaseEffects, keepRiser: boolean, force: boolean | null): PlanEvent[] {
  const keep = recipe.shape === 'S2' || (force ?? keepRiser);
  const db = phase.dress.riserDb;
  return events.flatMap((e): PlanEvent[] => {
    if (e.kind !== 'synth' || e.name !== 'riser') return [e];
    if (!keep) return [];
    return db === 0 ? [e] : [{ ...e, params: { ...e.params, fromDb: e.params.fromDb + db, toDb: e.params.toDb + db } }];
  });
}

export function planTransition({ now, A, B, phase, spin = null, history = [], rng, recipeOverride = null, hookOverride = null, kind = 'next', id = null, force = null, allowTease = true }: PlanRequest): Plan | PlanError {
  const spinStart = now + LOOKAHEAD_SEC;
  const minStart = spinStart + AFTER_DUCK;
  const win = spin ?? spinWindow({ pace: 14, phase: phase.name });
  const hook = hookOverride || pickHook(B.analysis, phase, history, rng, { minTailSec: Math.min(12, (win.slot ?? 14) + 2) });
  if (!hook) return { error: 'noHook' };
  const gB = hookGrid(B.analysis, hook);
  const pickup = Math.min(hook.pickupSec || 0, hook.downbeatSec);

  // A is usable only if it is still sounding when the spin starts.
  let tl: Timeline | null = null;
  if (A) {
    tl = deckTimeline(A.analysis, A.deck, A.landedDownbeatIndex);
    if (tl.posAt(spinStart) > tl.durationSec - 0.5) tl = null;
  }
  const duckLevel = dbToGain(phase.duckDb ?? -3);

  // The beat-matched Blend needs B's stretched render for this hook at this A's tempo (runtime BlendStore).
  const blend = tl && A && B.blend && B.blend.hookId === hook.id && B.blend.aSongId === A.songId ? B.blend : null;
  const teaseStems = B.stems?.[hook.id]?.parts ?? null;
  const caps: Caps = {
    blend: Boolean(blend),
    aLanes: laneWindow(A, tl),
    chop: chopSource(B, hook, pickup, teaseStems),
    blendVocals: Boolean(blend?.vocals) && singsBeforeHook(B, hook, teaseStems),
  };
  const aState: OutgoingDeck | null = tl ? { tl, level: duckLevel, bars: A?.stemBars ?? null, rate: A?.deck.rate ?? 1 } : null;
  const memory = memoryOf(history);
  let recipe = chooseRecipe({ hasA: Boolean(tl), phase, history, rng, override: recipeOverride, caps });
  let exit = chooseExit(recipe, memory, rng);
  if (force?.exit && recipe.exits?.includes(force.exit)) exit = force.exit;
  // Silence before the hit, never when the pickup is long (the first syllable must not clip); some recipes
  // want at least a little (D2's crowd gap, D11's breath after the chops). It varies, away from the last gaps.
  const drawnGap = pickup > gB.beat ? 0 : freshNumber(phase.gapBeats, memory.gaps, VARIETY.gap, rng);
  const gapBeatsFor = (r: Recipe) => (pickup > gB.beat ? 0 : Math.max(drawnGap, r.minGapBeats?.(phase.name) ?? 0));
  // A Tease from B's own stems when they cover this hook; otherwise a low-passed one, less often.
  const teaseChance = !allowTease ? 0 : teaseStems?.includes('drums') ? phase.stemTease ?? phase.tease ?? 0 : phase.tease ?? 0;
  const leadFor = (teaseBars: number) => clamp(Math.max(pickup, teaseBars * gB.bar), 0, hook.downbeatSec);
  /** A's stem lanes cover [t0, t1]. */
  const lanesCover = (t0: number, t1: number) => Boolean(caps.aLanes && caps.aLanes.from <= t0 + 1e-9 && caps.aLanes.to >= t1 - 1e-9);

  let candidateCount = 0;
  // The landing goes on one of A's phrase boundaries (4 or 8 bars from the hook A landed on) when one is in
  // reach: first in the Pace's window, then anywhere in the Spin's limits (a manual Next waits up to 11 s for
  // one), and only then on a plain bar.
  const passes: readonly SearchPass[] = [
    { window: [win.dMin, win.dMax], phraseOnly: true, relaxed: false, bridges: 'phase' },
    { window: SPIN_LIMITS, phraseOnly: true, relaxed: true, bridges: 'shorter' },
    { window: [win.dMin, win.dMax], phraseOnly: false, relaxed: false, bridges: 'phase' },
    { window: SPIN_LIMITS, phraseOnly: false, relaxed: true, bridges: 'any' },
  ];
  // An S2 bridge as long as the last builds costs a little more, and every length gets a small random cost, so
  // the builds' lengths vary rather than follow the tempo alone.
  const bridgeJitter = [1, 2, 3, 4].map(() => VARIETY.bridgeBarsJitter * rng());
  const bridgeCost = (n: number) => (bridgeJitter[n - 1] ?? 0) +
    VARIETY.bridgeBarsCost.reduce((sum, c, k) => sum + (memory.bridgeBars[memory.bridgeBars.length - 1 - k] === n ? c : 0), 0);

  /**
   * The best landing for a recipe: S1 lands on one of A's downbeats; S2 bridges on B's grid; S3 blends
   * B's stretched bars under A's last bars and lands on an A downbeat. Recipes playing A's stem lanes land
   * only where the lanes cover their move.
   */
  function search(r: Recipe, x: ExitName | null): Candidate | null {
    if (!tl) return null;
    let found: Candidate | null = null;
    const gap = gapBeatsFor(r) * gB.beat;
    if (r.shape === 'S1' || r.shape === 'S3') {
      const lead = leadFor(0);
      for (const { window: [dMin, dMax], phraseOnly, relaxed } of passes) {
        for (const d of tl.downbeatsBetween(spinStart + dMin, spinStart + dMax)) {
          const phraseClass = tl.phraseClass(d.index);
          if (phraseOnly && phraseClass === 'bar') continue;
          const T = d.ctxTime;
          const gapStart = T - pickup - gap;
          if (T - lead - DECLICK_SEC < spinStart + 0.05) continue;
          if (tl.posAt(gapStart) > tl.durationSec - 0.25) continue;
          let blendAt: BlendLayer | null = null;
          if (r.shape === 'S3') {
            blendAt = blendStart(d.index, T);
            if (!blendAt) continue;
            if (r.aLaneParts && !lanesCover(T - tl.barAt(d.index), gapStart + 0.1)) continue;
          } else {
            const aLead = r.aLeadSec(tl, d.index, null, phase.name);
            if (gapStart - aLead < minStart) continue;
            if (r.aLaneParts && !lanesCover(gapStart - aLead, gapStart + 0.1)) continue;
          }
          if (r.fits && aState && !r.fits(aState, d.index)) continue;
          candidateCount++;
          const cost = DRIFT_COST_PER_SEC * Math.abs(T - spinStart - win.dTarget) + PHRASE_COST[phraseClass];
          if (!found || cost < (found.cost ?? Infinity)) found = { T, i: d.index, land: d.index, e: gapStart, phraseClass, cost, lead, n: 0, teaseBars: 0, relaxed, blend: blendAt };
        }
        if (found) break;
      }
    } else if (r.shape === 'S2') {
      const wantsTease = rng() < teaseChance && !r.noTease;
      for (const { window: [dMin, dMax], phraseOnly, relaxed, bridges } of passes) {
        const lengths = bridges === 'phase' ? phase.bridgeBars : bridges === 'shorter' ? [1, 2, 3, 4].filter((n) => n <= Math.max(...phase.bridgeBars)) : [1, 2, 3, 4];
        const bridgeOptions = lengths.filter((n) => n >= (r.minBridgeBars ?? 0));
        for (const d of tl.downbeatsBetween(minStart, spinStart + dMax)) {
          const e = d.ctxTime;
          if (e - r.aLeadSec(tl, d.index, x, phase.name) < minStart) continue;
          if (tl.posAt(e) > tl.durationSec - 0.25) continue;
          for (const n of bridgeOptions) {
            // Best, B lands where A's bar `d.index + n` would have started: the bridge takes A's last bars and
            // the landing keeps A's phrases. Else A completes its phrase and the build comes after it (a B far
            // slower or faster than A cannot reach A's boundary in whole bars).
            const atLanding = tl.phraseClass(d.index + n);
            const phraseClass = atLanding !== 'bar' ? atLanding : tl.phraseClass(d.index);
            if (phraseOnly && phraseClass === 'bar') continue;
            const T = e + n * gB.bar;
            const D = T - spinStart;
            if (D < dMin || D > dMax) continue;
            const gapStart = T - pickup - gap;
            if (gapStart - e < 0.5) continue;
            const teaseBars = wantsTease ? Math.min(2, n) : 0;
            const lead = leadFor(teaseBars);
            if (T - lead - DECLICK_SEC < spinStart + 0.05) continue;
            candidateCount++;
            const cost = DRIFT_COST_PER_SEC * Math.abs(D - win.dTarget) + PHRASE_COST[phraseClass] + bridgeCost(n) + (atLanding === 'bar' ? PLANNER.phraseAtExitCost : 0);
            if (!found || cost < (found.cost ?? Infinity)) found = { T, i: d.index, land: d.index + n, e, phraseClass, cost, lead, n, teaseBars, relaxed, blend: null };
          }
        }
        if (found) break;
      }
    }
    return found;
  }

  /**
   * Where B's stretched layer starts for a landing on A's downbeat `index` (at T): as many whole A bars
   * before T as the render holds, starting after the spin-start duck, with A's real bars matching the
   * render's constant grid (else the drums would flam).
   */
  function blendStart(index: number, T: number): BlendLayer | null {
    if (!blend || !tl || !A) return null;
    const downbeats = A.analysis.downbeats;
    const fileBars = Math.floor((blend.hookSec - blend.firstDownbeatSec) / blend.barSec + 1e-6);
    for (let k = Math.min(fileBars, LAYERING.renderBars); k >= LAYERING.minBars; k--) {
      if (index - k < 0) break;
      const at = tl.ctxAt(downbeats[index - k]);
      if (at < minStart) continue;
      if (Math.abs(T - at - k * blend.barSec) > MAX_BLEND_DRIFT_SEC) continue;
      return { at, fileAt: blend.hookSec - (T - at), bars: k, bass: blend.bass };
    }
    return null;
  }

  let best = search(recipe, exit);
  if (!best && tl) {
    // Nothing fits this recipe (e.g. A's bars are irregular here): another real move before the bare fade.
    const fallbacks: Recipe[] = [];
    if (recipe.shape === 'S3' || recipe.aLaneParts || recipe.minBridgeBars || recipe.fits) {
      fallbacks.push(chooseRecipe({ hasA: true, phase, history, rng, caps: { ...caps, blend: false, blendVocals: false, aLanes: null } }));
    }
    fallbacks.push(RECIPES.R7, RECIPES.R2, RECIPES.R1);
    for (const r of fallbacks) {
      if (r === recipe) continue;
      const x = chooseExit(r, memory, rng);
      const found = search(r, x);
      if (found) {
        recipe = r;
        exit = x;
        best = found;
        break;
      }
    }
  }
  const wantsTease = recipe.shape === 'S2' && rng() < teaseChance; // the opener's Tease

  if (!best && !tl) {
    // Opener (nothing playing): a build from silence on B's grid, ending at the target duration.
    if (recipe.shape !== 'S2') recipe = phase.name === 'final' ? RECIPES.R10 : RECIPES.R7;
    exit = null;
    const T = spinStart + win.dTarget;
    const n = clamp(Math.floor((win.dTarget - 0.4) / gB.bar), 1, 4);
    const e = Math.max(spinStart + 0.1, T - n * gB.bar);
    const teaseBars = wantsTease ? 1 : 0;
    best = { T, i: null, land: null, e, phraseClass: null, cost: null, lead: leadFor(teaseBars), n, teaseBars, relaxed: false, blend: null };
  } else if (!best) {
    // A has no usable downbeat in the window (near its end, no grid): fade it under a swell, then land.
    recipe = RECIPES.FADE;
    exit = null;
    const T = spinStart + win.dTarget;
    best = { T, i: null, land: null, e: T - pickup - gapBeatsFor(recipe) * gB.beat, phraseClass: null, cost: null, lead: leadFor(0), n: 0, teaseBars: 0, relaxed: false, blend: null };
  }

  const { T, i, e, n, teaseBars } = best;
  const gapBeats = gapBeatsFor(recipe);
  const pickupAt = T - pickup;
  const gapStart = pickupAt - gapBeats * gB.beat;
  const events: PlanEvent[] = [];
  if (tl) events.push(ramp('A.gain', spinStart, spinStart + 0.4, 1, duckLevel, 'lin'));
  events.push(sfx('whoosh', spinStart, phase.dress.whooshDb));

  // The landing layer: the reverse cymbal, a dry landing, B's pre-verb (when it is rendered and A is cut low,
  // gone, or in a compatible key by then), or D14's tape start (B powering up inside a silent gap, never after a
  // low-passed Tease or under a Blend; most often after a stop).
  const keysMatch = keysAgree(A, B, hook);
  const preverbFits = Boolean(B.preverbs?.includes(hook.id)) &&
    (!tl || recipe.shape === 'S2' || gapBeats >= MOVES.preverb.clearGapBeats || Boolean(recipe.aClearsLows) || keysMatch);
  // A stem Tease plays from B's stems on B's clock, so B may still power up after it; a low-passed one plays B itself
  // (landB plays the stems when they hold the drums and more than a beat fits before the gap).
  const stemTease = teaseBars > 0 && Boolean(teaseStems?.includes('drums')) && gapStart - (T - best.lead) > gB.beat;
  const tapeRoom = recipe.shape === 'S3' || (teaseBars > 0 && !stemTease)
    ? 0
    : Math.min(gapBeats * gB.beat - 0.02, pickupAt - (tl ? minStart : spinStart + 0.1), hook.downbeatSec - pickup);
  const tapeBoost = ['stop', 'powerdown', 'hits'].includes(recipe.family) ? MOVES.tape.afterStop : 1;
  const lastOrchestra = history.findLastIndex((h) => h.impact?.includes('orchestra-hit'));
  const landing = chooseLanding({
    phase, rng, preverb: preverbFits, tape: tapeRoom >= MOVES.tape.minSec, tapeBoost, force: force?.landing ?? null,
    forceImpact: force?.impact ?? null, recent: { styles: memory.landings, impacts: memory.impacts },
    sinceOrchestra: lastOrchestra < 0 ? Infinity : history.length - lastOrchestra,
  });
  const vocalPreverb = Boolean(B.vocalPreverbs?.includes(hook.id)) && singsAtHook(B, hook);
  const preverbSource: PreverbSource = vocalPreverb ? (force?.preverbSource ?? (landing.style === 'preverb' && rng() < MOVES.preverb.vocalsChance ? 'vocals' : 'mix')) : 'mix';
  const preverb = landing.style === 'preverb'
    ? preverbEvent({ hookId: hook.id, pickupAt, minStart: tl ? minStart : spinStart + 0.1, gB, phase, rng, source: preverbSource })
    : null;
  if (landing.style === 'preverb' && !preverb) {
    // No room for the pre-verb: the Phase's lighter plain landing instead (early, dry without samples).
    const styles = MOVES.landing.weights[phase.name];
    landing.style = styles.dry >= styles.cymbal ? 'dry' : 'cymbal';
    if (landing.style === 'dry' && landing.impact === 'samples') Object.assign(landing, { impact: 'sub', samples: [] });
  }

  // Where B starts: a declick before its lead, or (tape) inside the gap with its rate climbing to the pickup.
  let lead: number;
  let powerUp: PowerUp | null = null;
  if (landing.style === 'tape') {
    const d = Math.min(pick(MOVES.tape.durSec, rng), tapeRoom);
    lead = pickup + d;
    powerUp = { from: MOVES.tape.fromRate, until: pickupAt };
  } else {
    lead = best.lead + Math.min(DECLICK_SEC, Math.max(0, hook.downbeatSec - best.lead));
  }
  const bStart = T - lead;

  // D5: B's riff looping under R7's bridge, when it has an approved riff on its grid (never under a low-passed Tease).
  // Its draw is made for every riff host, so a plan that does not loop a riff is the same with or without Signatures.
  const riffDraw = recipe.riffHost ? rng() : 1;
  const riffSrc = recipe.riffHost ? riffSource(B, gB) : null;
  const riff = riffSrc && gapStart - e >= MOVES.riff.minBars * gB.bar && (teaseBars === 0 || stemTease) &&
    (force?.riff ?? riffDraw < MOVES.riff.chance[phase.name]) ? riffSrc : null;

  const built = recipe.build({
    A: aState, i, e, T, pickupAt, gapStart, bStart, teaseFrom: powerUp ? T - best.lead : bStart, tease: teaseBars > 0, teaseStems, gB, phase, rng,
    exit, blend: best.blend, minStart, aLanes: caps.aLanes, chop: caps.chop, riff, landing, memory,
    force: force ? { bridge: force.bridge ?? null, variant: force.variant ?? null } : null,
  });
  const teaseStyle = teaseBars > 0 ? (built.events.some((x) => x.kind === 'stems') ? 'stems' : 'lpf') : null;
  events.push(...dress(built.events, recipe, phase, rng() < phase.dress.riser, force?.riser ?? null));
  if (preverb) events.push(preverb);
  const layers: LayerName[] = [...(built.layers ?? [])];
  let usesBSignature = Boolean(built.usesBSignature);

  // A one-beat chop or scratch of B's first syllable in an S1 gap of at least a beat, after a move that leaves its
  // gap silent (not with the tape start or the pre-verb, which live in the gap too).
  let gapUsed = false;
  if (tl && recipe.shape === 'S1' && recipe.gapHost && caps.chop && landing.style !== 'tape' && landing.style !== 'preverb' &&
    gapBeats >= MOVES.gapLayer.minGapBeats - 1e-9) {
    const kind = force?.gapLayer ?? (rng() < MOVES.gapLayer.chance[phase.name] ? weightedPick(MOVES.gapLayer.kinds, rng) : null);
    const chop = caps.chop;
    const layer = kind === 'chop'
      ? gapChopSlices({ source: chop, pickupAt, gB, phase: phase.name, signatureDb: phase.signatureDb, rng })
      : kind === 'scratch'
        ? scratchMove({ source: chop, pickupAt, from: pickupAt - gB.beat, beats: 1, gB, phase: phase.name, signatureDb: phase.signatureDb, rng })?.event ?? null
        : null;
    if (layer) {
      events.push(layer);
      layers.push(kind === 'chop' ? 'gapChop' : 'gapScratch');
      gapUsed = true;
      if (chop.from === 'signature') usesBSignature = true;
    }
  }

  // D9's Ghost Tease decorates moves that leave the reverb alone when B's vocals are decoded: A's last bars (S1),
  // or the bridge's last bars (S2, unless A washes out or B's riff is the bed). One voice of B at a time.
  const ghostFits = recipe.ghostHost && !gapUsed && !layers.includes('riff') &&
    (recipe.shape === 'S1' ? tl != null && i != null : recipe.shape === 'S2' && exit !== 'wash');
  if (ghostFits && teaseStems?.includes('vocals')) {
    const wants = force?.ghost ?? rng() < MOVES.ghost.chance[phase.name];
    // B's stems start STEMS.leadSec before its hook: the ghost stays inside them.
    const stemsFrom = T - (hook.downbeatSec - Math.max(0, hook.downbeatSec - STEMS.leadSec)) + STEMS.laneMarginSec;
    const bar = recipe.shape === 'S1' && tl && i != null ? tl.barAt(i) : gB.bar;
    const from = recipe.shape === 'S2' ? Math.max(e, tl ? minStart : spinStart + 0.1) : minStart;
    const ghost = wants
      ? ghostLayer({ T, pickupAt, gapStart, gB, bar, minStart: Math.max(from, stemsFrom), phase: phase.name, rng, keysMatch, voice: force?.ghostVoice ?? null })
      : null;
    if (ghost) {
      events.push(...ghost.events);
      layers.push('ghost');
      if (ghost.voice) layers.push('ghostVoice');
    }
  }

  // B's call is cut where B itself starts with a tape start (it powers up in the gap).
  const signature = signatureLayer({
    shape: recipe.id === 'FADE' ? 'S0' : recipe.shape, tl, A, B, aRate: A?.deck.rate ?? 1, gB, spinStart, e, n,
    pickupAt: powerUp ? bStart : pickupAt, exit, phase, rng, skipB: usesBSignature,
  });
  if (signature) events.push(signature);
  events.sort((x, y) => eventStart(x) - eventStart(y));
  // When A's exit move starts (after the spin-start duck): until then, a cancelled Spin can keep A.
  const aEvents = events.filter((x) => (('target' in x && x.target.startsWith('A.')) || ('deck' in x && x.deck === 'A')) && eventStart(x) > spinStart + 0.41);

  return {
    id,
    kind,
    recipe: recipe.id,
    recipeName: recipe.name,
    family: recipe.family,
    shape: recipe.shape,
    exit,
    variant: built.variant ?? null,
    phase: phase.name,
    now,
    spinStart,
    T,
    D: T - spinStart,
    window: { dMin: win.dMin, dTarget: win.dTarget, dMax: win.dMax },
    exitAt: e,
    exitIndex: i,
    landIndex: best.land,
    bridgeBars: n,
    gapBeats,
    teaseBars,
    teaseStyle,
    // A candidate only gets a blend layer when B's render (`blend`) is there.
    blend: best.blend && blend ? { bars: best.blend.bars, bass: best.blend.bass, at: best.blend.at, fileAt: best.blend.fileAt, toBpm: blend.toBpm } : null,
    signature: signature ? { deck: signature.deck, id: signature.id, at: signature.at, rate: signature.rate } : null,
    landing: landing.style,
    impact: impactName(landing),
    layers,
    phraseClass: best.phraseClass,
    relaxed: Boolean(best.relaxed),
    cost: best.cost,
    candidates: candidateCount,
    hook: {
      id: hook.id,
      tag: hook.tag,
      downbeatSec: hook.downbeatSec,
      downbeatIndex: hook.downbeatIndex,
      pickupSec: pickup,
      bar: gB.bar,
      beat: gB.beat,
    },
    // tl is only set when A is.
    a: tl && A
      ? { songId: A.songId, stopAt: built.aStopAt ?? T + 0.05, exitStart: Math.min(built.aStopAt ?? T, ...aEvents.map(eventStart)) }
      : null,
    b: {
      songId: B.songId,
      startCtx: bStart,
      offset: hook.downbeatSec - lead,
      rate: 1,
      lead,
      trimDb: trimDbFor(B.analysis, hook),
      bpm: B.analysis.tempo?.bpm,
      powerUp,
    },
    events,
  };
}

/**
 * Where A's stem lanes may play, in context time: inside what is decoded (less a margin), and only while A runs
 * at rate 1 (a lane must stay sample-locked to A's main source).
 */
function laneWindow(A: OutgoingSong | null, tl: Timeline | null): LaneWindow | null {
  if (!A?.lanes || !tl || (A.deck.rate ?? 1) !== 1 || !A.lanes.parts.length) return null;
  const from = tl.ctxAt(A.lanes.fromSec + STEMS.laneMarginSec);
  const to = tl.ctxAt(A.lanes.toSec - STEMS.laneMarginSec);
  return to > from ? { from, to, parts: A.lanes.parts } : null;
}

/**
 * D11's grain: B must sing at its hook (its vocal stem is decoded there, and its vocals bar is loud enough when
 * known); the grain is B's approved call when there is one, else the vocal stem from its pickup.
 */
function chopSource(B: IncomingSong, hook: Hook, pickup: number, parts: readonly StemName[] | null): ChopSource | null {
  if (!parts?.includes('vocals')) return null;
  const vocalsDb = B.stemBars?.vocals?.[hook.downbeatIndex];
  if (vocalsDb != null && vocalsDb < MOVES.chop.minVocalsDb) return null;
  const call = B.signatures?.find((s) => s.kind === 'call');
  if (call) return { from: 'signature', id: call.id, offset: 0, gainDb: call.gainDb };
  return { from: 'stem', offset: hook.downbeatSec - pickup };
}

/** B sings in the bars before its hook (D16's voice): its vocals bars when known, else its decoded stems there. */
function singsBeforeHook(B: IncomingSong, hook: Hook, parts: readonly StemName[] | null): boolean {
  const bars = B.stemBars?.vocals;
  if (!bars?.length) return Boolean(parts?.includes('vocals'));
  const before = bars.slice(Math.max(0, hook.downbeatIndex - STEMS.teaseBarsChecked), hook.downbeatIndex);
  return before.length > 0 && before.reduce((a, b) => a + b, 0) / before.length >= MOVES.acapella.minVocalsDb;
}

/** B sings at its hook (D12 from its voice): its vocals bar there when known; unknown counts as singing. */
function singsAtHook(B: IncomingSong, hook: Hook): boolean {
  const db = B.stemBars?.vocals?.[hook.downbeatIndex];
  return db == null || db >= MOVES.chop.minVocalsDb;
}

/**
 * D5's riff: B's first approved riff Signature that sits on B's grid at its hook with at most a slight resample
 * (SIGNATURES.maxRateShift), looped in whole bars of B.
 */
function riffSource(B: IncomingSong, gB: HookGrid): RiffSource | null {
  for (const s of B.signatures ?? []) {
    if (s.kind !== 'riff' || s.bpm <= 0) continue;
    const rate = 60 / gB.beat / s.bpm;
    const bars = Math.round(s.beats / gB.bpb);
    if (Math.abs(rate - 1) > SIGNATURES.maxRateShift || bars < 1) continue;
    return { id: s.id, anchorSec: s.anchorSec, durationSec: s.durationSec, bars, rate, gainDb: s.gainDb };
  }
  return null;
}

/** A's landed hook and B's hook have compatible keys, confidently enough to layer melodic parts. Unknown counts as not. */
function keysAgree(A: OutgoingSong | null, B: IncomingSong, hook: Hook): boolean {
  if (!A?.keys || !B.keys) return false;
  const aHook = A.analysis.hooks.find((h) => h.downbeatIndex === A.landedDownbeatIndex);
  const aKey = aHook ? A.keys[aHook.id] : undefined;
  const bKey = B.keys[hook.id];
  return Boolean(aKey && bKey && compatible(aKey, bKey, { minConfidence: LAYERING.minKeyConfidence }));
}

/** What signatureLayer needs from planTransition. `shape` S0 means a fallback with no grid to place on. */
export interface SignatureArgs {
  shape: RecipeShape;
  tl: Timeline | null;
  A: OutgoingSong | null;
  B: IncomingSong;
  /** A's playback rate (its clock runs `rate` song-seconds per second). */
  aRate: number;
  gB: { bar: number; beat: number };
  spinStart: number;
  /** S2: A's exit downbeat, where the bridge on B's grid starts; opener: the build's start. */
  e: number;
  /** S2 bridge length in B's bars. */
  n: number;
  pickupAt: number;
  exit: ExitName | null;
  phase: PhaseEffects;
  rng: () => number;
  /** The recipe already plays B's call (D11's chops): only A's Signature may be layered. */
  skipB?: boolean;
}

/**
 * At most one approved Signature per transition, on the beat:
 * - B's call before it lands (chance `phase.signature`): on B's own grid over an S2 bridge or an opener
 *   build, at its own tempo; over A's grid (S1, S3) only when it needs at most a slight resample
 *   (SIGNATURES.maxRateShift) or is a short one-shot shout. It plays its anchor on a downbeat, starts after
 *   the spin-start duck, and is faded out at B's pickup (at least SIGNATURES.minFit of it must play).
 * - Otherwise A's own Signature thrown into the echo as A leaves on an echo or wash exit (S2).
 * Draws from `rng` only when a song has Signatures, so plans without any are unchanged.
 */
export function signatureLayer({ shape, tl, A, B, aRate, gB, spinStart, e, n, pickupAt, exit, phase, rng, skipB = false }: SignatureArgs): SignatureEvent | null {
  const bSigs = skipB ? [] : B.signatures ?? [];
  const aSigs = A?.signatures ?? [];
  if (shape === 'S0' || (!bSigs.length && !aSigs.length)) return null;
  const minStart = spinStart + AFTER_DUCK;
  const event = (deck: 'A' | 'B', s: SignatureSource, at: number, rate: number, until: number, echo: number): SignatureEvent =>
    ({ kind: 'signature', deck, id: s.id, at, anchorSec: s.anchorSec, rate, gainDb: s.gainDb + phase.signatureDb, until, echo });

  if (bSigs.length && rng() < phase.signature) {
    for (const s of shuffled(bSigs, rng)) {
      // Downbeats the anchor may sit on, latest first, with the resample rate on that grid.
      let slots: number[];
      let rate = 1;
      if (shape === 'S2' || !tl) {
        slots = Array.from({ length: Math.max(1, n) }, (_, k) => e + k * gB.bar);
      } else {
        const aBpm = (A?.analysis.tempo.bpm ?? s.bpm) * aRate;
        const shift = aBpm / s.bpm;
        if (Math.abs(shift - 1) <= SIGNATURES.maxRateShift) rate = shift;
        else if (s.beats > SIGNATURES.shoutMaxBeats) continue;
        slots = tl.downbeatsBetween(minStart, pickupAt).map((d) => d.ctxTime);
      }
      for (const at of slots.sort((x, y) => y - x)) {
        const start = at - s.anchorSec / rate;
        const length = s.durationSec / rate;
        if (start < minStart) continue;
        if (Math.min(start + length, pickupAt) - start < SIGNATURES.minFit * length) continue;
        return event('B', s, at, rate, Math.min(start + length, pickupAt), 0);
      }
    }
  }
  if (shape === 'S2' && tl && aSigs.length && (exit === 'echo' || exit === 'wash') && rng() < phase.signature * SIGNATURES.aEchoShare) {
    const s = pick(aSigs, rng);
    const start = e - s.anchorSec / aRate;
    if (start >= minStart) return event('A', s, e, aRate, start + s.durationSec / aRate, SIGNATURES.echoSend);
  }
  return null;
}

function shuffled<T>(list: readonly T[], rng: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export { SILENT, SPIN_LIMITS, eventStart };
