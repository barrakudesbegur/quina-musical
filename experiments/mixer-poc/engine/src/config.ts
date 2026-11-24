// Every tunable number of the show engine, in one place. Terms follow GLOSSARY.md. Modules import from
// here instead of keeping their own constants; tests may pass overrides where a function takes `config`.
// (Recipe-internal shapes, such as riser frequencies, still live next to each recipe in plan/recipes.ts.)
// The numbers the remotes share (Pace limits and presets, sound names) come from @quina/protocol.
import { PACE_FINE_STEP_SEC, PACE_LIMITS_SEC, PACE_PRESETS_SEC, SFX_NAMES, STINGER_NAMES } from '@quina/protocol';
import type { PhaseName, StingerName } from '@quina/protocol';

export type { PhaseName } from '@quina/protocol';

/**
 * Effects per Phase. Every phase uses produced DJ moves from the first song (the user rejected plain cuts
 * and fades); toward a win the builds get longer, the silence before the landing grows, the snare
 * climbs higher and the impacts get bigger.
 */
export interface PhaseEffects {
  readonly name: PhaseName;
  /** Recipe id → weight. Keyed by string: a weight may name a recipe that does not exist (yet). */
  readonly weights: Readonly<Record<string, number>>;
  /** S2 bridge lengths, in B's bars. */
  readonly bridgeBars: readonly number[];
  /** Chance of a Tease of B before an S2 landing. */
  readonly tease: number;
  /** The same chance when B's own stems cover the hook. */
  readonly stemTease: number;
  /** Chance of layering an approved Signature (B's call before it lands, or A's echoing out). */
  readonly signature: number;
  /** A Signature's level against its normalized loudness, in dB. */
  readonly signatureDb: number;
  /** Silence before the pickup, in B's beats (one is drawn). */
  readonly gapBeats: readonly number[];
  /** How far the snare roll's pitch climbs. */
  readonly snarePitch: number;
  /** A's level after the spin-start duck. */
  readonly duckDb: number;
  /** Samples layered on the landing impact: [name, gain dB]. */
  readonly impactSamples: ReadonlyArray<readonly [string, number]>;
  /** Which hook tags this Phase may land. */
  readonly hookTags: readonly string[];
  readonly autoAdvance: boolean;
}

/** How the Pace plays out in one Phase. */
export interface PhaseTiming {
  /** Slot stretch: 1 keeps the Pace; late phases may stretch a slot by up to about 50%. */
  readonly stretch: number;
  /** The Spin's share of the slot. */
  readonly spinShare: number;
  /** Whether the Drift nudge may act. */
  readonly nudge: boolean;
}

export const PHASES: Readonly<Record<PhaseName, PhaseEffects>> = Object.freeze({
  early: {
    name: 'early',
    weights: { R8: 1, R7: 0.3, R4: 0.18, R5: 0.17, R2: 0.15, R6: 0.1, R1: 0.1 },
    bridgeBars: [1, 2],
    tease: 0,
    stemTease: 0.5,
    signature: 0.4,
    signatureDb: -5,
    gapBeats: [0, 0.5],
    snarePitch: 3,
    duckDb: -2,
    impactSamples: [['boom', -12]],
    hookTags: ['best'],
    autoAdvance: true,
  },
  mid: {
    name: 'mid',
    weights: { R8: 1, R7: 0.4, R4: 0.18, R5: 0.14, R2: 0.14, R6: 0.07, R1: 0.07 },
    bridgeBars: [2],
    tease: 0.5,
    stemTease: 0.8,
    signature: 0.55,
    signatureDb: -4,
    gapBeats: [0.5],
    snarePitch: 5,
    duckDb: -3,
    impactSamples: [['boom', -8]],
    hookTags: ['best', 'main'],
    autoAdvance: true,
  },
  late: {
    name: 'late',
    weights: { R8: 0.5, R7: 0.7, R4: 0.15, R5: 0.15 },
    bridgeBars: [2, 4],
    tease: 1,
    stemTease: 1,
    signature: 0.7,
    signatureDb: -3,
    gapBeats: [1],
    snarePitch: 7,
    duckDb: -4,
    impactSamples: [['orchestra-hit', -6], ['boom', -8]],
    hookTags: ['best', 'main'],
    autoAdvance: true,
  },
  final: {
    name: 'final',
    weights: { R10: 1 },
    bridgeBars: [3, 4],
    tease: 1,
    stemTease: 1,
    signature: 0.85,
    signatureDb: -2,
    gapBeats: [2],
    snarePitch: 12,
    duckDb: -4,
    impactSamples: [['orchestra-hit', -3], ['boom', -5]],
    hookTags: ['best'],
    autoAdvance: false, // the presenters advance by hand, unless they keep it on
  },
});

/** Placeholder Phase until cards in play are wired in: songs still to play until the first win. */
export const PHASE_PLACEHOLDER = Object.freeze({ midAt: 8, lateAt: 3, finalAt: 1 });

export const PACE = Object.freeze({
  /** Last year's medians: about 22 s in the first round and about 14 s after (fastest about 11 s). */
  firstRoundSec: 22,
  laterRoundsSec: 14,
  presets: PACE_PRESETS_SEC,
  limits: PACE_LIMITS_SEC,
  fineStepSec: PACE_FINE_STEP_SEC,
  /** The Spin takes about half the Pace, between 3 and 11 s. */
  spinLimits: [3, 11] as const,
  /** Per phase: slot stretch (late, fancy transitions may stretch a slot by up to about 50%), the
   * Spin's share of the slot, and whether the Drift nudge may act. */
  timing: Object.freeze<Record<PhaseName, PhaseTiming>>({
    early: { stretch: 1, spinShare: 0.5, nudge: true },
    mid: { stretch: 1, spinShare: 0.5, nudge: true },
    late: { stretch: 1.25, spinShare: 0.55, nudge: false },
    final: { stretch: 1.25, spinShare: 0.6, nudge: false },
  }),
  /** A landing that probably completes a card (a possible Line or Bingo) stretches its slot by about 50%,
   * so a Claim has time to happen before the next Spin. */
  completionStretch: 1.5,
  /** The system nudges the Pace by up to ±20% to recover Drift, in early and mid only. */
  nudgeLimits: [0.8, 1.2] as const,
  /** The landed song always plays on its own for at least this long before an automatic Next. */
  minSoloSec: 2,
  /** After a Hold is released with the song still playing, at least this long before an automatic Next. */
  minAfterHoldSec: 4,
});

export const SCHEDULE = Object.freeze({
  roundsTotal: 5,
  /** Random-card simulation (77 songs, ~200 cards): first Line around song 16, Bingo around song 50. */
  lineAtSong: 16,
  bingoAtSong: 50,
  lineCheckSec: 100, // last year 70–134 s
  bingoCheckSec: 150, // check plus finish, last year 85–220 s
  intervalSec: 150, // about 2.5 min
});

export const HOLD = Object.freeze({
  /** Songs under the presenters' voices during a Hold. */
  duckDb: -14,
  duckSec: 0.5,
  releaseSec: 1,
  /** A long Hold switches to Hold music after this many seconds. */
  holdMusicAfterSec: 40,
  holdMusicLevelDb: -12,
  holdMusicFadeInSec: 2,
  /** A song still playing in a Hold hands over to Hold music this long before it runs out. */
  songEndMarginSec: 2.5,
  /** Back: the undone song rewinds out for this long before Hold music comes in. */
  rewindSec: 1.1,
  /** A Spin closer than this to its landing can no longer be cancelled; Back or Hold act just after it. */
  cancelMinSec: 0.15,
});

export const STEMS = Object.freeze({
  /** A stem Teases a hook only if its last bars before the hook are at least this loud (bar RMS, dBFS). */
  teaseMinBarDb: -26,
  teaseBarsChecked: 2,
  /** Stems kept per hook: this long before the hook downbeat, and after it. */
  leadSec: 14,
  tailSec: 1,
});

/** Beat-matched layering (the Blend recipe, R8): B's bars before its hook, stretched to A's tempo. */
/** Suspense: a transition the presenters hold open (plan/suspense.ts). */
export const SUSPENSE = Object.freeze({
  /** It releases by itself after this long (it is never started automatically). */
  autoReleaseSec: 30,
  /** The loop reaches full intensity after this long. */
  rampSec: 24,
  /** Each bar of the loop is scheduled this long before it starts, so a release lands on the next bar or the one after. */
  scheduleAheadSec: 0.35,
  /** The final bar starts at least this long after the release (to schedule it and B). */
  minReleaseLeadSec: 0.25,
  /** The drum spins up to `coastGap` cards before the target (`coastSpinUpSec`, at least a lap), then crawls
   * with near-stops, its speed swinging between these (cards per second) once every `swingBars` bars. */
  coastSpinUpSec: 3,
  coastGap: 9,
  coastSpeed: [0.03, 0.45] as const,
  swingBars: 2,
  /** Exit moves for the outgoing song as the Suspense starts. */
  exits: ['echo', 'wash', 'brake', 'spinback'] as const,
});

/** Signatures: short, iconic, approved pieces of a song (analysis/signatures.py, approved on the audition page). */
export const SIGNATURES = Object.freeze({
  /** Over A's grid (S1, S3) B's Signature is resampled to A's tempo only within this (a slight pitch shift). */
  maxRateShift: 0.04,
  /** Shorter than this many beats, a Signature is a one-shot: it needs no tempo match. */
  shoutMaxBeats: 1.5,
  /** At least this share of a Signature must play before B's pickup (the rest is faded out). */
  minFit: 0.75,
  /** A's Signature thrown into the echo as it exits: the send level, and its share of the phase's chance. */
  echoSend: 0.55,
  aEchoShare: 0.5,
  fadeSec: 0.012,
});

export const LAYERING = Object.freeze({
  /** Pitch-preserving stretch limits (decisions: up to about ±8%); bass also layers only within ±4%. */
  maxStretch: 0.08,
  tightStretch: 0.04,
  /** Bars rendered before the hook (and after it), by analysis/stretch.py through the relay. */
  renderBars: 8,
  renderAfterBars: 1,
  /** Bars of the blend under A: at least this many, else the planner uses another recipe. */
  minBars: 2,
  /** Keys must be compatible with at least this detection confidence to layer B's bass over A. */
  minKeyConfidence: 0.7,
  /** Crossfade from the stretched layer into B's own mix on the pickup. */
  handoverSec: 0.008,
});

export const PLANNER = Object.freeze({
  lookaheadSec: 0.08,
  declickSec: 0.004,
  /** A's exit move starts after the spin-start duck. */
  afterDuckSec: 0.45,
  phraseCost: Object.freeze({ phrase8: 0, phrase4: 1.0, bar: 2.5 }),
  driftCostPerSec: 1.0,
  repeatPenalty: 0.2,
  /** Hook-based LUFS trim is clamped to this range (dB). */
  trimLimitsDb: [-12, 6] as const,
  /** songs.json `volume` was the old player's manual loudness fix; it double-compensates LUFS. */
  useLegacyVolume: false,
});

export const ENGINE = Object.freeze({
  taskIntervalMs: 25,
  healthIntervalMs: 5000,
  /** A reloaded show page resumes the current Game from its journal if its last entry is this recent. */
  resumeWithinMs: 12 * 3600 * 1000,
  /** A current song this close to its end is not used as the outgoing deck. */
  minOutgoingTailSec: 0.5,
  fxSamples: ['boom', 'orchestra-hit'] as const,
  /** One-shot fanfares (client/public/audios/stingers). */
  stingers: STINGER_NAMES,
  /** Played once per climb (towards the Line, then the Bingo) as the first Spin at or above
   * `finalLapStingerPhase` starts; game.finalLapStinger turns it off. 'late' because late starts a random
   * 3–8 songs before the expected win and has false alarms, so the fanfare never gives the ending away
   * ('final' would: it is 1–3 songs before a likely win). Pending the user's answer (research Q18). */
  finalLapStinger: 'mkwii-final-lap' as StingerName, // widened: a setting, not a fixed literal
  finalLapStingerPhase: 'late' as PhaseName,
  /** Sound effects the remotes may fire (files in client/public/audios/fx). */
  sfx: SFX_NAMES,
});

/** True for a stinger (loaded from /stingers/), false for any other sound (/fx/). */
export { isStingerName } from '@quina/protocol';
