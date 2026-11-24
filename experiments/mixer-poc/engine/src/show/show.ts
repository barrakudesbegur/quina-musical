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
import { checkCommand, makeEvent, COMMANDS, RECIPE_IDS } from '@quina/protocol';
import type {
  ClimbTarget,
  CommandFields,
  GameRecord,
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
import { HOLD, ENGINE, PHASES, PACE, SUSPENSE, DECOYS, type DecoyConfig } from '../config.ts';
import { validCards, possibleWinners, parseCardRanges } from '../game/cards.ts';
import { phasePlan } from '../game/phase.ts';
import { phaseFor } from '../plan/phases.ts';
import { planTransition } from '../plan/planner.ts';
import { openSuspense, releaseSuspense, suspenseBar, type SuspenseOpen } from '../plan/suspense.ts';
import { withDecoy } from '../plan/decoys.ts';
import { pickHook } from '../plan/hooks.ts';
import { tempoMatch } from '../plan/tempo.ts';
import { spinWindow, autoPressAt, pressAfterHold, defaultPace, scheduleEstimate, driftNudge, roundLengthSec, PACE_LIMITS } from '../plan/pace.ts';
import { seededRandom } from '../rng.ts';
import type { Analysis, Hook } from '../analysis.ts';
import type { Card } from '../game/cards.ts';
import type { PhaseStep } from '../game/phase.ts';
import type { BlendSource, Plan, SignatureSource } from '../plan/planner.ts';
import type { PlanEvent, StemName } from '../plan/recipes.ts';

/** Which Hold music fits: 'error' after Back (and, later, a failed Check), 'hold' otherwise. */
export type HoldMood = 'hold' | 'error';

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
  afterLanding: null | 'back' | 'hold';
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
  | StartSuspenseEffect
  | SuspenseBarEffect;
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
  random: () => number;
  shuffle: (ids: number[]) => number[];
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
  fixedQueue?: number[] | null;
  settings?: Partial<GameSettings>;
  /** The Game's id for its journal; a new one is drawn when missing. Ignored with `restore`. */
  gameId?: string;
  /**
   * Resume a Game from its journal (`replayJournal`): the round, its Queue and position, the landings,
   * the confirmed Line, cards in play and settings. Live playback starts fresh: nothing plays until Next.
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
    this.startRound(1, 'normal', false, settings.pace != null || restore?.settings != null);
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
    if (this.status === 'locked' && c.cmd !== 'unlock' && c.cmd !== 'getState') {
      this.reject(reqId, c.cmd, 'locked');
      return this.flush();
    }
    switch (c.cmd) {
      case 'unlock':
        if (this.status === 'locked') this.status = 'idle';
        this.unlocked = true;
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
      case 'newRound':
        this.startRound(c.number ?? this.round.number + 1, c.kind ?? 'normal', true);
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
      default:
        // checkCommand only lets known commands through, and the compiler checks every one is handled here.
        c satisfies never;
        this.reject(reqId, cmd, 'unknownCommand');
    }
    this.emitState();
    return this.flush();
  }

  /** Called every few tens of milliseconds by the runtime. */
  tick(): Effect[] {
    const now = this.env.now();
    if (this.status !== 'transition' && this.status !== 'locked') this.prepareNext();
    const t = this.transition;
    if (t && now >= t.T) this.land(t);
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
    if (p && p.songId === songId) {
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
  startRound(number: number, kind: RoundKind, stop: boolean, keepPace = false) {
    if (stop) this.out.push({ type: 'stopAll', fadeSec: 0.3 });
    const ids = [...this.catalog.keys()];
    const fixed = this.fixedQueue?.filter((id) => this.catalog.has(id));
    this.queue = fixed?.length ? fixed : this.env.shuffle(ids);
    this.position = -1;
    this.resetLive();
    this.landings = [];
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
    });
    this.out.push({ type: 'drumReset', ids: [...this.queue] });
    this.prefetch();
  }

  /** Live playback back to rest: nothing playing, spinning or held. The Game (Queue, landings) is untouched. */
  resetLive() {
    this.current = null;
    this.transition = null;
    this.suspense = null;
    this.pending = null;
    this.hold = null;
    this.holdMusic = false;
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
    this.rebuildPhase();
    this.updateNudge();
    // The drum keeps the cards not yet played, with the last landing under the pointer.
    const last = this.position >= 0 ? this.queue[this.position] : undefined;
    const remaining = this.queue.slice(this.position + 1);
    this.out.push(last == null ? { type: 'drumReset', ids: remaining } : { type: 'drumReset', ids: [last, ...remaining], selectId: last });
    this.prefetch();
  }

  /** The Game as this show holds it, in the shape `replayJournal` produces from its journal. */
  record(): GameRecord {
    return {
      gameId: this.gameId,
      seq: this.journalSeq,
      cardsInPlay: this.cardsInPlayText,
      settings: this.journalSettings(),
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
    if (this.status === 'hold') this.leaveHold(0.4);
    if (!this.env.isDecoded(songId)) {
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
      phase,
      spin,
      history: this.history,
      rng: seededRandom(seed),
      // An override that is not a recipe id is ignored, as the planner would ignore it.
      recipeOverride: RECIPE_IDS.find((r) => r === this.game.nextRecipe) ?? null,
      kind: 'next',
      id,
    });
    if ('error' in planned) return this.reject(reqId, 'next', 'planFailed', planned.error);
    let plan: ShowPlan = { ...planned, seed, reqId, targetPos };
    if (this.decoys.enabled) plan = this.addDecoy(plan);
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
      fromHoldMusic: this.holdMusic,
      afterLanding: null,
    };
    // Without a usable outgoing song (it ran out), the runtime fades whatever is left of it.
    if (!A) this.current = null;
    this.status = 'transition';
    this.hold = null;
    this.timers = { autoAt: null, holdMusicAt: null };
    const removeId = this.position >= 0 ? this.queue[this.position] : null;
    this.out.push({ type: 'startTransition', plan, fromHoldMusic: this.holdMusic, drum: { removeId, targetId: songId, minLaps: 1 } });
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
      return withDecoy(plan, { source: { songId: l.songId, analysis, hook }, phase: plan.phase, rng: seededRandom(plan.seed ^ 0x2545f491), config: this.decoys });
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
    const id = `tr-${++this.transitionCount}`;
    this.suspense = {
      id, reqId, songId, targetPos, open, seed, startedAt: now, autoReleaseAt: now + SUSPENSE.autoReleaseSec, nextBar: 0,
      fromSongId: A ? A.songId : null, fromHoldMusic: this.holdMusic,
    };
    if (!A) this.current = null;
    this.status = 'transition';
    this.hold = null;
    this.timers = { autoAt: null, holdMusicAt: null };
    const removeId = this.position >= 0 ? this.queue[this.position] : null;
    this.out.push({ type: 'startSuspense', open, fromHoldMusic: this.holdMusic, drum: { removeId, targetId: songId } });
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
    this.updateNudge();
    if (t.afterLanding === 'back') this.undo();
    else if (t.afterLanding === 'hold') this.enterHold('hold', { music: false });
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
    this.holdMusic = true;
    this.out.push({ type: 'holdMusic', at, levelDb: HOLD.holdMusicLevelDb, fadeSec: HOLD.holdMusicFadeInSec, mood: this.holdMood() });
  }

  holdMood(): HoldMood {
    return this.hold?.reason === 'back' ? 'error' : 'hold';
  }

  // The ducked song hands over to Hold music (a long Hold, or the song is running out).
  toHoldMusic() {
    if (this.current) {
      this.out.push({ type: 'songToHoldMusic', fadeSec: 3, mood: this.holdMood() });
      this.current = null;
      this.holdMusic = true;
    } else this.startHoldMusic(this.env.now());
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
    this.current = null;
    this.transition = null;
    this.suspense = null;
    this.pending = null;
    this.hold = null;
    this.holdMusic = false;
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
