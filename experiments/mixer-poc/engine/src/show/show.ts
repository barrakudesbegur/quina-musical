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
import { checkCommand, makeEvent, COMMANDS, RECIPE_IDS } from '@quina/protocol';
import type {
  CelebrationInfo,
  CelebrationMusic,
  CheckInfo,
  ClaimInfo,
  ClimbTarget,
  CommandFields,
  GameRecord,
  IntervalInfo,
  IntroInfo,
  PauseInfo,
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
  RejectReason,
  RoundInfo,
  RoundKind,
  ShowEvent,
  ShowEventBody,
  ShowEventType,
  ShowStatus,
  SongRef,
  SoundName,
} from '@quina/protocol';
import { HOLD, ENGINE, PHASES, PACE, SUSPENSE, DECOYS, FLOW, type DecoyConfig } from '../config.ts';
import { validCards, possibleWinners, parseCardRanges } from '../game/cards.ts';
import { computeCheck, timeCheck, type CheckResult, type TimedStep } from '../game/check.ts';
import { tieFreeShuffle } from '../game/shuffle.ts';
import { sceneAllows, type SceneContext } from './flow.ts';
import { phasePlan } from '../game/phase.ts';
import { phaseFor } from '../plan/phases.ts';
import { planTransition } from '../plan/planner.ts';
import { openSuspense, releaseSuspense, suspenseBar, type SuspenseOpen } from '../plan/suspense.ts';
import { withDecoy } from '../plan/decoys.ts';
import { pickHook } from '../plan/hooks.ts';
import { tempoMatch } from '../plan/tempo.ts';
import { spinWindow, autoPressAt, pressAfterHold, defaultPace, scheduleEstimate, driftNudge, roundLengthSec, PACE_LIMITS } from '../plan/pace.ts';
import { mixSeed, seededRandom } from '../rng.ts';
import type { Analysis, Hook } from '../analysis.ts';
import type { Card } from '../game/cards.ts';
import type { PhaseStep } from '../game/phase.ts';
import type { BlendSource, Plan, SignatureSource } from '../plan/planner.ts';
import type { PlanEvent, StemName } from '../plan/recipes.ts';

/** Which Hold music fits: 'error' after Back and a failed Check, 'hold' otherwise. */
export type HoldMood = 'hold' | 'error';
/** Scene music that is not Hold music: the Celebration's ('winningSong', 'victory') or the Interval's. */
export type Bed = 'winningSong' | 'victory' | 'interval';

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
  afterLanding: null | 'back' | 'hold' | 'claim';
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
}

// ---- effects: what the runtime must do. Audio-clock times in seconds. -------------------------------------
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
  drum: { removeId: number | null; targetId: number; minLaps: number; brake?: boolean };
}
/** A Suspense opens: A's duck and exit, the drum starts coasting (after removing the last song's card). */
export interface StartSuspenseEffect {
  type: 'startSuspense';
  open: SuspenseOpen;
  fromHoldMusic: boolean;
  drum: { removeId: number | null; targetId: number };
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
  drum: { insertId: number | null; selectId: number | null };
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
export interface DrumBackEffect {
  type: 'drumBack';
  insertId: number | null;
  selectId: number | null;
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
/**
 * A Check's steps, timed in advance: everything else (the song or Hold music) ducks to `duckDb` from `startAt`
 * to `endAt`; each ✓ step plays the song's hook snippet (/snippets/<id>.flac), each ✗ the "broken record".
 */
export interface CheckSnippetsEffect {
  type: 'checkSnippets';
  claimId: string;
  steps: TimedStep[];
  startAt: number;
  endAt: number;
  duckDb: number;
}
/** Answer `getJournal` with a `journal.entries` event from the local journal (the runtime keeps the entries). */
export interface JournalRequestEffect {
  type: 'journalRequest';
  reqId: string;
  fromSeq: number;
}
/** Stop a Check's snippets now and bring the music back up. */
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
/** Interval music (the 'celebration' mood until an Interval playlist exists); a victory track playing goes on. */
export interface IntervalMusicEffect {
  type: 'intervalMusic';
  at: number;
  fadeSec: number;
  levelDb: number;
}
/** The technical pause's "Tornem de seguida" on the show page (its Hold music comes as a holdMusic effect). */
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
/** What the runtime must do, as a discriminated union on `type`: `switch (effect.type)` narrows it. */
export type Effect =
  | EmitEffect
  | RejectEffect
  | PrefetchEffect
  | StartTransitionEffect
  | LandedEffect
  | CancelTransitionEffect
  | DuckEffect
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
  | CheckSnippetsEffect
  | CancelCheckEffect
  | CelebrationMusicEffect
  | IntervalMusicEffect
  | PauseOverlayEffect
  | LogEffect;
export type EffectType = Effect['type'];
/** One effect by type, for example `EffectOf<'startTransition'>`. */
export type EffectOf<T extends EffectType> = Extract<Effect, { type: T }>;

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
  cards?: readonly Card[];
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
  /** The Decoys experiment's settings (config.ts DECOYS; `enabled: false` by default). */
  decoys?: Partial<DecoyConfig>;
}

/** An event as the machine builds it, before `makeEvent` stamps the version. */
type EventBody<T extends ShowEventType> = Extract<ShowEventBody, { type: T }>;
type SetGameField = keyof CommandFields['setGame'];

/** The settings `setGame` may change: exactly the fields of the protocol's command. */
const SET_GAME_FIELDS = Object.keys(COMMANDS.setGame) as SetGameField[]; // Object.keys only knows string[]

const round2 = (x: number) => Math.round(x * 100) / 100;
const PHASE_RANK: Record<PhaseName, number> = { early: 0, mid: 1, late: 2, final: 3 };

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
  /** Every printed card (cards.json); only the ones in play and valid for the round count. */
  readonly allCards: readonly Card[];
  cardsInPlayText = '';
  cardsInPlay: number[] = [];
  phaseModel: PhaseModel = { kind: 'line', start: 0, seed: 0, valid: [], plan: null };
  readonly catalog: Map<number, SongInfo>;
  fixedQueue: number[] | null;
  status: ShowStatus = 'locked';
  unlocked = false;
  game: GameSettings;
  round: RoundInfo = { number: 1, kind: 'normal', startedAtMs: 0, targetEndMs: 0, lineConfirmed: false };
  queue: number[] = [];
  position = -1;
  current: PlayingSong | null = null;
  transition: Transition | null = null;
  pending: PendingNext | null = null;
  hold: HoldState | null = null;
  holdMusic = false;
  timers: Timers = { autoAt: null, holdMusicAt: null };
  history: HistoryEntry[] = [];
  landings: Landing[] = [];
  nudge = 1;
  seq = 0;
  transitionCount = 0;
  /** Climbs ('line', 'bingo') whose "final lap" stinger already played this round. */
  readonly stingerClimbs = new Set<ClimbTarget>();
  /** A Suspense held open (status 'transition', no `transition` until it is released). */
  suspense: SuspenseState | null = null;
  /** The next song's hook, chosen early so its Blend render can be prepared. */
  nextHook: { songId: number; hook: Hook } | null = null;
  blendRequested = '';
  readonly decoys: DecoyConfig;
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
  pause: PauseInfo | null = null;
  /** The public Shuffle's animation (audio-clock seconds), while it runs. */
  shuffle: { round: number; startAt: number; endAt: number } | null = null;
  intro: IntroInfo | null = null;
  /** This round's Claims, oldest first. */
  claims: ClaimInfo[] = [];
  /** Claims made in the whole Game (claim ids count on from it). */
  claimCount = 0;
  /** The Check on screen; `endAt` (audio clock) is when its result shows. */
  check: { info: CheckInfo; endAt: number } | null = null;
  /** The Claims of the Check in progress, and the Celebration it interrupted (it comes back if none is valid). */
  batch: { claimIds: string[]; celebration: CelebrationInfo | null } | null = null;
  /** Start the next queued Claim's Check as soon as nothing is in the way. */
  autoCheck = false;
  celebration: CelebrationInfo | null = null;
  /** The hook the Winning song landed on, for its Celebration loop. */
  winningHook: string | null = null;
  interval: IntervalInfo | null = null;
  winners: WinnerInfo[] = [];
  /** Scene music playing instead of a song or Hold music. */
  bed: Bed | null = null;
  /** The phones' next Heat sample (`heat.sample`, audio clock), drawn at the last landing. */
  heatSample: { at: number; value: number } | null = null;
  holdMusicMood: HoldMood = 'hold';
  out: Effect[] = [];

  constructor({ env, songs, cards = [], cardsInPlay = '', fixedQueue = null, settings = {}, gameId, restore = null, decoys = {} }: ShowOptions) {
    this.env = env;
    this.decoys = { ...DECOYS, ...decoys };
    this.allCards = cards;
    this.gameId = restore?.gameId || gameId || newGameId(env);
    this.catalog = new Map(songs.map((s) => [s.id, s]));
    this.fixedQueue = fixedQueue;
    this.game = {
      pace: defaultPace(1),
      paceLocked: false,
      autoAdvance: true,
      autoAdvanceFinal: false,
      songsUntilWinner: 20,
      phaseOverride: null,
      roundsTotal: 5,
      holdMusicAfterSec: HOLD.holdMusicAfterSec,
      nextRecipe: null,
      finalLapStinger: true,
      ...settings,
    };
    // Its effects wait for the runtime's first flush().
    if (restore?.round) {
      this.restore(restore, restore.round);
      return;
    }
    if (restore) this.journalSeq = restore.seq; // a journal without a round yet: keep numbering it
    if (restore?.settings) this.game = { ...this.game, ...restore.settings };
    const ranges = restore?.cardsInPlay || cardsInPlay;
    try {
      this.setCards(ranges);
      if (ranges && ranges !== restore?.cardsInPlay) this.journal({ kind: 'cards.set', ranges });
    } catch {}
    // Round 1's Queue is drawn now, without the public Shuffle: the Game is `before` until the first Spin
    // (or until the presenters introduce the round and run its Shuffle).
    this.startRound(1, 'normal', { keepPace: settings.pace != null || restore?.settings != null });
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
    if (this.status === 'locked' && c.cmd !== 'unlock' && c.cmd !== 'getState' && c.cmd !== 'getJournal') {
      this.reject(reqId, c.cmd, 'locked');
      return this.flush();
    }
    if (!sceneAllows(c.cmd, this.sceneContext())) {
      this.reject(reqId, c.cmd, 'wrongScene', this.pause ? `paused (scene ${this.scene})` : `scene ${this.scene}`);
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
        this.next(reqId);
        break;
      case 'back':
        this.back(reqId);
        break;
      case 'hold': {
        const on = c.on;
        const holding = this.status === 'hold';
        if (on === true || (on === undefined && !holding)) this.holdOn(reqId);
        else this.release(reqId);
        break;
      }
      case 'holdMusic':
        this.holdMusicNow();
        break;
      case 'suspense':
        if (c.on ?? !this.suspense) this.startSuspense(reqId);
        else if (this.suspense) this.releaseSuspense(reqId);
        else this.reject(reqId, c.cmd, 'noSuspense');
        break;
      case 'setPace':
        this.setPace(c);
        break;
      case 'setGame':
        this.setGame(c);
        break;
      case 'confirmLine':
        this.confirmLine();
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
      case 'newRound': {
        // Default: the introduced round; in `before`, round 1 again (the Game has not started); else the next.
        const number = c.number ?? this.intro?.round ?? (this.scene === 'before' ? this.round.number : this.round.number + 1);
        this.newRound(number, c.kind ?? this.intro?.kind ?? 'normal');
        break;
      }
      case 'roundIntro':
        this.roundIntro(c.number ?? (this.scene === 'before' ? this.round.number : this.round.number + 1), c.kind ?? 'normal');
        break;
      case 'claim':
        this.claim(c.cardId, c.kind ?? this.phaseModel.kind);
        break;
      case 'checkStart': {
        const claim = this.undecidedClaim(reqId, c.cmd, c.claimId);
        if (claim) this.runCheck(claim);
        break;
      }
      case 'decide': {
        const claim = this.undecidedClaim(reqId, c.cmd, c.claimId);
        if (claim) this.decide(claim, c.valid);
        break;
      }
      case 'winnerInfo':
        this.winnerInfo(reqId, c);
        break;
      case 'celebrationMusic':
        if (this.celebration) this.celebrationMusic(c.choice);
        break;
      case 'interval':
        this.startInterval();
        break;
      case 'endGame':
        // Within 0.15 s of a landing a Spin can no longer be cancelled: press again.
        if (this.transition && this.transition.T - this.env.now() < HOLD.cancelMinSec) this.reject(reqId, c.cmd, 'busy');
        else this.endGame();
        break;
      case 'pause':
        this.setPause(c.on ?? !this.pause);
        break;
      case 'panic':
        this.panic();
        break;
      case 'sfx': {
        // The protocol only lets known sound names through; the engine still plays only the sounds it has.
        const known: readonly string[] = [...ENGINE.sfx, ...ENGINE.stingers];
        if (known.includes(c.name)) this.out.push({ type: 'sfx', name: c.name });
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
    const now = this.env.now();
    if (this.unlocked) this.tickFlow(now);
    if (this.status !== 'transition' && this.status !== 'locked') this.prepareNext();
    const t = this.transition;
    if (t && now >= t.T) this.land(t);
    // After any landing in this tick, which replaces a sample not yet sent: never one at a landing.
    this.sendHeatSample(now);
    if (this.suspense) this.tickSuspense(this.suspense, now);
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
  startRound(number: number, kind: RoundKind, { stop = false, keepPace = false, shuffle = false, keepMusic = false } = {}) {
    if (stop) this.out.push({ type: 'stopAll', fadeSec: 0.3 });
    const drawn = this.drawQueue(kind);
    this.queue = drawn.queue;
    this.shuffleSeed = drawn.seed;
    this.shuffleAttempts = drawn.attempts;
    if (drawn.tied) this.out.push({ type: 'log', level: 'warn', message: `round ${number}: every Shuffle up to ${FLOW.shuffleMaxAttempts} had a Tie; kept the last (seed ${drawn.seed})` });
    this.position = -1;
    this.resetLive({ keepMusic });
    this.landings = [];
    // The round's Claims, Check, Celebration and Interval end with it; the Winners stay with the Game.
    this.claims = [];
    this.check = null;
    this.batch = null;
    this.autoCheck = false;
    this.celebration = null;
    this.winningHook = null;
    this.interval = null;
    this.intro = null;
    this.shuffle = null;
    if (!this.game.paceLocked && !keepPace) this.game.pace = defaultPace(number);
    const nowMs = this.env.nowMs();
    // The round's target end comes from the Pace it starts with; Drift is measured against it.
    this.round = { number, kind, startedAtMs: nowMs, targetEndMs: nowMs + 1000 * roundLengthSec({ pace: this.game.pace }), lineConfirmed: false };
    // A secret seed drawn at the Shuffle blurs this round's Phase; it stays with the Queue.
    this.phaseModel = { kind: 'line', start: 0, seed: Math.floor(this.env.random() * 2 ** 32) >>> 0, valid: [], plan: null };
    this.rebuildPhase();
    this.journal({
      kind: 'round.started',
      round: number,
      roundKind: kind,
      queue: [...this.queue],
      phaseSeed: this.phaseModel.seed,
      startedAtMs: this.round.startedAtMs,
      targetEndMs: this.round.targetEndMs,
      settings: this.journalSettings(),
      shuffleSeed: this.shuffleSeed,
      shuffleAttempts: this.shuffleAttempts,
    });
    if (shuffle) {
      const now = this.env.now();
      this.shuffle = { round: number, startAt: now, endAt: now + FLOW.shuffleSec };
      this.emit({
        type: 'shuffle.scheduled', round: number, kind, songCount: this.queue.length,
        startAtMs: this.env.toEpochMs(now), endAtMs: this.env.toEpochMs(this.shuffle.endAt),
      });
    }
    this.out.push({ type: 'drumReset', ids: [...this.queue] });
    this.prefetch();
  }

  /**
   * The round's Queue: the tie-free Shuffle of the Pool (game/shuffle.ts) from a secret seed, checked against
   * the cards in play valid for a round of this kind. A fixed Queue bypasses it (seed 0, attempts 0).
   */
  drawQueue(kind: RoundKind): { queue: number[]; seed: number; attempts: number; tied: boolean } {
    const fixed = this.fixedQueue?.filter((id) => this.catalog.has(id));
    if (fixed?.length) return { queue: fixed, seed: 0, attempts: 0, tied: false };
    const seed = Math.floor(this.env.random() * 2 ** 32) >>> 0;
    const cards = validCards(this.allCards, this.cardsInPlay, kind);
    return tieFreeShuffle({ pool: [...this.catalog.keys()], cards, seed, maxAttempts: FLOW.shuffleMaxAttempts });
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
    if (record.settings) this.game = { ...this.game, ...record.settings, nextRecipe: null };
    try {
      this.setCards(record.cardsInPlay);
    } catch {} // ranges were checked when they were entered
    this.queue = [...round.queue];
    this.position = Math.min(round.position, this.queue.length - 1);
    this.resetLive();
    const now = this.env.now();
    const nowMs = this.env.nowMs();
    // Landing times on this page's audio clock (in the past, possibly before it started).
    this.landings = round.landings.map((l) => ({ songId: l.songId, position: l.position, atMs: l.atMs, undone: l.undone, T: now - (nowMs - l.atMs) / 1000 }));
    this.round = { number: round.number, kind: round.kind, startedAtMs: round.startedAtMs, targetEndMs: round.targetEndMs, lineConfirmed: round.climbingTo === 'bingo' };
    this.phaseModel = { kind: round.climbingTo, start: round.climbFrom, seed: round.phaseSeed, valid: [], plan: null };
    this.shuffleSeed = round.shuffleSeed;
    this.shuffleAttempts = round.shuffleAttempts;
    this.rebuildPhase();
    this.updateNudge();
    this.restoreFlow(record);
    // The drum keeps the cards not yet played, with the last landing under the pointer.
    const last = this.position >= 0 ? this.queue[this.position] : undefined;
    const remaining = this.queue.slice(this.position + 1);
    this.out.push(last == null ? { type: 'drumReset', ids: remaining } : { type: 'drumReset', ids: [last, ...remaining], selectId: last });
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
    this.intro = record.intro ? { round: record.intro.round, kind: record.intro.kind, sinceMs: record.sceneSinceMs } : null;
    const inPlay = new Set(this.cardsInPlay);
    this.claims = record.claims.map((c) => ({
      claimId: c.claimId, round: c.round, cardId: c.cardId, kind: c.kind, atMs: c.atMs, position: c.position,
      status: c.verdict ?? 'queued', outcome: null, completeSince: null,
      warnings: this.allCards.some((card) => card.id === c.cardId) && !inPlay.has(c.cardId) ? ['notSold'] : [],
    }));
    if (this.scene === 'check') this.batch = { claimIds: this.claims.filter((c) => c.status === 'queued').map((c) => c.claimId), celebration: null };
    if (this.scene === 'celebration') {
      const kind: WinKind = this.claims.some((c) => c.status === 'valid' && c.kind === 'bingo') ? 'bingo' : 'line';
      this.celebration = this.celebrationOf(kind, this.sceneSinceMs, kind === 'line' ? 'winningSong' : 'victory');
    }
    if (this.scene === 'interval') this.interval = this.intervalFrom(this.sceneSinceMs);
  }

  /** The Game as this show holds it, in the shape `replayJournal` produces from its journal. */
  record(): GameRecord {
    return {
      gameId: this.gameId,
      seq: this.journalSeq,
      cardsInPlay: this.cardsInPlayText,
      settings: this.journalSettings(),
      scene: this.scene,
      sceneSinceMs: this.sceneSinceMs,
      intro: this.intro ? { round: this.intro.round, kind: this.intro.kind } : null,
      claims: this.claims.map((c): RecordedClaim => ({
        claimId: c.claimId, round: c.round, cardId: c.cardId, kind: c.kind, position: c.position, atMs: c.atMs,
        verdict: c.status === 'valid' || c.status === 'invalid' ? c.status : null,
      })),
      claimCount: this.claimCount,
      winners: this.winners.map((w) => ({ ...w })),
      round: {
        number: this.round.number,
        kind: this.round.kind,
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
      },
    };
  }

  journalSettings(): JournalSettings {
    const { nextRecipe: _testOnly, ...settings } = this.game;
    return settings;
  }

  /** Append an entry to the Game journal: the runtime keeps it, remotes may keep a copy. */
  journal(body: JournalEntryBody, atMs = this.env.nowMs()) {
    const entry: JournalEntry = { ...body, gameId: this.gameId, seq: ++this.journalSeq, atMs };
    this.out.push({ type: 'journal', entry });
    this.emit({ type: 'journal.entry', entry });
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
    // Decoys (experiment): rolled before planning, so a Decoy takes the place of B's Tease. Its own random
    // stream; with Decoys off nothing here runs.
    const wantDecoy = this.decoys.enabled && this.decoyCandidate() != null && seededRandom(seed ^ 0x2545f491)() < (this.decoys.chance[phase.name] ?? 0);
    const planned = planner({
      now,
      A,
      B: { songId, analysis, stems: this.env.stems?.(songId) ?? null, blend, signatures: this.env.signatures?.(songId) ?? null },
      hookOverride: chosen,
      phase,
      spin,
      history: this.history,
      rng: seededRandom(seed),
      // An override that is not a recipe id is ignored, as the planner would ignore it.
      recipeOverride: RECIPE_IDS.find((r) => r === this.game.nextRecipe) ?? null,
      kind: 'next',
      id,
      ...(wantDecoy ? { allowTease: false } : {}),
    });
    if ('error' in planned) return this.reject(reqId, 'next', 'planFailed', planned.error);
    this.startPlaying();
    let plan: ShowPlan = { ...planned, seed, reqId, targetPos };
    if (wantDecoy) plan = this.addDecoy(plan);
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
    this.out.push({ type: 'startTransition', plan, fromHoldMusic: this.holdMusic || this.bed != null, drum: { removeId, targetId: songId, minLaps: 1 } });
    this.bed = null;
    // A "final lap" fanfare as the drum starts, once per climb (towards the Line, then the Bingo), the
    // first time the Phase reaches ENGINE.finalLapStingerPhase.
    const climb = this.phaseModel.kind;
    const reached = PHASE_RANK[plan.phase] >= PHASE_RANK[ENGINE.finalLapStingerPhase];
    if (this.game.finalLapStinger && reached && !this.stingerClimbs.has(climb)) {
      this.stingerClimbs.add(climb);
      this.out.push({ type: 'sfx', name: ENGINE.finalLapStinger, at: plan.spinStart + 0.05 });
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
    });
  }

  // Decoys (experiment, off by default): the most recent song that already landed, is not A, and is still
  // decoded may tease in A's place before the real build (plan/decoys.ts). Its own random stream, so the
  // rest of the show is the same with or without it.
  addDecoy(plan: ShowPlan): ShowPlan {
    const a = plan.a?.songId;
    for (const l of [...this.landings].reverse()) {
      if (l.undone || l.songId === a || l.songId === plan.b.songId || !this.env.isDecoded(l.songId)) continue;
      const analysis = this.env.analysis(l.songId);
      const landedOn = [...this.history].reverse().find((h) => h.songId === l.songId)?.hookId;
      const hook = analysis?.hooks.find((h) => h.id === landedOn) ?? analysis?.hooks.find((h) => h.valid);
      if (!analysis || !hook) continue;
      // The dice were rolled before planning (beginTransition), so it is placed whenever it fits.
      const always = { early: 1, mid: 1, late: 1, final: 1 };
      return withDecoy(plan, { source: { songId: l.songId, analysis, hook }, phase: plan.phase, rng: () => 0, config: { ...this.decoys, chance: always } });
    }
    return plan;
  }

  // ---------------------------------------------------------------------------------- Suspense
  // The presenters hold the next transition open: A exits, a loop on B's grid builds bar by bar and the drum
  // coasts, until Next (or `suspense` off) releases it onto the next free bar line. Never automatic.
  startSuspense(reqId: string | null) {
    if (this.suspense) return;
    if (this.transition || this.pending) return this.reject(reqId, 'suspense', 'busy');
    const targetPos = this.position + 1;
    if (targetPos >= this.queue.length) return this.reject(reqId, 'suspense', 'endOfQueue');
    const songId = this.queue[targetPos];
    const analysis = this.env.analysis(songId);
    if (!analysis) return this.reject(reqId, 'suspense', 'notReady');
    if (this.status === 'hold') this.leaveHold(0.4);
    const now = this.env.now();
    const phase = PHASES[this.phaseName()];
    const cur = this.current;
    const aAnalysis = cur ? this.env.analysis(cur.songId) : null;
    const A = cur && aAnalysis && cur.endCtx > now + ENGINE.minOutgoingTailSec
      ? { songId: cur.songId, analysis: aAnalysis, deck: cur, landedDownbeatIndex: cur.landedDownbeatIndex }
      : null;
    const seed = Math.floor(this.env.random() * 2 ** 32) >>> 0;
    const chosen = this.nextHook?.songId === songId ? this.nextHook.hook : null;
    this.nextHook = null;
    this.blendRequested = '';
    const open = openSuspense({ now, A, B: { songId, analysis }, phase, rng: seededRandom(seed), history: this.history, hookOverride: chosen });
    if ('error' in open) return this.reject(reqId, 'suspense', 'planFailed', open.error);
    this.startPlaying();
    const id = `tr-${++this.transitionCount}`;
    const fromHoldMusic = this.holdMusic || this.bed != null;
    this.suspense = {
      id, reqId, songId, targetPos, open, seed, startedAt: now, autoReleaseAt: now + SUSPENSE.autoReleaseSec, nextBar: 0,
      fromSongId: A ? A.songId : null, fromHoldMusic,
    };
    if (!A) this.current = null;
    this.status = 'transition';
    this.hold = null;
    this.timers = { autoAt: null, holdMusicAt: null };
    const removeId = this.position >= 0 ? this.queue[this.position] : null;
    this.out.push({ type: 'startSuspense', open, fromHoldMusic, drum: { removeId, targetId: songId } });
    this.bed = null;
    this.holdMusic = false;
    this.emit({
      type: 'suspense.started',
      id,
      reqId,
      from: A ? A.songId : null,
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
    while (open.loopStart + s.nextBar * open.bar - SUSPENSE.scheduleAheadSec <= now) {
      this.out.push({ type: 'suspenseBar', bar: s.nextBar, events: suspenseBar(open, s.nextBar) });
      s.nextBar++;
    }
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
    this.current = null; // A left as the Suspense opened
    this.transition = {
      id: s.id,
      reqId: s.reqId,
      songId: s.songId,
      targetPos: s.targetPos,
      plan,
      spinStart: plan.spinStart,
      T: plan.T,
      fromSongId: null,
      aExitStart: null,
      fromHoldMusic: s.fromHoldMusic,
      afterLanding: null,
    };
    this.out.push({ type: 'startTransition', plan, fromHoldMusic: false, drum: { removeId: null, targetId: s.songId, minLaps: 0, brake: true } });
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
    });
  }

  // Back or Hold during an open Suspense: like a cancelled Spin, nothing lands. A stays if its exit had
  // not started; otherwise Hold music takes over.
  cancelSuspense(s: SuspenseState, reason: 'back' | 'hold') {
    const now = this.env.now();
    const keepOutgoing = s.fromSongId != null && s.open.a != null && s.open.a.exitStart > now + 0.05 && this.current?.songId === s.fromSongId;
    if (!keepOutgoing) this.current = null;
    this.suspense = null;
    const lastId = this.position >= 0 ? this.queue[this.position] : null;
    this.out.push({ type: 'cancelTransition', planId: s.id, keepOutgoing, drum: { insertId: lastId, selectId: lastId } });
    this.emit({ type: 'transition.cancelled', id: s.id, reason, keptOutgoing: keepOutgoing, atMs: this.env.toEpochMs(now) });
    this.enterHold(reason === 'back' ? 'back' : 'cancel', { music: !keepOutgoing });
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
    this.history.push({ recipe: plan.recipe, family: plan.family, exit: plan.exit, songId: t.songId, hookId: plan.hook.id, phase: plan.phase });
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
    else this.scheduleAuto(t.T, completes);
    this.prefetch();
    this.emitState();
  }

  /** `completes`: cards this landing probably completes. */
  scheduleAuto(landedAt: number, completes = 0) {
    this.timers.autoAt = this.autoAdvanceAllowed()
      ? autoPressAt({ landedAt, pace: this.game.pace, phase: this.phaseName(), nudge: this.nudge, minStretch: completes > 0 ? PACE.completionStretch : 1 })
      : null;
  }

  autoAdvanceAllowed() {
    if (this.position + 1 >= this.queue.length) return false;
    const phase = this.phaseName();
    return phase === 'final' ? this.game.autoAdvanceFinal : this.game.autoAdvance;
  }

  // -------------------------------------------------------------------------------------- Hold
  holdOn(reqId: string | null) {
    if (this.status === 'hold') return;
    if (this.transition) return this.cancel(this.transition, 'hold');
    if (this.suspense) return this.cancelSuspense(this.suspense, 'hold');
    if (this.pending) this.pending = null;
    void reqId;
    this.enterHold('hold', { music: !this.current });
  }

  release(reqId: string | null) {
    if (this.status !== 'hold') return this.reject(reqId, 'hold', 'notHolding');
    if (this.current) {
      this.leaveHold(HOLD.releaseSec);
      this.status = 'playing';
      const now = this.env.now();
      this.timers.autoAt = this.autoAdvanceAllowed()
        ? pressAfterHold({ now, pace: this.game.pace, phase: this.phaseName(), nudge: this.nudge })
        : null;
      return;
    }
    // On Hold music there is no song to go back to: releasing the Hold moves on to the next song.
    this.next(reqId);
  }

  enterHold(reason: HoldReason, { music, musicDelaySec = 0 }: { music: boolean; musicDelaySec?: number }) {
    const now = this.env.now();
    this.status = 'hold';
    this.hold = { since: now, reason };
    this.timers.autoAt = null;
    if (music || !this.current) {
      this.timers.holdMusicAt = null;
      if (this.current) this.toHoldMusic();
      else this.startHoldMusic(now + musicDelaySec);
    } else {
      this.out.push({ type: 'duck', db: HOLD.duckDb, seconds: HOLD.duckSec });
      this.timers.holdMusicAt = now + this.game.holdMusicAfterSec;
    }
  }

  leaveHold(seconds: number) {
    if (this.current) this.out.push({ type: 'duck', db: 0, seconds });
    this.hold = null;
    this.timers.holdMusicAt = null;
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
    this.out.push({ type: 'drumBack', insertId: prevId, selectId: prevId });
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
    this.transition = null;
    const lastId = this.position >= 0 ? this.queue[this.position] : null;
    this.out.push({ type: 'cancelTransition', planId: t.id, keepOutgoing, drum: { insertId: lastId, selectId: lastId } });
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
  }

  rescheduleAuto() {
    if (this.status !== 'playing') return;
    const last = [...this.landings].reverse().find((l) => !l.undone);
    if (!last || !this.autoAdvanceAllowed()) {
      this.timers.autoAt = null;
      return;
    }
    const completes = this.phaseStep(last.position)?.completes ?? 0;
    const minStretch = completes > 0 ? PACE.completionStretch : 1;
    const at = autoPressAt({ landedAt: last.T, pace: this.game.pace, phase: this.phaseName(), nudge: this.nudge, minStretch });
    this.timers.autoAt = Math.max(at, this.env.now() + 1);
  }

  panic() {
    this.out.push({ type: 'stopAll', fadeSec: 0.3 });
    this.stopCheck(); // a running Check goes back to the queue
    this.current = null;
    this.transition = null;
    this.suspense = null;
    this.pending = null;
    this.hold = null;
    this.holdMusic = false;
    this.bed = null;
    this.timers = { autoAt: null, holdMusicAt: null };
    this.status = 'idle';
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
      const hook = pickHook(analysis, PHASES[this.phaseName()], this.history, rng, { minTailSec: Math.min(12, spin.slot + 2) });
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
  rebuildPhase() {
    const m = this.phaseModel;
    m.valid = validCards(this.allCards, this.cardsInPlay, this.round.kind === 'special' ? 'special' : 'normal');
    m.plan = m.valid.length
      ? phasePlan({ cards: m.valid, queue: this.queue, kind: m.kind, startPosition: m.start, seed: m.seed, cardsInPlayCount: m.valid.length })
      : null;
  }

  // A claimed Line passed its Check: from the next song the Phase climbs again, towards the Bingo.
  confirmLine() {
    if (this.round.lineConfirmed) return;
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
    return { scene: this.scene, celebrating: this.celebration?.kind ?? null, introduced: this.intro != null, paused: this.pause != null };
  }

  /** Move to another scene: journaled (a resumed Game comes back in it) and announced to the projector. */
  setScene(scene: ShowScene, round = this.round.number, roundKind: RoundKind = this.round.kind) {
    if (scene === this.scene) return;
    const previous = this.scene;
    const atMs = this.env.nowMs();
    this.scene = scene;
    this.sceneSinceMs = atMs;
    this.journal({ kind: 'scene.changed', scene, round, roundKind }, atMs);
    this.emit({ type: 'scene.changed', scene, previous, atMs });
  }

  /** The first Spin of a fresh Game, or of a round whose Shuffle has run: the round is in play. */
  startPlaying() {
    if (this.scene === 'before' || this.scene === 'roundStart') this.setScene('play');
  }

  /** A Hold for the show flow (Check, Celebration, Interval): no song lands; the scene's music is set apart. */
  flowHold(reason: HoldReason) {
    this.status = 'hold';
    this.hold = { since: this.hold?.since ?? this.env.now(), reason };
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
    // The Check's last step is over: its result shows until the presenters decide.
    const check = this.check;
    if (check && now >= check.endAt) {
      const claim = this.claims.find((c) => c.claimId === check.info.claimId);
      if (claim?.status === 'checking') {
        claim.status = 'checked';
        changed = true;
      }
    }
    if (this.maybeAutoCheck()) changed = true;
    // A Bingo's Celebration flows into the Interval by itself, so the show never stalls.
    const c = this.celebration;
    if (this.scene === 'celebration' && c?.kind === 'bingo' && !this.pause && this.env.nowMs() >= c.sinceMs + FLOW.celebration.toIntervalSec * 1000) {
      this.startInterval();
      changed = true;
    }
    if (changed) this.emitState();
  }

  // ---------------------------------------------------------------------------------- Claims and the Check
  /** A Claim: the round stops like a Hold, the Claim queues, and its Check starts when nothing is in the way. */
  claim(cardId: number, kind: WinKind) {
    const from = this.scene;
    // A Spin in flight is cancelled like Hold does ('hold'); too close to its landing, the Hold comes right after.
    this.holdOn(null);
    if (this.transition?.afterLanding === 'hold') this.transition.afterLanding = 'claim';
    if (this.hold) this.hold.reason = 'claim';
    const atMs = this.env.nowMs();
    const known = this.allCards.some((c) => c.id === cardId);
    const claim: ClaimInfo = {
      claimId: `cl-${++this.claimCount}`, round: this.round.number, cardId, kind, atMs, position: this.position,
      status: 'queued', outcome: null, completeSince: null, warnings: known && !this.cardsInPlay.includes(cardId) ? ['notSold'] : [],
    };
    this.claims.push(claim);
    this.journal({ kind: 'claim.opened', round: claim.round, claimId: claim.claimId, cardId, winKind: kind, position: claim.position }, atMs);
    this.emit({ type: 'claim.opened', claim: { ...claim, warnings: [...claim.warnings] } });
    if (from !== 'check') {
      // A Claim during a Celebration (a late one): the Celebration comes back if no Claim of this Check is valid.
      this.batch = { claimIds: [], celebration: from === 'celebration' ? this.celebration : null };
      this.celebration = null;
      this.setScene('check');
    }
    (this.batch ??= { claimIds: [], celebration: null }).claimIds.push(claim.claimId);
    this.autoCheck = true;
  }

  /** The Claim `claimId` if it is this round's and still undecided; otherwise reject the command. */
  undecidedClaim(reqId: string | null, cmd: string, claimId: string): ClaimInfo | null {
    const claim = this.claims.find((c) => c.claimId === claimId);
    if (!claim) {
      this.reject(reqId, cmd, 'unknownClaim', `no claim ${claimId} in round ${this.round.number}`);
      return null;
    }
    if (claim.status === 'valid' || claim.status === 'invalid') {
      this.reject(reqId, cmd, 'unknownClaim', `claim ${claimId} is already decided`);
      return null;
    }
    return claim;
  }

  /** Start the next queued Claim's Check when one is due and nothing is in the way. */
  maybeAutoCheck(): boolean {
    if (!this.autoCheck || this.scene !== 'check' || this.pause || this.check || this.transition || this.suspense) return false;
    this.autoCheck = false;
    const next = this.claims.find((c) => c.status === 'queued');
    if (!next) return false;
    this.runCheck(next);
    return true;
  }

  /** What the card shows from the counted landings now (game/check.ts). */
  evaluate(claim: ClaimInfo): CheckResult {
    const result = computeCheck({
      allCards: this.allCards, cardId: claim.cardId, kind: claim.kind, roundKind: this.round.kind,
      cardsInPlay: new Set(this.cardsInPlay), queue: this.queue, position: this.position,
    });
    claim.outcome = result.outcome;
    claim.completeSince = result.completeSince;
    claim.warnings = result.warnings;
    return result;
  }

  /** (Re)start a Claim's Check from the counted landings now; its steps are timed in advance. */
  runCheck(claim: ClaimInfo) {
    this.stopCheck();
    const result = this.evaluate(claim);
    const now = this.env.now();
    const timed = timeCheck(result.steps, now, FLOW.check);
    const ms = (t: number) => this.env.toEpochMs(t);
    const info: CheckInfo = {
      claimId: claim.claimId, cardId: claim.cardId, kind: claim.kind, outcome: result.outcome, row: result.row, otherRows: result.otherRows,
      steps: timed.steps.map((s) => ({ songId: s.songId, landed: s.landed, atMs: ms(s.at), durationMs: Math.round(s.durationSec * 1000) })),
      startAtMs: ms(timed.startAt),
      endAtMs: ms(timed.endAt),
    };
    claim.status = timed.endAt > now ? 'checking' : 'checked';
    this.check = { info, endAt: timed.endAt };
    if (timed.steps.length) this.out.push({ type: 'checkSnippets', claimId: claim.claimId, steps: timed.steps, startAt: timed.startAt, endAt: timed.endAt, duckDb: FLOW.check.duckDb });
    this.emit({ type: 'check.scheduled', check: info });
  }

  /** Take the Check off screen; a running one stops, and its Claim goes back to the queue. */
  stopCheck() {
    const check = this.check;
    if (!check) return;
    this.check = null;
    const claim = this.claims.find((c) => c.claimId === check.info.claimId);
    if (claim?.status !== 'checking') return;
    claim.status = 'queued';
    if (check.info.steps.length) this.out.push({ type: 'cancelCheck', claimId: claim.claimId });
  }

  /** After a Back: the undecided Claims' Checks are out of date; they wait to be run again. */
  requeueClaims() {
    this.stopCheck();
    for (const c of this.claims) {
      if (c.status === 'valid' || c.status === 'invalid') continue;
      c.status = 'queued';
      c.outcome = null;
      c.completeSince = null;
    }
    this.autoCheck = false;
  }

  /** The presenters' verdict, journaled either way. A valid Claim makes a Winner; an invalid one gets the Failure fanfare. */
  decide(claim: ClaimInfo, valid: boolean) {
    if (this.check?.info.claimId === claim.claimId) {
      if (claim.status === 'checking' && this.check.info.steps.length) this.out.push({ type: 'cancelCheck', claimId: claim.claimId });
      this.check = null;
    }
    if (claim.outcome == null) this.evaluate(claim); // decided without a Check: still note when it completed
    const verdict = valid ? 'valid' : 'invalid';
    claim.status = verdict;
    const atMs = this.env.nowMs();
    // A Winner's position is the Winning song's (the card's completion), else the landing it was claimed on.
    const position = valid ? claim.completeSince ?? claim.position : claim.position;
    const winningSongId = valid && position >= 0 ? this.queue[position] ?? null : null;
    this.journal({ kind: 'claim.decided', round: claim.round, claimId: claim.claimId, verdict, winningSongId, position }, atMs);
    if (valid) this.winners.push({ round: claim.round, kind: claim.kind, cardId: claim.cardId, claimId: claim.claimId, winningSongId, position, atMs, name: null, notes: null });
    this.emit({ type: 'claim.decided', claimId: claim.claimId, cardId: claim.cardId, verdict, atMs });
    if (!valid) this.out.push({ type: 'sfx', name: FLOW.failureFanfare });
    this.autoCheck = true;
    this.afterDecision();
  }

  /** After a verdict: the next queued Claim's Check, or (all decided) the Celebration, or back to the round. */
  afterDecision() {
    if (this.claims.some((c) => c.status === 'queued' || c.status === 'checking' || c.status === 'checked')) return;
    const batch = this.batch;
    this.batch = null;
    this.autoCheck = false;
    const won = this.claims.filter((c) => c.status === 'valid' && (batch?.claimIds.includes(c.claimId) ?? false));
    if (won.length) return this.celebrate(won.some((c) => c.kind === 'bingo') ? 'bingo' : 'line', batch?.celebration ?? null);
    if (batch?.celebration) {
      // A late Claim during a Celebration was not valid: the Celebration goes on.
      this.celebration = { ...batch.celebration, sinceMs: this.env.nowMs() };
      this.setScene('celebration');
      return;
    }
    this.checkFailed();
  }

  /** Every Claim of the Check was invalid: back to the round, in a Hold with the error Hold music until Resume. */
  checkFailed() {
    this.setScene('play');
    this.status = 'hold';
    this.hold = { since: this.env.now(), reason: 'checkFailed' };
    this.timers.autoAt = null;
    this.switchToHoldMusic('error');
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
    const music: CelebrationMusic = previous && same ? previous.music : kind === 'line' ? 'winningSong' : 'victory';
    const celebration = this.celebrationOf(kind, this.env.nowMs(), music);
    if (!same) this.winningHook = this.hookOf(celebration.winningSongId);
    this.celebration = celebration;
    this.setScene('celebration');
    this.flowHold('claim');
    this.timers.holdMusicAt = null;
    const now = this.env.now();
    this.out.push({ type: 'sfx', name: FLOW.celebration.fanfare, at: now + 0.05 });
    this.out.push({ type: 'sfx', name: FLOW.celebration.impact, at: now + 0.05 });
    if (!same) this.startCelebrationMusic(music, now + FLOW.celebration.musicDelaySec);
    this.emit({ type: 'celebration.started', celebration: { ...celebration, cardIds: [...celebration.cardIds] } });
  }

  /** The round's Celebration of `kind`: every valid Claim of that kind shares it; the earliest Winning song leads. */
  celebrationOf(kind: WinKind, sinceMs: number, music: CelebrationMusic): CelebrationInfo {
    const ids = new Set(this.claims.filter((c) => c.status === 'valid' && c.kind === kind).map((c) => c.claimId));
    const won = this.winners.filter((w) => ids.has(w.claimId));
    const first = won.filter((w) => w.winningSongId != null).sort((a, b) => a.position - b.position)[0];
    return { kind, round: this.round.number, cardIds: [...new Set(won.map((w) => w.cardId))], winningSongId: first?.winningSongId ?? null, sinceMs, music };
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
    this.playIntervalMusic();
  }

  intervalFrom(sinceMs: number): IntervalInfo {
    return { sinceMs, nextRound: this.round.number + 1, guideEndMs: sinceMs + FLOW.intervalGuideSec * 1000 };
  }

  /** The Interval's music (also while a round is introduced, and after the Game); a victory track flows on. */
  playIntervalMusic() {
    this.flowHold('music');
    this.timers.holdMusicAt = null;
    if (this.bed === 'interval') return;
    this.out.push({ type: 'intervalMusic', at: this.env.now(), fadeSec: FLOW.intervalFadeSec, levelDb: FLOW.intervalDb });
    this.current = null;
    this.holdMusic = false;
    this.bed = 'interval';
  }

  /** Introduce a round: its name and prizes on screen while the Interval music plays. No Queue yet. */
  roundIntro(number: number, kind: RoundKind) {
    this.pending = null;
    this.celebration = null;
    this.interval = null;
    this.intro = { round: number, kind, sinceMs: this.env.nowMs() };
    this.setScene('roundStart', number, kind);
    this.playIntervalMusic();
  }

  /** Run a round's public Shuffle. The Interval's music goes on under it, and the first Spin builds out of it. */
  newRound(number: number, kind: RoundKind) {
    const keepMusic = this.bed === 'interval' && !this.current && !this.transition && !this.suspense;
    this.stopCheck();
    // Journaled before `round.started`, which ends the intro in the record too.
    if (this.scene !== 'roundStart') this.setScene('roundStart', number, kind);
    this.startRound(number, kind, { stop: !keepMusic, shuffle: true, keepMusic });
  }

  /** The end of the Game: closing music until Panic. */
  endGame() {
    if (this.transition) this.cancel(this.transition, 'hold');
    if (this.suspense) this.cancelSuspense(this.suspense, 'hold');
    this.pending = null;
    this.stopCheck();
    if (this.pause) {
      this.pause = null;
      this.out.push({ type: 'pauseOverlay', on: false });
    }
    this.batch = null;
    this.autoCheck = false;
    this.celebration = null;
    this.interval = null;
    this.intro = null;
    this.shuffle = null;
    this.setScene('after');
    this.playIntervalMusic();
  }

  // ---------------------------------------------------------------------------------- the technical pause
  /** "Tornem de seguida": nothing lands, a running Check stops (its Claim is queued again), Hold music plays. */
  setPause(on: boolean) {
    if (on === (this.pause != null)) return;
    if (!on) {
      this.pause = null;
      this.out.push({ type: 'pauseOverlay', on: false });
      this.resumeSceneMusic();
      return;
    }
    if (this.transition) this.cancel(this.transition, 'hold'); // too close to its landing: it lands, then holds
    if (this.suspense) this.cancelSuspense(this.suspense, 'hold');
    this.pending = null;
    this.stopCheck();
    this.pause = { sinceMs: this.env.nowMs() };
    this.out.push({ type: 'pauseOverlay', on: true });
    if (this.status === 'transition') return;
    this.flowHold(this.hold?.reason ?? 'music');
    this.switchToHoldMusic('hold');
  }

  /**
   * The scene's own music, after the technical pause or when a resumed Game is unlocked. In `play` (and
   * `before`) the Hold and its Hold music stay until Resume.
   */
  resumeSceneMusic() {
    switch (this.scene) {
      case 'celebration':
        if (!this.celebration) return;
        this.flowHold('claim');
        return this.startCelebrationMusic(this.celebration.music, this.env.now());
      case 'interval':
      case 'after':
      case 'roundStart':
        return this.playIntervalMusic();
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
  winnerInfo(reqId: string | null, { claimId, name, notes }: CommandFields['winnerInfo']) {
    const winner = this.winners.find((w) => w.claimId === claimId);
    if (!winner) return this.reject(reqId, 'winnerInfo', 'unknownClaim', `no winner for claim ${claimId}`);
    if (name !== undefined) winner.name = name.trim() || null;
    if (notes !== undefined) winner.notes = notes.trim() || null;
    this.journal({ kind: 'winner.noted', claimId, name: winner.name, notes: winner.notes });
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
    if (!valid.length) return { line: [], bingo: [] };
    const landed = this.landings.filter((l) => !l.undone).map((l) => l.songId);
    const strip = (list: ReturnType<typeof possibleWinners>) => list.slice(0, 60).map(({ cardId, lines, completedBy }) => ({ cardId, lines, completedBy }));
    return { line: strip(possibleWinners(valid, landed, 'line')), bingo: strip(possibleWinners(valid, landed, 'bingo')) };
  }

  spin() {
    return spinWindow({ pace: this.game.pace, phase: this.phaseName(), nudge: this.nudge });
  }

  schedule() {
    return scheduleEstimate({
      nowMs: this.env.nowMs(),
      round: this.round,
      game: { roundsTotal: this.game.roundsTotal },
      position: this.position,
      pace: this.game.pace,
      phase: this.phaseName(),
      lineConfirmed: this.round.lineConfirmed,
    });
  }

  updateNudge() {
    const { roundDriftSec } = this.schedule();
    this.nudge = driftNudge({ driftSec: roundDriftSec, position: this.position, pace: this.game.pace, phase: this.phaseName(), locked: this.game.paceLocked });
  }

  prefetch() {
    const ids = [this.queue[this.position], this.queue[this.position + 1], this.queue[this.position + 2]].filter((id) => id != null);
    // With Decoys on, the song a Decoy would tease stays decoded too (the runtime drops whatever isn't listed).
    const decoy = this.decoys.enabled ? this.decoyCandidate() : null;
    if (decoy != null && !ids.includes(decoy)) ids.push(decoy);
    this.out.push({ type: 'prefetch', ids });
  }

  /** The song a Decoy would tease: the newest counted landing that isn't the current song. */
  decoyCandidate(): number | null {
    const current = this.position >= 0 ? this.queue[this.position] : null;
    for (const l of [...this.landings].reverse()) if (!l.undone && l.songId !== current) return l.songId;
    return null;
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
      hold: this.hold ? { sinceMs: this.env.toEpochMs(this.hold.since), reason: this.hold.reason, holdMusic: this.holdMusic, holdMusicAtMs: toMs(this.timers.holdMusicAt) } : null,
      holdMusic: this.holdMusic,
      current: cur ? { ...this.songRef(cur.songId), hookId: cur.hookId, posSec: round2(cur.offset + (now - cur.startCtx) * cur.rate), endsAtMs: toMs(cur.endCtx) } : null,
      next: this.songInfo(this.queue[this.position + 1]),
      queue: { position: this.position, length: this.queue.length },
      round: { ...this.round },
      game: { ...this.game },
      phase: this.phaseName(),
      heat: this.phaseStep(this.position + 1)?.heat ?? null,
      cards: {
        inPlay: this.cardsInPlayText,
        inPlayCount: this.cardsInPlay.length,
        validCount: this.phaseModel.valid.length,
        phaseSource: this.game.phaseOverride ? 'override' : this.phaseModel.plan ? 'cards' : 'placeholder',
        climbingTo: this.phaseModel.kind,
      },
      possibleWinners: this.possibleWinners(),
      pace: { sec: this.game.pace, locked: this.game.paceLocked, nudge: round2(this.nudge), slotSec: round2(spin.slot), spinSec: round2(spin.dTarget) },
      schedule: { ...schedule, roundDriftSec: Math.round(schedule.roundDriftSec), gameDriftSec: schedule.gameDriftSec == null ? null : Math.round(schedule.gameDriftSec) },
      autoAtMs: toMs(this.timers.autoAt),
      transition: this.transition
        ? { id: this.transition.id, recipe: this.transition.plan.recipe, phase: this.transition.plan.phase, to: this.transition.songId, landAtMs: this.env.toEpochMs(this.transition.T) }
        : null,
      suspense: this.suspense
        ? { id: this.suspense.id, sinceMs: this.env.toEpochMs(this.suspense.open.spinStart), autoReleaseAtMs: this.env.toEpochMs(this.suspense.autoReleaseAt) }
        : null,
      landings: this.landings.slice(-10).map((l) => ({ ...this.songRef(l.songId), position: l.position, atMs: l.atMs, undone: l.undone })),
      history: this.history.slice(-8),
      scene: this.scene,
      pause: this.pause ? { ...this.pause } : null,
      shuffle: this.shuffle ? { round: this.shuffle.round, startAtMs: this.env.toEpochMs(this.shuffle.startAt), endAtMs: this.env.toEpochMs(this.shuffle.endAt) } : null,
      intro: this.intro ? { ...this.intro } : null,
      claims: this.claims.map((c) => ({ ...c, warnings: [...c.warnings] })),
      check: this.check ? { ...this.check.info, otherRows: [...this.check.info.otherRows], steps: this.check.info.steps.map((s) => ({ ...s })) } : null,
      celebration: this.celebration ? { ...this.celebration, cardIds: [...this.celebration.cardIds] } : null,
      interval: this.interval ? { ...this.interval } : null,
      winners: this.winners.map((w) => ({ ...w })),
    };
  }

  // ---------------------------------------------------------------------------------- output
  emit(event: ShowEventBody) {
    this.out.push({ type: 'emit', message: makeEvent(event) });
  }

  emitState() {
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
