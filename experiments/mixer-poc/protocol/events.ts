// Events the show engine emits, and the relay's own messages. Every event is a discriminated union member
// keyed on `type`, so remotes narrow with `switch (event.type)` and never cast. Times are epoch ms
// (ADR 0002: devices share timestamps, never an audio clock). docs/protocol.md explains each event.
import {
  PROTOCOL_VERSION,
  type CelebrationMusic,
  type CheckOutcome,
  type ClaimStatus,
  type ClaimWarning,
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
  type ShowScene,
  type ShowStatus,
  type WinKind,
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
  /**
   * Off: a Hold keeps the song ducked instead of switching to Hold music after `holdMusicAfterSec`; Hold music
   * still covers what would be silence (after Back, a cancelled Spin, a song that runs out). Default true.
   * Optional in the type only (added later in v1): the engine always sends it, and an older journal lacks it.
   */
  holdMusicOn?: boolean;
  /** The Interval playlist's level in dB, −30..0 (default −6). Optional in the type only, like `holdMusicOn`. */
  intervalVolumeDb?: number;
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

// ---- the show flow: scenes, Claims, the Check, Celebration, Interval, Winners ---------------------------
/** A Claim of this round. */
export interface ClaimInfo {
  /** 'cl-3': unique within the Game. */
  claimId: string;
  round: number;
  cardId: number;
  kind: WinKind;
  atMs: number;
  /** The Queue index of the last counted landing when the claim was made. */
  position: number;
  status: ClaimStatus;
  /** Set when its Check is scheduled (or the claim is decided without one). */
  outcome: CheckOutcome | null;
  /** PRIVATE (console only): the Queue index at which the card first completed this kind, or null. The
   * console shows "complete since song 34" (index + 1). */
  completeSince: number | null;
  /** PRIVATE (console only). */
  warnings: ClaimWarning[];
}

/** One song of a Check: its snippet (✓) or the "broken record" sound (✗), revealed at `atMs`. */
export interface CheckStep {
  songId: number;
  landed: boolean;
  /** When the snippet starts, scheduled in advance (ADR 0002). */
  atMs: number;
  durationMs: number;
}

/** A Check, scheduled in advance: the projector reveals each step at its `atMs`. */
export interface CheckInfo {
  claimId: string;
  cardId: number;
  kind: WinKind;
  outcome: CheckOutcome;
  /** Line: the row played (the completed row, else the row with most landed songs, top row on a tie).
   * Bingo: null (all 12 songs). */
  row: number | null;
  /** Line: the other completed rows, which the console mentions. */
  otherRows: number[];
  /** Empty for `unknownCard` and `wrongType`. */
  steps: CheckStep[];
  startAtMs: number;
  /** The result shows from here. */
  endAtMs: number;
}

export interface CelebrationInfo {
  kind: WinKind;
  round: number;
  /** Several when claims share the prize. */
  cardIds: number[];
  winningSongId: number | null;
  sinceMs: number;
  /** Default: Line → 'winningSong', Bingo → 'victory'. */
  music: CelebrationMusic;
}

/** A Claim the presenters decided valid. */
export interface WinnerInfo {
  round: number;
  kind: WinKind;
  cardId: number;
  claimId: string;
  winningSongId: number | null;
  /** The Queue index of the Winning song. */
  position: number;
  atMs: number;
  /** PRIVATE: the console and cloud data only; never the projector or phones. */
  name: string | null;
  /** PRIVATE. */
  notes: string | null;
}

export interface IntervalInfo {
  sinceMs: number;
  nextRound: number;
  /** Only a countdown guide: rounds always start by hand. */
  guideEndMs: number;
}

/** A track of the Interval playlist (analysis/interval.py: title and artist from the playlist). */
export interface IntervalTrackInfo {
  title: string;
  artist: string;
  /** Its place in this Game's shuffled order, 1-based (it wraps after `count` tracks), and the playlist's length. */
  index: number;
  count: number;
  /** When it took over from the music before it. */
  sinceMs: number;
}

/**
 * The Interval playlist while it plays: in `interval`, while a round is introduced and its Shuffle runs
 * (`roundStart`, and `play` until the first Spin builds out of it), and in `after`. Null otherwise.
 */
export interface IntervalMusicInfo {
  /** The track playing; null until the first one takes over (the music before it, such as the victory track, goes on). */
  track: IntervalTrackInfo | null;
}

/** The technical pause ("Tornem de seguida"), over whatever scene is underneath. */
export interface PauseInfo {
  sinceMs: number;
}

/** The round's public Shuffle (the projector animates it; it never reveals the Queue). */
export interface ShuffleInfo {
  round: number;
  startAtMs: number;
  endAtMs: number;
}

/** The round being introduced (`roundIntro`), before its Shuffle. */
export interface IntroInfo {
  round: number;
  kind: RoundKind;
  sinceMs: number;
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
  // ---- the show flow ----
  scene: ShowScene;
  /** The technical pause, or null. */
  pause: PauseInfo | null;
  /** The Shuffle while it runs (scene `roundStart`), else null. */
  shuffle: ShuffleInfo | null;
  /** In `roundStart`, the round being introduced, else null. */
  intro: IntroInfo | null;
  /** This round's Claims, oldest first. */
  claims: ClaimInfo[];
  /** The Check on screen (running, or showing its result until it is decided), else null. */
  check: CheckInfo | null;
  celebration: CelebrationInfo | null;
  interval: IntervalInfo | null;
  /** The whole Game's Winners (`name` and `notes` are PRIVATE). */
  winners: WinnerInfo[];
  /**
   * PRIVATE (tablet only, never a public screen): how to resume this round by hand on another show page
   * (`resumeAt`). Null before the round's Queue exists, or for a fixed test Queue. The seed is a secret:
   * with the cards in play it gives the whole Queue. Optional in the type only (added later in v1); the
   * engine always sends it.
   */
  resume?: ResumeToken | null;
  /** The Interval playlist while it plays, else null (`intervalSkip` is allowed then). Optional in the type only
   * (added later in v1); the engine always sends it. */
  intervalMusic?: IntervalMusicInfo | null;
  /**
   * The music picked during a Check for the Celebration that may follow (`celebrationMusic` in a Check), or
   * null for the default (Line: the winning song; Bingo: the victory track). Optional in the type only.
   */
  celebrationChoice?: CelebrationMusic | null;
}

/** What `resumeAt` needs, plus `text`, the same as a short code to note on paper (protocol/resume.ts). */
export interface ResumeToken {
  round: number;
  kind: RoundKind;
  shuffleSeed: number;
  shuffleAttempts: number;
  /** Queue index of the last counted song (−1 before the first). */
  position: number;
  /** The song at `position`, for the console's preview and the engine's check. */
  lastSongId: number | null;
  /** Where the Bingo climb started, if a Line was confirmed. */
  lineConfirmedFrom: number | null;
  text: string;
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
  /** 'panic' and 'newRound' stop it with everything else (nothing lands; remotes stop their Spin). */
  reason: 'back' | 'hold' | 'panic' | 'newRound';
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

/**
 * The answer to `getJournal`: the current Game's entries from the asked `fromSeq` on, in `seq` order (empty when
 * there are none, `gameId` null before the first entry). PRIVATE, like `journal.entry`.
 */
export interface JournalEntries {
  v: ProtocolVersion;
  type: 'journal.entries';
  reqId: string | null;
  gameId: string | null;
  entries: JournalEntry[];
}

/**
 * The phones' public Heat: ease towards `value` (0..1) between `fromMs` and `toMs`. Sent a random 4–15 s after a
 * landing, never at it, so the Heat never marks the landing that changed it; `toMs` is when the next sample is
 * due (the Spin in flight's), else `fromMs` + 15 s. Only with cards in play. Public (a blurred display value).
 */
export interface HeatSample {
  v: ProtocolVersion;
  type: 'heat.sample';
  value: number;
  fromMs: number;
  toMs: number;
}

/** The scene changed: a trigger for the projector's scene animations. */
export interface SceneChanged {
  v: ProtocolVersion;
  type: 'scene.changed';
  scene: ShowScene;
  previous: ShowScene;
  atMs: number;
}

/** A round's Shuffle: the projector animates it between these times. Never the Queue. */
export interface ShuffleScheduled {
  v: ProtocolVersion;
  type: 'shuffle.scheduled';
  round: number;
  kind: RoundKind;
  startAtMs: number;
  endAtMs: number;
  songCount: number;
}

/** A Claim was made (its `completeSince` and `warnings` are PRIVATE). */
export interface ClaimOpened {
  v: ProtocolVersion;
  type: 'claim.opened';
  claim: ClaimInfo;
}

/** A Check starts: its steps are timed in advance. */
export interface CheckScheduled {
  v: ProtocolVersion;
  type: 'check.scheduled';
  check: CheckInfo;
}

/** The presenters decided a Claim. */
export interface ClaimDecided {
  v: ProtocolVersion;
  type: 'claim.decided';
  claimId: string;
  cardId: number;
  verdict: 'valid' | 'invalid';
  atMs: number;
}

/** A Celebration starts (or its winning cards change). */
export interface CelebrationStarted {
  v: ProtocolVersion;
  type: 'celebration.started';
  celebration: CelebrationInfo;
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
  | JournalAppended
  | JournalEntries
  | HeatSample
  | SceneChanged
  | ShuffleScheduled
  | ClaimOpened
  | CheckScheduled
  | ClaimDecided
  | CelebrationStarted;
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
  'journal.entries',
  'heat.sample',
  'scene.changed',
  'shuffle.scheduled',
  'claim.opened',
  'check.scheduled',
  'claim.decided',
  'celebration.started',
] as const satisfies readonly ShowEventType[]);

// ---- relay messages -------------------------------------------------------------------------------------
/** A client's first message after connecting. */
export interface RelayHello {
  v: ProtocolVersion;
  type: 'hello';
  role: Role;
  clientId: string;
  /**
   * The relay token, for a device on the hotspot's LAN (tablet, admin phone, a split drum): it pairs the
   * device. This laptop's own pages need none; `show` and `cloud` are accepted only from this laptop. A socket
   * without a valid hello hears nothing.
   */
  token?: string;
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
