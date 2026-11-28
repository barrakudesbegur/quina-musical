// The show state machine: Queue position, transitions, Hold, Back, Pace and auto-advance. Pure logic with
// no Web Audio and no DOM. It takes commands (@quina/protocol), clock ticks and decode results, and returns
// *effects* that the runtime (main.ts) carries out on the audio graph, the drum and the network. Every
// time comes from `env`, so tests drive it with a fake clock and a seeded RNG.
//
// States (GLOSSARY.md):
//   locked      before the first click (browsers need a gesture to start audio)
//   idle        nothing has landed yet in this round, or after Panic
//   playing     a landed song plays; auto-advance may be counting down
//   transition  a Spin is running towards a Landing (Next is ignored)
//   hold        no new song lands; the song plays ducked, or Hold music plays
// Back undoes the last landing (or cancels the running Spin) and always ends in Hold.
//
// The show flow sits on top (docs/protocol.md › Scenes): the scene (before, roundStart, play, check,
// celebration, interval, after), the public tie-free Shuffle, Claims and their Checks, the Celebration, the
// Interval, the Winners and the technical pause. show/flow.ts says which command each scene accepts.
import { checkCommand, makeEvent, isVoiceCue, autoSoundsOf, drumOrder, formatCardRanges, AUTO_SOUNDS, COMMANDS, DEFAULT_POOL, DEFAULT_SIDE, RECIPE_IDS, STANDING_LIST_MAX, VOLUME_DEFAULTS, defaultCardType, firstPlaySec, foldPlayed, formatResumeToken, isPassingOutcome, roundPlan, roundSide, sidePool, volumeDb, winKindsOf } from '@quina/protocol';
import type {
  AutoSound,
  AutoSounds,
  SoundTestKind,
  CommandOf,
  ResumeToken,
  CelebrationInfo,
  CelebrationMusic,
  CheckInfo,
  CheckStep,
  ClaimInfo,
  FinaleFall,
  FinaleInfo,
  FinaleWinner,
  ClimbTarget,
  CommandFields,
  GameRecord,
  GamePlan,
  CardTypeSides,
  IntervalInfo,
  IntervalTrackInfo,
  IntroInfo,
  RecordedClaim,
  ShowScene,
  WinKind,
  WinnerInfo,
  GameSettings,
  JournalEntry,
  JournalEntryBody,
  JournalSettings,
  RecordedRound,
  HistoryEntry,
  HoldReason,
  PhaseName,
  PossibleWinners,
  FutureInfo,
  RejectReason,
  ReviewOutcome,
  RoundInfo,
  RoundKind,
  ShowEvent,
  ShowEventBody,
  ShowEventType,
  ShowStatus,
  SongRef,
  SoundName,
  StandingInfo,
  MusicSet,
  ThrowSong,
  VoiceCue,
  VoiceLead,
  PadHoldEffect,
  TwoLevelButton,
  ThrowInfo,
  ThrowTrackInfo,
  VolumeKey,
  Volumes,
} from '@quina/protocol';
import { HOLD, ENGINE, PHASES, PACE, SUSPENSE, FLOW, INTERVAL, INTRO, LOOP, PAUSA, SCHEDULE, THROW, VOICE, DRUMROLL, TWO_LEVEL, TEST_JUMP } from '../config.ts';
import { validCards, possibleWinners, parseCardRanges, cardCounts, firstWinAt, standingCards, standingCourse, standingRun, type PrintedCard } from '../game/cards.ts';
import { computeCheck, stepSound, type CheckResult, type CheckSong, type TimedStep } from '../game/check.ts';
import { tieFreeShuffle, type TieFreeShuffle, type TieRule } from '../game/shuffle.ts';
import { sceneAllows, type SceneContext } from '@quina/protocol';
import { phasePlan, standingPlan } from '../game/phase.ts';
import { phaseFor } from '../plan/phases.ts';
import { planTransition, summarize, LOOKAHEAD_SEC } from '../plan/planner.ts';
import { barSpan, openSuspense, releaseSuspense, suspenseBar, suspenseFromExit, suspenseTease, type SuspenseOpen } from '../plan/suspense.ts';
import { pickHook, usableHooks } from '../plan/hooks.ts';
import { tempoMatch } from '../plan/tempo.ts';
import { spinWindow, slotSec, alignedPress, autoPressAt, pressAfterHold, scheduleEstimate, driftNudge, roundLengthSec, roundSongs, slotSongs, PACE_LIMITS } from '../plan/pace.ts';
import { deckTimeline } from '../plan/timeline.ts';
import { firstRepeatAt, lastBarsLoop, lastPhraseLoop, loopSeconds, type PhraseLoop } from '../plan/loop.ts';
import { NO_BEAT, beatInfo, deckBeat, nextBeat, type BeatGrid, type BeatPublication, type BeatSource } from '../plan/beat.ts';
import { mixSeed, secureRandom, seededRandom } from '../rng.ts';

/** A Spin's public drum seed (D237), from its private plan seed through one more mix, so the plan seed stays unsaid. */
const drumSpinSeed = (seed: number): number => Math.floor(seededRandom(seed ^ 0x27d4eb2d)() * 2 ** 32) >>> 0;
/** A fresh public seed for a round's drum order, drawn apart from the Game's seeded stream (D237). */
const freshDrumSeed = (): number => Math.floor(secureRandom() * 2 ** 32) >>> 0;
import type { Analysis, Hook } from '../analysis.ts';
import type { Card } from '../game/cards.ts';
import type { PhaseStep } from '../game/phase.ts';
import type { BlendSource, Plan, PlanMemory, SignatureSource } from '../plan/planner.ts';
import type { PlanEvent, StemName } from '../plan/recipes.ts';

/** Which Hold music fits: 'error' after Back and a failed Check, 'hold' otherwise. */
export type HoldMood = 'hold' | 'error';
/** Scene music that is not Hold music: the Celebration's ('winningSong', 'victory'), a music set's ('interval', the
 * set in `bedSet`), a round's intro track, or the Pausa set a Next builds out of as Pausa ends. */
export type Bed = 'winningSong' | 'victory' | 'interval' | 'intro' | 'pausa';

/** The playing song repeating one of its phrases (plan/loop.ts): `nextAt` is the next repeat's start, `until` the
 * last moment a repeat may start (a Suspense's landing), or null to loop until it is stopped. */
export interface LoopState {
  songId: number;
  phrase: PhraseLoop;
  nextAt: number;
  until: number | null;
  /** Aguanta's last phrase near the song's end, or Suspense's phrase under its build. */
  purpose: 'stay' | 'suspense';
}

/** The song that is playing (it may be ducked in a Hold). Times are audio-clock seconds. */
export interface PlayingSong {
  songId: number;
  startCtx: number;
  offset: number;
  rate: number;
  landedDownbeatIndex: number | null;
  hookId: string;
  endCtx: number;
}

/**
 * A plan as the show schedules it: the planner's Plan, plus the seed it was planned with, the request that
 * asked for it and the Queue position it lands on.
 */
export type ShowPlan = Plan & { seed: number; reqId: string | null; targetPos: number };

/** The running Spin. `afterLanding`: Back or Hold came too close to the landing, so they act right after it. */
export interface Transition {
  id: string;
  reqId: string | null;
  songId: number;
  targetPos: number;
  plan: ShowPlan;
  spinStart: number;
  T: number;
  fromSongId: number | null;
  aExitStart: number | null;
  fromHoldMusic: boolean;
  afterLanding: null | 'back' | 'hold' | 'claim' | 'stay';
}

/** An open Suspense: its loop runs bar by bar until it is released (or releases itself). */
export interface SuspenseState {
  id: string;
  reqId: string | null;
  songId: number;
  targetPos: number;
  open: SuspenseOpen;
  seed: number;
  startedAt: number;
  autoReleaseAt: number;
  /** The first loop bar not yet scheduled. */
  nextBar: number;
  fromSongId: number | null;
  fromHoldMusic: boolean;
  /** Over A's loop: the pending songs the drum hovers over and teases in turn (the real next one among them). */
  hover: number[];
  /** Teases played so far (the next one is of `hover[teases % hover.length]`). */
  teases: number;
  /** It started from Aguanta (B held, then A: D144): a cancel goes back to Aguanta, else back to playing. */
  fromStay: boolean;
}

export interface Landing {
  songId: number;
  position: number;
  T: number;
  atMs: number;
  undone: boolean;
}

/** Next was pressed but the song is still decoding. */
export interface PendingNext {
  reqId: string | null;
  songId: number;
  targetPos: number;
}

export interface HoldState {
  since: number;
  reason: HoldReason;
  /** Parlem: the song ducked under the presenters' voices (Hold music may take over). False is Aguanta (Stay):
   * the song at full volume, nothing landing or advancing. */
  ducked: boolean;
}

// ---- effects: what the runtime must do. Audio-clock times in seconds. -------------------------------------
/** Over a Suspense's loop, the drum swings to `cardId` (a pending song being teased) by `at` and hovers there until `until`. */
export interface SuspenseHoverEffect {
  type: 'suspenseHover';
  cardId: number;
  at: number;
  until: number;
}

/** Re-cue the playing song so `offset` plays at `at` (a repeat of the phrase loop, plan/loop.ts). */
export interface CueEffect {
  type: 'cue';
  songId: number;
  at: number;
  offset: number;
}

/** Send an event to the remotes. */
export interface EmitEffect {
  type: 'emit';
  message: ShowEvent;
}
/** Tell the page a command was refused (the matching `command.rejected` event is emitted too). */
export interface RejectEffect {
  type: 'reject';
  reqId: string | null;
  cmd: string | null;
  reason: RejectReason;
  detail?: string;
}
/** Decode these songs (the current one and the next two). */
export interface PrefetchEffect {
  type: 'prefetch';
  ids: number[];
}
export interface StartTransitionEffect {
  type: 'startTransition';
  plan: ShowPlan;
  fromHoldMusic: boolean;
  /** `brake`: the drum is already coasting (a released Suspense) and brakes onto the card at T. */
  drum: { removeId: number | null; targetId: number; minLaps: number; brake?: boolean; seed: number };
}
/** A Suspense opens: A's duck and exit, the drum starts coasting (after removing the last song's card). */
export interface StartSuspenseEffect {
  type: 'startSuspense';
  open: SuspenseOpen;
  fromHoldMusic: boolean;
  drum: { removeId: number | null; targetId: number };
  /**
   * The running Spin becomes this Suspense (D177): its build and B's part stop at `cutAt` (audio clock). `keepA`: A is
   * still itself, so it comes back up at once and its phrase loops; else A's exit plays out and the build starts there.
   */
  fromSpin?: { keepA: boolean; cutAt: number };
}
/** The next bar of an open Suspense's loop (graph and synth events only). */
export interface SuspenseBarEffect {
  type: 'suspenseBar';
  bar: number;
  events: PlanEvent[];
}
export interface LandedEffect {
  type: 'landed';
  planId: string;
  plan: ShowPlan;
}
export interface CancelTransitionEffect {
  type: 'cancelTransition';
  planId: string;
  keepOutgoing: boolean;
  /** `ids`: the drum's cards once `insertId` (the last landing, off the drum since the Spin started) is back, in the
   * round's drum order (D237): the drum takes this order and brakes onto `insertId` at its place. */
  drum: { insertId: number | null; selectId: number | null; ids: number[] };
  /** A cancelled Suspense (D144): its build backs out and fades instead of stopping at once. */
  backOut?: boolean;
}
export interface DuckEffect {
  type: 'duck';
  db: number;
  seconds: number;
}
export interface HoldMusicEffect {
  type: 'holdMusic';
  at: number;
  levelDb: number;
  fadeSec: number;
  mood: HoldMood;
  /** Another bed (Hold music of another mood, the Celebration's or the Interval's music) cross-fades to it. */
  switch: boolean;
}
export interface SongToHoldMusicEffect {
  type: 'songToHoldMusic';
  fadeSec: number;
  mood: HoldMood;
}
export interface RewindEffect {
  type: 'rewind';
  songId: number;
}
/** Back (a landing undone): `insertId`, the landing before it, comes back and the drum turns back onto it. `ids`: the
 * drum's cards with it back, in the round's drum order (D237), so it returns to its own place, not beside the pointer. */
export interface DrumBackEffect {
  type: 'drumBack';
  insertId: number | null;
  selectId: number | null;
  ids: number[];
}
export interface DrumResetEffect {
  type: 'drumReset';
  ids: number[];
  /** A card to show under the pointer (a restored Game's last landing), else any. */
  selectId?: number;
}
/** Keep this Game journal entry (append it to the local journal, in `seq` order). */
export interface JournalEffect {
  type: 'journal';
  entry: JournalEntry;
}
export interface StopAllEffect {
  type: 'stopAll';
  fadeSec: number;
}
export interface SfxEffect {
  type: 'sfx';
  name: SoundName;
  at?: number;
  /** Its slider (D139): the presenters' pad, the win's or the fail's fanfares, the final-lap stinger. */
  volume: 'padFx' | 'winFx' | 'failFx' | 'finalLap';
}
/** Render B's bars before `hookId` stretched to A's tempo, for a Blend (runtime BlendStore). */
export interface PrepareBlendEffect {
  type: 'prepareBlend';
  aSongId: number;
  aBpm: number;
  aHookId: string;
  bSongId: number;
  hookId: string;
  beatsPerBar: number;
  tight: boolean;
}
/** One revealed song of a Check at `step.at`: a landed song from its hook's pickup (its snippet, then the full song),
 * playing on until the next reveal, a step back or the Check's end; the "broken record" or the knock. A sound still
 * playing from the reveal before stops. `nextSongId`: the next reveal's landed song, decoded meanwhile (else null). */
export interface CheckRevealEffect {
  type: 'checkReveal';
  claimId: string;
  step: TimedStep;
  nextSongId: number | null;
}
/** The music under a Check (the song or Hold music) goes far down (`FLOW.check.duckDb`) or comes back up. */
export interface CheckDuckEffect {
  type: 'checkDuck';
  on: boolean;
}
/** Answer `getJournal` with a `journal.entries` event from the local journal (the runtime keeps the entries). */
export interface JournalRequestEffect {
  type: 'journalRequest';
  reqId: string;
  fromSeq: number;
}
/** Stop a Check's sounds now and bring the music back up. */
export interface CancelCheckEffect {
  type: 'cancelCheck';
  claimId: string;
}
/**
 * The Celebration's music from `at`: whatever plays (a ducked song, Hold music) gives way. 'winningSong' loops
 * the Winning song's hook (`hookId`, the one it landed on, else its best) in whole bars; 'victory' is the
 * 'celebration' mood; 'holdMusic' is ordinary Hold music.
 */
export interface CelebrationMusicEffect {
  type: 'celebrationMusic';
  choice: CelebrationMusic;
  songId: number | null;
  hookId: string | null;
  at: number;
  fadeSec: number;
  levelDb: number;
}
/**
 * A music set (audio/interval.ts) at `levelDb`: the music playing (the victory track, Hold music, the Winning song's
 * loop, the intro) hands over to its first track on its own downbeat; from silence the track fades in.
 */
export interface IntervalMusicEffect {
  type: 'intervalMusic';
  set: MusicSet;
  at: number;
  fadeSec: number;
  levelDb: number;
}
/** A set moves on to its next track on the playing track's next downbeat. */
export interface IntervalSkipEffect {
  type: 'intervalSkip';
  set: MusicSet;
}
/** A round's intro track (D129), looping from `at` at `levelDb`; whatever plays gives way to it. */
export interface IntroMusicEffect {
  type: 'introMusic';
  at: number;
  fadeSec: number;
  levelDb: number;
}
/** Parlem in a Celebration (D117): the Hold music bus (its victory track or loop) ducks to `db`, or comes back (0). */
export interface BedDuckEffect {
  type: 'bedDuck';
  db: number;
  seconds: number;
}
/** The throw song (D138): play from `offsetSec` at `at` (the break music fades out under it), stop there (it fades
 * back), or end for good. */
export interface ThrowSongEffect {
  type: 'throwSong';
  action: 'play' | 'stop' | 'end';
  at: number;
  offsetSec: number;
  fadeSec?: number;
  /** With `play`: the track (THROW.songs) and its loudness trim. */
  track?: { name: string; trimDb: number };
}
/** A voice cue (D202–D204): its lead (a chime, a round's fanfare) and voice at `at`, the music dipping under them; or
 * stop the one playing. The runtime reports its end (Show.voiceEnded). */
export interface VoiceEffect {
  type: 'voice';
  action: 'play' | 'stop';
  cue: VoiceCue | null;
  lead: VoiceLead | null;
  at: number;
}
/** The drum roll held on the D-pad (D203): start it on `grid` (a beat at `t0`, `beatSec` apart), change its intensity,
 * or let it go: `land` with a hit at `at` (a beat), else it fades out from `at`. */
export interface PadHoldEffectMsg {
  type: 'padHold';
  action: 'start' | 'intensity' | 'release';
  effect: PadHoldEffect;
  at: number;
  intensity: number;
  grid?: { t0: number; beatSec: number };
  land?: boolean;
}
/** Pausa starts (D128): everything playing fades out and is saved where it is (the song deck, Hold music, the
 * Celebration's music, a set, the intro, the throw song, a Check's revealed song). Effects ring out (U113). */
export interface PausePlaybackEffect {
  type: 'pausePlayback';
  at: number;
  fadeSec: number;
}
/** Pausa ends: what it saved resumes from `at`, fading in (D135), the song from `song.offset`; `discard` drops it
 * instead (Next out of Pausa, Panic, the end of the Game). */
export interface ResumePlaybackEffect {
  type: 'resumePlayback';
  at: number;
  fadeSec: number;
  song: { songId: number; offset: number; rate: number } | null;
  discard: boolean;
}
/** The Pausa set on its own player, in or out. */
export interface PausaMusicEffect {
  type: 'pausaMusic';
  on: boolean;
  at: number;
  fadeSec: number;
  levelDb: number;
}
/** Every volume slider (D139, percent; vocabulary.ts volumeDb), gliding to its new level. */
/** The sound test (D229): `kind` on a loop at its slider's level, or null to stop. `songIds`: songs whose snippets
 * stand in for the songs and the Check; `parlemDb`: the Parlem duck, for songsParlem. */
export interface SoundTestEffect {
  type: 'soundTest';
  kind: SoundTestKind | null;
  songIds: number[];
  parlemDb: number;
}
export interface VolumesEffect {
  type: 'volumes';
  volumes: Volumes;
  /** The sounds switched off (D237) are silent whatever their slider says. */
  autoSounds: AutoSounds;
}
/** Pausa's "Tornem de seguida" on the show page (only during a round, a Check or a Celebration, D135). */
export interface PauseOverlayEffect {
  type: 'pauseOverlay';
  on: boolean;
}
/** Something worth a line in the console (the machine itself never logs). */
export interface LogEffect {
  type: 'log';
  level: 'info' | 'warn';
  message: string;
}
/** `testReset` (a rehearsal test tool): reload the page with `fresh=1`, its other URL params kept: a new Game. */
export interface ReloadFreshEffect {
  type: 'reloadFresh';
}
/** What the runtime must do, as a discriminated union on `type`: `switch (effect.type)` narrows it. */
export type Effect =
  | SoundTestEffect
  | EmitEffect
  | RejectEffect
  | PrefetchEffect
  | StartTransitionEffect
  | LandedEffect
  | CancelTransitionEffect
  | DuckEffect
  | CueEffect
  | HoldMusicEffect
  | SongToHoldMusicEffect
  | RewindEffect
  | DrumBackEffect
  | DrumResetEffect
  | StopAllEffect
  | SfxEffect
  | PrepareBlendEffect
  | JournalEffect
  | JournalRequestEffect
  | StartSuspenseEffect
  | SuspenseBarEffect
  | SuspenseHoverEffect
  | CheckRevealEffect
  | CheckDuckEffect
  | CancelCheckEffect
  | CelebrationMusicEffect
  | IntervalMusicEffect
  | IntervalSkipEffect
  | IntroMusicEffect
  | ThrowSongEffect
  | VoiceEffect
  | PadHoldEffectMsg
  | BedDuckEffect
  | PausePlaybackEffect
  | ResumePlaybackEffect
  | PausaMusicEffect
  | VolumesEffect
  | PauseOverlayEffect
  | LogEffect
  | ReloadFreshEffect;
export type EffectType = Effect['type'];
/** One effect by type, for example `EffectOf<'startTransition'>`. */
export type EffectOf<T extends EffectType> = Extract<Effect, { type: T }>;

/** The Check on screen (D107): the presenters pace its reveals, and auto reveals in a row. Audio-clock times. */
export interface CheckRun {
  info: CheckInfo;
  /** The songs it may reveal, in order. */
  songs: CheckSong[];
  /** The index of the last song it reveals (the last, or the first ✗), or null: none, the first press is the cue. */
  until: number | null;
  /** A step back turned auto off for this Check (D134); asking for auto again turns it back on. */
  autoOff: boolean;
  /** Auto waits for a press: nothing revealed yet, or a Review continued. */
  awaitPress: boolean;
  /** Auto's next reveal or cue, or null. */
  autoAt: number | null;
  /** When the last reveal's sound ends, or null. */
  soundEndAt: number | null;
  /** After its cue, when the next queued card's Check comes on screen by itself, or null. */
  nextAt: number | null;
  /** After the last card's fail cue with nothing valid: when the round goes back to the fail moment's Hold. */
  failAt: number | null;
}

/** Everything the machine needs from the outside world. Times: `now` audio-clock seconds, `nowMs` epoch ms. */
export interface Env {
  now: () => number;
  nowMs: () => number;
  toEpochMs: (ctxSec: number) => number;
  /** The song's analysis once it is decoded, else null. */
  analysis: (songId: number) => Analysis | null;
  isDecoded: (songId: number) => boolean;
  /** Secure in the runtime, seeded in tests: the Shuffle's seed, the Phase's seed, the planner's seeds. */
  random: () => number;
  /** Per hook id, the stems decoded around that hook (runtime StemStore). */
  stems?: (songId: number) => Record<string, { parts: StemName[] }> | null;
  /** The planner (tests may swap it). */
  plan?: typeof planTransition;
  /** B's render stretched to A's tempo for one hook, if it is ready (runtime BlendStore). */
  blend?: (aSongId: number, hookId: string) => BlendSource | null;
  /** The song's approved Signatures that are decoded (runtime SignatureStore). */
  signatures?: (songId: number) => readonly SignatureSource[];
}

export interface SongInfo {
  id: number;
  title: string;
  artist: string;
  /**
   * Its pools (D178, D268): a round on a side of any of them may draw it, so one song can be in several. Absent or
   * empty: DEFAULT_POOL only.
   */
  pools?: readonly string[];
}

/** Audio-clock times of the pending automatic Next and of the switch to Hold music. */
export interface Timers {
  autoAt: number | null;
  holdMusicAt: number | null;
}

/**
 * The round's Phase plan from the cards in play (game/phase.ts). `kind` is what the round is climbing
 * towards: the Line, then (once a Line is confirmed) the Bingo.
 */
export interface PhaseModel {
  kind: ClimbTarget;
  start: number;
  seed: number;
  valid: Card[];
  plan: PhaseStep[] | null;
}

export interface ShowOptions {
  env: Env;
  songs: SongInfo[];
  cards?: readonly PrintedCard[];
  /** card-types.json: each type's sides and the pool each plays (D178). Without it, every type has one side on pool 1. */
  cardTypes?: readonly CardTypeSides[];
  cardsInPlay?: string;
  /** A fixed Queue (tests, `?queue=`): it bypasses the tie-free Shuffle (seed 0, attempts 0). */
  fixedQueue?: number[] | null;
  settings?: Partial<GameSettings>;
  /** The Game's id for its journal; a new one is drawn when missing. Ignored with `restore`. */
  gameId?: string;
  /**
   * Resume a Game from its journal (`replayJournal`): the round, its Queue and position, the landings,
   * the confirmed Line, cards in play and settings, the scene, the round's Claims and the Game's Winners.
   * Live playback starts fresh (a Check in progress is queued again): nothing plays until unlocked, and a
   * song only with Next.
   */
  restore?: GameRecord | null;
}

/** An event as the machine builds it, before `makeEvent` stamps the version. */
type EventBody<T extends ShowEventType> = Extract<ShowEventBody, { type: T }>;
type SetGameField = keyof CommandFields['setGame'];

/** The settings `setGame` may change: exactly the fields of the protocol's command. */
const SET_GAME_FIELDS = Object.keys(COMMANDS.setGame) as SetGameField[]; // Object.keys only knows string[]

const round2 = (x: number) => Math.round(x * 100) / 100;
/** A throw song's track, as its buttons show it (ThrowTrackInfo). */
const throwTrackInfo = (song: ThrowSong): ThrowTrackInfo => {
  const t = THROW.songs[song];
  return { title: t.title, artist: t.artist, startSec: t.hookSec, dropSec: t.dropSec, durationSec: t.durationSec };
};
/** The Celebration a set of valid Claims makes: the round's end (a Bingo, the last card standing) over a Line. */
const roundWin = (kinds: readonly WinKind[]): WinKind => (kinds.includes('standing') ? 'standing' : kinds.includes('bingo') ? 'bingo' : 'line');
/** The Shuffle's Tie rule for a round: one last card standing in the Desgraciat round, else no shared first win. */
const tieRule = (kind: RoundKind): TieRule => (kind === 'desgraciat' ? 'none' : 'firstWins');
/** What a round's Phase climbs towards from its first song: the Line, or the Desgraciat round's last card standing. */
const firstClimb = (kind: RoundKind): ClimbTarget => (kind === 'desgraciat' ? 'standing' : 'line');
const PHASE_RANK: Record<PhaseName, number> = { early: 0, mid: 1, late: 2, final: 3 };
/** A Claim with a verdict, or set aside: nothing more happens to it. */
const settled = (c: ClaimInfo) => c.status === 'valid' || c.status === 'invalid' || c.status === 'discarded';
const copyClaim = (c: ClaimInfo): ClaimInfo => ({ ...c, warnings: [...c.warnings], markedCard: c.markedCard.map((s) => ({ ...s })) });

/** Who a command without the relay's `from` came from: the show page itself (never in the relay's client list). */
const OWN_PAGE = 'local';

/** Where a test jump lands (`testJump`, rehearsal test runs only): round `number`'s intro, or that round in play. */
export interface TestJumpTarget {
  /** When it lands (audio clock): once the runtime has let go of what played (TEST_JUMP.settleSec). */
  at: number;
  number: number;
  kind: RoundKind;
  cardType: string;
  side: number;
  pool: string;
  /** In play: its fresh Shuffle and the Queue index of the last counted song (−1: none yet). Null: the intro. */
  play: { drawn: TieFreeShuffle; position: number } | null;
}
/** What still goes through while a test jump settles: what only reads, a console letting go of a button, and the test
 * tools themselves (another jump replaces it). */
const DURING_JUMP: ReadonlySet<string> = new Set(['getState', 'getJournal', 'getUpcoming', 'twoLevelHold', 'testReset', 'testJump']);

/** Copy one field when the source sets it. The call compiles only if the source's field fits the target's. */
/** A Game id from the clock (no random draw, so seeded shows stay as they were), e.g. `g-2026-11-24-mhv2k1x0`. */
function newGameId(env: Env): string {
  const nowMs = env.nowMs();
  return `g-${new Date(nowMs).toISOString().slice(0, 10)}-${Math.round(nowMs).toString(36)}`;
}

function assignDefined<T, K extends keyof T>(target: T, source: Partial<Pick<T, K>>, key: K) {
  const value = source[key];
  if (value !== undefined) target[key] = value;
}

export class Show {
  readonly env: Env;
  /** Every printed card (cards.json); only the ones in play, of the round's type, count, on the round's side. */
  readonly allCards: readonly PrintedCard[];
  /** card-types.json's sides (D178). */
  readonly cardTypes: readonly CardTypeSides[];
  /** The edition's Game plan (setPlan), or null: only the Schedule and the Interval's countdown read it. */
  plan: GamePlan | null = null;
  cardsInPlayText = '';
  cardsInPlay: number[] = [];
  /** The last `addCardsInPlay` taken (D234): the state's `cards.lastAdd`. Not journaled. */
  cardsLastAdd: { reqId: string; added: string; alreadyIn: string } | null = null;
  phaseModel: PhaseModel = { kind: 'line', start: 0, seed: 0, valid: [], plan: null };
  /** The round's songs from its Queue and cards in play (its first Bingo or last card standing), or null. */
  expectedSongs: number | null = null;
  /**
   * Seconds the round's target end moved after it was journaled, because its expected songs changed (cards in play
   * set mid-round). Not journaled: the Drift adds it, so a different count never reads as time lost.
   */
  targetShiftSec = 0;
  readonly catalog: Map<number, SongInfo>;
  fixedQueue: number[] | null;
  status: ShowStatus = 'locked';
  unlocked = false;
  game: GameSettings;
  round: RoundInfo & { cardType: string; side: number; pool: string } = {
    number: 1, kind: 'normal', cardType: defaultCardType('normal'), side: DEFAULT_SIDE, pool: DEFAULT_POOL, startedAtMs: 0, targetEndMs: 0, lineConfirmed: false,
  };
  queue: number[] = [];
  position = -1;
  current: PlayingSong | null = null;
  transition: Transition | null = null;
  pending: PendingNext | null = null;
  hold: HoldState | null = null;
  holdMusic = false;
  /** The playing song repeating a phrase, or null. */
  loop: LoopState | null = null;
  /** The pulse last published (`state.beat`, plan/beat.ts): it changes only when the grid heard changes materially.
   * Not journaled: a resumed Game works it out again. */
  beat: BeatPublication = NO_BEAT;
  /** The rounds whose prizes were revealed, and how (the journal's `prizes.revealed`). */
  prizesRevealed: { round: number; by: 'presenters' | 'intro' }[] = [];
  timers: Timers = { autoAt: null, holdMusicAt: null };
  /** This round's landings as the planner remembers them (its rotation memory); the state shows their HistoryEntry part. */
  history: (HistoryEntry & PlanMemory)[] = [];
  landings: Landing[] = [];
  nudge = 1;
  seq = 0;
  transitionCount = 0;
  /** Climbs ('line', 'bingo') whose "final lap" stinger already played this round. */
  readonly stingerClimbs = new Set<ClimbTarget>();
  /** The Celebration music picked during a Check, for the Celebration that may follow (null: the default). */
  celebrationChoice: CelebrationMusic | null = null;
  /** A Suspense held open (status 'transition', no `transition` until it is released). */
  suspense: SuspenseState | null = null;
  /** The next song's hook, chosen early so its Blend render can be prepared. */
  nextHook: { songId: number; hook: Hook } | null = null;
  /** The songs counted in this Game's earlier rounds (GameRecord.playedBefore, D174); `played` looks them up. */
  playedBefore: number[] = [];
  played = new Set<number>();
  blendRequested = '';
  /** The Game this show belongs to, and the last journal entry's number. */
  gameId: string;
  journalSeq = 0;
  /** How this round's Queue was drawn (journaled for debugging). */
  shuffleSeed = 0;
  shuffleAttempts = 0;
  // ---- the show flow ----
  /** A fresh Game is `before`, which accepts every command `play` does; the first Spin moves it to `play`. */
  scene: ShowScene = 'before';
  /** The journal time of the last scene change (0: none yet). */
  sceneSinceMs = 0;
  /** Pausa, and when it started (audio clock). */
  pause: { sinceMs: number; since: number } | null = null;
  /** The Pausa set's track playing, while Pausa is on. */
  pausaNow: IntervalTrackInfo | null = null;
  /** A throw song (D138, D151): which, where it plays from, since `startedAt` (audio clock) while playing. */
  throwSong: { song: ThrowSong; playing: boolean; offsetSec: number; startedAt: number; sinceMs: number } | null = null;
  /** The voice cue playing (D202–D204): since when, when it ends by itself at the latest, what it leads into. */
  voice: { cue: VoiceCue; since: number; sinceMs: number; endsBy: number; durationMs: number | null } | null = null;
  /** The timed cues already played or dropped this Game (a Descans's by round: `descans-2min@<round>`). */
  voicesDone = new Set<string>();
  /** A timed cue that came due while it wasn't quiet: since when it waits. */
  voiceWaiting: { key: string; cue: VoiceCue; since: number } | null = null;
  /** The effect held on the D-pad (D203), while held. */
  padHeld: { effect: PadHoldEffect; since: number; sinceMs: number; intensity: number; grid: { t0: number; beatSec: number } } | null = null;
  /** The public Shuffle's animation (audio-clock seconds), while it runs. */
  shuffle: { round: number; startAt: number; endAt: number } | null = null;
  intro: (IntroInfo & { cardType: string; side: number }) | null = null;
  /** This round's Claims, oldest first. */
  claims: ClaimInfo[] = [];
  /** Claims made in the whole Game (claim ids count on from it). */
  claimCount = 0;
  /** The Check on screen, paced by the presenters. */
  check: CheckRun | null = null;
  /** A Claim under review whose Check left the screen for another card's: its marks, so it comes back where it was (D121). */
  reviewMarks = new Map<string, { revealed: CheckStep[]; autoOff: boolean }>();
  /** `checkAuto`: reveal in a row (the Wii's A held, or the tablet's toggle). */
  checkAutoOn = false;
  /** The Desgraciat's finale (D161, D166–D172): its finalists in order; `byHand`, a removal left one standing. */
  finale: { cardIds: number[]; byHand: boolean } | null = null;
  /** The presenters gave the finale's cue (the Celebration is on). */
  finaleCued = false;
  /** Every card of the claim had its cue, an earlier one passed: the press that starts the shared Celebration. */
  celebrationNext: { claimId: string; step: number } | null = null;
  /** The Claims of the Check in progress, and the Celebration it interrupted (it comes back if none is valid). */
  batch: { claimIds: string[]; celebration: CelebrationInfo | null } | null = null;
  /** Start the next queued Claim's Check as soon as nothing is in the way. */
  autoCheck = false;
  celebration: CelebrationInfo | null = null;
  /** The hook the Winning song landed on, for its Celebration loop. */
  winningHook: string | null = null;
  interval: IntervalInfo | null = null;
  /** The Interval playlist's track playing (the runtime reports it on each handover), while its music plays. */
  intervalNow: IntervalTrackInfo | null = null;
  winners: WinnerInfo[] = [];
  /** Scene music playing instead of a song or Hold music. */
  bed: Bed | null = null;
  /** With `bed` 'interval': which set plays. */
  bedSet: MusicSet = 'breaks';
  /** The round's drum order (D237, drumOrder): public, drawn on its own at each round start or resume. */
  drumSeed = 0;
  /** The sound test playing (D229), else null. */
  soundTest: { kind: SoundTestKind; sinceMs: number } | null = null;
  /** A two-level button held on a console (D234), the state's `twoLevelHeld`; `until`: when it clears by itself (audio
   * clock). Not journaled. */
  twoLevelHeld: { button: TwoLevelButton; clientId: string; sinceMs: number; until: number } | null = null;
  /** The runtime's report of a stalled audio clock (D284, `audioStalled`), else null. Not journaled. */
  audioStall: { sinceMs: number } | null = null;
  /** A test jump settling (`testJump`): Panic stopped what played, and it lands at its `at`. Never set on the night. */
  jump: TestJumpTarget | null = null;
  /** The phones' next Heat sample (`heat.sample`, audio clock), drawn at the last landing. */
  heatSample: { at: number; value: number } | null = null;
  holdMusicMood: HoldMood = 'hold';
  /** The volume sliders (D139). `volumesSet`: this Game set them (a slider, or the plan's while it had none). */
  volumes: Volumes = { ...VOLUME_DEFAULTS };
  volumesSet = false;
  /** The volumes as last journaled (null: none yet): the record shows them, so it always equals the journal's replay. */
  journaledVolumes: Volumes | null = null;
  /** A slider moved: journal the volumes once they have been still for `FLOW.volumesJournalSec`. */
  volumesMovedAt: number | null = null;
  out: Effect[] = [];

  constructor({ env, songs, cards = [], cardTypes = [], cardsInPlay = '', fixedQueue = null, settings = {}, gameId, restore = null }: ShowOptions) {
    this.env = env;
    this.allCards = cards;
    this.cardTypes = cardTypes;
    this.gameId = restore?.gameId || gameId || newGameId(env);
    this.catalog = new Map(songs.map((s) => [s.id, s]));
    this.fixedQueue = fixedQueue;
    this.game = {
      pace: PACE.defaultSec,
      paceLocked: false,
      autoAdvance: true,
      autoAdvanceFinal: false,
      remoteShake: true,
      announceWins: true,
      songsUntilWinner: 20,
      phaseOverride: null,
      roundsTotal: 5,
      holdMusicAfterSec: HOLD.holdMusicAfterSec,
      nextRecipe: null,
      holdMusicOn: true,
      ...settings,
      autoSounds: autoSoundsOf(settings),
    };
    this.takeVolumes(this.game);
    if (AUTO_SOUNDS.some((k) => !this.game.autoSounds[k])) this.pushVolumes();
    // Its effects wait for the runtime's first flush().
    if (restore?.round) {
      this.restore(restore, restore.round);
      return;
    }
    if (restore) {
      this.journalSeq = restore.seq; // a journal without a round yet: keep numbering it
      this.setPlayed(restore.playedBefore ?? []);
    }
    if (restore?.settings) {
      this.takeSettings(restore.settings);
    }
    const ranges = restore?.cardsInPlay || cardsInPlay;
    try {
      this.setCards(ranges);
      if (ranges && ranges !== restore?.cardsInPlay) this.journal({ kind: 'cards.set', ranges });
    } catch {}
    // Round 1's Queue is drawn now, without the public Shuffle: the Game is `before` until the first Spin
    // (or until the presenters introduce the round and run its Shuffle).
    this.startRound(1, 'normal', defaultCardType('normal'), DEFAULT_SIDE, { keepPace: settings.pace != null || restore?.settings != null });
  }

  // ------------------------------------------------------------------------------------- public API
  command(message: unknown): Effect[] {
    const check = checkCommand(message);
    if (!check.ok) {
      this.reject(check.reqId, check.cmd, 'invalid', check.error);
      return this.flush();
    }
    const c = check.command;
    const reqId = c.reqId;
    const cmd: string = c.cmd;
    // A locked page (no "Start show" click yet) still answers, and may be resumed by hand before the click (or, in a
    // test run, reset to a new Game).
    if (this.status === 'locked' && c.cmd !== 'unlock' && c.cmd !== 'getState' && c.cmd !== 'getJournal' && c.cmd !== 'resumeAt' && c.cmd !== 'testReset') {
      this.reject(reqId, c.cmd, 'locked');
      return this.flush();
    }
    // A test jump settling (rehearsal test runs only): the show waits for it to land.
    if (this.jump && !DURING_JUMP.has(c.cmd)) {
      this.reject(reqId, c.cmd, 'busy', 'a test jump is landing');
      return this.flush();
    }
    if (!sceneAllows(c.cmd, this.sceneContext())) {
      this.reject(reqId, c.cmd, 'wrongScene', this.pause ? `paused (scene ${this.scene})` : `scene ${this.scene}`);
      return this.flush();
    }
    // D234's lock, enforced: while a console holds a two-level button, only that sender's Aguanta, Parlem, Suspens
    // and Pausa act. Each console locks itself from its last snapshot, so two presses within the network latency
    // could both act; the first `twoLevelHold on` wins here. Consoles sharing a clientId are one sender.
    const held = this.twoLevelHeld;
    if (held && (c.cmd === 'hold' || c.cmd === 'pause' || c.cmd === 'suspense') && (c.from ?? OWN_PAGE) !== held.clientId) {
      this.reject(reqId, c.cmd, 'busy', `held by ${held.clientId}`);
      return this.flush();
    }
    switch (c.cmd) {
      case 'unlock':
        this.unlocked = true;
        if (this.status === 'locked') {
          this.status = 'idle';
          this.resumeSceneMusic(); // a resumed Game in its Celebration or Interval gets its music back
        }
        break;
      case 'next':
        // Nothing lands while B is held (D133): Aguanta, or a Suspense (let go of B, or `suspense {on: false}`).
        if (this.suspense) this.reject(reqId, c.cmd, 'nextBlocked', 'Suspens is on: it lands when B is let go');
        else if (this.status === 'hold' && this.hold?.ducked === false) this.reject(reqId, c.cmd, 'nextBlocked', 'Aguanta is on');
        else if (this.finaleInfo()?.winner && !this.finaleCued) this.reject(reqId, c.cmd, 'finaleDecided', 'the finale has its winner: the cue comes first');
        else {
          if (this.pause) this.endPause({ forNext: true });
          this.next(reqId);
        }
        break;
      case 'back':
        this.back(reqId);
        break;
      case 'hold': {
        if (this.scene === 'celebration') {
          this.celebrationHold(reqId, c.on);
          break;
        }
        // A review's Parlem (D118): the duck in place; the round never leaves the Check's Hold.
        if (this.scene === 'check') {
          this.holdMode(c.on ?? !(this.hold?.ducked ?? true));
          break;
        }
        const on = c.on;
        const holding = this.status === 'hold';
        // While holding, `duck` switches between Parlem and Aguanta in place.
        if (holding && on !== false && c.duck !== undefined) this.holdMode(c.duck);
        else if (on === true || (on === undefined && !holding)) this.holdOn(reqId, c.duck ?? true);
        else this.release(reqId);
        break;
      }
      case 'holdMusic':
        this.holdMusicNow();
        break;
      case 'suspense':
        if (c.on ?? !this.suspense) this.startSuspense(reqId);
        else if (!this.suspense) this.reject(reqId, c.cmd, 'noSuspense');
        // Cancelled (D144, D145): nothing lands, the build backs out, back to where the Suspense started.
        else if (c.cancel) this.cancelSuspense(this.suspense, 'cancel');
        else this.releaseSuspense(reqId);
        break;
      case 'setPace':
        this.setPace(c);
        break;
      case 'setGame':
        this.setGame(c);
        break;
      case 'setAutoSound':
        this.setAutoSound(c.key, c.on);
        break;
      case 'soundTest':
        if (c.kind && (this.current || this.transition || this.holdMusic || this.bed)) {
          this.reject(c.reqId, 'soundTest', 'busy');
          return this.flush();
        }
        this.setSoundTest(c.kind ?? null);
        break;
      case 'setVolume':
        this.setVolume(c.key, c.percent);
        break;
      case 'confirmLine':
        if (this.round.kind === 'desgraciat') this.reject(reqId, c.cmd, 'invalid', 'the Desgraciat round has no Line');
        else this.confirmLine();
        break;
      case 'setCardsInPlay': {
        try {
          this.setCards(c.ranges);
          this.journal({ kind: 'cards.set', ranges: c.ranges });
          this.rebuildPhase();
          this.rescheduleAuto();
        } catch (error) {
          this.reject(reqId, c.cmd, 'invalid', error instanceof Error ? error.message : String(error));
        }
        break;
      }
      case 'addCardsInPlay':
        this.addCards(reqId, c.ranges);
        break;
      case 'newRound': {
        // Default: the introduced round; in `before`, round 1 again (the Game has not started); else the next.
        const number = c.number ?? this.intro?.round ?? (this.scene === 'before' ? this.round.number : this.round.number + 1);
        const kind = c.kind ?? this.intro?.kind ?? 'normal';
        // The introduced round's card type and side, when this is that round.
        const introduced = this.intro && this.intro.round === number && this.intro.kind === kind ? this.intro : null;
        const cardType = c.cardType ?? introduced?.cardType ?? defaultCardType(kind);
        const side = c.side ?? introduced?.side ?? this.plannedSide(number, kind, cardType);
        if (this.roundPool(cardType, side) == null) this.reject(reqId, c.cmd, 'invalid', `card type ${cardType} has no side ${side}`);
        else this.newRound(number, kind, cardType, side);
        break;
      }
      case 'roundIntro': {
        const kind = c.kind ?? 'normal';
        const number = c.number ?? (this.scene === 'before' ? this.round.number : this.round.number + 1);
        const cardType = c.cardType ?? defaultCardType(kind);
        const side = c.side ?? this.plannedSide(number, kind, cardType);
        if (this.roundPool(cardType, side) == null) this.reject(reqId, c.cmd, 'invalid', `card type ${cardType} has no side ${side}`);
        else this.roundIntro(number, kind, cardType, side);
        break;
      }
      case 'claim': {
        const kind = c.kind ?? this.phaseModel.kind;
        // Several numbers from the claim pad: one Claim each, checked in turn (D110). checkCommand lets exactly one of the two through.
        const cardIds = c.cardIds ?? (c.cardId != null ? [c.cardId] : []);
        const unknown = this.unknownCards(cardIds);
        if (!winKindsOf(this.round.kind).includes(kind)) this.reject(reqId, c.cmd, 'invalid', `a ${this.round.kind} round isn't won by a ${kind}`);
        // A number that isn't printed refuses the whole claim, privately (D126): the presenter retypes it.
        // `detail`: the unknown numbers, comma-separated, so the claim pad marks the wrong chip and keeps the others.
        else if (unknown.length) this.reject(reqId, c.cmd, 'unknownCard', unknown.join(','));
        else for (const cardId of cardIds) this.claim(cardId, kind);
        break;
      }
      case 'checkNext':
        this.checkNext(c.claimId, c.step);
        break;
      case 'checkBack':
        this.checkBack(c.claimId, c.step);
        break;
      case 'checkAuto':
        this.setCheckAuto(c.on);
        break;
      case 'checkReview': {
        const claim = this.undecidedClaim(reqId, c.cmd, c.claimId);
        if (claim) this.checkReview(reqId, claim);
        break;
      }
      case 'reviewEnd': {
        const claim = this.undecidedClaim(reqId, c.cmd, c.claimId);
        if (claim) this.reviewEnd(reqId, claim, c.outcome);
        break;
      }
      case 'checkStart': {
        const claim = this.undecidedClaim(reqId, c.cmd, c.claimId);
        if (!claim) break;
        if (claim.status === 'reviewing') this.reject(reqId, c.cmd, 'invalid', `claim ${claim.claimId} is under review: reviewEnd continues it`);
        else this.showCheck(claim);
        break;
      }
      case 'winnerInfo':
        this.winnerInfo(reqId, c);
        break;
      case 'celebrationMusic':
        // In a Check it is kept for the Celebration that may follow.
        if (this.celebration) this.celebrationMusic(c.choice);
        else this.celebrationChoice = c.choice;
        break;
      case 'interval':
        this.startInterval();
        break;
      case 'intervalSet':
        // D228: the break's set, picked by the presenters; the scene rules keep it to a break.
        this.playIntervalMusic(c.set);
        break;
      case 'intervalSkip':
        // The scene rules let it through only while a set plays; the runtime picks the downbeat.
        this.out.push({ type: 'intervalSkip', set: this.pause ? 'pausa' : this.bedSet });
        return this.flush(); // the state changes when the next track takes over (intervalTrack)
      case 'throw':
        this.throwTap('throw', c.restart ?? false);
        break;
      case 'voiceSkip':
        this.cutVoice();
        break;
      case 'padHold':
        this.padHold(c.effect, c.on, c.intensity);
        break;
      case 'twoLevelHold':
        this.twoLevelHold(reqId, c.button, c.on, c.from ?? OWN_PAGE);
        break;
      case 'finale':
        this.setFinale(reqId, c.cardIds);
        break;
      case 'finaleCue':
        this.finaleCue(reqId);
        break;
      case 'storm':
        // During the last round's play the round holds first (Parlem), so no song lands unheard under the storm (D155).
        if (this.scene === 'play' && !(this.throwSong?.song === 'storm' && this.throwSong.playing) && this.status !== 'hold') this.holdOn(reqId);
        this.throwTap('storm', c.restart ?? false);
        break;
      case 'endGame':
        // Within 0.15 s of a landing a Spin can no longer be cancelled: press again.
        if (this.transition && this.transition.T - this.env.now() < HOLD.cancelMinSec) this.reject(reqId, c.cmd, 'busy');
        // A Claim under review holds the round in its Check (D118).
        else if (this.claims.some((cl) => cl.status === 'reviewing')) this.reject(reqId, c.cmd, 'claimOpen', 'a claim is under review');
        else this.endGame();
        break;
      case 'pause':
        this.setPause(c.on ?? !this.pause, reqId);
        break;
      case 'panic':
        this.panic();
        break;
      case 'sfx': {
        // The protocol only lets known sound names through; the engine still plays only the sounds it has.
        const known: readonly string[] = [...ENGINE.sfx, ...ENGINE.stingers];
        if (known.includes(c.name)) this.out.push({ type: 'sfx', name: c.name, volume: 'padFx' });
        else this.reject(reqId, c.cmd, 'unknownSfx');
        return this.flush(); // no state change worth broadcasting
      }
      case 'overrideNextRecipe':
        this.game.nextRecipe = c.recipe ?? null;
        break;
      case 'getState':
        break;
      case 'getJournal':
        this.out.push({ type: 'journalRequest', reqId, fromSeq: c.fromSeq ?? 1 });
        return this.flush(); // nothing changed
      case 'getUpcoming':
        // PRIVATE, only when asked (D170): the order never rides on the state.
        this.emit({ type: 'upcoming', reqId, round: this.round.number, position: this.position, songs: this.queue.slice(this.position + 1).map((id) => this.songRef(id)) });
        return this.flush();
      case 'resumeAt':
        this.resumeAt(c);
        break;
      case 'revealPrizes':
        this.revealPrizes(c.round, 'presenters');
        break;
      case 'testReset':
        // Rehearsal test runs only (the relay's --test, the page's relay.mode): the runtime reloads the page on a new Game.
        this.out.push({ type: 'reloadFresh' });
        return this.flush();
      case 'testJump':
        this.testJump(reqId, c.round, c.songs ?? null);
        break;
      default:
        // checkCommand only lets known commands through, and the compiler checks every one is handled here.
        c satisfies never;
        this.reject(reqId, cmd, 'unknownCommand');
    }
    this.maybeAutoCheck();
    this.emitState();
    return this.flush();
  }

  /** Called every few tens of milliseconds by the runtime. */
  tick(): Effect[] {
    this.tickAt(this.env.now());
    // The beat also moves on its own (the outgoing song's exit starting, a drift): sent when nothing else sent it.
    if (this.refreshBeat()) this.emitState();
    return this.flush();
  }

  /** One tick of the machine at `now` (its effects wait in `out`). */
  tickAt(now: number) {
    // A test jump settling: nothing moves until it lands (Panic left nothing playing).
    if (this.jump) {
      if (now < this.jump.at) return;
      this.landJump(this.jump);
    }
    if (this.volumesMovedAt != null && now >= this.volumesMovedAt + FLOW.volumesJournalSec) {
      this.volumesMovedAt = null;
      this.journal({ kind: 'settings.changed', settings: this.journalSettings() });
    }
    if (this.twoLevelHeld && now >= this.twoLevelHeld.until) {
      this.twoLevelHeld = null; // a lost release never locks the other consoles (D234)
      this.emitState();
    }
    if (this.unlocked) this.tickFlow(now);
    if (this.unlocked) this.tickVoice(now);
    if (this.status !== 'transition' && this.status !== 'locked') this.prepareNext();
    // Pausa froze what plays: no timer runs, no loop repeats, nothing lands (endPause moves them all on).
    if (this.pause) return;
    const t = this.transition;
    if (t && now >= t.T) this.land(t);
    // After any landing in this tick, which replaces a sample not yet sent: never one at a landing.
    this.sendHeatSample(now);
    if (this.suspense) this.tickSuspense(this.suspense, now);
    this.tickStay(now);
    this.tickLoop(now);
    if (this.status === 'playing' && this.timers.autoAt != null && now >= this.timers.autoAt) {
      this.timers.autoAt = null;
      this.next(null);
      this.emitState();
    }
    if (this.status === 'hold' && this.timers.holdMusicAt != null && now >= this.timers.holdMusicAt) {
      this.timers.holdMusicAt = null;
      this.toHoldMusic();
      this.emitState();
    }
    const cur = this.current;
    if (cur && !this.transition && !this.pending) {
      if (this.status === 'playing') {
        const spin = this.spin();
        if (this.autoAdvanceAllowed() && now >= cur.endCtx - spin.dTarget - 1) {
          this.timers.autoAt = null;
          this.next(null);
          this.emitState();
        } else if (!this.autoAdvanceAllowed() && now >= cur.endCtx - HOLD.songEndMarginSec) {
          this.enterHold('end', { music: true });
          this.emitState();
        }
      } else if (this.status === 'hold' && now >= cur.endCtx - HOLD.songEndMarginSec) {
        this.toHoldMusic();
        this.emitState();
      }
    }
  }

  /**
   * The relay's client list (`relay.clients`): a two-level button held on a console that has left is let go (D234), so
   * a dropped link never locks the others.
   */
  clientsChanged(clientIds: readonly string[]): Effect[] {
    const held = this.twoLevelHeld;
    if (held && held.clientId !== OWN_PAGE && !clientIds.includes(held.clientId)) {
      this.twoLevelHeld = null;
      this.emitState();
    }
    return this.flush();
  }

  /**
   * The runtime's audio-clock watchdog (D284): the clock stalled since `sinceMs` (epoch ms), or null once it advances
   * again. Only the private state carries it (the consoles' alert, the preflight); not journaled, nothing on the
   * projector. The state is emitted when it changes.
   */
  audioStalled(sinceMs: number | null): Effect[] {
    if ((this.audioStall?.sinceMs ?? null) !== sinceMs) {
      this.audioStall = sinceMs == null ? null : { sinceMs };
      this.emitState();
    }
    return this.flush();
  }

  /** The runtime finished decoding a song. */
  decoded(songId: number): Effect[] {
    const p = this.pending;
    if (p && p.songId === songId && !this.shuffleRunning()) {
      this.pending = null;
      this.beginTransition(p.reqId, p.songId, p.targetPos);
      this.emitState();
    }
    return this.flush();
  }

  decodeFailed(songId: number, detail?: string): Effect[] {
    const p = this.pending;
    if (p && p.songId === songId) {
      this.pending = null;
      this.reject(p.reqId, 'next', 'decodeFailed', detail);
      // The music never stops by accident: with nothing playing, Hold music covers.
      if (!this.current && !this.holdMusic) this.enterHold('music', { music: true });
      this.emitState();
    }
    return this.flush();
  }

  // ----------------------------------------------------------------------------------- the round
  /**
   * Start a round: draw its Queue with the tie-free Shuffle and journal it. `stop` silences everything first;
   * `shuffle` runs the public Shuffle (`shuffle.scheduled`; the scene becomes `play` when it ends);
   * `keepMusic` lets the Interval music go on under it, so the first Spin builds out of it.
   */
  startRound(number: number, kind: RoundKind, cardType: string, side: number, { stop = false, keepPace = false, shuffle = false, keepMusic = false } = {}) {
    if (stop) this.out.push({ type: 'stopAll', fadeSec: 0.3 });
    this.foldPlayed(number);
    const pool = this.roundPool(cardType, side) ?? DEFAULT_POOL;
    const drawn = this.drawQueue(cardType, kind, side, pool);
    this.queue = drawn.queue;
    this.shuffleSeed = drawn.seed;
    this.shuffleAttempts = drawn.attempts;
    this.drumSeed = freshDrumSeed();
    // The seed is a secret (with the cards it gives the Queue): never in a log.
    if (drawn.tied) this.out.push({ type: 'log', level: 'warn', message: `round ${number}: every Shuffle up to ${FLOW.shuffleMaxAttempts} had a Tie; kept the last` });
    this.position = -1;
    this.resetLive({ keepMusic });
    this.landings = [];
    // The round's Claims, Check, Celebration and Interval end with it; the Winners stay with the Game.
    this.claims = [];
    this.reviewMarks.clear();
    this.finale = null;
    this.finaleCued = false;
    this.celebrationChoice = null;
    this.check = null;
    this.batch = null;
    this.autoCheck = false;
    this.celebration = null;
    this.winningHook = null;
    this.interval = null;
    this.intro = null;
    this.shuffle = null;
    if (!this.game.paceLocked && !keepPace) this.game.pace = PACE.defaultSec;
    const nowMs = this.env.nowMs();
    // The round's target end comes from the Pace it starts with and its first plays; Drift is measured against it.
    this.round = { number, kind, cardType, side, pool, startedAtMs: nowMs, targetEndMs: nowMs + 1000 * this.roundTargetSec(kind), lineConfirmed: false };
    // A secret seed drawn at the Shuffle blurs this round's Phase; it stays with the Queue.
    this.phaseModel = { kind: firstClimb(kind), start: 0, seed: Math.floor(this.env.random() * 2 ** 32) >>> 0, valid: [], plan: null };
    this.expectedSongs = null;
    this.targetShiftSec = 0;
    this.rebuildPhase({ songsMove: 'target' });
    this.journal({
      kind: 'round.started',
      round: number,
      roundKind: kind,
      cardType,
      ...(side !== DEFAULT_SIDE ? { side } : {}),
      queue: [...this.queue],
      phaseSeed: this.phaseModel.seed,
      startedAtMs: this.round.startedAtMs,
      targetEndMs: this.round.targetEndMs,
      settings: this.journalSettings(),
      shuffleSeed: this.shuffleSeed,
      shuffleAttempts: this.shuffleAttempts,
      drumSeed: this.drumSeed,
    });
    if (shuffle) {
      const now = this.env.now();
      this.shuffle = { round: number, startAt: now, endAt: now + FLOW.shuffleSec };
      this.emit({
        type: 'shuffle.scheduled', round: number, kind, songCount: this.queue.length,
        startAtMs: this.env.toEpochMs(now), endAtMs: this.env.toEpochMs(this.shuffle.endAt),
      });
    }
    this.out.push({ type: 'drumReset', ids: drumOrder(this.queue, this.drumSeed) });
    this.prefetch();
  }

  /**
   * Plan B (`resumeAt`): resume a round by hand on a page with no journal. The seeded Shuffle rebuilds the
   * round's Queue from its seed and the cards in play; the songs up to `position` count from now. A Queue
   * that doesn't match what the token says (draw number, song at the position) is refused, never resumed.
   */
  resumeAt(c: CommandOf<'resumeAt'>) {
    if (this.transition || this.suspense || this.pending || this.check) return this.reject(c.reqId, c.cmd, 'busy');
    const cardType = c.cardType ?? defaultCardType(c.kind);
    const side = c.side ?? DEFAULT_SIDE;
    const pool = this.roundPool(cardType, side);
    if (pool == null) return this.reject(c.reqId, c.cmd, 'cannotResume', `card type ${cardType} has no side ${side}`);
    const cards = validCards(this.allCards, this.cardsInPlay, cardType, side);
    const drawn = tieFreeShuffle({ pool: this.poolSongs(pool), cards, seed: c.shuffleSeed, maxAttempts: FLOW.shuffleMaxAttempts, rule: tieRule(c.kind) });
    const lineFrom = c.kind === 'desgraciat' ? null : c.lineConfirmedFrom ?? null;
    const refuse = (detail: string) => this.reject(c.reqId, c.cmd, 'cannotResume', detail);
    if (c.shuffleAttempts != null && drawn.attempts !== c.shuffleAttempts) {
      return refuse(`the Shuffle took draw ${drawn.attempts} here, ${c.shuffleAttempts} there: are the cards in play the same?`);
    }
    if (c.position >= drawn.queue.length) return refuse(`position ${c.position} is past the Queue (${drawn.queue.length} songs)`);
    if (c.lastSongId != null && (c.position < 0 || drawn.queue[c.position] !== c.lastSongId)) {
      return refuse(`song ${c.lastSongId} is not at position ${c.position} of this Queue: check the seed and the position`);
    }
    if (lineFrom != null && lineFrom > c.position + 1) return refuse(`the Line cannot be confirmed from position ${lineFrom}, after the last counted song`);
    this.resumeRound({ number: c.round, kind: c.kind, cardType, side, pool, drawn, position: c.position, lineFrom });
  }

  /**
   * A round resumed from its Shuffle `drawn`, with its songs up to `position` counted from now (−1: none yet) and the
   * Line confirmed from `lineFrom` (or not): `resumeAt` once its token checks out, and a test jump into play. Journaled as
   * `round.resumed`, which puts the Game in `play` from now; the projector hears of the scene too. Hold music until Next.
   */
  resumeRound({ number, kind, cardType, side, pool, drawn, position, lineFrom }: {
    number: number; kind: RoundKind; cardType: string; side: number; pool: string; drawn: TieFreeShuffle; position: number; lineFrom: number | null;
  }) {
    this.resetLive();
    this.foldPlayed(number);
    this.queue = drawn.queue;
    this.shuffleSeed = drawn.seed;
    this.shuffleAttempts = drawn.attempts;
    this.drumSeed = freshDrumSeed();
    this.position = position;
    const now = this.env.now();
    const nowMs = this.env.nowMs();
    this.landings = this.queue.slice(0, position + 1).map((songId, p) => ({ songId, position: p, atMs: nowMs, undone: false, T: now }));
    this.claims = [];
    this.reviewMarks.clear();
    this.finale = null;
    this.finaleCued = false;
    this.celebrationChoice = null;
    this.check = null;
    this.batch = null;
    this.autoCheck = false;
    this.celebration = null;
    this.winningHook = null;
    this.interval = null;
    this.intro = null;
    this.shuffle = null;
    this.round = { number, kind, cardType, side, pool, startedAtMs: nowMs, targetEndMs: nowMs + 1000 * this.roundTargetSec(kind), lineConfirmed: lineFrom != null };
    this.phaseModel = { kind: lineFrom != null ? 'bingo' : firstClimb(kind), start: lineFrom ?? 0, seed: Math.floor(this.env.random() * 2 ** 32) >>> 0, valid: [], plan: null };
    this.expectedSongs = null;
    this.targetShiftSec = 0;
    this.rebuildPhase({ songsMove: 'target' });
    this.updateNudge();
    this.journal({
      kind: 'round.resumed', round: number, roundKind: kind, cardType, ...(side !== DEFAULT_SIDE ? { side } : {}), queue: [...this.queue], phaseSeed: this.phaseModel.seed,
      startedAtMs: this.round.startedAtMs, targetEndMs: this.round.targetEndMs, settings: this.journalSettings(),
      shuffleSeed: this.shuffleSeed, shuffleAttempts: this.shuffleAttempts, drumSeed: this.drumSeed, position, lineConfirmedFrom: lineFrom,
    }, nowMs);
    // The journal entry puts the Game in `play` from now (also from `play`: a test jump); the projector hears of a change.
    const previous = this.scene;
    this.scene = 'play';
    this.sceneSinceMs = nowMs;
    if (previous !== 'play') this.emit({ type: 'scene.changed', scene: 'play', previous, atMs: nowMs });
    this.out.push(this.drumResetEffect(position));
    this.prefetch();
    // The music never stops by accident: Hold music until the presenters press Next.
    if (this.unlocked) this.enterHold('music', { music: true });
  }

  /** The state's `resume`: how to resume this round by hand elsewhere (null for a fixed test Queue). */
  resumeToken(): ResumeToken | null {
    if (this.fixedQueue?.length) return null;
    const point = {
      round: this.round.number,
      kind: this.round.kind,
      cardType: this.round.cardType,
      ...(this.round.side !== DEFAULT_SIDE ? { side: this.round.side } : {}),
      shuffleSeed: this.shuffleSeed,
      shuffleAttempts: this.shuffleAttempts,
      position: this.position,
      lastSongId: this.position >= 0 ? this.queue[this.position] ?? null : null,
      lineConfirmedFrom: this.round.lineConfirmed ? this.phaseModel.start : null,
    };
    return { ...point, text: formatResumeToken(point) };
  }

  /**
   * The round's Queue: the tie-free Shuffle of its pool (game/shuffle.ts) from a secret seed, checked against the cards
   * in play valid for a round of this card type and side. A fixed Queue bypasses it (seed 0, attempts 0).
   */
  drawQueue(cardType: string, kind: RoundKind, side: number, pool: string): { queue: number[]; seed: number; attempts: number; tied: boolean } {
    const fixed = this.fixedQueue?.filter((id) => this.catalog.has(id));
    if (fixed?.length) return { queue: fixed, seed: 0, attempts: 0, tied: false };
    const seed = Math.floor(this.env.random() * 2 ** 32) >>> 0;
    const cards = validCards(this.allCards, this.cardsInPlay, cardType, side);
    return tieFreeShuffle({ pool: this.poolSongs(pool), cards, seed, maxAttempts: FLOW.shuffleMaxAttempts, rule: tieRule(kind) });
  }

  // ------------------------------------------------------------------------------------------ pools (D178)
  /** A song's pools (D268: a song may be in several): its own, else DEFAULT_POOL only. */
  poolsOf(songId: number): readonly string[] {
    const pools = this.catalog.get(songId)?.pools;
    return pools?.length ? pools : [DEFAULT_POOL];
  }

  /**
   * A pool's songs, in the catalogue's order (the order is part of the Shuffle's rule), a song shared with another
   * pool included (D268). A pool with no songs (a repertoire not split into pools yet) plays the whole repertoire,
   * with a warning: a round never starts empty.
   */
  poolSongs(pool: string): number[] {
    const ids = [...this.catalog.keys()];
    const songs = ids.filter((id) => this.poolsOf(id).includes(pool));
    if (songs.length || !ids.length) return songs;
    this.out.push({ type: 'log', level: 'warn', message: `pool ${pool} has no songs: the round plays the whole repertoire` });
    return ids;
  }

  /** The pool a round of this card type and side plays (card-types.json); null when the type has no such side. */
  roundPool(cardType: string, side: number): string | null {
    return sidePool(this.cardTypes, cardType, side);
  }

  /** The side the plan gives round `number`, when it plans that round as this kind and card type; else 1. */
  plannedSide(number: number, kind: RoundKind, cardType: string): number {
    const planned = roundPlan(this.plan, number);
    return planned && planned.kind === kind && (planned.cardType || defaultCardType(kind)) === cardType ? roundSide(planned) : DEFAULT_SIDE;
  }

  /** The public Shuffle is still animating: no song may land yet. */
  shuffleRunning(): boolean {
    return this.shuffle != null && this.env.now() < this.shuffle.endAt;
  }

  /**
   * Live playback back to rest: nothing playing, spinning or held. The Game (Queue, landings) is untouched.
   * `keepMusic`: the Interval music goes on.
   */
  resetLive({ keepMusic = false } = {}) {
    const bed = keepMusic ? this.bed : null;
    this.current = null;
    this.transition = null;
    this.suspense = null;
    this.pending = null;
    this.hold = null;
    this.holdMusic = false;
    this.bed = bed;
    this.heatSample = null;
    this.timers = { autoAt: null, holdMusicAt: null };
    this.history = [];
    this.nudge = 1;
    this.stingerClimbs.clear();
    this.nextHook = null;
    this.blendRequested = '';
    this.status = this.unlocked ? 'idle' : 'locked';
  }

  // ------------------------------------------------------------------------------------- journal
  /** Resume the Game in `record` (see ShowOptions.restore). Writes no journal entry: nothing new happened. */
  restore(record: GameRecord, round: RecordedRound) {
    this.gameId = record.gameId;
    this.journalSeq = record.seq;
    if (record.settings) {
      this.takeSettings(record.settings);
      this.game.nextRecipe = null;
    }
    try {
      this.setCards(record.cardsInPlay);
    } catch {} // ranges were checked when they were entered
    this.queue = [...round.queue];
    this.position = Math.min(round.position, this.queue.length - 1);
    this.setPlayed(record.playedBefore ?? []);
    this.resetLive();
    const now = this.env.now();
    const nowMs = this.env.nowMs();
    // Landing times on this page's audio clock (in the past, possibly before it started).
    this.landings = round.landings.map((l) => ({ songId: l.songId, position: l.position, atMs: l.atMs, undone: l.undone, T: now - (nowMs - l.atMs) / 1000 }));
    const cardType = round.cardType ?? defaultCardType(round.kind);
    const side = round.side ?? DEFAULT_SIDE;
    this.round = {
      number: round.number, kind: round.kind, cardType, side, pool: this.roundPool(cardType, side) ?? DEFAULT_POOL,
      startedAtMs: round.startedAtMs, targetEndMs: round.targetEndMs, lineConfirmed: round.climbingTo === 'bingo',
    };
    this.phaseModel = { kind: round.climbingTo, start: round.climbFrom, seed: round.phaseSeed, valid: [], plan: null };
    this.shuffleSeed = round.shuffleSeed;
    this.shuffleAttempts = round.shuffleAttempts;
    // A journal from before the drum's order has none: a fresh one (the drum only needs one per round).
    this.drumSeed = round.drumSeed ?? freshDrumSeed();
    this.finale = round.finale ? { cardIds: [...round.finale.cardIds], byHand: round.finale.byHand === true } : null;
    // The journal's target already counts the round's songs as they were when it started.
    this.expectedSongs = null;
    this.targetShiftSec = 0;
    this.rebuildPhase({ songsMove: 'none' });
    this.updateNudge();
    this.restoreFlow(record);
    // The drum keeps the cards not yet played, with the last landing under the pointer.
    this.out.push(this.drumResetEffect(this.position));
    this.prefetch();
  }

  /**
   * The show flow of a resumed Game: its scene, the round's Claims (a Check that was running is queued again)
   * and the Game's Winners. The Celebration and the Interval come back from the scene and the Claims.
   */
  restoreFlow(record: GameRecord) {
    this.scene = record.scene;
    this.sceneSinceMs = record.sceneSinceMs;
    this.claimCount = record.claimCount;
    this.winners = record.winners.map((w) => ({ ...w }));
    this.prizesRevealed = (record.prizesRevealed ?? []).map((r) => ({ ...r }));
    this.intro = record.intro
      ? { round: record.intro.round, kind: record.intro.kind, cardType: record.intro.cardType ?? defaultCardType(record.intro.kind), side: record.intro.side ?? DEFAULT_SIDE, sinceMs: record.sceneSinceMs }
      : null;
    const inPlay = new Set(this.cardsInPlay);
    this.claims = record.claims.map((c): ClaimInfo => ({
      claimId: c.claimId, round: c.round, cardId: c.cardId, kind: c.kind, atMs: c.atMs, position: c.position,
      status: c.verdict ?? (c.reviewing ? 'reviewing' : 'queued'), outcome: null, completeSince: null,
      warnings: this.allCards.some((card) => card.id === c.cardId) && !inPlay.has(c.cardId) ? ['notSold'] : [],
      markedCard: [], revealUntil: null, cueNext: false,
    }));
    for (const c of this.claims) if (!settled(c)) this.evaluate(c);
    // The Check under way: the Claims made since it began (an earlier card's pass still counts for its Celebration).
    if (this.scene === 'check') this.batch = { claimIds: this.claims.filter((c) => c.atMs >= this.sceneSinceMs).map((c) => c.claimId), celebration: null };
    if (this.scene === 'celebration') {
      const kind = roundWin(this.claims.filter((c) => c.status === 'valid').map((c) => c.kind));
      this.celebration = this.celebrationOf(kind, this.sceneSinceMs, kind === 'line' ? 'winningSong' : 'victory');
    }
    if (this.scene === 'interval') this.interval = this.intervalFrom(this.sceneSinceMs);
    // A finale already celebrated (or past it) had its cue.
    this.finaleCued = this.finale != null && (this.scene === 'celebration' || this.scene === 'interval' || this.scene === 'after');
  }

  /** The Game as this show holds it, in the shape `replayJournal` produces from its journal. */
  record(): GameRecord {
    return {
      gameId: this.gameId,
      seq: this.journalSeq,
      cardsInPlay: this.cardsInPlayText,
      settings: this.recordSettings(),
      scene: this.scene,
      sceneSinceMs: this.sceneSinceMs,
      intro: this.intro ? { round: this.intro.round, kind: this.intro.kind, cardType: this.intro.cardType, side: this.intro.side } : null,
      claims: this.claims.map((c): RecordedClaim => ({
        claimId: c.claimId, round: c.round, cardId: c.cardId, kind: c.kind, position: c.position, atMs: c.atMs,
        verdict: c.status === 'valid' || c.status === 'invalid' || c.status === 'discarded' ? c.status : null,
        ...(c.status === 'reviewing' ? { reviewing: true as const } : {}),
      })),
      claimCount: this.claimCount,
      winners: this.winners.map((w) => ({ ...w })),
      prizesRevealed: this.prizesRevealed.map((r) => ({ ...r })),
      playedBefore: [...this.playedBefore],
      round: {
        number: this.round.number,
        kind: this.round.kind,
        cardType: this.round.cardType,
        side: this.round.side,
        queue: [...this.queue],
        phaseSeed: this.phaseModel.seed,
        startedAtMs: this.round.startedAtMs,
        targetEndMs: this.round.targetEndMs,
        position: this.position,
        climbingTo: this.phaseModel.kind,
        climbFrom: this.phaseModel.start,
        landings: this.landings.map(({ position, songId, atMs, undone }) => ({ position, songId, atMs, undone })),
        shuffleSeed: this.shuffleSeed,
        shuffleAttempts: this.shuffleAttempts,
        drumSeed: this.drumSeed,
        ...(this.finale ? { finale: { cardIds: [...this.finale.cardIds], ...(this.finale.byHand ? { byHand: true as const } : {}) } } : {}),
      },
    };
  }

  journalSettings(): JournalSettings {
    const { nextRecipe: _testOnly, volumes: _kept, ...rest } = this.game;
    const settings = { ...rest, autoSounds: { ...this.game.autoSounds } };
    // Absent until this Game set them, so a fresh Game still takes the plan's (D139).
    return this.volumesSet ? { ...settings, volumes: { ...this.volumes } } : settings;
  }

  /** The settings as the journal has them: the volumes as last journaled (a slider still moving isn't yet). */
  recordSettings(): JournalSettings {
    const { volumes: _live, ...settings } = this.journalSettings();
    return this.journaledVolumes ? { ...settings, volumes: { ...this.journaledVolumes } } : settings;
  }

  /** Settings that carry volumes (the constructor's, a journal's): the sliders take them, the settings drop them. */
  takeVolumes(settings: GameSettings) {
    const given = settings.volumes;
    delete settings.volumes;
    if (!given) return;
    this.volumes = { ...VOLUME_DEFAULTS, ...given };
    this.volumesSet = true;
    this.journaledVolumes = { ...this.volumes };
    this.pushVolumes();
  }

  /** The sliders and the sounds switched off, for the runtime's gains. */
  pushVolumes() {
    this.out.push({ type: 'volumes', volumes: { ...this.volumes }, autoSounds: { ...this.game.autoSounds } });
  }

  /**
   * A journal's settings over the Game's: its sounds through autoSoundsOf (a journal from before D237 has only the old
   * `finalLapStinger` and `voicesOn`, which the Game no longer keeps), its volumes to the sliders.
   */
  takeSettings(settings: JournalSettings) {
    const { finalLapStinger: _old, voicesOn: _oldVoices, ...rest } = settings;
    this.game = { ...this.game, ...rest, autoSounds: autoSoundsOf(settings) };
    this.takeVolumes(this.game);
  }

  /** The drum after a resume: the songs not yet played and the last landing (under the pointer), in the round's
   * drum order (D237). */
  drumResetEffect(position: number): DrumResetEffect {
    const last = position >= 0 ? this.queue[position] : undefined;
    const ids = this.drumIds(position);
    return last == null ? { type: 'drumReset', ids } : { type: 'drumReset', ids, selectId: last };
  }

  /** The drum's cards at `position`: the songs still to play and the last landing (none before the first), in the
   * round's drum order (D237), as a phone lays them out. Back and a cancelled Spin put a card back at its place in it. */
  drumIds(position: number): number[] {
    const shown = new Set(this.queue.slice(Math.max(0, position)));
    return drumOrder(this.queue, this.drumSeed).filter((id) => shown.has(id));
  }

  /**
   * The lock mirror (D234): one console at a time holds a two-level button. Another console's press meanwhile is refused
   * `busy` (the first holder keeps it), and a release that isn't the holder's, of that button, is ignored. The holder's
   * own press again (the other button) takes over. It clears by itself after TWO_LEVEL.timeoutSec.
   */
  twoLevelHold(reqId: string, button: TwoLevelButton, on: boolean, clientId: string) {
    const held = this.twoLevelHeld;
    if (on) {
      if (held && held.clientId !== clientId) return this.reject(reqId, 'twoLevelHold', 'busy', `held by ${held.clientId}`);
      this.twoLevelHeld = { button, clientId, sinceMs: this.env.nowMs(), until: this.env.now() + TWO_LEVEL.timeoutSec[button] };
    } else if (held?.clientId === clientId && held.button === button) this.twoLevelHeld = null;
  }

  /** The sound test (D229): one kind at a time; the runtime plays it at its slider's level. */
  setSoundTest(kind: SoundTestKind | null) {
    if ((this.soundTest?.kind ?? null) === kind) return;
    const songIds = kind ? [...this.catalog.keys()].slice(0, 8) : [];
    this.out.push({ type: 'soundTest', kind, songIds, parlemDb: this.parlemDb() });
    this.soundTest = kind ? { kind, sinceMs: this.env.nowMs() } : null;
  }

  /** One automatic sound on or off (D237): applied at once, journaled with the settings. */
  setAutoSound(key: AutoSound, on: boolean) {
    this.game.autoSounds = { ...this.game.autoSounds, [key]: on };
    this.pushVolumes();
    this.journal({ kind: 'settings.changed', settings: this.journalSettings() });
  }

  /** One slider (D139): applied at once, journaled once the sliders are still. */
  setVolume(key: VolumeKey, percent: number) {
    this.volumes[key] = percent;
    this.volumesSet = true;
    this.volumesMovedAt = this.env.now();
    this.pushVolumes();
    // The song under Parlem follows its slider at once.
    if (key === 'songsParlem' && this.status === 'hold' && this.hold?.ducked && this.current && !this.holdMusic) {
      this.out.push({ type: 'duck', db: this.parlemDb(), seconds: INTERVAL.volumeGlideSec });
    }
  }

  /** How far Parlem ducks the song: its slider (D139; the default is the tuned −14 dB). */
  parlemDb(): number {
    return Math.max(-80, volumeDb(this.volumes.songsParlem));
  }

  /** Append an entry to the Game journal: the runtime keeps it, remotes may keep a copy. */
  journal(body: JournalEntryBody, atMs = this.env.nowMs()) {
    const entry: JournalEntry = { ...body, gameId: this.gameId, seq: ++this.journalSeq, atMs };
    if ('settings' in body && body.settings?.volumes) this.journaledVolumes = { ...VOLUME_DEFAULTS, ...body.settings.volumes };
    this.out.push({ type: 'journal', entry });
    this.emit({ type: 'journal.entry', entry });
  }

  /**
   * Merge cards into the cards in play (D234's «Cartrons venuts»): two consoles adding at once keep both. Refused whole
   * when a number isn't printed (`detail`: those numbers, as ranges), or when the merged list would no longer fit in a
   * `cards.set` (setCardsInPlay's limit, which the cloud's journal check keeps too). Journaled as `cards.set` with the
   * merged list, only when something joined.
   */
  addCards(reqId: string, ranges: string) {
    let ids: number[];
    try {
      ids = parseCardRanges(ranges);
    } catch (error) {
      return this.reject(reqId, 'addCardsInPlay', 'invalid', error instanceof Error ? error.message : String(error));
    }
    if (!ids.length) return this.reject(reqId, 'addCardsInPlay', 'invalid', 'no card numbers');
    const unknown = this.unknownCards(ids);
    if (unknown.length) return this.reject(reqId, 'addCardsInPlay', 'invalid', formatCardRanges(unknown));
    const have = new Set(this.cardsInPlay);
    const added = ids.filter((id) => !have.has(id));
    const merged = formatCardRanges([...this.cardsInPlay, ...added].sort((a, b) => a - b));
    if (added.length && merged.length > COMMANDS.setCardsInPlay.ranges.maxLength) {
      return this.reject(reqId, 'addCardsInPlay', 'invalid', `the cards in play would no longer fit in ${COMMANDS.setCardsInPlay.ranges.maxLength} characters`);
    }
    this.cardsLastAdd = { reqId, added: formatCardRanges(added), alreadyIn: formatCardRanges(ids.filter((id) => have.has(id))) };
    if (!added.length) return;
    this.setCards(merged);
    this.journal({ kind: 'cards.set', ranges: merged });
    this.rebuildPhase();
    this.rescheduleAuto();
  }

  /** Set the cards in play from their ranges; throws on bad ranges and leaves them as they were. */
  setCards(ranges: string) {
    const parsed = parseCardRanges(ranges);
    this.cardsInPlay = parsed;
    this.cardsInPlayText = ranges;
  }

  // ------------------------------------------------------------------------------------- Next
  next(reqId: string | null) {
    if (this.suspense) return this.releaseSuspense(reqId);
    if (this.transition || this.pending) return this.reject(reqId, 'next', 'busy');
    const targetPos = this.position + 1;
    if (targetPos >= this.queue.length) return this.reject(reqId, 'next', 'endOfQueue');
    const songId = this.queue[targetPos];
    // From a Line's Celebration, back to the round.
    if (this.scene === 'celebration') this.leaveCelebration();
    if (this.status === 'hold') this.leaveHold(0.4);
    // A song left playing on its loop (D239) plays on from the phrase it is in, as on leaving Aguanta.
    if (this.loop?.purpose === 'stay') this.loop = null;
    // A song still decoding, or the Shuffle still animating: it starts as soon as both are done.
    if (!this.env.isDecoded(songId) || this.shuffleRunning()) {
      this.pending = { reqId, songId, targetPos };
      this.prefetch();
      return;
    }
    this.beginTransition(reqId, songId, targetPos);
  }

  beginTransition(reqId: string | null, songId: number, targetPos: number) {
    const now = this.env.now();
    const phase = PHASES[this.phaseName()];
    const spin = this.spin();
    const cur = this.current;
    const aAnalysis = cur ? this.env.analysis(cur.songId) : null;
    const A = cur && aAnalysis && cur.endCtx > now + ENGINE.minOutgoingTailSec
      ? { songId: cur.songId, analysis: aAnalysis, deck: cur, landedDownbeatIndex: cur.landedDownbeatIndex, signatures: this.env.signatures?.(cur.songId) ?? null }
      : null;
    const analysis = this.env.analysis(songId);
    if (!analysis) return this.reject(reqId, 'next', 'notReady');
    const seed = Math.floor(this.env.random() * 2 ** 32) >>> 0;
    const chosen = this.nextHook?.songId === songId ? this.nextHook.hook : null;
    const blend = A && chosen ? this.env.blend?.(A.songId, chosen.id) ?? null : null;
    this.nextHook = null;
    this.blendRequested = '';
    const planner = this.env.plan ?? planTransition;
    const id = `tr-${++this.transitionCount}`;
    const planned = planner({
      now,
      A,
      B: { songId, analysis, stems: this.env.stems?.(songId) ?? null, blend, signatures: this.env.signatures?.(songId) ?? null },
      hookOverride: chosen,
      phase: this.hookPhase(phase, songId),
      spin,
      history: this.history,
      rng: seededRandom(seed),
      // An override that is not a recipe id is ignored, as the planner would ignore it.
      recipeOverride: RECIPE_IDS.find((r) => r === this.game.nextRecipe) ?? null,
      kind: 'next',
      id,
    });
    if ('error' in planned) return this.reject(reqId, 'next', 'planFailed', planned.error);
    this.startPlaying();
    const plan: ShowPlan = { ...planned, seed, reqId, targetPos };
    this.game.nextRecipe = null;
    this.transition = {
      id,
      reqId,
      songId,
      targetPos,
      plan,
      spinStart: plan.spinStart,
      T: plan.T,
      fromSongId: A ? A.songId : null,
      aExitStart: plan.a?.exitStart ?? null,
      fromHoldMusic: this.holdMusic || this.bed != null,
      afterLanding: null,
    };
    // Without a usable outgoing song (it ran out), the runtime fades whatever is left of it.
    if (!A) this.current = null;
    this.status = 'transition';
    this.hold = null;
    this.timers = { autoAt: null, holdMusicAt: null };
    const removeId = this.position >= 0 ? this.queue[this.position] : null;
    // Hold music, or the Interval's or Celebration's music, gives way to the build.
    const spinSeed = drumSpinSeed(seed);
    this.out.push({ type: 'startTransition', plan, fromHoldMusic: this.holdMusic || this.bed != null, drum: { removeId, targetId: songId, minLaps: 1, seed: spinSeed } });
    this.bed = null;
    // A "final lap" fanfare as the drum starts, once per climb (towards the Line, then the Bingo), the
    // first time the Phase reaches ENGINE.finalLapStingerPhase.
    const climb = this.phaseModel.kind;
    const reached = PHASE_RANK[plan.phase] >= PHASE_RANK[ENGINE.finalLapStingerPhase];
    if (this.game.autoSounds.finalLap && reached && !this.stingerClimbs.has(climb)) {
      this.stingerClimbs.add(climb);
      this.out.push({ type: 'sfx', name: ENGINE.finalLapStinger, at: plan.spinStart + 0.05, volume: 'finalLap' });
    }
    this.holdMusic = false;
    this.emit({
      type: 'transition.scheduled',
      id,
      reqId,
      from: A ? A.songId : null,
      to: songId,
      position: targetPos,
      phase: plan.phase,
      recipe: plan.recipe,
      recipeName: plan.recipeName,
      exit: plan.exit,
      shape: plan.shape,
      spinStartAtMs: this.env.toEpochMs(plan.spinStart),
      exitAtMs: this.env.toEpochMs(plan.a?.stopAt ?? plan.T),
      landAtMs: this.env.toEpochMs(plan.T),
      durationMs: Math.round(plan.D * 1000),
      hookId: plan.hook.id,
      bpm: plan.b.bpm ?? null,
      drum: { removeId, targetId: songId, minLaps: 1 },
      spinSeed,
    });
  }

  // ---------------------------------------------------------------------------------- Suspense
  // The presenters hold the next transition open: A exits, a loop on B's grid builds bar by bar and the drum
  // coasts, until Next (or `suspense` off) releases it onto the next free bar line. Never automatic.
  /**
   * A Suspense from the song playing (or from Hold music). During a Spin (D176, D177: A held, then B) the Spin becomes
   * the Suspense, with its own id, song and hook: while A's exit hasn't started, over A's phrase (A comes back up); after
   * it, A's exit plays out and the build runs on B's grid; in the Spin's last moment B lands, into Aguanta (B is held).
   */
  startSuspense(reqId: string | null) {
    if (this.suspense) return;
    if (this.pending) return this.reject(reqId, 'suspense', 'busy');
    const spin = this.transition;
    const now = this.env.now();
    if (spin && spin.T - now < HOLD.cancelMinSec) {
      spin.afterLanding = 'stay';
      return;
    }
    const targetPos = spin ? spin.targetPos : this.position + 1;
    if (targetPos >= this.queue.length) return this.reject(reqId, 'suspense', 'endOfQueue');
    const songId = spin ? spin.songId : this.queue[targetPos];
    const analysis = this.env.analysis(songId);
    if (!analysis) return this.reject(reqId, 'suspense', 'notReady');
    const fromStay = !spin && this.status === 'hold' && this.hold?.ducked === false && this.current != null && !this.holdMusic;
    if (!spin && this.status === 'hold') this.leaveHold(0.4);
    const phase = PHASES[this.phaseName()];
    const cur = this.current;
    // A Spin keeps A while A's exit hasn't started; after it, A leaves as the Spin planned.
    const keepA = !spin || (spin.fromSongId != null && spin.aExitStart != null && spin.aExitStart > now + 0.05 && cur?.songId === spin.fromSongId);
    const aAnalysis = cur && keepA ? this.env.analysis(cur.songId) : null;
    const A = cur && aAnalysis && cur.endCtx > now + ENGINE.minOutgoingTailSec
      ? { songId: cur.songId, analysis: aAnalysis, deck: cur, landedDownbeatIndex: cur.landedDownbeatIndex }
      : null;
    const seed = spin ? spin.plan.seed : Math.floor(this.env.random() * 2 ** 32) >>> 0;
    const chosen = spin ? analysis.hooks.find((h) => h.id === spin.plan.hook.id) ?? null : this.nextHook?.songId === songId ? this.nextHook.hook : null;
    this.nextHook = null;
    this.blendRequested = '';
    const B = { songId, analysis };
    const open = spin && !keepA && spin.fromSongId != null
      ? suspenseFromExit({ now, plan: spin.plan, B, phase }) ?? { error: 'noHook' as const }
      : openSuspense({ now, A, B, phase: this.hookPhase(phase, songId), rng: seededRandom(seed), history: this.history, hookOverride: chosen });
    if ('error' in open) return this.reject(reqId, 'suspense', 'planFailed', open.error);
    // The Spin had its whoosh.
    if (spin) open.events = open.events.filter((e) => !(e.kind === 'sfx' && e.name === 'whoosh'));
    this.startPlaying();
    const id = spin ? spin.id : `tr-${++this.transitionCount}`;
    const fromHoldMusic = spin ? spin.fromHoldMusic : this.holdMusic || this.bed != null;
    this.transition = null;
    // Over A's loop the drum hovers over a few pending songs, the real next one among them, teased in turn.
    const hover = open.loop ? this.hoverSongs(songId, seed) : [];
    this.suspense = {
      id, reqId, songId, targetPos, open, seed, startedAt: now, autoReleaseAt: now + SUSPENSE.autoReleaseSec, nextBar: 0,
      fromSongId: A ? A.songId : null, fromHoldMusic, hover, teases: 0, fromStay,
    };
    if (open.loop && cur) {
      // A keeps playing: its phrase repeats from its end until the release lands B on it.
      this.loop = { songId: cur.songId, phrase: open.loop.phrase, nextAt: open.loop.firstPassAt + open.loop.passSec, until: null, purpose: 'suspense' };
    } else if (!A) this.current = null;
    if (hover.length) this.prefetch();
    this.status = 'transition';
    this.hold = null;
    this.timers = { autoAt: null, holdMusicAt: null };
    // A Spin already took the last song off the drum and stopped what played before it.
    const removeId = !spin && this.position >= 0 ? this.queue[this.position] : null;
    // The Spin's build and B's part stop where the Suspense takes over: at once over A, else where A's exit ends.
    const fromSpin = spin ? { keepA: A != null, cutAt: A ? now : open.loopStart } : undefined;
    this.out.push({ type: 'startSuspense', open, fromHoldMusic: !spin && fromHoldMusic, drum: { removeId, targetId: songId }, ...(fromSpin ? { fromSpin } : {}) });
    this.bed = null;
    this.holdMusic = false;
    this.emit({
      type: 'suspense.started',
      id,
      reqId,
      ...(spin ? { fromSpin: true as const } : {}),
      from: spin ? spin.fromSongId : A ? A.songId : null,
      to: songId,
      position: targetPos,
      phase: phase.name,
      spinStartAtMs: this.env.toEpochMs(open.spinStart),
      exitAtMs: this.env.toEpochMs(open.loopStart),
      autoReleaseAtMs: this.env.toEpochMs(now + SUSPENSE.autoReleaseSec),
      drum: { removeId, targetId: songId },
    });
    this.tickSuspense(this.suspense, now);
  }

  /** Schedule the loop's bars just ahead of time, and release it when it has run long enough. */
  tickSuspense(s: SuspenseState, now: number) {
    if (now >= s.autoReleaseAt) {
      this.releaseSuspense(null);
      this.emitState();
      return;
    }
    const { open } = s;
    while (barSpan(open, s.nextBar).t0 - SUSPENSE.scheduleAheadSec <= now) {
      const events = suspenseBar(open, s.nextBar);
      const tease = this.teaseFor(s, s.nextBar);
      if (tease) {
        events.push(...tease.events);
        // The drum sways on that card until the next tease takes it elsewhere (a pass later).
        this.out.push({ type: 'suspenseHover', cardId: tease.songId, at: tease.at, until: tease.at + (open.loop?.passSec ?? 0) + 1 });
      }
      this.out.push({ type: 'suspenseBar', bar: s.nextBar, events });
      s.nextBar++;
    }
  }

  /**
   * The pending songs a Suspense hovers over: the real next one and up to SUSPENSE.hoverSongs − 1 others still to
   * play this round, in a seeded order (where the real one sits gives nothing away).
   */
  hoverSongs(next: number, seed: number): number[] {
    const rng = seededRandom(seed ^ 0x68e31da4);
    const pending = this.queue.slice(this.position + 2);
    const others: number[] = [];
    while (others.length < SUSPENSE.hoverSongs - 1 && pending.length) others.push(...pending.splice(Math.floor(rng() * pending.length), 1));
    const all = [next, ...others];
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
  }

  /** Bar `k`'s tease over A's loop, of the next hovered song whose audio is decoded (it is skipped otherwise). */
  teaseFor(s: SuspenseState, k: number): { events: PlanEvent[]; songId: number; at: number; until: number } | null {
    if (!s.open.loop || !s.hover.length) return null;
    const songId = s.hover[s.teases % s.hover.length];
    const analysis = this.env.analysis(songId);
    const hook = songId === s.songId ? s.open.hook : analysis ? usableHooks(analysis)[0] : null;
    if (!analysis || !hook) return null;
    const tease = suspenseTease(s.open, k, { songId, analysis, hook });
    if (!tease) return null;
    s.teases++;
    return { ...tease, songId };
  }

  releaseSuspense(reqId: string | null) {
    const s = this.suspense;
    if (!s) return;
    const analysis = this.env.analysis(s.songId);
    if (!analysis) return this.reject(reqId, 'suspense', 'notReady'); // never: it was decoded to open
    const now = this.env.now();
    const planned = releaseSuspense({
      open: s.open,
      releaseAt: now,
      firstFreeBar: s.nextBar,
      B: { songId: s.songId, analysis, signatures: this.env.signatures?.(s.songId) ?? null },
      rng: seededRandom(s.seed ^ 0x5bd1e995),
      id: s.id,
    });
    const plan: ShowPlan = { ...planned, seed: s.seed, reqId: s.reqId, targetPos: s.targetPos };
    this.suspense = null;
    const overLoop = s.open.loop != null && this.current?.songId === s.open.loop.songId;
    if (overLoop && this.loop) this.loop.until = plan.T; // A repeats its phrase up to the landing
    else this.current = null; // A left as the Suspense opened
    this.transition = {
      id: s.id,
      reqId: s.reqId,
      songId: s.songId,
      targetPos: s.targetPos,
      plan,
      spinStart: plan.spinStart,
      T: plan.T,
      fromSongId: overLoop ? s.fromSongId : null,
      aExitStart: overLoop ? plan.a?.exitStart ?? null : null,
      fromHoldMusic: s.fromHoldMusic,
      afterLanding: null,
    };
    const spinSeed = drumSpinSeed(s.seed);
    this.out.push({ type: 'startTransition', plan, fromHoldMusic: false, drum: { removeId: null, targetId: s.songId, minLaps: 0, brake: true, seed: spinSeed } });
    this.emit({
      type: 'transition.scheduled',
      id: s.id,
      reqId: reqId ?? s.reqId,
      from: s.fromSongId,
      to: s.songId,
      position: s.targetPos,
      phase: plan.phase,
      recipe: plan.recipe,
      recipeName: plan.recipeName,
      exit: plan.exit,
      shape: plan.shape,
      spinStartAtMs: this.env.toEpochMs(plan.spinStart),
      exitAtMs: this.env.toEpochMs(s.open.loopStart),
      landAtMs: this.env.toEpochMs(plan.T),
      durationMs: Math.round(plan.D * 1000),
      hookId: plan.hook.id,
      bpm: plan.b.bpm ?? null,
      drum: { removeId: null, targetId: s.songId, minLaps: 0 },
      spinSeed,
    });
  }

  /**
   * Back, Hold or a cancel during an open Suspense: like a cancelled Spin, nothing lands. A stays if its exit had not
   * started (over A's loop it never left); otherwise Hold music takes over. A cancel (D144, D145) backs the build out
   * (it fades away rather than stops) and goes back to where the Suspense started: Aguanta, or the song playing on.
   */
  cancelSuspense(s: SuspenseState, reason: 'back' | 'hold' | 'cancel') {
    const now = this.env.now();
    // Over A's loop A never left: it plays on from the phrase it is in.
    const overLoop = s.open.loop != null && this.current?.songId === s.open.loop.songId;
    const keepOutgoing = overLoop || (s.fromSongId != null && s.open.a != null && s.open.a.exitStart > now + 0.05 && this.current?.songId === s.fromSongId);
    if (!keepOutgoing) this.current = null;
    if (this.loop?.purpose === 'suspense') this.loop = null;
    this.suspense = null;
    const lastId = this.position >= 0 ? this.queue[this.position] : null;
    const backOut = reason === 'cancel';
    this.out.push({ type: 'cancelTransition', planId: s.id, keepOutgoing, drum: { insertId: lastId, selectId: lastId, ids: this.drumIds(this.position) }, ...(backOut ? { backOut } : {}) });
    this.emit({ type: 'transition.cancelled', id: s.id, reason, keptOutgoing: keepOutgoing, atMs: this.env.toEpochMs(now) });
    if (!backOut || !keepOutgoing) return this.enterHold(reason === 'back' ? 'back' : 'cancel', { music: !keepOutgoing });
    if (s.fromStay) return this.enterHold('hold', { music: false, duck: false });
    // The song plays on, as it did before the Suspense (with the auto-advance off, D145, nothing lands by itself).
    this.status = 'playing';
    this.hold = null;
    this.timers.autoAt = this.autoAdvanceAllowed() ? this.pressAfterRelease(now) : null;
  }

  land(t: Transition) {
    const plan = t.plan;
    const analysis = this.env.analysis(t.songId);
    const duration = analysis?.source?.durationSec ?? plan.hook.downbeatSec + 60;
    this.current = {
      songId: t.songId,
      startCtx: plan.b.startCtx,
      offset: plan.b.offset,
      rate: plan.b.rate,
      landedDownbeatIndex: plan.hook.downbeatIndex ?? null,
      hookId: plan.hook.id,
      endCtx: plan.b.startCtx + (duration - plan.b.offset) / plan.b.rate,
    };
    this.position = t.targetPos;
    this.transition = null;
    this.status = 'playing';
    this.game.songsUntilWinner = Math.max(0, this.game.songsUntilWinner - 1);
    this.history.push({ ...summarize(plan), songId: t.songId, phase: plan.phase });
    const atMs = this.env.toEpochMs(t.T);
    this.landings.push({ songId: t.songId, position: t.targetPos, T: t.T, atMs, undone: false });
    this.journal({ kind: 'song.landed', round: this.round.number, position: t.targetPos, songId: t.songId }, atMs);
    this.out.push({ type: 'landed', planId: t.id, plan });
    const completes = this.phaseStep(t.targetPos)?.completes ?? 0;
    this.emit({ type: 'transition.landed', id: t.id, songId: t.songId, position: t.targetPos, atMs: this.env.toEpochMs(t.T) });
    this.scheduleHeatSample(t.T, t.targetPos);
    this.updateNudge();
    if (t.afterLanding === 'back') this.undo();
    else if (t.afterLanding === 'hold' || t.afterLanding === 'claim') this.enterHold(t.afterLanding, { music: false });
    // A Suspense pressed in the Spin's last moment (D177): B is held, so the new song goes into Aguanta.
    else if (t.afterLanding === 'stay') this.enterHold('hold', { music: false, duck: false });
    else this.scheduleAuto(t.T, completes);
    this.prefetch();
    this.emitState();
  }

  /** `completes`: cards this landing probably completes. */
  scheduleAuto(landedAt: number, completes = 0) {
    this.timers.autoAt = this.autoAdvanceAllowed() ? this.autoPressAfter(landedAt, completes, landedAt) : null;
  }

  /**
   * When the automatic Next presses after a landing at `landedAt`: timed back from the playing song's phrase
   * boundary nearest the slot (pace.ts alignedPress), else one slot after the landing. Never before `earliest`.
   */
  autoPressAfter(landedAt: number, completes: number, earliest: number): number {
    const timing = { pace: this.songPace(), phase: this.phaseName(), nudge: this.nudge, minStretch: completes > 0 ? PACE.completionStretch : 1 };
    const slot = slotSec(timing);
    // A slot stretched for a Claim is a minimum: the landing never comes sooner.
    const aligned = this.phrasePress(landedAt + slot, slot, Math.max(earliest, landedAt + PACE.minSoloSec), completes > 0 ? 1 : undefined);
    return aligned ?? Math.max(earliest, autoPressAt({ landedAt, ...timing }));
  }

  /**
   * The press for a landing on the playing song's 4- or 8-bar phrase boundary near `idealLandAt`, counted from
   * the hook it landed on; null when it has none in reach.
   */
  phrasePress(idealLandAt: number, slot: number, earliestPress: number, minShare?: number): number | null {
    const cur = this.current;
    const analysis = cur ? this.env.analysis(cur.songId) : null;
    if (!cur || !analysis || cur.landedDownbeatIndex == null) return null;
    const grid = deckTimeline(analysis, cur, cur.landedDownbeatIndex);
    // A bridge on a slower B lands a little later than A's boundary: leave it room under the Spin's limit.
    const dTarget = Math.min(this.spin().dTarget, PACE.alignedSpinMaxSec);
    const aligned = alignedPress({ grid, idealLandAt, slot, dTarget, earliestPress, latestLand: cur.endCtx - PACE.endMarginSec, lookaheadSec: LOOKAHEAD_SEC, minShare });
    return aligned?.pressAt ?? null;
  }

  autoAdvanceAllowed() {
    if (this.position + 1 >= this.queue.length) return false;
    // The Desgraciat round: never take out the last card standing by itself.
    if (this.phaseModel.kind === 'standing' && this.phaseModel.valid.length && this.standingNow().length <= 1) return false;
    // The finale: never past its winner, nor past its last finalist standing (D169).
    const finale = this.finaleInfo();
    if (finale && (finale.winner || finale.standing.length <= 1)) return false;
    const phase = this.phaseName();
    return phase === 'final' ? this.game.autoAdvanceFinal : this.game.autoAdvance;
  }

  // -------------------------------------------------------------------------------------- Hold
  /** `duck` false: Aguanta (Stay), the song at full volume. */
  holdOn(reqId: string | null, duck = true) {
    if (this.status === 'hold') return;
    void reqId;
    if (this.transition) this.cancel(this.transition, 'hold');
    else if (this.suspense) this.cancelSuspense(this.suspense, 'hold');
    else {
      if (this.pending) this.pending = null;
      this.enterHold('hold', { music: !this.current, duck });
      return;
    }
    if (!duck) this.holdMode(false);
  }

  /**
   * Switch a Hold between Parlem (ducked; Hold music may take over after its delay) and Aguanta (the song at full
   * volume, no Hold music). On Hold music there is no song to bring back, so it stays as it is.
   */
  holdMode(duck: boolean) {
    const hold = this.hold;
    if (!hold || hold.ducked === duck || !this.current || this.holdMusic) return;
    hold.ducked = duck;
    this.out.push({ type: 'duck', db: duck ? this.parlemDb() : 0, seconds: duck ? HOLD.duckSec : HOLD.releaseSec });
    this.timers.holdMusicAt = duck && this.game.holdMusicOn !== false ? Math.max(this.env.now() + 1, hold.since + this.game.holdMusicAfterSec) : null;
  }

  release(reqId: string | null) {
    if (this.status !== 'hold') return this.reject(reqId, 'hold', 'notHolding');
    if (this.current) {
      this.leaveHold(HOLD.releaseSec);
      this.status = 'playing';
      const now = this.env.now();
      this.timers.autoAt = this.autoAdvanceAllowed() ? this.pressAfterRelease(now) : null;
      return;
    }
    // On Hold music there is no song to go back to: releasing the Hold moves on to the next song.
    this.next(reqId);
  }

  /** After a Hold is released with the song still playing: let it breathe, then land on one of its phrases. */
  pressAfterRelease(now: number): number {
    const timing = { pace: this.songPace(), phase: this.phaseName(), nudge: this.nudge };
    const press = pressAfterHold({ now, ...timing });
    const { slot, dTarget } = spinWindow(timing);
    return this.phrasePress(press + LOOKAHEAD_SEC + dTarget, slot, now + PACE.minAfterHoldSec) ?? press;
  }

  enterHold(reason: HoldReason, { music, musicDelaySec = 0, duck = true }: { music: boolean; musicDelaySec?: number; duck?: boolean }) {
    const now = this.env.now();
    this.status = 'hold';
    this.hold = { since: now, reason, ducked: true };
    this.timers.autoAt = null;
    if (music || !this.current) {
      this.timers.holdMusicAt = null;
      if (this.current) this.toHoldMusic();
      else this.startHoldMusic(now + musicDelaySec);
    } else if (!duck) {
      // Aguanta: the song keeps playing at full volume; no Hold music takes over.
      this.hold.ducked = false;
      this.timers.holdMusicAt = null;
    } else {
      this.out.push({ type: 'duck', db: this.parlemDb(), seconds: HOLD.duckSec });
      // With Hold music off the ducked song stays (it still hands over if it runs out).
      this.timers.holdMusicAt = this.game.holdMusicOn === false ? null : now + this.game.holdMusicAfterSec;
    }
  }

  leaveHold(seconds: number) {
    if (this.current) this.out.push({ type: 'duck', db: 0, seconds });
    this.hold = null;
    this.timers.holdMusicAt = null;
    // Leaving Aguanta: the song plays on from the phrase it is in, into the rest of it.
    if (this.loop?.purpose === 'stay') this.loop = null;
  }

  // ---------------------------------------------------------------------------------- the phrase loop
  /**
   * A song left playing never hands over to other music by itself (D239): in Aguanta (a Hold at full volume), or
   * with auto-advance off and nobody pressing Next, near its end its last full phrase (8 bars, else 4, before the
   * outro) starts repeating, else its last 4 bars. Only a song too short or with no beat grid still runs out (into
   * Hold music, as before).
   */
  tickStay(now: number) {
    const cur = this.current;
    if (!cur || this.loop || this.holdMusic || this.transition || this.pending || this.suspense) return;
    const leftPlaying = this.status === 'hold'
      ? this.hold != null && !this.hold.ducked
      : this.status === 'playing' && !this.autoAdvanceAllowed();
    if (!leftPlaying || now < cur.endCtx - LOOP.stayLookSec) return;
    const analysis = this.env.analysis(cur.songId);
    if (!analysis) return;
    const after = now + LOOP.aheadSec + 0.05;
    const phrase = lastPhraseLoop({ analysis, deck: cur, landedDownbeatIndex: cur.landedDownbeatIndex }, after, LOOP.stayTailSec)
      ?? lastBarsLoop({ analysis, deck: cur }, after, LOOP.stayTailSec);
    if (phrase) this.loop = { songId: cur.songId, phrase, nextAt: firstRepeatAt(cur, phrase), until: null, purpose: 'stay' };
  }

  /** Re-cue each repeat of the loop a moment ahead; the playing song's clock follows it. */
  tickLoop(now: number) {
    const loop = this.loop;
    const cur = this.current;
    if (!loop) return;
    if (!cur || cur.songId !== loop.songId) {
      this.loop = null;
      return;
    }
    while (now >= loop.nextAt - LOOP.aheadSec && (loop.until == null || loop.nextAt < loop.until - 1e-6)) {
      const at = loop.nextAt;
      const endPos = cur.offset + (cur.endCtx - cur.startCtx) * cur.rate;
      this.out.push({ type: 'cue', songId: cur.songId, at, offset: loop.phrase.fromSec });
      cur.startCtx = at;
      cur.offset = loop.phrase.fromSec;
      cur.endCtx = at + (endPos - loop.phrase.fromSec) / cur.rate;
      loop.nextAt = at + loopSeconds(cur, loop.phrase);
    }
  }

  startHoldMusic(at: number) {
    if (this.holdMusic) return;
    const mood = this.holdMood();
    // Scene music playing (the Interval's, the Celebration's) cross-fades to it.
    this.out.push({ type: 'holdMusic', at, levelDb: HOLD.holdMusicLevelDb, fadeSec: HOLD.holdMusicFadeInSec, mood, switch: this.bed != null });
    this.holdMusic = true;
    this.holdMusicMood = mood;
    this.bed = null;
  }

  holdMood(): HoldMood {
    return this.hold?.reason === 'back' || this.hold?.reason === 'checkFailed' ? 'error' : 'hold';
  }

  // The ducked song hands over to Hold music (a long Hold, or the song is running out).
  toHoldMusic() {
    if (this.current) {
      const mood = this.holdMood();
      this.out.push({ type: 'songToHoldMusic', fadeSec: 3, mood });
      this.current = null;
      this.holdMusic = true;
      this.holdMusicMood = mood;
    } else this.startHoldMusic(this.env.now());
  }

  /** Hold music of `mood` now: the song washes out into it, or other music (another mood, a bed) cross-fades to it. */
  switchToHoldMusic(mood: HoldMood) {
    this.timers.holdMusicAt = null;
    if (this.current) {
      this.out.push({ type: 'songToHoldMusic', fadeSec: 3, mood });
      this.current = null;
    } else if (!this.holdMusic || this.bed != null || this.holdMusicMood !== mood) {
      const now = this.env.now();
      this.out.push({ type: 'holdMusic', at: now, levelDb: HOLD.holdMusicLevelDb, fadeSec: HOLD.holdMusicFadeInSec, mood, switch: this.holdMusic || this.bed != null });
    }
    this.holdMusic = true;
    this.holdMusicMood = mood;
    this.bed = null;
  }

  holdMusicNow() {
    if (this.transition) {
      this.cancel(this.transition, 'hold');
      if (this.transition) return; // too close to the landing: it holds right after
    }
    if (this.status !== 'hold') this.enterHold('music', { music: true });
    else this.toHoldMusic();
  }

  // -------------------------------------------------------------------------------------- Back
  back(reqId: string | null) {
    if (this.pending) {
      this.pending = null;
      this.enterHold('back', { music: !this.current });
      return;
    }
    if (this.transition) return this.cancel(this.transition, 'back');
    if (this.suspense) return this.cancelSuspense(this.suspense, 'back');
    if (this.position < 0) return this.reject(reqId, 'back', 'nothingToUndo');
    this.undo();
  }

  // Undo the last landing: that song stops counting and becomes the next song again. The Queue's order
  // is untouched; only the position moves back. The drum turns back one card; Hold and Hold music.
  undo() {
    const undoneId = this.queue[this.position];
    const now = this.env.now();
    if (this.current) {
      this.out.push({ type: 'duck', db: 0, seconds: 0.03 });
      this.out.push({ type: 'rewind', songId: this.current.songId });
      this.current = null;
    }
    const landing = [...this.landings].reverse().find((l) => !l.undone && l.position === this.position);
    if (landing) landing.undone = true;
    this.position -= 1;
    this.game.songsUntilWinner += 1;
    this.journal({ kind: 'landing.undone', round: this.round.number, position: this.position + 1, songId: undoneId });
    this.heatSample = null;
    // Undecided Claims survive a Back; their Checks are out of date and wait to be run again.
    if (this.scene === 'check') this.requeueClaims();
    const prevId = this.position >= 0 ? this.queue[this.position] : null;
    this.out.push({ type: 'drumBack', insertId: prevId, selectId: prevId, ids: this.drumIds(this.position) });
    this.enterHold('back', { music: true, musicDelaySec: HOLD.rewindSec * 0.8 });
    this.emit({ type: 'landing.undone', songId: undoneId, position: this.position + 1, atMs: this.env.toEpochMs(now) });
    this.prefetch();
  }

  // Cancel the running Spin `t` (Back or Hold pressed during it). The outgoing song stays if its exit move
  // has not started; otherwise Hold music takes over. Too close to the landing, act right after it.
  cancel(t: Transition, reason: 'back' | 'hold') {
    const now = this.env.now();
    if (t.T - now < HOLD.cancelMinSec) {
      t.afterLanding = reason;
      return;
    }
    const keepOutgoing = t.fromSongId != null && t.aExitStart != null && t.aExitStart > now + 0.05 && this.current?.songId === t.fromSongId;
    if (!keepOutgoing) this.current = null;
    if (this.loop?.purpose === 'suspense') this.loop = null; // a released Suspense's A plays on from its phrase
    this.transition = null;
    const lastId = this.position >= 0 ? this.queue[this.position] : null;
    this.out.push({ type: 'cancelTransition', planId: t.id, keepOutgoing, drum: { insertId: lastId, selectId: lastId, ids: this.drumIds(this.position) } });
    this.emit({ type: 'transition.cancelled', id: t.id, reason, keptOutgoing: keepOutgoing, atMs: this.env.toEpochMs(now) });
    this.enterHold(reason === 'back' ? 'back' : 'cancel', { music: !keepOutgoing });
  }

  // ------------------------------------------------------------------------------------ settings
  setPace({ pace, delta, locked }: CommandFields['setPace']) {
    let value = pace ?? this.game.pace;
    if (delta != null) value += delta;
    this.game.pace = Math.min(PACE_LIMITS[1], Math.max(PACE_LIMITS[0], value));
    if (locked != null) this.game.paceLocked = locked;
    this.journal({ kind: 'settings.changed', settings: this.journalSettings() });
    this.updateNudge();
    this.rescheduleAuto();
  }

  setGame(fields: CommandFields['setGame']) {
    for (const key of SET_GAME_FIELDS) assignDefined(this.game, fields, key);
    this.journal({ kind: 'settings.changed', settings: this.journalSettings() });
    this.rescheduleAuto();
    // Hold music switched on or off in a Hold with the song ducked: its timed switch goes or comes back.
    if (fields.holdMusicOn != null && this.status === 'hold' && this.hold && this.current && !this.holdMusic) {
      this.timers.holdMusicAt = fields.holdMusicOn ? Math.max(this.env.now() + 1, this.hold.since + this.game.holdMusicAfterSec) : null;
    }
  }

  rescheduleAuto() {
    if (this.status !== 'playing') return;
    const last = [...this.landings].reverse().find((l) => !l.undone);
    if (!last || !this.autoAdvanceAllowed()) {
      this.timers.autoAt = null;
      return;
    }
    const completes = this.phaseStep(last.position)?.completes ?? 0;
    this.timers.autoAt = this.autoPressAfter(last.T, completes, this.env.now() + 1);
  }

  panic() {
    this.announceCancel('panic');
    this.setSoundTest(null);
    this.cutVoice();
    this.releasePad({ land: false });
    this.dropPause(); // nothing saved comes back
    this.endThrow(0.3);
    this.out.push({ type: 'stopAll', fadeSec: 0.3 });
    this.stopCheck(); // a running Check goes back to the queue
    this.current = null;
    this.transition = null;
    this.suspense = null;
    this.pending = null;
    this.hold = null;
    this.holdMusic = false;
    this.bed = null;
    this.loop = null;
    this.timers = { autoAt: null, holdMusicAt: null };
    this.status = 'idle';
  }

  /** A Spin or Suspense that Panic or a new round stops: nothing lands, and the remotes stop their Spin. */
  announceCancel(reason: 'panic' | 'newRound') {
    const id = this.transition?.id ?? this.suspense?.id;
    if (!id) return;
    const keptOutgoing = false;
    this.emit({ type: 'transition.cancelled', id, reason, keptOutgoing, atMs: this.env.nowMs() });
  }

  // Choose the next song's hook as soon as it is decoded, and ask for its Blend render (B's bars before the
  // hook stretched to the current song's tempo) when the two tempos can be matched.
  prepareNext() {
    const nextId = this.queue[this.position + 1];
    if (nextId == null) return;
    const analysis = this.env.analysis(nextId);
    if (!analysis) return;
    if (this.nextHook?.songId !== nextId) {
      const spin = this.spin();
      const rng = seededRandom(Math.floor(this.env.random() * 2 ** 32) >>> 0);
      const hook = pickHook(analysis, this.hookPhase(PHASES[this.phaseName()], nextId), this.history, rng, { minTailSec: Math.min(12, spin.slot + 2) });
      this.nextHook = hook ? { songId: nextId, hook } : null;
      this.blendRequested = '';
    }
    const cur = this.current;
    if (!this.nextHook || !cur) return;
    const key = `${cur.songId}:${this.nextHook.hook.id}`;
    if (this.blendRequested === key) return;
    this.blendRequested = key;
    const aAnalysis = this.env.analysis(cur.songId);
    if (!aAnalysis) return;
    const match = tempoMatch(aAnalysis.tempo.bpm, analysis.tempo.bpm);
    if (match.pairClass === 'none') return;
    this.out.push({
      type: 'prepareBlend', aSongId: cur.songId, aBpm: aAnalysis.tempo.bpm, aHookId: cur.hookId, bSongId: nextId,
      hookId: this.nextHook.hook.id, beatsPerBar: analysis.tempo.beatsPerBar ?? 4, tight: match.pairClass === 'tight',
    });
  }

  // ------------------------------------------------------------------------------------ Phase
  /**
   * The Phase plan and the round's expected songs from its Queue and valid cards. When the songs change, the
   * round's target end moves with them, so the Drift measures only time lost, never a different count: the target
   * itself while the round starts (before it is journaled), else `targetShiftSec`; nothing when resuming from the
   * journal, whose target already counts them.
   */
  rebuildPhase({ songsMove = 'shift' }: { songsMove?: 'target' | 'shift' | 'none' } = {}) {
    const m = this.phaseModel;
    m.valid = validCards(this.allCards, this.cardsInPlay, this.round.cardType, this.round.side);
    if (!m.valid.length) m.plan = null;
    else if (m.kind === 'standing') m.plan = standingPlan({ cards: m.valid, queue: this.queue, startPosition: m.start, seed: m.seed });
    else m.plan = phasePlan({ cards: m.valid, queue: this.queue, kind: m.kind, startPosition: m.start, seed: m.seed, cardsInPlayCount: m.valid.length });
    const before = this.roundSlots();
    const end = !m.valid.length || !this.queue.length ? null
      : this.round.kind === 'desgraciat' ? standingCourse(m.valid, this.queue).lastStandingAt
      : firstWinAt(m.valid, this.queue, 'bingo')?.index ?? null;
    this.expectedSongs = end == null ? null : end + 1;
    const moveSec = (this.roundSlots() - before) * this.game.pace;
    if (songsMove === 'target' && this.round.targetEndMs) this.round.targetEndMs += 1000 * moveSec;
    else if (songsMove === 'shift') this.targetShiftSec += moveSec;
  }

  // A claimed Line passed its Check: from the next song the Phase climbs again, towards the Bingo.
  confirmLine() {
    if (this.round.lineConfirmed || this.round.kind === 'desgraciat') return;
    this.round.lineConfirmed = true;
    this.phaseModel.kind = 'bingo';
    this.phaseModel.start = this.position + 1;
    this.journal({ kind: 'line.confirmed', round: this.round.number, fromPosition: this.phaseModel.start });
    this.rebuildPhase();
    this.rescheduleAuto();
  }

  /** `position`: the Queue index of a landing. */
  phaseStep(position: number): PhaseStep | null {
    const m = this.phaseModel;
    return m.plan?.[position - m.start] ?? null;
  }

  // ---------------------------------------------------------------------------------- show flow
  sceneContext(): SceneContext {
    return {
      scene: this.scene, celebrating: this.celebration?.kind ?? null, introduced: this.intro != null, paused: this.pause != null,
      intervalMusic: this.pause != null || this.bed === 'interval',
      lastRound: this.isLastRound(),
      reviewing: this.check?.info.reviewing === true,
    };
  }

  /**
   * Move to another scene: journaled (a resumed Game comes back in it) and announced to the projector. `again`: also
   * when it is the scene already (a test jump to an intro from a round's start, which another round's intro replaces).
   */
  setScene(scene: ShowScene, round = this.round.number, roundKind: RoundKind = this.round.kind, cardType: string = this.round.cardType, side: number = this.round.side, { again = false }: { again?: boolean } = {}) {
    if (scene === this.scene && !again) return;
    this.setSoundTest(null); // a scene change ends the sound test (D229)
    const previous = this.scene;
    const atMs = this.env.nowMs();
    this.scene = scene;
    this.endThrow();
    if (previous === 'celebration') this.out.push({ type: 'bedDuck', db: 0, seconds: HOLD.releaseSec });
    if (this.pause) this.out.push({ type: 'pauseOverlay', on: this.pauseOverlay() });
    this.sceneSinceMs = atMs;
    this.journal({ kind: 'scene.changed', scene, round, roundKind, cardType, ...(side !== DEFAULT_SIDE ? { side } : {}) }, atMs);
    this.emit({ type: 'scene.changed', scene, previous, atMs });
  }

  /** The first Spin of a fresh Game, or of a round whose Shuffle has run: the round is in play. */
  startPlaying() {
    if (this.scene === 'before' || this.scene === 'roundStart') this.setScene('play');
  }

  /** A Hold for the show flow (Check, Celebration, Interval): no song lands; the scene's music is set apart. */
  flowHold(reason: HoldReason) {
    this.status = 'hold';
    this.hold = { since: this.hold?.since ?? this.env.now(), reason, ducked: this.hold?.ducked ?? true };
    this.timers = { autoAt: null, holdMusicAt: this.timers.holdMusicAt };
  }

  tickFlow(now: number) {
    let changed = false;
    // The Shuffle's animation is over: the round is in play, and a Next pressed meanwhile starts.
    if (this.shuffle && now >= this.shuffle.endAt) {
      this.shuffle = null;
      this.startPlaying();
      changed = true;
    }
    const p = this.pending;
    if (p && this.shuffle == null && this.env.isDecoded(p.songId)) {
      this.pending = null;
      this.beginTransition(p.reqId, p.songId, p.targetPos);
      changed = true;
    }
    if (this.tickCheck(now)) changed = true;
    if (this.maybeAutoCheck()) changed = true;
    // A Bingo's (or the last card standing's) Celebration flows into the Interval by itself, so the show never stalls.
    const c = this.celebration;
    if (this.scene === 'celebration' && c != null && c.kind !== 'line' && !this.pause && this.env.nowMs() >= c.sinceMs + FLOW.celebration.toIntervalSec * 1000) {
      this.startInterval();
      changed = true;
    }
    if (changed) this.emitState();
  }

  // ---------------------------------------------------------------------------------- Claims and the Check
  /**
   * A Claim: the round stops like a Hold, the Claim queues, and its Check comes on screen when nothing is in the way
   * (nothing revealed: the first reveal waits for a press, D107).
   */
  claim(cardId: number, kind: WinKind) {
    const from = this.scene;
    // A Spin in flight is cancelled like Hold does ('hold'); too close to its landing, the Hold comes right after.
    this.holdOn(null);
    if (this.transition?.afterLanding === 'hold') this.transition.afterLanding = 'claim';
    // A claim in Aguanta: the song ducks under the presenters, as in Parlem.
    if (this.hold && !this.hold.ducked) this.holdMode(true);
    if (this.hold) this.hold.reason = 'claim';
    const atMs = this.env.nowMs();
    const known = this.allCards.some((c) => c.id === cardId);
    const claim: ClaimInfo = {
      claimId: `cl-${++this.claimCount}`, round: this.round.number, cardId, kind, atMs, position: this.position,
      status: 'queued', outcome: null, completeSince: null, warnings: known && !this.cardsInPlay.includes(cardId) ? ['notSold'] : [],
      markedCard: [], revealUntil: null, cueNext: false,
    };
    this.evaluate(claim); // the console sees the whole card marked from the claim on (D108)
    this.claims.push(claim);
    this.journal({ kind: 'claim.opened', round: claim.round, claimId: claim.claimId, cardId, winKind: kind, position: claim.position }, atMs);
    this.emit({ type: 'claim.opened', claim: copyClaim(claim) });
    if (from !== 'check') {
      // A Claim during a Celebration (a late one): the Celebration comes back if no Claim of this Check is valid.
      this.batch = { claimIds: [], celebration: from === 'celebration' ? this.celebration : null };
      this.celebration = null;
      this.setScene('check');
    }
    (this.batch ??= { claimIds: [], celebration: null }).claimIds.push(claim.claimId);
    // A new card to check: the Celebration waits for it.
    this.celebrationNext = null;
    this.autoCheck = true;
  }

  /** A claim's card numbers that aren't printed cards (D126); none when no cards are loaded (nothing to check against). */
  unknownCards(cardIds: readonly number[]): number[] {
    if (!this.allCards.length) return [];
    return cardIds.filter((id) => !this.allCards.some((c) => c.id === id));
  }

  /** The Claim `claimId` if it is this round's and still undecided; otherwise reject the command. */
  undecidedClaim(reqId: string | null, cmd: string, claimId: string): ClaimInfo | null {
    const claim = this.claims.find((c) => c.claimId === claimId);
    if (!claim) {
      this.reject(reqId, cmd, 'unknownClaim', `no claim ${claimId} in round ${this.round.number}`);
      return null;
    }
    if (settled(claim)) {
      this.reject(reqId, cmd, 'unknownClaim', `claim ${claimId} is already decided`);
      return null;
    }
    return claim;
  }

  /**
   * Put the next Claim's Check on screen when one is due and nothing is in the way: none on screen still undecided, a
   * cued one's moment over. A Claim under review comes first (a resumed Game shows it again), then the queue.
   */
  maybeAutoCheck(): boolean {
    if (!this.autoCheck || this.scene !== 'check' || this.pause || this.transition || this.suspense) return false;
    const run = this.check;
    if (run && run.info.cue == null) return false;
    if (run?.nextAt != null && this.env.now() < run.nextAt) return false;
    const next = this.claims.find((c) => c.status === 'reviewing') ?? this.claims.find((c) => c.status === 'queued');
    this.autoCheck = false;
    if (!next) return false;
    this.showCheck(next);
    return true;
  }

  /** What the card shows from the counted landings now (game/check.ts); the Claim's PRIVATE view follows it. */
  evaluate(claim: ClaimInfo): CheckResult {
    const result = computeCheck({
      allCards: this.allCards, cardId: claim.cardId, kind: claim.kind, cardType: this.round.cardType, side: this.round.side,
      cardsInPlay: new Set(this.cardsInPlay), queue: this.queue, position: this.position,
    });
    claim.outcome = result.outcome;
    claim.completeSince = result.completeSince;
    // A decision by hand keeps its warning (notPassing, wouldPass).
    claim.warnings = [...result.warnings, ...claim.warnings.filter((w) => w === 'notPassing' || w === 'wouldPass')];
    claim.markedCard = result.markedCard.map((s) => ({ ...s }));
    claim.revealUntil = result.revealUntil;
    claim.cueNext = false;
    return result;
  }

  /**
   * A Claim's Check on screen from the counted landings now, nothing revealed (D107): its first reveal waits for a
   * press, and the music from before the Check plays on at the Claim's level until then. A Claim under review comes
   * back under review.
   */
  showCheck(claim: ClaimInfo) {
    this.stopCheck();
    const result = this.evaluate(claim);
    const reviewing = claim.status === 'reviewing';
    if (!reviewing) claim.status = 'checking';
    claim.cueNext = result.revealUntil == null; // nothing to reveal (wrongType): the first press is the cue
    const info: CheckInfo = {
      claimId: claim.claimId, cardId: claim.cardId, kind: claim.kind, outcome: result.outcome, row: result.row, otherRows: result.otherRows,
      // The printed card's type: the projector shows it as the Check's first step (and a wrongType fails on it).
      cardType: this.allCards.find((c) => c.id === claim.cardId)?.type ?? null, side: this.round.side,
      startAtMs: this.env.nowMs(), total: result.steps.length, revealed: [], auto: false, cue: null, reviewing,
    };
    // A Claim under review comes back from where it was (D121): its earlier reveals as marks, no song replayed, the
    // next reveal waiting for a press. Only while the card still checks the same way (a Back can change it).
    const marks = reviewing ? this.reviewMarks.get(claim.claimId) : undefined;
    this.reviewMarks.delete(claim.claimId);
    const still = marks && marks.revealed.length <= result.steps.length && marks.revealed.every((m, i) => result.steps[i].songId === m.songId && result.steps[i].landed === m.landed);
    if (still) info.revealed = marks.revealed.map((m) => ({ ...m }));
    this.check = { info, songs: result.steps, until: result.revealUntil, autoOff: still ? marks.autoOff : false, awaitPress: true, autoAt: null, soundEndAt: null, nextAt: null, failAt: null };
    // The music is far down once something is revealed, as it was before the Check left the screen.
    if (still && info.revealed.length) this.out.push({ type: 'checkDuck', on: true });
    this.emit({ type: 'check.started', check: this.checkInfo()! });
  }

  /** Take the Check off screen: its sounds stop and the music comes back up; one still revealing goes back to the queue. */
  stopCheck() {
    const run = this.check;
    if (!run) return;
    this.check = null;
    // Under review, its marks wait for it to come back on screen (D121).
    if (run.info.reviewing && run.info.revealed.length) this.reviewMarks.set(run.info.claimId, { revealed: run.info.revealed.map((m) => ({ ...m })), autoOff: run.autoOff });
    this.out.push({ type: 'cancelCheck', claimId: run.info.claimId });
    const claim = this.claims.find((c) => c.claimId === run.info.claimId);
    if (claim?.status === 'checking') claim.status = 'queued';
    if (claim) claim.cueNext = false;
  }

  /** After a Back: the undecided Claims' Checks are out of date; they wait to be run again (one under review stays so). */
  requeueClaims() {
    this.stopCheck();
    for (const c of this.claims) {
      if (settled(c)) continue;
      if (c.status === 'checking') c.status = 'queued';
      this.evaluate(c);
    }
    this.celebrationNext = null;
    this.autoCheck = false;
  }

  /** Whether a Claim's card passes its Check from the counted landings now (evaluated if it hasn't run yet). */
  passes(claim: ClaimInfo): boolean {
    if (claim.outcome == null) this.evaluate(claim);
    return isPassingOutcome(claim.outcome, claim.kind);
  }

  /** Auto reveals on this Check now (D117, D134): on, not turned off for it, after its first press, before its cue. */
  autoRevealing(run: CheckRun): boolean {
    return this.checkAutoOn && !run.autoOff && !run.awaitPress && !run.info.reviewing && run.info.cue == null && !this.pause;
  }

  /**
   * `checkNext` (D107): the press that expects `step`. The next song's index reveals it; once the reveals stop, the
   * revealed count is the cue; with `celebrationNext`, its step starts the shared Celebration. Anything else is a
   * press that came late or twice: ignored, silently.
   */
  checkNext(claimId: string, step: number) {
    const cn = this.celebrationNext;
    if (cn) {
      if (cn.claimId === claimId && cn.step === step) {
        this.celebrationNext = null;
        this.finishBatch(true);
      }
      return;
    }
    const run = this.check;
    if (!run || run.info.claimId !== claimId || run.info.reviewing || run.info.cue != null) return;
    if (step !== run.info.revealed.length) return;
    const claim = this.claims.find((c) => c.claimId === claimId);
    if (!claim) return;
    if (claim.cueNext) this.cue(run, claim, this.passes(claim));
    else this.reveal(run, claim);
  }

  /** Reveal the Check's next song (the song from its hook on, the broken record or the knock), just ahead so sound and
   * screens meet. */
  reveal(run: CheckRun, claim: ClaimInfo) {
    const k = run.info.revealed.length;
    const song = run.songs[k];
    if (!song) return;
    const at = this.env.now() + FLOW.check.revealLeadSec;
    const { sound, durationSec } = stepSound(song, claim.kind, FLOW.check);
    // From the first reveal the music goes far down under the sounds (U85: as before, for now).
    if (k === 0) this.out.push({ type: 'checkDuck', on: true });
    const next = run.until != null && k < run.until ? run.songs[k + 1] : undefined;
    this.out.push({ type: 'checkReveal', claimId: claim.claimId, step: { ...song, at, durationSec, sound }, nextSongId: next?.landed ? next.songId : null });
    const step: CheckStep = { songId: song.songId, landed: song.landed, atMs: this.env.toEpochMs(at), durationMs: Math.round(durationSec * 1000) };
    run.info.revealed.push(step);
    run.awaitPress = false;
    run.soundEndAt = at + durationSec;
    claim.cueNext = run.until == null || k >= run.until;
    run.autoAt = this.autoRevealing(run) ? run.soundEndAt + FLOW.check.gapSec : null;
    this.emit({ type: 'check.revealed', claimId: claim.claimId, index: k, step: { ...step } });
  }

  /**
   * "Enrere" inside a Check (D127, D134): the mark at `step`, the last revealed, goes, and that cell is next again; the
   * previous song plays again from its hook, or at none the music from before the Check comes back up. Auto turns off
   * for this Check. Only while revealing: a press that doesn't match is ignored, silently.
   */
  checkBack(claimId: string, step: number) {
    const run = this.check;
    if (!run || run.info.claimId !== claimId || run.info.reviewing || run.info.cue != null) return;
    const revealed = run.info.revealed;
    if (!revealed.length || step !== revealed.length - 1) return;
    const claim = this.claims.find((c) => c.claimId === claimId);
    if (!claim) return;
    revealed.pop();
    run.autoOff = true;
    run.autoAt = null;
    claim.cueNext = false;
    const now = this.env.now();
    this.emit({ type: 'check.unrevealed', claimId, index: step, atMs: this.env.toEpochMs(now) });
    const prev = run.songs[step - 1];
    if (!prev) {
      run.soundEndAt = null;
      this.out.push({ type: 'checkDuck', on: false });
      return;
    }
    const at = now + FLOW.check.revealLeadSec;
    const { sound, durationSec } = stepSound(prev, claim.kind, FLOW.check);
    const next = run.songs[step];
    this.out.push({ type: 'checkReveal', claimId, step: { ...prev, at, durationSec, sound }, nextSongId: next?.landed ? next.songId : null });
    run.soundEndAt = at + durationSec;
  }

  /** `checkAuto` (D117): reveal in a row while on. Turning it on reveals at once a Check waiting for its first press. */
  setCheckAuto(on: boolean) {
    this.checkAutoOn = on;
    const run = this.check;
    if (!run) return;
    if (!on) {
      run.autoAt = null;
      return;
    }
    run.autoOff = false; // asked for again by hand: this Check reveals by itself after all
    if (run.info.reviewing || run.info.cue != null) return;
    run.awaitPress = false;
    const now = this.env.now();
    run.autoAt = Math.max(now, (run.soundEndAt ?? now) + (run.soundEndAt != null ? FLOW.check.gapSec : 0));
    // Due now (nothing sounding): the reveal comes with this press of the toggle.
    if (run.autoAt <= now) this.tickCheck(now);
  }

  /** The automatic reveals and the next card's turn, as the clock passes them. */
  tickCheck(now: number): boolean {
    const run = this.check;
    if (!run) return false;
    if (run.autoAt != null && now >= run.autoAt) {
      run.autoAt = null;
      if (!this.autoRevealing(run)) return false;
      const claim = this.claims.find((c) => c.claimId === run.info.claimId);
      if (!claim) return false;
      if (claim.cueNext) this.cue(run, claim, this.passes(claim));
      else this.reveal(run, claim);
      return true;
    }
    if (run.nextAt != null && now >= run.nextAt && this.autoCheck) return this.maybeAutoCheck();
    if (run.failAt != null && now >= run.failAt) {
      run.failAt = null;
      // A claim that came in meanwhile is checked first.
      if (this.claims.some((c) => c.status === 'queued' || c.status === 'reviewing')) {
        this.autoCheck = true;
        return this.maybeAutoCheck();
      }
      this.finishBatch(false);
      return true;
    }
    return false;
  }

  /**
   * The cue (D109, D110): the card passed (valid) or failed, by its reveals or a Review's decision by hand. A pass that
   * isn't the batch's last card shows its plaque with no fanfare; a fail plays the fail moment. Then the next card's
   * Check comes on screen by itself after a moment, or (none left) the batch ends.
   */
  cue(run: CheckRun, claim: ClaimInfo, pass: boolean, manual = false) {
    const atMs = this.env.nowMs();
    run.autoAt = null;
    run.awaitPress = false;
    run.info.cue = pass ? 'pass' : 'fail';
    run.info.reviewing = false;
    claim.cueNext = false;
    this.out.push({ type: 'cancelCheck', claimId: claim.claimId });
    this.decide(claim, pass, manual);
    this.emit({ type: 'check.cue', claimId: claim.claimId, cue: run.info.cue, ...(manual ? { manual: true } : {}), atMs });
    const more = this.claims.some((c) => c.status === 'queued' || c.status === 'reviewing');
    if (!pass) this.out.push({ type: 'sfx', name: FLOW.failureFanfare, volume: 'failFx' });
    if (more) {
      run.nextAt = this.env.now() + FLOW.check.nextCardSec;
      this.autoCheck = true;
      return;
    }
    if (pass) return this.finishBatch(true);
    // The last card failed: the Celebration of an earlier one waits for one more press; else its ✗ shows for a moment,
    // as between two cards, and the round goes back to the fail moment's Hold.
    if (this.batchWinners().length) this.celebrationNext = { claimId: claim.claimId, step: run.info.revealed.length + 1 };
    else run.failAt = this.env.now() + FLOW.check.nextCardSec;
  }

  /** A Claim decided by its cue (or by hand from a Review), journaled. A valid Claim makes a Winner. */
  decide(claim: ClaimInfo, valid: boolean, manual = false) {
    if (claim.outcome == null) this.evaluate(claim); // still note when it completed
    const verdict = valid ? 'valid' : 'invalid';
    claim.status = verdict;
    const atMs = this.env.nowMs();
    // A Winner's position is the Winning song's (the card's completion), else the landing it was claimed on.
    const position = valid ? claim.completeSince ?? claim.position : claim.position;
    const winningSongId = valid && position >= 0 ? this.queue[position] ?? null : null;
    this.journal({
      kind: 'claim.decided', round: claim.round, claimId: claim.claimId, verdict, winningSongId, position,
      ...(claim.outcome ? { outcome: claim.outcome } : {}), ...(manual ? { manual: true as const } : {}),
    }, atMs);
    if (valid) this.winners.push({ round: claim.round, kind: claim.kind, cardId: claim.cardId, claimId: claim.claimId, winningSongId, position, atMs, name: null, notes: null });
    this.emit({ type: 'claim.decided', claimId: claim.claimId, cardId: claim.cardId, verdict, atMs });
  }

  /** "Revisió manual" (D119, D120): a Check put under review before its cue; whatever was playing goes on (D118). */
  checkReview(reqId: string | null, claim: ClaimInfo) {
    if (claim.status === 'reviewing') return;
    const run = this.check?.info.claimId === claim.claimId ? this.check : null;
    if (run?.info.cue != null) return this.reject(reqId, 'checkReview', 'invalid', `claim ${claim.claimId} already had its cue`);
    const atMs = this.env.nowMs();
    claim.status = 'reviewing';
    claim.cueNext = false;
    this.journal({ kind: 'claim.reviewing', round: claim.round, claimId: claim.claimId }, atMs);
    if (run) {
      run.info.reviewing = true;
      run.autoAt = null;
    }
    this.celebrationNext = null;
    this.emit({ type: 'check.reviewing', claimId: claim.claimId, atMs });
  }

  /**
   * The Review's end (D121): continue the Check from where it was (the next reveal waits for a press); win or lose it
   * by hand, straight to that cue (a PRIVATE warning when it goes against the card); or discard it, silently.
   */
  reviewEnd(reqId: string | null, claim: ClaimInfo, outcome: ReviewOutcome) {
    if (claim.status !== 'reviewing') return this.reject(reqId, 'reviewEnd', 'invalid', `claim ${claim.claimId} is not under review`);
    if (outcome === 'discard') return this.discard(claim);
    // The Claim under review comes back on screen if another took its place meanwhile.
    if (this.check?.info.claimId !== claim.claimId) this.showCheck(claim);
    const run = this.check!;
    if (outcome === 'continue') {
      claim.status = 'checking';
      run.info.reviewing = false;
      run.awaitPress = true;
      claim.cueNext = run.until == null || (run.info.revealed.length > 0 && run.info.revealed.length > run.until);
      this.journal({ kind: 'claim.continued', round: claim.round, claimId: claim.claimId });
      return;
    }
    const win = outcome === 'win';
    const passes = this.passes(claim);
    if (win !== passes) claim.warnings = [...claim.warnings.filter((w) => w !== 'notPassing' && w !== 'wouldPass'), win ? 'notPassing' : 'wouldPass'];
    this.cue(run, claim, win, true);
  }

  /**
   * A Review discarded (D121, D124): no verdict, no fanfare, no failure music. The next card's Check, or the batch's
   * end: an earlier pass's Celebration waits for a press; else the round is back in plain Parlem over the music from
   * before the Check (D142).
   */
  discard(claim: ClaimInfo) {
    this.reviewMarks.delete(claim.claimId);
    claim.status = 'discarded';
    claim.cueNext = false;
    this.journal({ kind: 'claim.discarded', round: claim.round, claimId: claim.claimId });
    if (this.check?.info.claimId === claim.claimId) this.stopCheck();
    if (this.claims.some((c) => c.status === 'queued' || c.status === 'reviewing')) {
      this.autoCheck = true;
      return;
    }
    if (this.batchWinners().length) {
      this.celebrationNext = { claimId: claim.claimId, step: 0 };
      return;
    }
    this.finishBatch(false, 'discarded');
  }

  /** This Check's valid Claims (the batch's). */
  batchWinners(): ClaimInfo[] {
    const ids = this.batch?.claimIds ?? [];
    return this.claims.filter((c) => c.status === 'valid' && ids.includes(c.claimId));
  }

  /**
   * Every card of the claim had its cue: the shared Celebration if one passed; else the Celebration this Check
   * interrupted comes back, or the round goes back to a Hold: the fail moment's error Hold music, or after a discard
   * plain Parlem over the music from before the Check.
   */
  finishBatch(celebrate: boolean, reason: 'checkFailed' | 'discarded' = 'checkFailed') {
    const batch = this.batch;
    const won = this.batchWinners();
    this.batch = null;
    this.autoCheck = false;
    this.celebrationNext = null;
    this.check = null;
    if (celebrate && won.length) return this.celebrate(roundWin(won.map((c) => c.kind)), batch?.celebration ?? null);
    if (batch?.celebration) {
      // A late Claim during a Celebration was not valid: the Celebration goes on.
      this.celebration = { ...batch.celebration, sinceMs: this.env.nowMs() };
      this.setScene('celebration');
      return;
    }
    this.celebrationChoice = null; // it was for a Celebration that didn't come
    this.setScene('play');
    this.status = 'hold';
    this.hold = { since: this.hold?.since ?? this.env.now(), reason, ducked: true };
    this.timers.autoAt = null;
    if (reason === 'checkFailed') this.switchToHoldMusic('error');
  }

  /** The Check on screen as the state and events show it (auto as it applies to this Check). */
  checkInfo(): CheckInfo | null {
    const run = this.check;
    if (!run) return null;
    const i = run.info;
    return { ...i, otherRows: [...i.otherRows], revealed: i.revealed.map((s) => ({ ...s })), auto: this.checkAutoOn && !run.autoOff };
  }

  // ---------------------------------------------------------------------------------- the Desgraciat's finale
  /**
   * The finalists (D161, D168): the whole set, in order, or none to call the finale off. A card new to the set must be
   * a valid card of the round still standing; one already in it may have fallen since (it shows in its group). A
   * removal that leaves one standing makes that one the winner (D169's rule 5).
   */
  setFinale(reqId: string | null, cardIds: readonly number[] | undefined) {
    if (this.round.kind !== 'desgraciat') return this.reject(reqId, 'finale', 'invalid', `a ${this.round.kind} round has no finale`);
    if (this.finale && this.finaleInfo()?.winner && this.finaleCued) return this.reject(reqId, 'finale', 'invalid', 'the finale is over');
    if (!cardIds?.length) {
      if (!this.finale) return;
      this.finale = null;
      this.journal({ kind: 'finale.set', round: this.round.number, cardIds: [] });
      return;
    }
    const unknown = this.unknownCards(cardIds);
    if (unknown.length) return this.reject(reqId, 'finale', 'unknownCard', unknown.join(','));
    const before = this.finale?.cardIds ?? [];
    if (!before.length && cardIds.length < 2) return this.reject(reqId, 'finale', 'invalid', 'a finale starts with two finalists or more');
    const valid = new Set(this.phaseModel.valid.map((c) => c.id));
    const notValid = cardIds.filter((id) => !valid.has(id));
    if (notValid.length) return this.reject(reqId, 'finale', 'invalid', `not a card of this round: ${notValid.join(',')}`);
    // Who stands among these finalists (D180's rule among them): a landing that took out all of them counted for none.
    const counted = this.queue.slice(0, Math.max(0, this.position + 1));
    const fallenAmong = (ids: readonly number[]) => standingRun(this.phaseModel.valid.filter((c) => ids.includes(c.id)), counted).fallAt;
    const now = fallenAmong(cardIds);
    // D168: a card that has fallen isn't added (one already in the set stays, as fallen).
    const fallen = cardIds.filter((id) => !before.includes(id) && now.has(id));
    if (fallen.length) return this.reject(reqId, 'finale', 'invalid', `already fallen: ${fallen.join(',')}`);
    // D183: nothing by hand brings a fallen finalist back, not even a removal that would undo the landing that took them
    // out (only Enrere undoes a landing).
    const was = before.length ? fallenAmong(before) : new Map<number, number>();
    const revived = cardIds.filter((id) => was.has(id) && !now.has(id));
    if (revived.length) return this.reject(reqId, 'finale', 'invalid', `a fallen finalist can't come back: ${revived.join(',')}`);
    const removal = cardIds.length < before.length && cardIds.every((id) => before.includes(id));
    this.finale = { cardIds: [...cardIds], byHand: false };
    const byHand = removal && this.finaleStanding().length === 1;
    this.finale.byHand = byHand;
    this.journal({ kind: 'finale.set', round: this.round.number, cardIds: [...cardIds], ...(byHand ? { byHand: true as const } : {}) });
    this.timers.autoAt = this.autoAdvanceAllowed() ? this.timers.autoAt : null;
  }

  /** The finalists still standing after the counted landings, in their order (before any winning group is decided). */
  finaleStanding(): number[] {
    return this.finaleInfo()?.standing ?? [];
  }

  /**
   * The finale from its finalists and the counted landings (D169): at each landing the finalists with that song fall
   * together, as one group; one left wins; a landing that would take everyone left takes nobody, and they all win
   * together. A removal by hand that left one standing makes that one the winner.
   */
  finaleInfo(): FinaleInfo | null {
    const f = this.finale;
    if (!f) return null;
    // The finalists among themselves along the counted landings (D180): a landing takes out each finalist with that
    // song, unless it would take out all of them; then it counts for none, and the finale goes on to exactly one.
    const finalists = this.phaseModel.valid.filter((c) => f.cardIds.includes(c.id));
    const run = standingRun(finalists, this.queue.slice(0, Math.max(0, this.position + 1)));
    const atMsOf = (p: number) => this.landings.findLast((l) => !l.undone && l.position === p)?.atMs ?? this.env.nowMs();
    const positions = [...new Set(run.fallAt.values())].sort((a, b) => a - b);
    const fallen: FinaleFall[] = positions.flatMap((p) =>
      f.cardIds.filter((id) => run.fallAt.get(id) === p).map((cardId) => ({ cardId, position: p, songId: this.queue[p] ?? null, atMs: atMsOf(p) })));
    // A finalist entered but not among the valid cards stands (setFinale only takes valid ones).
    const standing = f.cardIds.filter((id) => !run.fallAt.has(id));
    let winner: FinaleWinner | null = null;
    if (standing.length === 1) {
      const lastFall = positions.at(-1);
      // Left alone by a landing, or by a removal by hand (D169's rule 5).
      winner = f.byHand || lastFall == null
        ? { cardId: standing[0], position: this.position, songId: this.position >= 0 ? this.queue[this.position] ?? null : null, atMs: this.env.nowMs(), byHand: true }
        : { cardId: standing[0], position: lastFall, songId: this.queue[lastFall] ?? null, atMs: atMsOf(lastFall) };
    }
    return { cardIds: [...f.cardIds], standing, fallen, winner, cued: this.finaleCued };
  }

  /**
   * The presenters' cue once the finale has its winner (D169, D180): the winner's Claim is opened and decided valid (the
   * journal's claim.opened and claim.decided, `manual` when a removal by hand decided it), and the Celebration starts
   * with its fanfare.
   */
  finaleCue(reqId: string | null) {
    const info = this.finaleInfo();
    if (!info?.winner) return this.reject(reqId, 'finaleCue', 'invalid', 'the finale has no winner yet');
    if (this.finaleCued) return;
    this.finaleCued = true;
    const w = info.winner;
    const atMs = this.env.nowMs();
    const claim: ClaimInfo = {
      claimId: `cl-${++this.claimCount}`, round: this.round.number, cardId: w.cardId, kind: 'standing', atMs, position: this.position,
      status: 'queued', outcome: null, completeSince: null, warnings: [], markedCard: [], revealUntil: null, cueNext: false,
    };
    this.evaluate(claim);
    claim.completeSince = w.position;
    this.claims.push(claim);
    this.journal({ kind: 'claim.opened', round: claim.round, claimId: claim.claimId, cardId: w.cardId, winKind: 'standing', position: claim.position }, atMs);
    this.emit({ type: 'claim.opened', claim: copyClaim(claim) });
    this.decide(claim, true, w.byHand === true);
    this.timers.autoAt = null;
    this.celebrate('standing', null);
  }

  // ---------------------------------------------------------------------------------- Celebration
  /**
   * A valid Line (it confirms the Line: the Phase climbs towards the Bingo) or a valid Bingo (the round is
   * over): the Clear fanfare, an impact, then the Celebration's music. A Claim during a Celebration that
   * adds a Winner of the same kind keeps its music.
   */
  celebrate(kind: WinKind, previous: CelebrationInfo | null) {
    if (kind === 'line' && !this.round.lineConfirmed) this.confirmLine();
    const same = previous?.kind === kind;
    const music: CelebrationMusic = previous && same ? previous.music : this.celebrationChoice ?? (kind === 'line' ? 'winningSong' : 'victory');
    this.celebrationChoice = null;
    const celebration = this.celebrationOf(kind, this.env.nowMs(), music);
    if (!same) this.winningHook = this.hookOf(celebration.winningSongId);
    this.celebration = celebration;
    this.setScene('celebration');
    this.flowHold('claim');
    this.timers.holdMusicAt = null;
    const now = this.env.now();
    this.out.push({ type: 'sfx', name: FLOW.celebration.fanfare, at: now + 0.05, volume: 'winFx' });
    this.out.push({ type: 'sfx', name: FLOW.celebration.impact, at: now + 0.05, volume: 'winFx' });
    if (!same) this.startCelebrationMusic(music, now + FLOW.celebration.musicDelaySec);
    this.emit({ type: 'celebration.started', celebration: { ...celebration, cardIds: [...celebration.cardIds] } });
  }

  /**
   * Parlem in a Celebration (D117): its music ducks under the voices, and comes back. Releasing a Line's Celebration
   * with no Parlem on goes back to the round, like Next.
   */
  celebrationHold(reqId: string | null, on: boolean | undefined) {
    const c = this.celebration;
    if (!c) return;
    if (on ?? !c.parlem) {
      if (c.parlem) return;
      c.parlem = true;
      this.out.push({ type: 'bedDuck', db: this.parlemDb(), seconds: HOLD.duckSec });
      return;
    }
    if (c.parlem) {
      c.parlem = false;
      this.out.push({ type: 'bedDuck', db: 0, seconds: HOLD.releaseSec });
      return;
    }
    if (c.kind === 'line') this.release(reqId);
  }

  /** The round's Celebration of `kind`: every valid Claim of that kind shares it; the earliest Winning song leads. */
  celebrationOf(kind: WinKind, sinceMs: number, music: CelebrationMusic): CelebrationInfo {
    const ids = new Set(this.claims.filter((c) => c.status === 'valid' && c.kind === kind).map((c) => c.claimId));
    const won = this.winners.filter((w) => ids.has(w.claimId));
    const first = won.filter((w) => w.winningSongId != null).sort((a, b) => a.position - b.position)[0];
    return { kind, round: this.round.number, cardIds: [...new Set(won.map((w) => w.cardId))], winningSongId: first?.winningSongId ?? null, sinceMs, music, parlem: false };
  }

  /** The hook a song landed on this round (its Celebration loops it), if known. */
  hookOf(songId: number | null): string | null {
    if (songId == null) return null;
    if (this.current?.songId === songId) return this.current.hookId;
    return this.history.findLast((h) => h.songId === songId)?.hookId ?? null;
  }

  /** The presenters change the Celebration's music. */
  celebrationMusic(choice: CelebrationMusic) {
    if (!this.celebration) return;
    this.celebration.music = choice;
    this.startCelebrationMusic(choice, this.env.now());
  }

  /** The Celebration's music from `at`: a ducked song or Hold music gives way to it. */
  startCelebrationMusic(choice: CelebrationMusic, at: number) {
    const c = FLOW.celebration;
    const levelDb = choice === 'winningSong' ? c.winningSongDb : choice === 'victory' ? c.victoryDb : HOLD.holdMusicLevelDb;
    this.out.push({ type: 'celebrationMusic', choice, songId: this.celebration?.winningSongId ?? null, hookId: this.winningHook, at, fadeSec: c.musicFadeSec, levelDb });
    this.current = null;
    this.timers.holdMusicAt = null;
    this.holdMusic = choice === 'holdMusic';
    this.holdMusicMood = 'hold';
    this.bed = choice === 'holdMusic' ? null : choice;
  }

  /** From a Line's Celebration back to the round (its music gives way to the next Spin's build). */
  leaveCelebration() {
    this.celebration = null;
    this.setScene('play');
  }

  // ---------------------------------------------------------------------------------- Interval and rounds
  startInterval() {
    this.celebration = null;
    this.interval = this.intervalFrom(this.env.nowMs());
    this.setScene('interval');
    this.playIntervalMusic('breaks');
  }

  /** The Interval after this round: its countdown guide is the plan's Interval plus any Throw planned after it. */
  intervalFrom(sinceMs: number): IntervalInfo {
    return { sinceMs, nextRound: this.round.number + 1, guideEndMs: sinceMs + 1000 * this.breakSecAfter(this.round.number) };
  }

  /** The planned Interval (the plan's intervalMinutes), else the default guide. */
  intervalSec(): number {
    return this.plan ? this.plan.schedule.intervalMinutes * 60 : FLOW.intervalGuideSec;
  }

  /** The break after round `number`: a Throw planned there sets its length (the throw is inside it), else the Interval. */
  breakSecAfter(number: number): number {
    const planned = this.plan?.schedule.throws?.find((b) => b.afterRound === number);
    return planned ? 60 * planned.minutes : this.intervalSec();
  }

  /**
   * The edition's Game plan, as the relay pushes it (`relay.plan`, checked by the runtime): the Schedule then follows
   * the planned rounds' kinds, the planned Interval and Throws. Not part of the Game (not journaled): it is the
   * edition's setup, and a restarted page gets it again from the relay. Its volumes are the exception (D139).
   */
  setPlan(plan: GamePlan | null): Effect[] {
    this.plan = plan;
    // A Game that set no volume yet starts from the edition's (D139), never one mid-Game.
    if (plan?.volumes && !this.volumesSet) {
      this.volumes = { ...VOLUME_DEFAULTS, ...plan.volumes };
      this.volumesSet = true;
      this.pushVolumes();
      this.journal({ kind: 'settings.changed', settings: this.journalSettings() });
    }
    if (this.interval) this.interval = this.intervalFrom(this.interval.sinceMs);
    this.updateNudge();
    this.emitState();
    return this.flush();
  }

  /**
   * A music set (D129): the breaks' in the Interval, the end's after the Game. The music playing, such as the victory
   * track, hands over to it on its own downbeat, so the end of a round flows into the Interval.
   */
  playIntervalMusic(set: MusicSet) {
    this.flowHold('music');
    this.timers.holdMusicAt = null;
    if (this.bed === 'interval' && this.bedSet === set) return;
    this.out.push({ type: 'intervalMusic', set, at: this.env.now(), fadeSec: INTERVAL.fadeInSec, levelDb: INTERVAL.volumeDb });
    this.current = null;
    this.holdMusic = false;
    this.bed = 'interval';
    this.bedSet = set;
    this.intervalNow = null;
  }

  /**
   * A round's intro music (D129): for now one track for every round, looping low as if in Parlem, from the intro
   * through its Shuffle until the first Spin builds out of it (U99).
   */
  playIntroMusic() {
    this.flowHold('music');
    this.timers.holdMusicAt = null;
    if (this.bed === 'intro') return;
    this.out.push({ type: 'introMusic', at: this.env.now(), fadeSec: INTRO.fadeInSec, levelDb: INTRO.levelDb });
    this.current = null;
    this.holdMusic = false;
    this.bed = 'intro';
    this.intervalNow = null;
  }

  /**
   * The runtime: a set's track took over at `at` (audio clock). Shown in the state while that set plays; a report that
   * comes after the music gave way is ignored. Pausa's set (D129) has its own.
   */
  intervalTrack(track: Omit<IntervalTrackInfo, 'sinceMs'>, at = this.env.now(), set: MusicSet = this.bedSet): Effect[] {
    const info = { title: track.title, artist: track.artist, index: track.index, count: track.count, sinceMs: Math.round(this.env.toEpochMs(at)) };
    if (set === 'pausa') {
      if (!this.pause) return this.flush();
      this.pausaNow = info;
    } else {
      if (this.bed !== 'interval' || this.bedSet !== set) return this.flush();
      this.intervalNow = info;
    }
    this.emitState();
    return this.flush();
  }

  /**
   * Introduce a round: its name and prizes on screen while its intro music plays. No Queue yet. `again`: a test jump,
   * which may come from `roundStart` itself (the scene rules keep the presenters' intro out of it).
   */
  roundIntro(number: number, kind: RoundKind, cardType: string, side: number, { again = false }: { again?: boolean } = {}) {
    this.pending = null;
    this.celebration = null;
    this.interval = null;
    this.intro = { round: number, kind, cardType, side, sinceMs: this.env.nowMs() };
    this.setScene('roundStart', number, kind, cardType, side, { again });
    // Announcing a round reveals its prizes (unless the plan keeps them all secret: plan.ts revealedRounds).
    this.revealPrizes(number, 'intro');
    // Its fanfare and the voice naming it over the intro music, which comes up as the voice ends (D198).
    this.playIntroMusic();
    this.pressCue(this.roundCue(number, kind));
  }

  /** A round's prizes revealed, once per way (the journal's `prizes.revealed`). */
  revealPrizes(round: number, by: 'presenters' | 'intro') {
    if (this.prizesRevealed.some((r) => r.round === round && r.by === by)) return;
    this.prizesRevealed.push({ round, by });
    this.journal({ kind: 'prizes.revealed', round, by });
  }

  /** Run a round's public Shuffle. The intro's music goes on under it (or the breaks'), and the first Spin builds out of it. */
  newRound(number: number, kind: RoundKind, cardType: string, side: number) {
    const keepMusic = (this.bed === 'interval' || this.bed === 'intro') && !this.current && !this.transition && !this.suspense;
    this.announceCancel('newRound');
    this.stopCheck();
    // Journaled before `round.started`, which ends the intro in the record too.
    if (this.scene !== 'roundStart') this.setScene('roundStart', number, kind, cardType, side);
    this.startRound(number, kind, cardType, side, { stop: !keepMusic, shuffle: true, keepMusic });
    if (!keepMusic && this.unlocked) this.playIntroMusic();
  }

  /** The end of the Game: the end's music plays until the laptop is disconnected (D137). */
  endGame() {
    if (this.transition) this.cancel(this.transition, 'hold');
    if (this.suspense) this.cancelSuspense(this.suspense, 'hold');
    this.pending = null;
    this.stopCheck();
    if (this.pause) this.dropPause();
    this.batch = null;
    this.autoCheck = false;
    this.celebrationNext = null;
    this.celebration = null;
    this.interval = null;
    this.intro = null;
    this.shuffle = null;
    this.setScene('after');
    // The goodbye over the end set's first song, which comes up as it ends (D202).
    this.playIntervalMusic('end');
    this.pressCue('goodbye');
  }

  // ------------------------------------------------------------------ rehearsal test tools (TEST_COMMANDS, never the night)
  /**
   * `testJump`: round `number`'s intro, or with `songs` that round in play with its first `songs` songs counted, in the
   * same Game (the cards in play, the settings and the volumes stay). The round is the plan's (its kind, card type and
   * side, as `plannedSide` reads it), else a normal round on the default card type. Whatever plays stops at once, as with
   * Panic, and the jump lands once the runtime has let go of it (TEST_JUMP.settleSec, `landJump`): until then every other
   * command is `busy`. A refused jump stops nothing. Another jump meanwhile replaces it.
   */
  testJump(reqId: string, number: number, songs: number | null) {
    const planned = roundPlan(this.plan, number);
    const kind = planned?.kind ?? 'normal';
    const cardType = planned?.cardType || defaultCardType(kind);
    const side = this.plannedSide(number, kind, cardType);
    const pool = this.roundPool(cardType, side);
    if (pool == null) return this.reject(reqId, 'testJump', 'invalid', `card type ${cardType} has no side ${side}`);
    let play: TestJumpTarget['play'] = null;
    if (songs != null) {
      // A fresh Shuffle, as a round's start draws it (its seed from env.random; a fixed test Queue stays fixed).
      const drawn = this.drawQueue(cardType, kind, side, pool);
      if (songs > drawn.queue.length) return this.reject(reqId, 'testJump', 'invalid', `round ${number}'s Queue has ${drawn.queue.length} songs, fewer than ${songs}`);
      if (drawn.tied) this.out.push({ type: 'log', level: 'warn', message: `round ${number}: every Shuffle up to ${FLOW.shuffleMaxAttempts} had a Tie; kept the last` });
      play = { drawn, position: songs - 1 };
    }
    // Panic: nothing lands, and everything stops (a voice cue, a held effect, Pausa, a throw song, a Check's sounds).
    this.panic();
    this.autoCheck = false; // no Check comes on screen while it settles
    this.jump = { at: this.env.now() + TEST_JUMP.settleSec, number, kind, cardType, side, pool, play };
  }

  /** The test jump lands: the show flow it left is cleared, then the round's intro (as roundIntro) or the round in play
   * (as resumeAt: Hold music until Next). */
  landJump(j: TestJumpTarget) {
    this.jump = null;
    this.clearFlow({ intro: j.play == null });
    if (j.play) {
      this.resumeRound({ number: j.number, kind: j.kind, cardType: j.cardType, side: j.side, pool: j.pool, drawn: j.play.drawn, position: j.play.position, lineFrom: null });
    } else {
      this.out.push(this.drumResetEffect(this.position)); // the drum at rest, as a round's end leaves it
      this.roundIntro(j.number, j.kind, j.cardType, j.side, { again: true });
    }
    this.emitState();
  }

  /**
   * Before a test jump lands, the show flow of the moment it left goes, so the moment it lands in is clean: the Check and
   * its batch, the Celebration (and Parlem's duck of its music), the Interval, the intro, the Shuffle, and live playback.
   * An intro keeps the round it left as a round's end does (its Queue, landings and decided Claims), so what was still
   * open there is closed in the journal too: an undecided Claim is discarded (`claim.reviewing`, `claim.discarded`), and
   * a finale not yet cued is called off (`finale.set` with none). A jump into play needs neither: its `round.resumed`
   * starts the round afresh.
   */
  clearFlow({ intro }: { intro: boolean }) {
    if (this.scene === 'celebration') this.out.push({ type: 'bedDuck', db: 0, seconds: HOLD.releaseSec });
    this.stopCheck();
    this.reviewMarks.clear();
    this.batch = null;
    this.autoCheck = false;
    this.celebrationNext = null;
    this.celebrationChoice = null;
    this.celebration = null;
    this.winningHook = null;
    this.interval = null;
    this.intro = null;
    this.shuffle = null;
    this.resetLive();
    if (!intro) return;
    for (const claim of this.claims) {
      if (settled(claim)) continue;
      if (claim.status !== 'reviewing') this.journal({ kind: 'claim.reviewing', round: claim.round, claimId: claim.claimId });
      claim.status = 'discarded';
      claim.cueNext = false;
      this.journal({ kind: 'claim.discarded', round: claim.round, claimId: claim.claimId });
    }
    if (this.finale && !this.finaleCued) {
      this.finale = null;
      this.journal({ kind: 'finale.set', round: this.round.number, cardIds: [] });
    }
  }

  // ------------------------------------------------------------------------------- voice cues (D198, D202–D204)
  /** A round's voice cue: a normal round by its Quina number (its place among the plan's normal rounds). */
  roundCue(number: number, kind: RoundKind): VoiceCue | null {
    if (kind === 'desgraciat') return 'round-desgraciat';
    if (kind === 'special') return 'round-especial';
    const quina = this.plan ? this.plan.rounds.filter((r) => r.number <= number && r.kind === 'normal').length : number;
    const cue = `round-${quina}`;
    return isVoiceCue(cue) ? cue : null;
  }

  /**
   * A presenter's press plays its cue at once (D204's waiting is for the timed cues): a timed one playing gives way. The
   * music it leads into starts under it, dipped, and comes up as the voice ends.
   */
  pressCue(cue: VoiceCue | null) {
    if (!cue || !this.game.autoSounds.voices) return;
    this.cutVoice();
    this.playVoice(cue, cue.startsWith('round-') ? 'fanfare' : 'chime');
  }

  playVoice(cue: VoiceCue, lead: VoiceLead) {
    const at = this.env.now() + VOICE.leadSec;
    this.voice = { cue, since: at, sinceMs: this.env.toEpochMs(at), endsBy: at + VOICE.maxCueSec, durationMs: null };
    this.out.push({ type: 'voice', action: 'play', cue, lead, at });
  }

  /** The runtime: the cue started at `at` (audio clock) and lasts `durationSec`, its lead and voice together. */
  voiceStarted(cue: VoiceCue, at: number, durationSec: number): Effect[] {
    const v = this.voice;
    if (v?.cue === cue) {
      v.since = at;
      v.sinceMs = this.env.toEpochMs(at);
      v.durationMs = Math.round(durationSec * 1000);
      v.endsBy = Math.max(v.endsBy, at + durationSec + 1);
      this.emitState();
    }
    return this.flush();
  }

  /** The runtime: the cue played to its end (its file missing included). */
  voiceEnded(cue: VoiceCue): Effect[] {
    if (this.voice?.cue === cue) {
      this.voice = null;
      this.emitState();
    }
    return this.flush();
  }

  /** Stop the cue playing (`voiceSkip`, Pausa, Panic): the music comes back up. */
  cutVoice() {
    const v = this.voice;
    if (!v) return;
    this.voice = null;
    this.out.push({ type: 'voice', action: 'stop', cue: v.cue, lead: null, at: this.env.now() });
  }

  /**
   * The timed cue due now: the doors' countdown in `before` (from the plan's start, never before the doors open), or
   * "Tornem en dos minuts" in a Descans (the break after a round with a planned Throw, D197). The latest one due wins.
   */
  timedCues(): { key: string; cue: VoiceCue; dueMs: number }[] {
    const sch = this.plan?.schedule;
    if (this.scene === 'before' && sch?.startAtMs != null) {
      const start = sch.startAtMs;
      return VOICE.doorsMinutes
        .map((m) => ({ key: `doors-${m}`, cue: `doors-${m}` as VoiceCue, dueMs: start - m * 60_000 }))
        .filter((c) => sch.doorsAtMs == null || c.dueMs >= sch.doorsAtMs);
    }
    const interval = this.interval;
    if (this.scene === 'interval' && interval && this.plan?.schedule.throws?.some((t) => t.afterRound === interval.nextRound - 1)) {
      return [{ key: `descans-2min@${interval.nextRound - 1}`, cue: 'descans-2min', dueMs: interval.guideEndMs - VOICE.descansWarnSec * 1000 }];
    }
    return [];
  }

  /** Quiet enough for a timed cue (D204): the presenters are unlikely to be talking, nothing else is going on. */
  voiceQuiet(): boolean {
    const talking = this.hold != null && (this.hold.reason === 'hold' || this.hold.reason === 'pause' || this.hold.reason === 'claim');
    return !this.voice && !this.pause && !this.transition && !this.suspense && !talking && this.scene !== 'check' && !this.throwSong?.playing && !this.padHeld;
  }

  tickVoice(now: number) {
    if (this.voice && now >= this.voice.endsBy) {
      this.voice = null;
      this.emitState();
    }
    const nowMs = this.env.nowMs();
    const due = this.timedCues().filter((c) => c.dueMs <= nowMs && !this.voicesDone.has(c.key));
    if (!due.length) return;
    // An earlier one never comes after a later one: only the latest due may still play.
    const last = due.reduce((a, b) => (b.dueMs > a.dueMs ? b : a));
    for (const c of due) if (c !== last) this.voicesDone.add(c.key);
    const late = (nowMs - last.dueMs) / 1000 > VOICE.maxWaitSec;
    if (late || !this.game.autoSounds.voices) {
      this.voicesDone.add(last.key);
      return this.emitState();
    }
    if (!this.voiceQuiet()) return;
    this.voicesDone.add(last.key);
    this.playVoice(last.cue, 'chime');
    this.emitState();
  }

  /** The next timed cue, for the console: the one waiting, else the next due. */
  voiceNext(): { cue: VoiceCue; atMs: number } | null {
    if (!this.game.autoSounds.voices) return null;
    const nowMs = this.env.nowMs();
    const open = this.timedCues().filter((c) => !this.voicesDone.has(c.key) && nowMs - c.dueMs <= VOICE.maxWaitSec * 1000);
    const waiting = open.filter((c) => c.dueMs <= nowMs).sort((a, b) => b.dueMs - a.dueMs)[0];
    const next = waiting ?? open.filter((c) => c.dueMs > nowMs).sort((a, b) => a.dueMs - b.dueMs)[0];
    return next ? { cue: next.cue, atMs: next.dueMs } : null;
  }

  // ---------------------------------------------------------------------------------- the drum roll (D203)
  /** An effect held on the D-pad: start, intensity, or let go (landing on the next beat once held long enough). */
  padHold(effect: PadHoldEffect, on: boolean, intensity?: number) {
    const now = this.env.now();
    const held = this.padHeld;
    if (on) {
      const value = Math.min(1, Math.max(0, intensity ?? held?.intensity ?? 0));
      if (held) {
        held.intensity = value;
        this.out.push({ type: 'padHold', action: 'intensity', effect: held.effect, at: now, intensity: value });
        return;
      }
      const grid = this.beatGrid(now);
      this.padHeld = { effect, since: now, sinceMs: this.env.nowMs(), intensity: value, grid };
      this.out.push({ type: 'padHold', action: 'start', effect, at: now + 0.02, intensity: value, grid });
      return;
    }
    this.releasePad({ land: true });
  }

  /** Let the held effect go: it lands on the next beat when held long enough (and `land`), else it fades out now. */
  releasePad({ land }: { land: boolean }) {
    const held = this.padHeld;
    if (!held) return;
    this.padHeld = null;
    const now = this.env.now();
    const lands = land && now - held.since >= DRUMROLL.landAfterSec;
    const { t0, beatSec } = held.grid;
    const at = lands ? t0 + Math.ceil((now + 0.05 - t0) / beatSec) * beatSec : now;
    this.out.push({ type: 'padHold', action: 'release', effect: held.effect, at, intensity: held.intensity, land: lands });
  }

  /** The beat to play on: the song playing's (a downbeat and its beat length), else DRUMROLL.defaultBpm from now. */
  beatGrid(now: number): { t0: number; beatSec: number } {
    const cur = this.current;
    const analysis = cur ? this.env.analysis(cur.songId) : null;
    if (cur && analysis) {
      const tl = deckTimeline(analysis, cur, cur.landedDownbeatIndex);
      const near = tl.downbeatsBetween(now - 8, now + 8).reduce<{ ctxTime: number; index: number } | null>((b, d) => (!b || Math.abs(d.ctxTime - now) < Math.abs(b.ctxTime - now) ? d : b), null);
      if (near) return { t0: near.ctxTime, beatSec: tl.beatAt(near.index) };
    }
    return { t0: now, beatSec: 60 / DRUMROLL.defaultBpm };
  }

  // ---------------------------------------------------------------------------------- the throw songs
  /**
   * "Llançament" (D138), or the corn-seed storm's button (D151): its song at full volume over the scene's music, which
   * fades out under it. A tap starts it from its hook, stops it while it plays, and resumes it where it stopped;
   * `restart` plays it again from the hook; the other song's button replaces it. Not journaled: it's music.
   */
  throwTap(song: ThrowSong, restart: boolean) {
    const now = this.env.now();
    const t = this.throwSong;
    if (!t || restart || t.song !== song) return this.playThrow(song, THROW.songs[song].hookSec);
    if (t.playing) {
      t.offsetSec += Math.max(0, now - t.startedAt);
      t.playing = false;
      t.sinceMs = this.env.toEpochMs(now);
      this.out.push({ type: 'throwSong', action: 'stop', at: now, offsetSec: t.offsetSec });
      return;
    }
    this.playThrow(song, t.offsetSec);
  }

  playThrow(song: ThrowSong, offsetSec: number) {
    const at = this.env.now() + THROW.leadSec;
    this.throwSong = { song, playing: true, offsetSec, startedAt: at, sinceMs: this.env.toEpochMs(at) };
    const { name, trimDb } = THROW.songs[song];
    this.out.push({ type: 'throwSong', action: 'play', at, offsetSec, track: { name, trimDb } });
  }

  /** The throw song on, as the buttons show it: where it is at `sinceMs`. */
  throwInfo(): ThrowInfo | null {
    const t = this.throwSong;
    return t ? { ...throwTrackInfo(t.song), song: t.song, playing: t.playing, sinceMs: t.sinceMs, posSec: round2(t.offsetSec) } : null;
  }

  /** The runtime: the throw song played to its end (the break music is back). */
  throwEnded(): Effect[] {
    if (this.throwSong?.playing) {
      this.throwSong = null;
      this.emitState();
    }
    return this.flush();
  }

  /** The round in play is the night's last: the plan's last round, else `game.roundsTotal` (D155). */
  isLastRound(): boolean {
    return this.round.number >= (this.plan?.rounds.length || this.game.roundsTotal);
  }

  /** The scene changes, or Panic: the throw song stops for good. */
  endThrow(fadeSec: number = THROW.endFadeSec) {
    if (!this.throwSong) return;
    this.throwSong = null;
    this.out.push({ type: 'throwSong', action: 'end', at: this.env.now(), offsetSec: 0, fadeSec });
  }

  // ---------------------------------------------------------------------------------- Pausa
  /**
   * Pausa (D128, D135), at any time: nothing lands (a Spin or Suspense in flight is cancelled, U105), the playback in
   * progress is saved and fades out, and the Pausa set plays. The scene stays underneath; a Check keeps its marks.
   */
  setPause(on: boolean, reqId: string | null = null) {
    if (on === (this.pause != null)) return;
    if (!on) return this.endPause();
    // Within 0.15 s of a landing a Spin can no longer be cancelled: press again.
    if (this.transition && this.transition.T - this.env.now() < HOLD.cancelMinSec) return this.reject(reqId, 'pause', 'busy');
    if (this.transition) this.cancel(this.transition, 'hold');
    if (this.suspense) this.cancelSuspense(this.suspense, 'hold');
    this.pending = null;
    // A voice cue stops; a held effect stops without landing.
    this.cutVoice();
    this.releasePad({ land: false });
    const now = this.env.now();
    const run = this.check;
    if (run) {
      // Its marks stay; auto stops and the next reveal waits for a press (U107). The revealed song is saved with the
      // rest of the playback (pausePlayback) and resumes with it, under the Check's duck again.
      run.autoAt = null;
      run.awaitPress = true;
      run.soundEndAt = null;
    }
    const t = this.throwSong;
    if (t?.playing) {
      t.offsetSec += Math.max(0, now - t.startedAt);
      t.sinceMs = this.env.nowMs();
    }
    this.pause = { sinceMs: this.env.nowMs(), since: now };
    this.pausaNow = null;
    this.out.push({ type: 'pausePlayback', at: now, fadeSec: PAUSA.fadeOutSec });
    // D128: "the Pausa music plays low, as if in Parlem": the set's level under the Parlem duck (the songsParlem slider).
    this.out.push({ type: 'pausaMusic', on: true, at: now, fadeSec: PAUSA.musicFadeInSec, levelDb: INTERVAL.volumeDb + this.parlemDb() });
    this.out.push({ type: 'pauseOverlay', on: this.pauseOverlay() });
  }

  /** "Tornem de seguida" on the projector and phones: only during a round, a Check or a Celebration (D135). */
  pauseOverlay(): boolean {
    return this.pause != null && (this.scene === 'play' || this.scene === 'check' || this.scene === 'celebration');
  }

  /**
   * Pausa ends: what it saved resumes exactly where it was, fading in (D135), under Parlem where the round has Parlem
   * (D128); every timer moves on by the paused time. `forNext`: Next ended it, so the saved playback is dropped and the
   * Spin builds out of the Pausa music instead.
   */
  endPause({ forNext = false }: { forNext?: boolean } = {}) {
    const pause = this.pause;
    if (!pause) return;
    this.pause = null;
    this.pausaNow = null;
    const now = this.env.now();
    const at = now + PAUSA.resumeLeadSec;
    this.out.push({ type: 'pauseOverlay', on: false });
    // The song plays on from where Pausa found it.
    const cur = this.current;
    if (cur) {
      const pos = cur.offset + (pause.since - cur.startCtx) * cur.rate;
      cur.endCtx += at - pause.since;
      cur.startCtx = at;
      cur.offset = pos;
    }
    this.shiftClock(at - pause.since, { song: false });
    const run = this.check;
    if (forNext) {
      // The Pausa music is the bed the Spin builds out of; nothing saved comes back.
      this.out.push({ type: 'resumePlayback', at, fadeSec: 0, song: null, discard: true });
      this.current = null;
      this.loop = null;
      this.holdMusic = false;
      this.bed = 'pausa';
      if (this.throwSong) this.endThrow(0);
      return;
    }
    // A break playing Pausa's set (D228) was never paused: Pausa's music was already it, and it plays on.
    if (!(this.bed === 'interval' && this.bedSet === 'pausa')) {
      this.out.push({ type: 'pausaMusic', on: false, at, fadeSec: PAUSA.musicFadeOutSec, levelDb: INTERVAL.volumeDb });
    }
    this.out.push({ type: 'resumePlayback', at, fadeSec: PAUSA.fadeInSec, song: cur ? { songId: cur.songId, offset: cur.offset, rate: cur.rate } : null, discard: false });
    const t = this.throwSong;
    if (t?.playing) {
      t.startedAt = at;
      t.sinceMs = this.env.toEpochMs(at);
    }
    // In a round, Parlem comes back on over what resumes (D128).
    if (this.scene === 'play' || this.scene === 'before') {
      if (this.status === 'playing' && cur) this.enterHold('pause', { music: false });
      else if (this.status === 'hold' && this.hold && !this.hold.ducked) this.holdMode(true);
    }
    if (run && run.info.revealed.length && run.info.cue == null) this.out.push({ type: 'checkDuck', on: true });
  }

  /**
   * Move every audio-clock time of what Pausa froze on by `d` seconds: the playing song's timeline and its loop, the
   * Hold's timers, the Celebration's way to the Interval. The Interval's countdown is only a guide and runs on (U110).
   */
  shiftClock(d: number, { song = true }: { song?: boolean } = {}) {
    const cur = this.current;
    if (cur && song) {
      cur.startCtx += d;
      cur.endCtx += d;
    }
    if (this.loop) this.loop.nextAt += d;
    if (this.hold) this.hold.since += d;
    if (this.timers.holdMusicAt != null) this.timers.holdMusicAt += d;
    if (this.timers.autoAt != null) this.timers.autoAt += d;
    if (this.heatSample) this.heatSample.at += d;
    if (this.celebration) this.celebration.sinceMs += d * 1000;
  }

  /** Panic or the end of the Game during Pausa: it ends with nothing saved to resume. */
  dropPause() {
    if (!this.pause) return;
    this.pause = null;
    this.pausaNow = null;
    this.out.push({ type: 'pauseOverlay', on: false });
    this.out.push({ type: 'pausaMusic', on: false, at: this.env.now(), fadeSec: 0.3, levelDb: INTERVAL.volumeDb });
    this.out.push({ type: 'resumePlayback', at: this.env.now(), fadeSec: 0, song: null, discard: true });
  }

  /**
   * The scene's own music when a resumed Game is unlocked. In `play` (and `before`) the Hold and its Hold music stay
   * until Next.
   */
  resumeSceneMusic() {
    switch (this.scene) {
      case 'celebration':
        if (!this.celebration) return;
        this.flowHold('claim');
        return this.startCelebrationMusic(this.celebration.music, this.env.now());
      case 'interval':
        return this.playIntervalMusic('breaks');
      case 'after':
        return this.playIntervalMusic('end');
      case 'roundStart':
        return this.playIntroMusic();
      case 'check':
        // The Checks go on (a running one was queued again), with Hold music under them.
        if (this.status !== 'hold') this.enterHold('claim', { music: true });
        this.autoCheck = true;
        return;
      case 'before':
      case 'play':
        return;
      default:
        this.scene satisfies never;
    }
  }

  /** A Winner's name and notes (PRIVATE), set or edited at any time; an empty string clears one. */
  winnerInfo(reqId: string | null, { claimId, name, notes, slip }: CommandFields['winnerInfo']) {
    const winner = this.winners.find((w) => w.claimId === claimId);
    if (!winner) return this.reject(reqId, 'winnerInfo', 'unknownClaim', `no winner for claim ${claimId}`);
    if (name !== undefined) winner.name = name.trim() || null;
    if (notes !== undefined) winner.notes = notes.trim() || null;
    winner.slip = slip !== undefined ? slip.trim() || null : winner.slip ?? null;
    this.journal({ kind: 'winner.noted', claimId, name: winner.name, notes: winner.notes, slip: winner.slip });
  }

  // ---------------------------------------------------------------------------------- the phones' Heat
  /**
   * After the landing at `position`: the Heat the state now carries, for the phones a random 4–15 s later
   * (`heat.sample`), so their Heat never moves on a landing. Nothing without cards in play.
   */
  scheduleHeatSample(landedAt: number, position: number) {
    const value = this.phaseStep(position + 1)?.heat ?? null;
    this.heatSample = value == null ? null : { at: landedAt + this.heatDelay(position), value };
  }

  /** The delay after the landing at `position`: from the round's secret seed, so a seed always gives the same. */
  heatDelay(position: number): number {
    const { minDelaySec, maxDelaySec } = FLOW.heatSample;
    return minDelaySec + seededRandom(mixSeed(this.phaseModel.seed ^ 0x48454154, position))() * (maxDelaySec - minDelaySec);
  }

  sendHeatSample(now: number) {
    const sample = this.heatSample;
    if (!sample || now < sample.at) return;
    this.heatSample = null;
    const fromMs = Math.round(this.env.toEpochMs(sample.at));
    // Due next: the Spin in flight's sample, if one is on its way; else the sample holds for a while.
    const t = this.transition;
    const next = t ? Math.round(this.env.toEpochMs(t.T + this.heatDelay(t.targetPos))) : null;
    const toMs = next != null && next > fromMs ? next : fromMs + FLOW.heatSample.holdSec * 1000;
    this.emit({ type: 'heat.sample', value: Math.round(sample.value * 1000) / 1000, fromMs, toMs });
  }

  // ---------------------------------------------------------------------------------- derived
  // The Phase of the coming transition: the presenters' override, else the cards-in-play plan, else the
  // "songs until a winner" placeholder.
  phaseName(): PhaseName {
    if (this.game.phaseOverride) return this.game.phaseOverride;
    const step = this.phaseStep(this.position + 1);
    if (step) return step.phase;
    return phaseFor(this.game.songsUntilWinner, null).name;
  }

  // Cards that now have a Line or a Bingo. Private to the tablet: "possible", since unsold cards count too.
  possibleWinners(): PossibleWinners {
    const valid = this.phaseModel.valid;
    if (!valid.length || this.phaseModel.kind === 'standing') return { line: [], bingo: [] };
    const landed = this.landings.filter((l) => !l.undone).map((l) => l.songId);
    const strip = (list: ReturnType<typeof possibleWinners>) => list.slice(0, 60).map(({ cardId, lines, completedBy }) => ({ cardId, lines, completedBy }));
    return { line: strip(possibleWinners(valid, landed, 'line')), bingo: strip(possibleWinners(valid, landed, 'bingo')) };
  }

  /**
   * PRIVATE, for the console's Futur tab: where the known Queue first completes a Line and a Bingo on a valid card
   * from the next song on, and the valid cards by songs still missing and by songs marked. Null without cards.
   */
  future(): FutureInfo | null {
    const valid = this.phaseModel.valid;
    if (!valid.length) return null;
    const landed = this.landings.filter((l) => !l.undone).map((l) => l.songId);
    const counts = cardCounts(valid, landed);
    const from = this.position + 1;
    if (this.phaseModel.kind === 'standing') {
      const course = standingCourse(valid, this.queue);
      const at = course.lastStandingAt != null && course.lastStandingAt >= from ? course.lastStandingAt : null;
      return {
        lineAt: null, bingoAt: null, toLine: [], toBingo: [], markCounts: counts.marked,
        lastStandingAt: at, standingCurve: at == null ? [] : course.standingAfter.slice(from, at + 1),
      };
    }
    return {
      lineAt: firstWinAt(valid, this.queue, 'line', from)?.index ?? null,
      bingoAt: firstWinAt(valid, this.queue, 'bingo', from)?.index ?? null,
      toLine: counts.toLine,
      toBingo: counts.toBingo,
      markCounts: counts.marked,
      lastStandingAt: null,
      standingCurve: [],
    };
  }

  /** The Desgraciat round's valid cards still standing after the counted landings (D180: never none). */
  standingNow() {
    return standingCards(this.phaseModel.valid, this.queue.slice(0, Math.max(0, this.position + 1)));
  }

  /** PRIVATE, for the console: the Desgraciat round's cards still standing; null in other rounds or without cards. */
  standing(): StandingInfo | null {
    if (this.phaseModel.kind !== 'standing' || !this.phaseModel.valid.length) return null;
    const ids = this.standingNow().map((c) => c.id);
    return { count: ids.length, cardIds: ids.length > STANDING_LIST_MAX ? null : ids };
  }

  /** The Spin out of the song playing, from its own slot (a first play's is longer). */
  spin() {
    return spinWindow({ pace: this.songPace(), phase: this.phaseName(), nudge: this.nudge });
  }

  // ------------------------------------------------------------------------------- first plays (D174, D175)
  /** A song not counted in this Game's earlier rounds: its play gets the longer slot, on its best hook. */
  isFirstPlay(songId: number): boolean {
    return !this.played.has(songId);
  }

  /** The Pace for the song playing's slot: a first play's is the Pace × 22/14 (firstPlaySec). */
  songPace(): number {
    const cur = this.current;
    return cur && this.isFirstPlay(cur.songId) ? firstPlaySec(this.game.pace) : this.game.pace;
  }

  /** The Phase as the hook choice sees it: a first play always lands on its best hook (D174). */
  hookPhase<T extends { readonly hookTags?: readonly string[] }>(phase: T, songId: number): T {
    return this.isFirstPlay(songId) ? { ...phase, hookTags: ['best'] } : phase;
  }

  setPlayed(list: readonly number[]) {
    this.playedBefore = [...list];
    this.played = new Set(list);
  }

  /** Round `next` starts or is resumed: the round in progress's counted songs join `playedBefore` (as the journal's replay). */
  foldPlayed(next: number) {
    this.setPlayed(foldPlayed(this.playedBefore, { number: this.round.number, queue: this.queue, position: this.position }, next));
  }

  /** First plays among the Queue's indexes from `from` to before `to`. */
  firstPlaysIn(from: number, to: number): number {
    let n = 0;
    for (let i = Math.max(0, from); i < Math.min(to, this.queue.length); i++) if (this.isFirstPlay(this.queue[i])) n++;
    return n;
  }

  /**
   * The round's songs in slots (pace.ts slotSongs): its expected songs, with the first plays among those whose slots
   * count towards its end (all but the last, whose landing ends it).
   */
  roundSlots(): number {
    const songs = roundSongs(this.round.kind, SCHEDULE, this.expectedSongs);
    return slotSongs(songs, this.firstPlaysIn(0, songs - 1));
  }

  /** A round's length from its start, as its target: the Queue just drawn and the songs played before it. */
  roundTargetSec(kind: RoundKind): number {
    return roundLengthSec({ pace: this.game.pace, kind, firstPlays: this.firstPlaysIn(0, roundSongs(kind, SCHEDULE) - 1) });
  }

  /** First plays among the songs whose slots are still to come: the one playing to the second-to-last expected. */
  firstPlaysLeft(): number {
    return this.firstPlaysIn(this.position, roundSongs(this.round.kind, SCHEDULE, this.expectedSongs) - 1);
  }

  /**
   * Each pool's songs no round will have played by this round's expected end, for later rounds' first plays (D178).
   * A song in several pools counts in each (D268), and once played in any round it is played for all of them: the
   * first plays are the Game's (D174), not a pool's.
   */
  poolsLeft(): Record<string, { songs: number; unplayed: number }> {
    const end = roundSongs(this.round.kind, SCHEDULE, this.expectedSongs);
    const thisRound = new Set(this.queue.slice(0, end));
    const out: Record<string, { songs: number; unplayed: number }> = {};
    for (const id of this.catalog.keys()) {
      const unplayed = !this.played.has(id) && !thisRound.has(id);
      for (const pool of this.poolsOf(id)) {
        const p = (out[pool] ??= { songs: 0, unplayed: 0 });
        p.songs++;
        if (unplayed) p.unplayed++;
      }
    }
    return out;
  }

  schedule() {
    const plan = this.plan;
    const after = plan?.rounds.filter((r) => r.number > this.round.number) ?? [];
    const nowMs = this.env.nowMs();
    const est = scheduleEstimate({
      nowMs,
      round: { ...this.round, targetEndMs: this.round.targetEndMs + 1000 * this.targetShiftSec, songs: this.expectedSongs, firstPlays: this.firstPlaysLeft(), pool: this.round.pool },
      game: { roundsTotal: this.game.roundsTotal },
      position: this.position,
      pace: this.game.pace,
      phase: this.phaseName(),
      lineConfirmed: this.round.lineConfirmed,
      locked: this.game.paceLocked,
      pools: this.poolsLeft(),
      later: plan
        ? {
            kinds: after.map((r) => r.kind),
            pools: after.map((r) => this.roundPool(r.cardType || defaultCardType(r.kind), roundSide(r)) ?? DEFAULT_POOL),
            intervalSec: this.intervalSec(),
            // What the planned breaks with a Throw add to (or take from) their Intervals: each one is its break's length.
            throwsSec: (plan.schedule.throws ?? []).filter((b) => b.afterRound >= this.round.number && b.afterRound < (after.at(-1)?.number ?? 0)).reduce((s, b) => s + 60 * b.minutes - this.intervalSec(), 0),
          }
        : null,
    });
    // The flag and moon say when the round and the night should end; at the doors that's from the planned start
    // (plan.schedule.startAtMs), or from now if now is later. Only the ends move: the Drift (and so the nudge) stays.
    const startAtMs = this.scene === 'before' ? plan?.schedule.startAtMs : null;
    const waitMs = startAtMs != null ? Math.max(0, startAtMs - nowMs) : 0;
    return waitMs ? { ...est, roundEndMs: est.roundEndMs + waitMs, gameEndMs: est.gameEndMs + waitMs } : est;
  }

  updateNudge() {
    const { roundDriftSec } = this.schedule();
    this.nudge = driftNudge({ driftSec: roundDriftSec, position: this.position, pace: this.game.pace, phase: this.phaseName(), locked: this.game.paceLocked, kind: this.round.kind, songs: this.expectedSongs, firstPlays: this.firstPlaysLeft() });
  }

  prefetch() {
    const ids = [this.queue[this.position], this.queue[this.position + 1], this.queue[this.position + 2]].filter((id) => id != null);
    // An open Suspense teases the songs it hovers over: their audio stays decoded too.
    for (const id of this.suspense?.hover ?? []) if (!ids.includes(id)) ids.push(id);
    this.out.push({ type: 'prefetch', ids });
  }

  /** A song as the remotes see it; an id missing from the catalog still gets a placeholder. */
  songRef(id: number): SongRef {
    const s = this.catalog.get(id);
    return s ? { songId: id, title: s.title, artist: s.artist } : { songId: id, title: String(id), artist: '' };
  }

  /** `songRef`, or null for no song (past the end of the Queue). */
  songInfo(id: number | null | undefined): SongRef | null {
    return id == null ? null : this.songRef(id);
  }

  snapshot(): EventBody<'state'> {
    const now = this.env.now();
    const toMs = (t: number | null) => (t == null ? null : this.env.toEpochMs(t));
    const cur = this.current;
    const schedule = this.schedule();
    const spin = this.spin();
    return {
      type: 'state',
      seq: ++this.seq,
      atMs: this.env.nowMs(),
      status: this.status,
      pending: this.pending ? 'next' : null,
      hold: this.hold ? { sinceMs: this.env.toEpochMs(this.hold.since), reason: this.hold.reason, holdMusic: this.holdMusic, holdMusicAtMs: toMs(this.timers.holdMusicAt), ducked: this.hold.ducked } : null,
      holdMusic: this.holdMusic,
      current: cur ? { ...this.songRef(cur.songId), hookId: cur.hookId, firstPlay: this.isFirstPlay(cur.songId), posSec: round2(cur.offset + (now - cur.startCtx) * cur.rate), endsAtMs: toMs(cur.endCtx) } : null,
      beat: this.beat.info ? { ...this.beat.info } : null,
      next: this.songInfo(this.queue[this.position + 1]),
      queue: { position: this.position, length: this.queue.length },
      round: { ...this.round, drumSeed: this.drumSeed },
      game: { ...this.game, autoSounds: { ...this.game.autoSounds }, volumes: { ...this.volumes } },
      phase: this.phaseName(),
      heat: this.phaseStep(this.position + 1)?.heat ?? null,
      cards: {
        inPlay: this.cardsInPlayText,
        inPlayCount: this.cardsInPlay.length,
        validCount: this.phaseModel.valid.length,
        phaseSource: this.game.phaseOverride ? 'override' : this.phaseModel.plan ? 'cards' : 'placeholder',
        climbingTo: this.phaseModel.kind,
        lastAdd: this.cardsLastAdd ? { ...this.cardsLastAdd } : null,
      },
      possibleWinners: this.possibleWinners(),
      future: this.future(),
      standing: this.standing(),
      prizes: { revealed: this.prizesRevealed.map((r) => ({ ...r })) },
      pace: { sec: this.game.pace, firstPlaySec: round2(firstPlaySec(this.game.pace)), defaultSec: PACE.defaultSec, locked: this.game.paceLocked, nudge: round2(this.nudge), slotSec: round2(spin.slot), spinSec: round2(spin.dTarget) },
      schedule: { ...schedule, roundDriftSec: Math.round(schedule.roundDriftSec), gameDriftSec: schedule.gameDriftSec == null ? null : Math.round(schedule.gameDriftSec) },
      autoAtMs: toMs(this.timers.autoAt),
      transition: this.transition
        ? { id: this.transition.id, recipe: this.transition.plan.recipe, phase: this.transition.plan.phase, to: this.transition.songId, landAtMs: this.env.toEpochMs(this.transition.T) }
        : null,
      suspense: this.suspense
        ? { id: this.suspense.id, sinceMs: this.env.toEpochMs(this.suspense.open.spinStart), autoReleaseAtMs: this.env.toEpochMs(this.suspense.autoReleaseAt) }
        : null,
      landings: this.landings.slice(-10).map((l) => ({ ...this.songRef(l.songId), position: l.position, atMs: l.atMs, undone: l.undone })),
      history: this.history.slice(-8).map(({ recipe, family, exit, songId, hookId, phase }) => ({ recipe, family, exit, songId, hookId, phase })),
      scene: this.scene,
      pause: this.pause ? { sinceMs: this.pause.sinceMs, overlay: this.pauseOverlay() } : null,
      shuffle: this.shuffle ? { round: this.shuffle.round, startAtMs: this.env.toEpochMs(this.shuffle.startAt), endAtMs: this.env.toEpochMs(this.shuffle.endAt) } : null,
      intro: this.intro ? { ...this.intro } : null,
      claims: this.claims.map(copyClaim),
      check: this.checkInfo(),
      celebrationNext: this.celebrationNext ? { ...this.celebrationNext } : null,
      celebration: this.celebration ? { ...this.celebration, cardIds: [...this.celebration.cardIds] } : null,
      interval: this.interval ? { ...this.interval } : null,
      winners: this.winners.map((w) => ({ ...w })),
      resume: this.resumeToken(),
      intervalMusic: this.pause
        ? { set: 'pausa', track: this.pausaNow ? { ...this.pausaNow } : null }
        : this.bed === 'interval' ? { set: this.bedSet, track: this.intervalNow ? { ...this.intervalNow } : null } : null,
      celebrationChoice: this.celebrationChoice,
      lastRound: this.isLastRound(),
      finale: this.finaleInfo(),
      throwSong: this.throwInfo(),
      throwSongs: { throw: throwTrackInfo('throw'), storm: throwTrackInfo('storm') },
      voice: this.voice ? { cue: this.voice.cue, sinceMs: this.voice.sinceMs, durationMs: this.voice.durationMs } : null,
      soundTest: this.soundTest ? { ...this.soundTest } : null,
      twoLevelHeld: this.twoLevelHeld
        ? { button: this.twoLevelHeld.button, clientId: this.twoLevelHeld.clientId, label: this.twoLevelHeld.clientId, sinceMs: this.twoLevelHeld.sinceMs }
        : null,
      voiceNext: this.voiceNext(),
      padHold: this.padHeld ? { effect: this.padHeld.effect, sinceMs: this.padHeld.sinceMs, intensity: this.padHeld.intensity } : null,
      audioStalled: this.audioStall ? { ...this.audioStall } : null,
    };
  }

  // ---------------------------------------------------------------------------------- the beat
  /**
   * The grid the room hears now (`state.beat`) and the deck it comes from, or null when no song is heard: Pausa, Hold
   * music, scene music (a bed), a Check's reveals (its revealed songs over the music, far down), no song, or a song with no
   * grid. Parlem and the voice cues' dips still count as heard. A Spin's is the incoming song's from the outgoing one's
   * exit start on (from its start without one), anchored on the landing: never before its `transition.scheduled`, which
   * comes with the Spin. A held Suspense's is the outgoing song's while it plays on (its phrase loop, or until its exit
   * starts), else null: the incoming song's beat waits for the release's Spin.
   */
  beatCandidate(now: number): { grid: BeatGrid; source: BeatSource } | null {
    if (this.pause || this.holdMusic || this.bed) return null;
    const run = this.check;
    if (run && run.info.revealed.length && run.info.cue == null) return null; // the music is under checkDuck
    const cur = this.current;
    /** The outgoing song still plays as it did: its exit move (which bends its time) hasn't started. */
    const aPlays = (songId: number | null | undefined, exitStart: number | null | undefined) => cur != null && cur.songId === songId && exitStart != null && now < exitStart;
    const t = this.transition;
    if (t && !aPlays(t.fromSongId, t.aExitStart)) {
      const { startCtx, offset, rate } = t.plan.b;
      return this.deckGrid({ songId: t.songId, startCtx, offset, rate }, t.plan.hook.downbeatIndex, now);
    }
    const s = this.suspense;
    if (s && !(s.open.loop && cur?.songId === s.open.loop.songId) && !aPlays(s.open.a?.songId, s.open.a?.exitStart)) return null;
    if (!cur) return null;
    return this.deckGrid({ songId: cur.songId, startCtx: cur.startCtx, offset: cur.offset, rate: cur.rate }, cur.landedDownbeatIndex, now);
  }

  /** The grid of the deck `source` at `now` (plan/beat.ts deckBeat), with that source; null without its analysis or a grid. */
  deckGrid(source: BeatSource, landedDownbeatIndex: number | null, now: number): { grid: BeatGrid; source: BeatSource } | null {
    const analysis = this.env.analysis(source.songId);
    const grid = analysis ? deckBeat(analysis, source, landedDownbeatIndex, now) : null;
    return grid ? { grid, source } : null;
  }

  /** Publish the beat heard now when it changed materially (plan/beat.ts nextBeat). @returns whether the value changed */
  refreshBeat(): boolean {
    const now = this.env.now();
    const toMs = (t: number) => this.env.toEpochMs(t);
    const heard = this.beatCandidate(now);
    const next = nextBeat(this.beat, heard && { info: beatInfo(heard.grid, toMs), source: heard.source }, toMs(now));
    const changed = next.info !== this.beat.info;
    this.beat = next;
    return changed;
  }

  // ---------------------------------------------------------------------------------- output
  emit(event: ShowEventBody) {
    this.out.push({ type: 'emit', message: makeEvent(event) });
  }

  emitState() {
    this.refreshBeat();
    this.emit(this.snapshot());
  }

  reject(reqId: string | null, cmd: string | null, reason: RejectReason, detail?: string) {
    this.out.push({ type: 'reject', reqId, cmd, reason, detail });
    this.emit({ type: 'command.rejected', reqId, cmd, reason, ...(detail ? { detail } : {}) });
  }

  flush() {
    const out = this.out;
    this.out = [];
    return out;
  }
}
