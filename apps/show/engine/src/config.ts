// Every tunable number of the show engine, in one place. Terms follow GLOSSARY.md. Modules import from
// here instead of keeping their own constants; tests may pass overrides where a function takes `config`.
// (Recipe-internal shapes, such as riser frequencies, still live next to each recipe in plan/recipes.ts.)
// The numbers the remotes share (Pace limits and presets, sound names) come from @quina/protocol.
import { PACE_FINE_STEP_SEC, PACE_LIMITS_SEC, PACE_PRESETS_SEC, SFX_NAMES, STINGER_NAMES } from '@quina/protocol';
import type { PhaseName, SoundName, StingerName } from '@quina/protocol';

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
  /** S2 bridge lengths, in B's bars: the search takes the one nearest the Pace, preferring one the last builds did not have. */
  readonly bridgeBars: readonly number[];
  /** Chance of a Tease of B before an S2 landing. */
  readonly tease: number;
  /** The same chance when B's own stems cover the hook. */
  readonly stemTease: number;
  /** Chance of layering an approved Signature (B's call before it lands, or A's echoing out). */
  readonly signature: number;
  /** A Signature's level against its normalized loudness, in dB. */
  readonly signatureDb: number;
  /** Silence before the pickup, in B's beats: one is drawn (a value listed twice weighs double), away from the last gaps. */
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
    // docs/dj-techniques.md › Weights. R8, D10 and D16 need B's stretched render, D8, D10, D15 and D16 A's stem
    // lanes, D11 and D19 B's vocals, D16 B's stretched voice (tight tempos, agreeing keys): without them the rest
    // share the draw. Early keeps the Blend and the build common; the theatrical moves wait for mid.
    weights: { R8: 1, D10: 0.6, R7: 0.3, D1: 0.25, D3: 0.2, D8: 0.15, D2: 0.1, R2: 0.1, R4: 0.1, R5: 0.08, R1: 0.05, R6: 0.05 },
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
    // D16 is rare (about 7.5% of pairs qualify), so it is drawn often when it does.
    weights: {
      R8: 0.8, D16: 1, D10: 0.6, R7: 0.45, D8: 0.25, D1: 0.2, D3: 0.2, D2: 0.15, D11: 0.15, D19: 0.12, D15: 0.12, D7: 0.12, R4: 0.12,
      R5: 0.1, R2: 0.1, R6: 0.04, R1: 0.04,
    },
    bridgeBars: [2, 3],
    tease: 0.5,
    stemTease: 0.8,
    signature: 0.55,
    signatureDb: -4,
    gapBeats: [0.5, 0.5, 1],
    snarePitch: 5,
    duckDb: -3,
    impactSamples: [['boom', -8]],
    hookTags: ['best', 'main'],
    autoAdvance: true,
  },
  late: {
    name: 'late',
    weights: {
      R7: 0.6, D16: 0.9, D10: 0.4, R8: 0.4, D8: 0.3, D11: 0.25, D6: 0.2, D2: 0.2, D19: 0.18, D15: 0.15, D7: 0.15, D3: 0.15, R4: 0.15,
      R5: 0.15, D1: 0.12,
    },
    bridgeBars: [2, 3, 4],
    tease: 1,
    stemTease: 1,
    signature: 0.7,
    signatureDb: -3,
    gapBeats: [1, 1, 0.5, 2],
    snarePitch: 7,
    duckDb: -4,
    impactSamples: [['orchestra-hit', -6], ['boom', -8]],
    hookTags: ['best', 'main'],
    autoAdvance: true,
  },
  final: {
    name: 'final',
    // R10 is no longer the only final move: D2's crawl, D8's long strip-down, the fake drop, the braker, the
    // mashup, the scratch, and the final gate and spiral.
    weights: { R10: 0.5, D2: 0.4, D16: 0.4, D8: 0.3, D6: 0.3, D15: 0.2, D1: 0.2, D19: 0.15, D3: 0.15 },
    bridgeBars: [3, 4],
    tease: 1,
    stemTease: 1,
    signature: 0.85,
    signatureDb: -2,
    gapBeats: [2, 2, 1],
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
  /** An automatic Next lands on the outgoing song's 8-bar (else 4-bar) phrase boundary nearest its slot,
   * between these shares of the slot after the last landing. */
  phraseSlotRange: [0.75, 1.4] as const,
  /** With no phrase boundary in that range (a slow song's 4 bars can straddle it): the nearest one in this one. */
  phraseSlotRangeWide: [0.6, 1.6] as const,
  /** An 8-bar boundary is preferred: a 4-bar one wins only when it is nearer the slot by this share of it. */
  phrase4Penalty: 0.15,
  /** The Spin an automatic Next aims at a phrase boundary with, at most: an S2 bridge on B's slower bars lands
   * a little after A's boundary and must stay inside the Spin's 11 s limit. */
  alignedSpinMaxSec: 10,
  /** An automatic Next lands at least this long before the outgoing song ends. */
  endMarginSec: 1,
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
  /** P1 stem lanes of the playing song (A): decoded from just before its landed hook to this long after it
   * (the stored window ends at hook + 48 s), and used only this far inside what is decoded. */
  laneLeadSec: 1,
  laneTailSec: 48,
  laneMarginSec: 0.5,
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
  /** The drum spins (`coastSpinUpSec`, at least a lap) to a random card, unrelated to the target, then wanders
   * back and forth around it: swings of `wanderCards` cards, `wanderBars` bars long. */
  coastSpinUpSec: 3,
  wanderCards: [3, 1.5] as const,
  wanderBars: [4, 11] as const,
  /** Exit moves for the outgoing song as the Suspense starts. */
  exits: ['echo', 'wash', 'brake', 'spinback'] as const,
});

/**
 * Decoys (experiment, OFF by default; docs/decoys.md): a transition may tease a song that is not next, then
 * cut it off with a tape stop and land the real one. Only songs that already landed this round are used, so
 * a Decoy can never count. With `enabled: false` nothing else changes.
 */
export interface DecoyConfig {
  readonly enabled: boolean;
  /** Chance per transition, by Phase (only S2 transitions with A playing and a long enough bridge). */
  readonly chance: Readonly<Record<PhaseName, number>>;
  /** At least this many bridge bars: the Decoy plays in the first ones, the real build keeps the last. */
  readonly minBridgeBars: number;
  /** The Decoy plays at least `minSec` and at most `maxSec` before its tape stop. */
  readonly minSec: number;
  readonly maxSec: number;
  /** Its level (after its loudness trim) and a low-pass, so it sounds like the wrong record. */
  readonly gainDb: number;
  readonly lpfHz: number;
  /** The tape stop that cuts it off, and the sound on the cut. */
  readonly cutSec: number;
  readonly cutSfx: string;
}
export const DECOYS: DecoyConfig = Object.freeze({
  enabled: false,
  chance: Object.freeze({ early: 0, mid: 0.12, late: 0.18, final: 0 }),
  minBridgeBars: 2,
  minSec: 0.7,
  maxSec: 2.4,
  gainDb: -4,
  lpfHz: 3200,
  cutSec: 0.45,
  cutSfx: 'thunk',
});

/** Signatures: short, iconic, approved pieces of a song (tools/prep/signatures.py, approved on the audition page). */
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
  /** Bars rendered before the hook (and after it), by tools/prep/stretch.py through the relay. */
  renderBars: 8,
  renderAfterBars: 1,
  /** Bars of the blend under A: at least this many, else the planner uses another recipe. */
  minBars: 2,
  /** Keys must be compatible with at least this detection confidence to layer B's bass over A. */
  minKeyConfidence: 0.7,
  /** Crossfade from the stretched layer into B's own mix on the pickup. */
  handoverSec: 0.008,
});

/** A value per Phase. */
type ByPhase<T> = Readonly<Record<PhaseName, T>>;

/**
 * The DJ techniques of docs/dj-techniques.md (D1–D16, D19) and the variants of the older recipes: what varies at
 * random, and what scales with the Phase. Levels are linear gains unless named `Db`; lengths in beats or bars
 * of the deck named. The shapes of the moves are in plan/moves.ts, plan/bridges.ts and plan/landing.ts.
 */
export const MOVES = Object.freeze({
  /** D1 Trans gate and pump: A chopped on its own grid over its last bars. */
  gate: Object.freeze({
    /** Its length in A's bars (one is drawn, away from the last builds' lengths); two bars play the long ladder. */
    bars: { early: [1, 1, 2], mid: [1, 2], late: [2, 2, 1], final: [2] } as ByPhase<readonly number[]>,
    /** The gate's closed level (a partial gate keeps the groove early); null closes it to silence. */
    closedDb: { early: -15, mid: -24, late: null, final: null } as ByPhase<number | null>,
    modes: { gate: 0.5, pump: 0.3, gatePump: 0.2 },
    duty: [0.5, 0.6] as const,
    /** Chance of the 3-3-2 pattern in the 1/16 stage instead of straight steps. */
    tresillo: 0.2,
    edgeSec: 0.002,
    /** Open steps get a little lift against the perceived level dip. */
    openLiftDb: 1,
    /** A's high-pass reaches at least this before the 1/16 stage (AM sidebands buzz in the lows). */
    fastStageHpfHz: 250,
    hpfToHz: [300, 500, 800] as const,
    riserDb: { early: -12, mid: -10, late: -8, final: -6 } as ByPhase<number>,
    pumpDb: [-6, -14] as const,
    pumpRecoverBeats: 0.7,
    kicks: [0.35, 0.55] as const,
    /** Bars whose drums are this far under the song's median are sparse: the gate would sound like dropouts. */
    sparseDrumsDb: -9,
    finalBusHpfHz: 300,
  }),
  /** D3 Spiral echo-out: A's last beat caught in an echo whose delay shrinks, so the repeats climb. */
  spiral: Object.freeze({
    /** Its length in A's bars (one is drawn, away from the last builds' lengths). */
    bars: { early: [1, 1, 2], mid: [1, 2], late: [2, 2, 1], final: [2] } as ByPhase<readonly number[]>,
    delayBeats: [0.5, 0.75, 1] as const,
    endBeats: [1 / 16, 1 / 12] as const,
    feedbackFrom: 0.55,
    feedbackTo: { early: 0.7, mid: 0.75, late: 0.8, final: 0.85 } as ByPhase<number>,
    send: 0.8,
    hpfFromHz: 300,
    hpfToHz: [1500, 2500] as const,
    /** "Spiral down" (only as an R7 exit, a bridge follows): the delay grows and the repeats fall. */
    downChance: 0.25,
    downBeats: [0.25, 1] as const,
  }),
  /** R10 Power-down: at most once in a final stretch (final covers the last 1–3 songs of a climb). */
  powerDown: Object.freeze({ cooldown: 3 }),
  /** The riser under an S1 or S3 move that does not pick its own: a tone riser (noise and a climbing saw) this often,
   * else the noise alone; the risers of the last transitions are turned down (VARIETY.riser). */
  riser: Object.freeze({ tone: 0.35 }),
  /** D2 Stop-time hits: A only on chosen beats, silence between, the crowd fills the gap. */
  hits: Object.freeze({
    holdBeats: [0.2, 0.3] as const,
    openSec: 0.003,
    closeSec: 0.03,
    kick: 0.55,
    thunkDb: -12,
    ringSend: 0.4,
    /** The silence before the pickup, in B's beats, whatever the Phase's gap. */
    minGapBeats: { early: 1, mid: 1, late: 1, final: 2 } as ByPhase<number>,
    lateRiserChance: 0.3,
    impactBoost: 0.1,
    /** Never within this many previous transitions (at most one in six). */
    cooldown: 5,
  }),
  /** D8 Stem peel: A taken apart stem by stem, its voice thrown into the echo. */
  peel: Object.freeze({
    bars: { early: [1, 1, 2], mid: [2, 2, 1], late: [2], final: [2, 3, 4] } as ByPhase<readonly number[]>,
    orders: { acapella: 0.5, beat: 0.25, drumsVoice: 0.25 },
    /** Chance a removal slides over a beat instead of cutting on the one. */
    slide: 0.5,
    cutSec: 0.01,
    /** A stem is never exposed alone longer than this many A bars. */
    maxExposedBars: { early: 1, mid: 1, late: 2, final: 2 } as ByPhase<number>,
    reverbSend: [0.15, 0.35] as const,
    hpfHz: 120,
    throwDelayBeats: [0.5, 0.75] as const,
    throwFeedback: 0.5,
  }),
  /** D10 Drum swap: A's drums out, B's stretched drums in, under A's voice. */
  swap: Object.freeze({
    bars: { early: [1, 1, 2], mid: [2, 2, 1], late: [2, 3, 4], final: [2, 3, 4] } as ByPhase<readonly number[]>,
    juggle: 0.3,
    drums: 0.9,
    bass: 0.85,
    /** During the swap, B's kick against A's bassline: A's bass a little down, or A high-passed. */
    aBassDown: -0.29,
    aHpfHz: 80,
    exits: { echo: 0.4, wash: 0.3, throw: 0.3 },
  }),
  /** D9 Ghost Tease: B's voice only through the reverb, behind A's last bars (S1). */
  ghost: Object.freeze({
    chance: { early: 0, mid: 0.4, late: 0.5, final: 0.5 } as ByPhase<number>,
    bars: { early: 0, mid: 1, late: 1.5, final: 2 } as ByPhase<number>,
    send: { early: 0, mid: 0.4, late: 0.5, final: 0.55 } as ByPhase<number>,
    hpfFromHz: 400,
    hpfToHz: [700, 1200] as const,
    /** Keys incompatible or unknown: air more than pitch. */
    airHpfHz: 1500,
    airSend: 0.3,
    /** Keys compatible: "the ghost becomes a voice", B's dry vocals at this level in the ghost's last beat. */
    voiceChance: 0.3,
    voiceDb: -18,
  }),
  /** D11 Vocal-chop stutter build: B's first syllable chopped faster and faster on B's grid (S2). */
  chop: Object.freeze({
    bars: { early: 1, mid: 1, late: 2, final: 2 } as ByPhase<number>,
    grainBeats: [0.25, 0.125] as const,
    rateTo: { early: 1, mid: 1.06, late: 1.12, final: 1.19 } as ByPhase<number>,
    gainDb: { early: -1, mid: 0, late: 1, final: 2 } as ByPhase<number>,
    octaveChance: 0.3,
    octaveDb: -10,
    fadeMs: 3,
    hpfHz: 150,
    /** The grain starts on the syllable's onset, searched this far after the source point, past at most
     * `consonantSec` of noise-like consonant. */
    onsetSearchSec: 0.25,
    consonantSec: 0.03,
    minGapBeats: { early: 0.5, mid: 0.5, late: 1, final: 1 } as ByPhase<number>,
    /** The build under the chops: the snare roll's velocity scale (about −6 dB). */
    rollScale: 0.65,
    /** B sings at its hook when its vocals bar is at least this loud (stems bars, dB). */
    minVocalsDb: -30,
  }),
  /** D12 Pre-verb swell (P3): B's own first beat, reversed through a reverb, inhaled into the landing. */
  preverb: Object.freeze({
    lengthBars: { early: 0.5, mid: 0.75, late: 1, final: 1 } as ByPhase<number>,
    gainDb: { early: -12, mid: -10, late: -8, final: -7 } as ByPhase<number>,
    breathSec: [0.03, 0.06] as const,
    hpfHz: 200,
    /** The render: B's mix from its pickup for one beat, RT60 = this × B's bar, faded in. */
    rt60Bars: 1.25,
    fadeInSec: 0.02,
    minSec: 0.25,
    /** With a gap under this many B beats the swell overlaps A: A must be cut low, or the keys agree. */
    clearGapBeats: 0.5,
    /** Rendered from B's vocals instead of its mix (when B sings at its hook and the render is ready). */
    vocalsChance: 0.5,
  }),
  /** The landing layer, rotated: the reverse cymbal, a dry landing, D12's pre-verb (when rendered) or D14's tape start. */
  landing: Object.freeze({
    weights: {
      early: { cymbal: 0.45, dry: 0.3, preverb: 0.45, tape: 0 },
      mid: { cymbal: 0.45, dry: 0.2, preverb: 0.5, tape: 0.15 },
      late: { cymbal: 0.5, dry: 0.1, preverb: 0.5, tape: 0.25 },
      final: { cymbal: 0.5, dry: 0, preverb: 0.5, tape: 0.25 },
    } as ByPhase<Readonly<Record<'cymbal' | 'dry' | 'preverb' | 'tape', number>>>,
    /** Sample layers on the impact, one set drawn per landing ([name, gain dB]). */
    impacts: {
      early: [[['boom', -12]], [['boom', -14]], [['orchestra-hit', -14]], [['horn', -18]]],
      mid: [[['boom', -8]], [['orchestra-hit', -9]], [['boom', -9], ['orchestra-hit', -12]], [['horn', -14]]],
      late: [[['orchestra-hit', -6], ['boom', -8]], [['boom', -6]], [['orchestra-hit', -5]]],
      final: [[['orchestra-hit', -3], ['boom', -5]], [['orchestra-hit', -3]], [['boom', -4]]],
    } as ByPhase<ReadonlyArray<ReadonlyArray<readonly [string, number]>>>,
    /** The samples sit this far before T (their attack). */
    sampleLeadSec: [0.02, 0.04] as const,
    dryImpactScale: 0.8,
  }),
  /** R7's bridge patterns, independent of its exit (D4 half-time, D13 clap-along, a kick roll). */
  bridges: Object.freeze({
    weights: {
      early: { roll: 1, clap: 0.6, kickroll: 0.4, halftime: 0 },
      mid: { roll: 1, halftime: 0.5, clap: 0.4, kickroll: 0.4 },
      late: { roll: 1, halftime: 0.7, kickroll: 0.4, clap: 0 },
      final: { roll: 1, halftime: 0.6, kickroll: 0, clap: 0 },
    } as ByPhase<Readonly<Record<'roll' | 'halftime' | 'kickroll' | 'clap', number>>>,
    /** Classic roll variety: start at 1/8 sometimes, triplets in the last beat, a tone riser. */
    eighthStart: 0.3,
    tripletEnd: 0.3,
    toneRiser: 0.4,
    kicks: 0.6,
    claps: 0.5,
  }),
  /** D14 Tape start (P5): B powers up from a growl to full speed exactly at its pickup, in the gap. */
  tape: Object.freeze({
    durSec: [0.35, 0.45, 0.6] as const,
    fromRate: 0.25,
    fromDb: -12,
    lpfFromHz: 800,
    /** At least this much of it must fit in the gap (it is shortened to the gap). */
    minSec: 0.3,
    /** Its weight after a stop (R5, R10, D2, D15): "stop → silence → power-up" is a complete gag. */
    afterStop: 2.5,
    /** Its first milliseconds fade in from silence. */
    fadeInSec: 0.005,
  }),
  /** D5 Riff bed: B's approved riff Signature looped on B's grid under R7's bridge (a Tease). */
  riff: Object.freeze({
    chance: { early: 0, mid: 0.3, late: 0.5, final: 0.6 } as ByPhase<number>,
    gainDb: { early: -8, mid: -8, late: -7, final: -6 } as ByPhase<number>,
    variants: { dry: 0.4, throw: 0.35, gate: 0.25 },
    /** The build plays on top with its snare roll about 15 velocity quieter, so the riff speaks. */
    rollScale: 0.88,
    seamFadeSec: 0.005,
    endFadeSec: 0.01,
    /** At least this many of B's bars from the bridge's start to the gap (a two-bar bridge less its pickup and gap). */
    minBars: 1.25,
    throwSend: 0.5,
    throwDelayBeats: [0.5, 0.75] as const,
    throwFeedback: 0.5,
    /** The gate variant: the last bar chopped in eighths of a beat, open half of each. */
    gateStepBeats: 0.125,
    gateDuty: 0.5,
  }),
  /** D6 Fake drop: the build peaks, a beat of silence, a bar of something else, a short re-build, the real landing. */
  fake: Object.freeze({
    kinds: { drums: 0.4, comedy: 0.35, kicks: 0.25 },
    comedy: ['spongebob-boowomp', 'duck-quack', 'anime-wow'] as const,
    comedyDb: -8,
    kick: 0.55,
    impact: 0.5,
    rebuildHpfHz: 500,
    /** The bridge must hold the first build, the fake bar and the re-build. */
    minBridgeBars: 3,
    /** Never within this many transitions: about once per climb to a win. */
    cooldown: 8,
    impactBoost: 0.1,
  }),
  /** D7 Pitch-up rush: A becomes the riser, its tape speed (pitch and tempo) climbing, then a breath and the hook. */
  rush: Object.freeze({
    bars: { early: [1], mid: [1], late: [1, 2], final: [1] } as ByPhase<readonly number[]>,
    semitones: { early: 3, mid: 3, late: 4, final: 4 } as ByPhase<number>,
    maxSemitones: 5,
    hpfToHz: [400, 700] as const,
    liftDb: 1,
    cutSec: 0.03,
    /** A runs ahead of its grid: at least this much silence before the pickup. */
    minGapBeats: { early: 0.5, mid: 0.5, late: 0.5, final: 0.5 } as ByPhase<number>,
    /** Late: a D1 gate on top, synced to A's climbing tempo. */
    gateChance: { early: 0, mid: 0, late: 0.3, final: 0 } as ByPhase<number>,
    /** A's voice this far above its median level in those bars: a semitone less (no chipmunks). */
    loudVocalsDb: 3,
    riserDb: { early: -12, mid: -10, late: -8, final: -6 } as ByPhase<number>,
  }),
  /** D15 Instrumental braker: A's band brakes to a halt while its singer carries on dry, then the voice is thrown. */
  braker: Object.freeze({
    /** The brake's length, in A's bars. */
    brakeBars: [0.75, 1] as const,
    /** A's voice must be singing in its last bars (stems bars, dB); unknown counts as singing. */
    minVocalsDb: -28,
    lpfToHz: 500,
    rateTo: 0.02,
    /** The dry voice goes into the echo this many of A's beats before the gap. */
    throwBeats: 0.5,
    throwDelayBeats: [0.5, 0.75] as const,
    throwFeedback: 0.5,
    riserDb: { early: -14, mid: -12, late: -10, final: -8 } as ByPhase<number>,
  }),
  /** D16 Acapella-in mashup: A's singer out, B's voice (stretched to A's tempo) sings over A's band. */
  acapella: Object.freeze({
    bars: { early: [1], mid: [1], late: [1, 2], final: [2] } as ByPhase<readonly number[]>,
    vocals: 1,
    hpfHz: 150,
    /** A makes room: a little down and high-passed (there is no mid EQ). */
    aDownDb: -3,
    aHpfHz: 120,
    exits: { echo: 0.6, wash: 0.4 },
    /** B sings in the bars before its hook (stems bars, dB). */
    minVocalsDb: -26,
  }),
  /** D19 Scratch-in (P7): B's first syllable scratched back and forth on B's grid, released into the hook. */
  scratch: Object.freeze({
    /** Beats of scratching before the pickup (S2). */
    beats: { early: 1, mid: 1, late: 2, final: 2 } as ByPhase<number>,
    styles: { baby: 0.45, chirp: 0.3, forward: 0.25 },
    /** How far the hand moves the record each stroke, in B's beats of the source. */
    grainBeats: [0.2, 0.25, 0.3] as const,
    gainDb: { early: -2, mid: -1, late: 0, final: 1 } as ByPhase<number>,
    hpfHz: 150,
    /** Needle noise at the record's normal speed. */
    needleDb: -42,
    /** The crossfader's edges. */
    edgeSec: 0.003,
    /** The release ends this long before the pickup. */
    breathSec: 0.03,
    minGapBeats: { early: 0.5, mid: 0.5, late: 1, final: 1 } as ByPhase<number>,
    /** The build under the scratch: the snare roll's velocity scale. */
    rollScale: 0.7,
  }),
  /** A layer in an S1 gap of at least a beat: D11's one-beat chop or D19's one-beat scratch (they live in the gap). */
  gapLayer: Object.freeze({
    chance: { early: 0, mid: 0.3, late: 0.45, final: 0.45 } as ByPhase<number>,
    kinds: { chop: 0.6, scratch: 0.4 },
    minGapBeats: 1,
  }),
  /** Variants of the older recipes (docs/dj-techniques.md › weakest recipes). */
  variants: Object.freeze({
    R1: { hpf: 0.5, lpf: 0.3, stab: 0.2 },
    R2: { delayBeats: [0.5, 0.5, 0.75, 1] as const, freeze: 0.2, vocalThrow: 0.35, freezeFeedback: 0.92 },
    R4: { lastBeat: 0.35, triplet: 0.3, pitchUp: { early: 0, mid: 0.3, late: 0.4, final: 0.4 } as ByPhase<number>, pitchTo: 1.12 },
    R5: { brakeSec: [0.6, 0.8, 1.0] as const, spinRate: [2.5, 3, 3.5] as const, spinSec: [0.8, 1.0, 1.2] as const },
  }),
});

export const PLANNER = Object.freeze({
  lookaheadSec: 0.08,
  declickSec: 0.004,
  /** A's exit move starts after the spin-start duck. */
  afterDuckSec: 0.45,
  phraseCost: Object.freeze({ phrase8: 0, phrase4: 1.0, bar: 2.5 }),
  /** An S2 build after A's completed phrase (rather than in place of its last bars) costs this much more. */
  phraseAtExitCost: 0.5,
  driftCostPerSec: 1.0,
  /** Hook-based LUFS trim is clamped to this range (dB). */
  trimLimitsDb: [-12, 6] as const,
  /** songs.json `volume` was the old player's manual loudness fix; it double-compensates LUFS. */
  useLegacyVolume: false,
});

/**
 * Rotation memory (plan/variety.ts): a listener hears the whole night, so every choice a transition draws remembers
 * what the last transitions of the round did. An option used k transitions ago weighs `[k − 1]` times as much, once
 * for every time it was used; nothing is forbidden here (the hard rules stay in chooseRecipe). Measured by
 * tests/variety.test.ts over whole simulated nights.
 */
export const VARIETY = Object.freeze({
  /** How many transitions back the planner remembers (the round's; a new round starts afresh). */
  memory: 4,
  /** The recipe itself, and its family (the spiral counts as an echo). */
  recipe: [0.2, 0.5, 0.8] as const,
  family: [0.55, 0.8, 0.9] as const,
  /** How A leaves (an S2 exit, or what an S1 or S3 move does to A: an echo, a wash, a brake…). */
  move: [0.15, 0.45, 0.75] as const,
  /** The landing layer and the impact's samples. */
  landing: [0.35, 0.65, 0.85] as const,
  /** The riser's flavour (noise, or noise with a climbing saw) under an S1 or S3 move. */
  riser: [0.4, 0.75] as const,
  impact: [0.25, 0.6] as const,
  /** R7's bridge pattern, against the last S2 builds (D11, D19, D6 and R10 build on the classic roll). */
  bridge: [0.3, 0.6, 0.85] as const,
  /** The gap before the pickup. */
  gap: [0.35, 0.7] as const,
  /** A's move length in its bars (D1, D3, D7, D8, D10, D16), against the last moves'. */
  bars: [0.4, 0.75] as const,
  /** S2: a bridge as long as the last S2 builds costs this much more (seconds of distance from the Pace's target). */
  bridgeBarsCost: [0.9, 0.4] as const,
  /** S2: each bridge length also gets a random cost up to this, drawn per transition, so tempo alone does not decide. */
  bridgeBarsJitter: 0.5,
  /** Builds from silence (the round's first Spin, after Hold music or a Celebration), per Phase: R7 unless B sings
   * at its hook (D11's chops and D19's scratch need its voice); final keeps the power-down. */
  openers: {
    early: { R7: 1, D11: 0.35, D19: 0.25 },
    mid: { R7: 1, D11: 0.5, D19: 0.4 },
    late: { R7: 1, D11: 0.6, D19: 0.5 },
    final: { R10: 1, R7: 0.4, D11: 0.4, D19: 0.4 },
  } as ByPhase<Readonly<Record<string, number>>>,
});

/** The show flow (docs/protocol.md › Scenes): the Shuffle, the Check, the Celebration and the Interval. */
export const FLOW = Object.freeze({
  /** The public Shuffle's animation: the scene becomes `play` after it, and no song lands before then. */
  shuffleSec: 8,
  /** The tie-free Shuffle reshuffles at most this many times; then it keeps the last Queue and warns. */
  shuffleMaxAttempts: 500,
  check: Object.freeze({
    /** From the Check's start to its first snippet: the projector shows the card first. */
    leadSec: 1.5,
    /** A ✓ step: the landed song's hook snippet (tools/prep/snippets.py cuts 3 s). */
    stepSec: 2.5,
    /** A ✗ step: the short "broken record" sound. */
    missSec: 1.2,
    /** Silence between steps. */
    gapSec: 0.35,
    /** After the last step, the result shows. */
    tailSec: 0.4,
    /** The song or Hold music under the Check, far down. */
    duckDb: -32,
    duckFadeSec: 0.4,
    /** Snippets play at their loudness-normalised level plus this. */
    snippetDb: -2,
    snippetFadeSec: 0.25,
    brokenDb: -8,
  }),
  celebration: Object.freeze({
    /** The Clear fanfare and an impact on the Celebration's start. */
    fanfare: 'mkwii-mission-clear' as StingerName,
    impact: 'orchestra-hit' as SoundName,
    /** The Celebration's music comes in under the fanfare. */
    musicDelaySec: 1.2,
    musicFadeSec: 1.5,
    /** 'winningSong': the Winning song's landed hook looped in whole bars (at most this many). */
    loopBars: 8,
    loopMinBars: 2,
    winningSongDb: -4,
    victoryDb: -6,
    /** After a Bingo's Celebration, the Interval starts by itself so the show never stalls. */
    toIntervalSec: 60,
  }),
  /** The Failure fanfare on an invalid Claim. */
  failureFanfare: 'mkwii-mission-failure' as StingerName,
  /** The Interval's countdown is only a guide. Its music: INTERVAL below. */
  intervalGuideSec: SCHEDULE.intervalSec,
  /** The phones' Heat (`heat.sample`): a random 4–15 s after a landing, never at it; held 15 s at most when no
   * next sample is due yet. */
  heatSample: Object.freeze({ minDelaySec: 4, maxDelaySec: 15, holdSec: 15 }),
});

/**
 * The Interval playlist (tools/prep/interval.py → data/interval/): the break music between rounds, also under a
 * round's intro and Shuffle and in `after`. Tracks hand over with an echo-out of the outgoing track on its
 * downbeat while the next one swells or opens up into that same downbeat (engine/src/interval/plan.ts).
 */
export const INTERVAL = Object.freeze({
  /** Its level by default (`setGame intervalVolumeDb`, −30..0): under the presenters' talk. */
  volumeDb: -6,
  /** A volume change glides over this long. */
  volumeGlideSec: 0.3,
  /** From silence (nothing playing before it), the first track fades in over this long. */
  fadeInSec: 2,
  /** A natural handover's echo-out lands on a downbeat in the last `minBeforeEndSec + windowSec` to
   * `minBeforeEndSec` seconds of the track's sound, and no later than `intoFadeSec` into its closing fade. */
  minBeforeEndSec: 8,
  windowSec: 4,
  intoFadeSec: 1,
  /** A track plays at least this long before it hands over. */
  minPlaySec: 20,
  /** Bars count from the first downbeat; a handover prefers the start of a phrase of this many bars. */
  phraseBars: 4,
  /** The runtime commits a natural handover this long before the incoming track enters. */
  armLeadSec: 2.5,
  /** A skip's downbeat is at least this far ahead (time to schedule the next track). */
  skipLeadSec: 0.6,
  /** Tempos this close (after folding ×2, ÷2) overlap their bars into the downbeat; otherwise the next track
   * drops on the one after its pickup, so two grids never clash. */
  matchedTempo: 0.04,
  /** Tempos matched: the next track rises under the outgoing one for this many of the outgoing track's bars
   * (a skip: `skipOverlapBars`, or less if its downbeat is near), within `overlapSec`. */
  overlapBars: 2,
  skipOverlapBars: 1,
  overlapSec: Object.freeze({ min: 3, max: 8 }),
  /** Tempos apart: the next track's pickup before the one, at most this many of its beats. */
  pickupBeats: 1,
  /** Swell: the next track rises from `swellFromDb` and its high-pass falls from `swellHpfHz`. */
  swellFromDb: -30,
  swellHpfHz: 600,
  /** Filter opening: the next track's low-pass opens from `filterFromHz`, fully at the one (tempos matched) or
   * `filterAfterBars` of its bars after it (tempos apart). */
  filterFromHz: 300,
  filterOpenHz: 20000,
  filterAfterBars: 2,
  /** The outgoing track thins out (high-pass) while the next one comes in. */
  outHpfHz: 250,
  /** The echo-out: the outgoing track's last beat into a synced echo (one beat; half a beat when beats are
   * longer than `echoHalfBeatOverSec`), its dry signal cut on the one over `cutSec`. */
  echoFeedback: 0.5,
  echoTailSec: 4,
  echoHpfHz: Object.freeze({ from: 150, to: 2000 }),
  echoHalfBeatOverSec: 0.9,
  cutSec: 0.03,
  /** Music without a beat grid: its echo uses this beat. */
  fallbackBeatSec: 0.5,
});

export const ENGINE = Object.freeze({
  taskIntervalMs: 25,
  healthIntervalMs: 5000,
  /** A reloaded show page resumes the current Game from its journal if its last entry is this recent. */
  resumeWithinMs: 12 * 3600 * 1000,
  /** A current song this close to its end is not used as the outgoing deck. */
  minOutgoingTailSec: 0.5,
  /** Samples the plans play (impacts, D6's comedy bar), loaded at start. */
  fxSamples: ['boom', 'orchestra-hit', 'horn', ...MOVES.fake.comedy] as const,
  /** One-shot fanfares (data/media/stingers). */
  stingers: STINGER_NAMES,
  /** Played once per climb (towards the Line, then the Bingo) as the first Spin at or above
   * `finalLapStingerPhase` starts; game.finalLapStinger turns it off. 'late' because late starts a random
   * 3–8 songs before the expected win and has false alarms, so the fanfare never gives the ending away
   * ('final' would: it is 1–3 songs before a likely win). Pending the user's answer (research Q18). */
  finalLapStinger: 'mkwii-final-lap' as StingerName, // widened: a setting, not a fixed literal
  finalLapStingerPhase: 'late' as PhaseName,
  /** Sound effects the remotes may fire (files in data/media/fx). */
  sfx: SFX_NAMES,
});

/** True for a stinger (loaded from /stingers/), false for any other sound (/fx/). */
export { isStingerName } from '@quina/protocol';
