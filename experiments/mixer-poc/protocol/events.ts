// Events the show engine emits, and the relay's own messages. Every event is a discriminated union member
// keyed on `type`, so remotes narrow with `switch (event.type)` and never cast. Times are epoch ms
// (ADR 0002: devices share timestamps, never an audio clock). docs/protocol.md explains each event.
import {
  PROTOCOL_VERSION,
  type ClimbTarget,
  type ExitName,
  type HoldReason,
  type PhaseName,
  type PhaseSource,
  type ProtocolVersion,
  type RecipeFamily,
  type RecipeId,
  type RecipeShape,
  type RejectReason,
  type Role,
  type RoundKind,
  type ShowStatus,
} from './vocabulary.ts';
import type { JournalEntry } from './journal.ts';

// ---- the `state` snapshot -----------------------------------------------------------------------------
export interface SongRef {
  songId: number;
  title: string;
  artist: string;
}

export interface HoldInfo {
  sinceMs: number;
  reason: HoldReason;
  holdMusic: boolean;
  /** When Hold music will take over, or null. */
  holdMusicAtMs: number | null;
}

export interface CurrentSong extends SongRef {
  hookId: string;
  /** Position in the song, in seconds, at the snapshot's `atMs`. */
  posSec: number;
  endsAtMs: number | null;
}

export interface RoundInfo {
  number: number;
  kind: RoundKind;
  startedAtMs: number;
  targetEndMs: number;
  lineConfirmed: boolean;
}

/** The game settings (`setGame`, `setPace`). */
export interface GameSettings {
  /** Seconds from one landing to the next. */
  pace: number;
  /** No Drift nudges. */
  paceLocked: boolean;
  autoAdvance: boolean;
  /** Keep auto-advance on in the final phase. */
  autoAdvanceFinal: boolean;
  /** Phase placeholder when no cards are in play. */
  songsUntilWinner: number;
  phaseOverride: PhaseName | null;
  roundsTotal: number;
  holdMusicAfterSec: number;
  nextRecipe: string | null;
  /** A fanfare once per climb, as the Phase reaches the engine's Final Lap phase. */
  finalLapStinger: boolean;
}

export interface CardsInfo {
  /** The cards in play as entered, for example "1-180, 200-215". */
  inPlay: string;
  inPlayCount: number;
  /** Cards in play that count this round (special round: special cards only). */
  validCount: number;
  phaseSource: PhaseSource;
  climbingTo: ClimbTarget;
}

export interface PossibleWinner {
  cardId: number;
  /** Indexes of the completed lines (0-based). */
  lines: number[];
  /** The song whose landing completed it. */
  completedBy: number | null;
}

/** PRIVATE: the presenters' tablet only, never the projector or the players' phones. */
export interface PossibleWinners {
  line: PossibleWinner[];
  bingo: PossibleWinner[];
}

export interface PaceInfo {
  sec: number;
  locked: boolean;
  /** The Drift catch-up factor (1 = none). */
  nudge: number;
  slotSec: number;
  spinSec: number;
}

/** Drift > 0 means running late. */
export interface ScheduleInfo {
  roundEndMs: number;
  gameEndMs: number;
  roundDriftSec: number;
  gameDriftSec: number | null;
}

export interface TransitionInfo {
  id: string;
  recipe: RecipeId;
  phase: PhaseName;
  /** The incoming song. PRIVATE before `landAtMs`. */
  to: number;
  landAtMs: number;
}

/** A Suspense held open (it becomes a normal `transition` once released). */
export interface SuspenseInfo {
  id: string;
  sinceMs: number;
  /** When it releases by itself. */
  autoReleaseAtMs: number;
}

export interface LandingInfo extends SongRef {
  position: number;
  atMs: number;
  undone: boolean;
}

export interface HistoryEntry {
  recipe: RecipeId;
  family: RecipeFamily;
  exit: ExitName | null;
  songId: number;
  hookId: string;
  phase: PhaseName;
}

/** The whole show as the engine sees it. Sent after every change and in answer to `getState`. */
export interface ShowState {
  v: ProtocolVersion;
  type: 'state';
  /** Increases with every snapshot. */
  seq: number;
  atMs: number;
  status: ShowStatus;
  /** 'next' while the next song is still decoding. */
  pending: 'next' | null;
  hold: HoldInfo | null;
  holdMusic: boolean;
  current: CurrentSong | null;
  /** PRIVATE: the Queue's next song. */
  next: SongRef | null;
  /** `position` is the Queue index of the last counted landing (−1 before the first). */
  queue: { position: number; length: number };
  round: RoundInfo;
  game: GameSettings;
  /** The coming transition's Phase. */
  phase: PhaseName;
  /** 0..1 placeholder, or null without cards in play. */
  heat: number | null;
  cards: CardsInfo;
  possibleWinners: PossibleWinners;
  pace: PaceInfo;
  schedule: ScheduleInfo;
  /** When auto-advance will press Next, or null. */
  autoAtMs: number | null;
  transition: TransitionInfo | null;
  suspense: SuspenseInfo | null;
  /** The last 10 landings. */
  landings: LandingInfo[];
  /** The last 8 transitions. */
  history: HistoryEntry[];
}

// ---- the other events ---------------------------------------------------------------------------------
/** A Spin starts. A split-mode drum needs only `drum`, `spinStartAtMs` and `landAtMs` to solve its own Spin. */
export interface TransitionScheduled {
  v: ProtocolVersion;
  type: 'transition.scheduled';
  id: string;
  reqId: string | null;
  from: number | null;
  /** PRIVATE before `landAtMs`. */
  to: number;
  position: number;
  phase: PhaseName;
  recipe: RecipeId;
  recipeName: string;
  exit: ExitName | null;
  shape: RecipeShape;
  spinStartAtMs: number;
  exitAtMs: number;
  landAtMs: number;
  durationMs: number;
  hookId: string;
  bpm: number | null;
  /** PRIVATE before `landAtMs` (targetId is the incoming song). */
  drum: { removeId: number | null; targetId: number; minLaps: number };
}

/**
 * A Suspense started: the outgoing song exits and the build loops until it is released, then a
 * `transition.scheduled` with the same id gives the landing. A split-mode drum coasts until then.
 */
export interface SuspenseStarted {
  v: ProtocolVersion;
  type: 'suspense.started';
  id: string;
  reqId: string | null;
  from: number | null;
  /** PRIVATE until it lands. */
  to: number;
  position: number;
  phase: PhaseName;
  spinStartAtMs: number;
  /** When the outgoing song's exit ends (the loop starts there). */
  exitAtMs: number;
  autoReleaseAtMs: number;
  /** PRIVATE until it lands (targetId is the incoming song). */
  drum: { removeId: number | null; targetId: number };
}

/** The Landing: the song counts from now. */
export interface TransitionLanded {
  v: ProtocolVersion;
  type: 'transition.landed';
  id: string;
  songId: number;
  position: number;
  atMs: number;
}

/** A Spin was cancelled and nothing landed. */
export interface TransitionCancelled {
  v: ProtocolVersion;
  type: 'transition.cancelled';
  id: string;
  reason: 'back' | 'hold';
  keptOutgoing: boolean;
  atMs: number;
}

/** Back undid a landing. */
export interface LandingUndone {
  v: ProtocolVersion;
  type: 'landing.undone';
  songId: number;
  position: number;
  atMs: number;
}

/** A command was refused. */
export interface CommandRejected {
  v: ProtocolVersion;
  type: 'command.rejected';
  reqId: string | null;
  cmd: string | null;
  reason: RejectReason;
  detail?: string;
}

/** Every 5 s, from the show page's runtime. */
export interface EngineHealth {
  v: ProtocolVersion;
  type: 'engine.health';
  atMs: number;
  outputLatencyMs: number | null;
  baseLatencyMs: number | null;
  contextState: string;
  decodedMB: number;
  jsHeapMB: number | null;
  longTasks: number;
  /** The Hold music track playing, or null. */
  holdMusic: string | null;
}

/**
 * A new Game journal entry (journal.ts), for whoever keeps a copy of the journal. PRIVATE: a
 * `round.started` entry carries the whole Queue.
 */
export interface JournalAppended {
  v: ProtocolVersion;
  type: 'journal.entry';
  entry: JournalEntry;
}

/** Everything the show engine emits. */
export type ShowEvent =
  | ShowState
  | TransitionScheduled
  | SuspenseStarted
  | TransitionLanded
  | TransitionCancelled
  | LandingUndone
  | CommandRejected
  | EngineHealth
  | JournalAppended;
export type ShowEventType = ShowEvent['type'];
/** One event by type, for example `EventOf<'transition.landed'>`. */
export type EventOf<T extends ShowEventType> = Extract<ShowEvent, { type: T }>;

export const EVENT_TYPES = Object.freeze([
  'state',
  'transition.scheduled',
  'suspense.started',
  'transition.landed',
  'transition.cancelled',
  'landing.undone',
  'command.rejected',
  'engine.health',
  'journal.entry',
] as const satisfies readonly ShowEventType[]);

// ---- relay messages -------------------------------------------------------------------------------------
/** A client's first message after connecting. */
export interface RelayHello {
  v: ProtocolVersion;
  type: 'hello';
  role: Role;
  clientId: string;
}

/** Who is connected (for example, whether the show page is open). Sent by the relay to everyone. */
export interface RelayClients {
  v: ProtocolVersion;
  type: 'relay.clients';
  clients: { role: Role | 'unknown'; clientId: string }[];
}

/** What a remote receives: the engine's events plus the relay's client list. */
export type IncomingEvent = ShowEvent | RelayClients;

type Unversioned<E> = E extends unknown ? Omit<E, 'v'> : never;
/** An event as the engine builds it, before `makeEvent` stamps the version. */
export type ShowEventBody = Unversioned<ShowEvent>;

/** Stamp an event with the protocol version. */
export function makeEvent<E extends ShowEventBody>(event: E): E & { v: ProtocolVersion } {
  return { v: PROTOCOL_VERSION, ...event };
}

/**
 * Accept a message on a remote: right version and a known event type. It trusts the engine for the
 * fields; a remote must still ignore event types it does not handle (additions stay v1).
 */
export function isEvent(message: unknown): message is IncomingEvent {
  if (!message || typeof message !== 'object') return false;
  const m = message as Record<string, unknown>;
  if (m.v !== PROTOCOL_VERSION || typeof m.type !== 'string') return false;
  return (EVENT_TYPES as readonly string[]).includes(m.type) || m.type === 'relay.clients';
}
