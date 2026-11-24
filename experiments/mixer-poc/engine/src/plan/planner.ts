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
import { chooseLanding, preverbEvent } from './landing.ts';
import { ghostLayer } from './layers.ts';
import { weightedPick } from '../rng.ts';
import { PLANNER, LAYERING, MOVES, SIGNATURES, STEMS } from '../config.ts';
import type { Analysis, Hook, SignatureKind } from '../analysis.ts';
import type { PhaseEffects, PhaseName } from '../config.ts';
import type { KeyInfo } from './keys.ts';
import type { SpinWindow } from './pace.ts';
import type { DeckClock, PhraseClass, Timeline } from './timeline.ts';
import type { BridgePattern } from './bridges.ts';
import type { LandingStyle } from './landing.ts';
import type { ChopSource, LayerName } from './layers.ts';
import type {
  BlendLayer, Caps, ExitName, LanePart, LaneWindow, OutgoingDeck, PlanEvent, Recipe, RecipeFamily, RecipeId, RecipeShape, RecipeVariant,
  SignatureEvent, StemBars, StemName,
} from './recipes.ts';

export const LOOKAHEAD_SEC = PLANNER.lookaheadSec;
const DECLICK_SEC = PLANNER.declickSec;
const AFTER_DUCK = PLANNER.afterDuckSec;
const PHRASE_COST = PLANNER.phraseCost;
const DRIFT_COST_PER_SEC = PLANNER.driftCostPerSec;
const REPEAT_PENALTY = PLANNER.repeatPenalty;
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
  /** Its hooks' keys, by hook id (data/keys). */
  keys?: Readonly<Record<string, KeyInfo>> | null;
}

/**
 * B's bars before a hook, stretched onto a constant grid at A's tempo (analysis/stretch.py). Times are in
 * the rendered file: `hookSec` is the hook downbeat, `barSec` the grid's bar. `bass` = B's bass may layer
 * too (tempos within ±4% and compatible keys).
 */
export interface BlendSource {
  aSongId: number;
  hookId: string;
  toBpm: number;
  hookSec: number;
  firstDownbeatSec: number;
  barSec: number;
  bass: boolean;
}

/** A landing candidate. `blend`: where B's stretched layer goes, for S3. */
export interface Candidate {
  T: number;
  i: number | null;
  e: number;
  phraseClass: PhraseClass | null;
  cost: number | null;
  lead: number;
  n: number;
  teaseBars: number;
  relaxed: boolean;
  blend: BlendLayer | null;
}

/** How far A's real bars may drift from the render's constant grid over the blend. */
const MAX_BLEND_DRIFT_SEC = 0.03;

/**
 * What the planner remembers of an earlier landing, oldest first (show.ts keeps these). Typed loosely
 * (string, not RecipeId) because the history is kept outside the planner.
 */
export interface PlanSummary {
  recipe: string;
  family: string;
  exit: string | null;
  songId: number;
  hookId: string;
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
  /** Layers of B decorating the recipe (D9's Ghost Tease). */
  layers: readonly LayerName[];
  phraseClass: PhraseClass | null;
  /** True when no candidate fit the Pace window and SPIN_LIMITS was used. */
  relaxed: boolean;
  /** Null in the fallbacks. */
  cost: number | null;
  candidates: number;
  hook: { id: string; tag: string; downbeatSec: number; downbeatIndex: number; pickupSec: number; bar: number; beat: number };
  /** Null when nothing was playing. */
  a: { songId: number; stopAt: number; exitStart: number } | null;
  b: { songId: number; startCtx: number; offset: number; rate: number; lead: number; trimDb: number; bpm: number };
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

/** Variants a test or the audition page may force (never the show): the landing, R7's bridge, a recipe's variant, the Ghost. */
export interface PlanForce {
  landing?: LandingStyle | null;
  /** The exit move of an S2 recipe, when it is one of the recipe's exits. */
  exit?: ExitName | null;
  bridge?: BridgePattern | null;
  variant?: string | null;
  ghost?: boolean | null;
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

export function chooseRecipe({ hasA, phase, history = [], rng, override = null, caps = NO_CAPS }: RecipeChoice): Recipe {
  const forced = override && RECIPES[override];
  if (forced && possible(forced, hasA, caps)) return forced;
  if (!hasA) return phase.name === 'final' ? RECIPES.R10 : RECIPES.R7;
  const last = history[history.length - 1];
  const lastTwo = history.slice(-2);
  const many = Object.keys(phase.weights).length > 1;
  const weights: Partial<Record<RecipeId, number>> = {};
  for (const [id, w] of Object.entries(phase.weights)) {
    // phase.weights may name a recipe that does not exist (yet): the lookup can miss.
    const recipe = RECIPE_LOOKUP[id];
    if (!recipe || !possible(recipe, true, caps)) continue;
    let weight = w;
    if (many && id === last?.recipe) weight *= REPEAT_PENALTY;
    if (many && id !== 'R10' && THEATRICAL.has(id) && last && THEATRICAL.has(last.recipe)) weight = 0;
    // Never one family (the spiral counts as an echo) three times in a row.
    if (many && lastTwo.length === 2 && lastTwo.every((h) => familyGroup(h.family) === familyGroup(recipe.family))) weight = 0;
    // A gimmick (D2) waits its turn.
    if (recipe.cooldown && history.slice(-recipe.cooldown).some((h) => h.recipe === id)) weight = 0;
    weights[recipe.id] = weight; // RECIPES are keyed by their id, so this is `id`, typed
  }
  // DEFAULT_WEIGHTS are all positive, so a recipe is always drawn.
  const id = weightedPick(weights, rng) ?? weightedPick(DEFAULT_WEIGHTS, rng)!;
  return RECIPES[id];
}

/**
 * The exit move for an S2 recipe, avoiding the last one used.
 * @returns null when the recipe has no exit moves
 */
function chooseExit(recipe: Recipe, history: readonly PlanSummary[], rng: () => number): ExitName | null {
  if (!recipe.exits) return null;
  const last = history.map((h) => h.exit).filter(Boolean).pop();
  const fresh = recipe.exits.filter((x) => x !== last);
  return pick(fresh.length ? fresh : recipe.exits, rng);
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
  const caps: Caps = { blend: Boolean(blend), aLanes: laneWindow(A, tl), chop: chopSource(B, hook, pickup, teaseStems) };
  let recipe = chooseRecipe({ hasA: Boolean(tl), phase, history, rng, override: recipeOverride, caps });
  let exit = chooseExit(recipe, history, rng);
  if (force?.exit && recipe.exits?.includes(force.exit)) exit = force.exit;
  // Silence before the hit, never when the pickup is long (the first syllable must not clip); some recipes
  // want at least a little (D2's crowd gap, D11's breath after the chops).
  const drawnGap = pickup > gB.beat ? 0 : pick(phase.gapBeats, rng);
  const gapBeatsFor = (r: Recipe) => (pickup > gB.beat ? 0 : Math.max(drawnGap, r.minGapBeats?.(phase.name) ?? 0));
  // A Tease from B's own stems when they cover this hook; otherwise a low-passed one, less often.
  const teaseChance = !allowTease ? 0 : teaseStems?.includes('drums') ? phase.stemTease ?? phase.tease ?? 0 : phase.tease ?? 0;
  const leadFor = (teaseBars: number) => clamp(Math.max(pickup, teaseBars * gB.bar), 0, hook.downbeatSec);
  /** A's stem lanes cover [t0, t1]. */
  const lanesCover = (t0: number, t1: number) => Boolean(caps.aLanes && caps.aLanes.from <= t0 + 1e-9 && caps.aLanes.to >= t1 - 1e-9);

  let candidateCount = 0;
  const windows: ReadonlyArray<readonly [number, number]> = [[win.dMin, win.dMax], SPIN_LIMITS];

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
      for (const [pass, [dMin, dMax]] of windows.entries()) {
        for (const d of tl.downbeatsBetween(spinStart + dMin, spinStart + dMax)) {
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
          candidateCount++;
          const phraseClass = tl.phraseClass(d.index);
          const cost = DRIFT_COST_PER_SEC * Math.abs(T - spinStart - win.dTarget) + PHRASE_COST[phraseClass];
          if (!found || cost < (found.cost ?? Infinity)) found = { T, i: d.index, e: gapStart, phraseClass, cost, lead, n: 0, teaseBars: 0, relaxed: pass > 0, blend: blendAt };
        }
        if (found) break;
      }
    } else if (r.shape === 'S2') {
      const wantsTease = rng() < teaseChance;
      for (const [pass, [dMin, dMax]] of windows.entries()) {
        const bridgeOptions = pass === 0 ? phase.bridgeBars : [1, 2, 3, 4];
        for (const d of tl.downbeatsBetween(minStart, spinStart + dMax)) {
          const e = d.ctxTime;
          if (e - r.aLeadSec(tl, d.index, x, phase.name) < minStart) continue;
          if (tl.posAt(e) > tl.durationSec - 0.25) continue;
          for (const n of bridgeOptions) {
            const T = e + n * gB.bar;
            const D = T - spinStart;
            if (D < dMin || D > dMax) continue;
            const gapStart = T - pickup - gap;
            if (gapStart - e < 0.5) continue;
            const teaseBars = wantsTease ? Math.min(2, n) : 0;
            const lead = leadFor(teaseBars);
            if (T - lead - DECLICK_SEC < spinStart + 0.05) continue;
            candidateCount++;
            const phraseClass = tl.phraseClass(d.index);
            const cost = DRIFT_COST_PER_SEC * Math.abs(D - win.dTarget) + PHRASE_COST[phraseClass];
            if (!found || cost < (found.cost ?? Infinity)) found = { T, i: d.index, e, phraseClass, cost, lead, n, teaseBars, relaxed: pass > 0, blend: null };
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
    if (recipe.shape === 'S3' || recipe.aLaneParts) fallbacks.push(chooseRecipe({ hasA: true, phase, history, rng, caps: { ...caps, blend: false, aLanes: null } }));
    fallbacks.push(RECIPES.R7, RECIPES.R2, RECIPES.R1);
    for (const r of fallbacks) {
      if (r === recipe) continue;
      const x = chooseExit(r, history, rng);
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
    best = { T, i: null, e, phraseClass: null, cost: null, lead: leadFor(teaseBars), n, teaseBars, relaxed: false, blend: null };
  } else if (!best) {
    // A has no usable downbeat in the window (near its end, no grid): fade it under a swell, then land.
    recipe = RECIPES.FADE;
    exit = null;
    const T = spinStart + win.dTarget;
    best = { T, i: null, e: T - pickup - gapBeatsFor(recipe) * gB.beat, phraseClass: null, cost: null, lead: leadFor(0), n: 0, teaseBars: 0, relaxed: false, blend: null };
  }

  const { T, i, e, n, teaseBars } = best;
  const gapBeats = gapBeatsFor(recipe);
  const declick = Math.min(DECLICK_SEC, Math.max(0, hook.downbeatSec - best.lead));
  const lead = best.lead + declick;
  const pickupAt = T - pickup;
  const gapStart = pickupAt - gapBeats * gB.beat;
  const bStart = T - lead;
  const events: PlanEvent[] = [];
  const aState: OutgoingDeck | null = tl ? { tl, level: duckLevel, bars: A?.stemBars ?? null } : null;
  if (tl) events.push(ramp('A.gain', spinStart, spinStart + 0.4, 1, duckLevel, 'lin'));
  events.push(sfx('whoosh', spinStart, phase.name === 'early' ? -8 : -5));

  // The landing layer: the reverse cymbal, a dry landing, or B's pre-verb (when it is rendered and A is cut
  // low, gone, or in a compatible key by then).
  const keysMatch = keysAgree(A, B, hook);
  const preverbFits = Boolean(B.preverbs?.includes(hook.id)) &&
    (!tl || recipe.shape === 'S2' || gapBeats >= MOVES.preverb.clearGapBeats || Boolean(recipe.aClearsLows) || keysMatch);
  const landing = chooseLanding({ phase, rng, preverb: preverbFits, force: force?.landing ?? null });
  const preverb = landing.style === 'preverb' ? preverbEvent({ hookId: hook.id, pickupAt, minStart: tl ? minStart : spinStart + 0.1, gB, phase, rng }) : null;
  if (landing.style === 'preverb' && !preverb) landing.style = 'cymbal';

  const built = recipe.build({
    A: aState, i, e, T, pickupAt, gapStart, bStart, tease: teaseBars > 0, teaseStems, gB, phase, rng, exit, blend: best.blend,
    minStart, aLanes: caps.aLanes, chop: caps.chop, landing, force: force ? { bridge: force.bridge ?? null, variant: force.variant ?? null } : null,
  });
  const teaseStyle = teaseBars > 0 ? (built.events.some((x) => x.kind === 'stems') ? 'stems' : 'lpf') : null;
  events.push(...built.events);
  if (preverb) events.push(preverb);

  // D9's Ghost Tease decorates S1 moves that leave the reverb alone, when B's vocals are decoded.
  const layers: LayerName[] = [];
  if (tl && recipe.shape === 'S1' && recipe.ghostHost && teaseStems?.includes('vocals')) {
    const wants = force?.ghost ?? rng() < MOVES.ghost.chance[phase.name];
    // B's stems start STEMS.leadSec before its hook: the ghost stays inside them.
    const stemsFrom = T - (hook.downbeatSec - Math.max(0, hook.downbeatSec - STEMS.leadSec)) + STEMS.laneMarginSec;
    const ghost = wants && i != null
      ? ghostLayer({ T, pickupAt, gapStart, gB, barA: tl.barAt(i), minStart: Math.max(minStart, stemsFrom), phase: phase.name, rng, keysMatch })
      : null;
    if (ghost) {
      events.push(...ghost);
      layers.push('ghost');
    }
  }

  const signature = signatureLayer({
    shape: recipe.id === 'FADE' ? 'S0' : recipe.shape, tl, A, B, aRate: A?.deck.rate ?? 1, gB, spinStart, e, n, pickupAt, exit, phase, rng,
    skipB: Boolean(built.usesBSignature),
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
    bridgeBars: n,
    gapBeats,
    teaseBars,
    teaseStyle,
    // A candidate only gets a blend layer when B's render (`blend`) is there.
    blend: best.blend && blend ? { bars: best.blend.bars, bass: best.blend.bass, at: best.blend.at, fileAt: best.blend.fileAt, toBpm: blend.toBpm } : null,
    signature: signature ? { deck: signature.deck, id: signature.id, at: signature.at, rate: signature.rate } : null,
    landing: landing.style,
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
