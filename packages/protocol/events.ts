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
  type MusicSet,
  type ThrowSong,
  type VolumeKey,
  type WinKind,
} from './vocabulary.ts';
import type { JournalEntry } from './journal.ts';
import type { GamePlan } from './plan.ts';

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
  /** PRIVATE (console and admin only): false in Aguanta (Stay, the song at full volume), true in Parlem (ducked).
   * Absent from an older engine: ducked. */
  ducked?: boolean;
}

export interface CurrentSong extends SongRef {
  hookId: string;
  /** The song's first play in this Game (D174): its slot is `pace.firstPlaySec`, and it landed on its best hook. */
  firstPlay: boolean;
  /** Position in the song, in seconds, at the snapshot's `atMs`. */
  posSec: number;
  endsAtMs: number | null;
}

export interface RoundInfo {
  number: number;
  kind: RoundKind;
  /** The printed card type it plays: only cards of this type count (and any other fails its Check as `wrongType`).
   * Optional in the type only (added later in v1): the engine always sends it. */
  cardType?: string;
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
  /**
   * The remote's shake gesture (D148): the console paired with the remote turns it on or off; every console shows the
   * switch. The engine only keeps it. Default true. Optional in the type only: an older journal lacks it.
   */
  remoteShake?: boolean;
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
  /**
   * The volume sliders, percent 0–VOLUME_MAX (`setVolume`, vocabulary.ts VOLUME_KEYS and volumeDb). The state always has
   * every key. In the journal they are absent until a slider or the plan's `volumes` first set them, so a Game that
   * set none starts from the plan's (D139).
   */
  volumes?: Partial<Record<VolumeKey, number>>;
}

export interface CardsInfo {
  /** The cards in play as entered, for example "1-180, 200-215". */
  inPlay: string;
  inPlayCount: number;
  /** Cards in play that count this round: those of the round's card type. */
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

/**
 * PRIVATE (console only; never the stage, the feed or phones): the Desgraciat round's cards still standing. They are
 * the round's valid cards in play (its card type within the ranges, sold or not: the ranges can't tell) with none of
 * their songs counted yet.
 */
export interface StandingInfo {
  count: number;
  /** Sorted; null when more than STANDING_LIST_MAX stand. */
  cardIds: number[] | null;
  /** The valid cards in play whose first landed song is the latest landing: they sat down with it, and may share the
   * win if nobody in the room is still standing (their Check is `fellLast`). Sorted; null above STANDING_LIST_MAX.
   * Optional in the type only (added later in v1). */
  fellLast?: number[] | null;
}
/** The most standing cards `StandingInfo.cardIds` lists. */
export const STANDING_LIST_MAX = 60;

/**
 * PRIVATE (the console's Futur tab, hidden until revealed): what the round's valid cards in play (sold or not)
 * and the known Queue say about the wins to come. Never in the public feed, on the stage or on phones.
 */
export interface FutureInfo {
  /** The Queue index whose landing first completes a Line (a Bingo) on a valid card, from the next song on;
   * null when none ever does. The console shows `at − queue.position` songs. */
  lineAt: number | null;
  bingoAt: number | null;
  /** Valid cards by songs still missing to their first Line: index = songs missing (0 = has one), value = cards. */
  toLine: number[];
  /** The same for the Bingo (index = songs missing to a full card, 0–12). */
  toBingo: number[];
  /** Valid cards by their counted (landed) songs: index = songs marked (0–12), value = cards. */
  markCounts: number[];
  /** Desgraciat round: the Queue index whose landing leaves one card standing; null when none does, or in another
   * round. (`lineAt` and `bingoAt` are null there, `toLine` and `toBingo` empty.) Optional in the type only. */
  lastStandingAt?: number | null;
  /** Desgraciat round: the standing count after each of the next landings, up to the one that leaves one card
   * (included); [] in another round. Optional in the type only. */
  standingCurve?: number[];
}

export interface PaceInfo {
  /** The Pace: a repeat's slot (a song played in an earlier round of this Game). */
  sec: number;
  /** A song's first play in the Game gets this slot instead: `sec` × 22/14 (vocabulary.ts firstPlaySec, D174). */
  firstPlaySec: number;
  /** The Pace each round starts with (PACE_DEFAULT_SEC.repeat), which the console recommends. */
  defaultSec?: number;
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
  /** What its card shows from the counted landings, set when its Check comes on screen. PRIVATE before the cue. */
  outcome: CheckOutcome | null;
  /** PRIVATE (console only): the Queue index at which the card first completed this kind, or null. The
   * console shows "complete since song 34" (index + 1). */
  completeSince: number | null;
  /** PRIVATE (console only). */
  warnings: ClaimWarning[];
  /**
   * PRIVATE (console only, D108): the whole card in its grid order, each song marked landed or not, from the claim
   * on (updated if a Back changes the landings). Empty for a card of the wrong type.
   */
  markedCard: { songId: number; landed: boolean }[];
  /** PRIVATE: the index of the last song its Check reveals (the last, or the first ✗), or null when it reveals none
   * (`wrongType`: the cue comes at once). */
  revealUntil: number | null;
  /** PRIVATE: every song its Check reveals is revealed, so the next press on it is the cue (pass or fail). */
  cueNext: boolean;
}

/** One revealed song of a Check: its snippet (✓) or the "broken record" sound (✗). */
export interface CheckStep {
  songId: number;
  landed: boolean;
  /** When its sound starts, set just ahead of the press so sound and screens meet (ADR 0002). */
  atMs: number;
  durationMs: number;
}

/**
 * The Check on screen, paced by the presenters (D107): each press reveals one song (`revealed`), then the cue. Nothing
 * public says ahead of the cue whether the card passes: `outcome` is PRIVATE until `cue` is set.
 */
export interface CheckInfo {
  claimId: string;
  cardId: number;
  kind: WinKind;
  /** PRIVATE until the cue: what the card shows (screens learn the result from `cue`, never ahead of it). */
  outcome: CheckOutcome;
  /** Line: the row played (the completed row, else the row with most landed songs, top row on a tie).
   * Bingo and standing: null (all 12 songs, card order; a standing Check stops on the first landed one). */
  row: number | null;
  /** Line: the other completed rows, which the console mentions. */
  otherRows: number[];
  /** The card's printed type ('normal', 'especial'), shown as the Check's first step; null for `unknownCard`.
   * `wrongType`: it isn't the round's card type (`RoundInfo.cardType`). */
  cardType?: string | null;
  /** When it came on screen. */
  startAtMs: number;
  /** The most songs the Check can reveal: the card's 12, a Line's 4 (the row played), 0 for `wrongType`. */
  total: number;
  /** The songs revealed so far, in the card's grid order (a Line's: its row's). */
  revealed: CheckStep[];
  /** Revealing in a row (`checkAuto` on, and not turned off for this Check by a step back, D134). */
  auto: boolean;
  /** The cue, once it has played: the card passed (valid) or failed. */
  cue: 'pass' | 'fail' | null;
  /** Under review ("Revisió manual"): the projector stays on the Check and says so (D123). Whether phones see it
   * is U79. */
  reviewing: boolean;
}

export interface CelebrationInfo {
  kind: WinKind;
  round: number;
  /** Several when claims share the prize. */
  cardIds: number[];
  winningSongId: number | null;
  sinceMs: number;
  /** Default: Line → 'winningSong', Bingo and standing → 'victory'. */
  music: CelebrationMusic;
  /** Parlem is on (D117): its music is ducked under the presenters' voices (`hold`). */
  parlem: boolean;
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
  /** PRIVATE: the number of the slip handed to the winner, if one was. Optional in the type only (added later in v1). */
  slip?: string | null;
}

export interface IntervalInfo {
  sinceMs: number;
  nextRound: number;
  /** Only a countdown guide: rounds always start by hand. */
  guideEndMs: number;
}

/** A track of the Interval playlist (tools/prep/interval.py: title and artist from the playlist). */
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
  /** Which playlist plays (D129): the breaks', Pausa's or the end's. */
  set: MusicSet;
  /** The track playing; null until the first one takes over (the music before it, such as the victory track, goes on). */
  track: IntervalTrackInfo | null;
}

/**
 * Pausa (D128, D135), over whatever scene is underneath: the playback in progress is saved, and resumes where it was
 * when Pausa ends.
 */
export interface PauseInfo {
  sinceMs: number;
  /** "Tornem de seguida" shows on the projector and phones: only during a round, a Check or a Celebration (D135). */
  overlay: boolean;
}

/** Finalists who fell or won together, on one landing (D169: shown together, with the group ninos, D172). */
export interface FinaleGroup {
  cardIds: number[];
  /** The landing's Queue index, and its song; for a win by a removal by hand, the last counted landing. */
  position: number;
  songId: number | null;
  atMs: number;
  /** A win decided by a removal by hand, not by a song (D169's rule 5). */
  byHand?: true;
}

/**
 * The Desgraciat's finale (D161, D166–D172): the finalists entered, the groups that fell, in order (a finalist is out
 * at the landing of a song on their card; the projector fades the group at the next Spin), and the winners once
 * known. Everything follows from the counted landings, so Enrere brings a group back. Public on the projector; the
 * phones' view is U150.
 */
export interface FinaleInfo {
  /** The finalists, in the order entered. */
  cardIds: number[];
  /** The finalists still standing. */
  standing: number[];
  groups: FinaleGroup[];
  /** The winners: the last one standing, a group that fell together taking everyone left (a shared win), or the one
   * left by a removal by hand; null until then. */
  winners: FinaleGroup | null;
  /** The presenters gave the cue: the Celebration is on. */
  cued: boolean;
}

/** A throw song's track, as its button shows it before and while it plays (seconds into the file). */
export interface ThrowTrackInfo {
  title: string;
  artist: string;
  /** Where a tap starts it (its hook). */
  startSec: number;
  /** Where its drop is. */
  dropSec: number;
  durationSec: number;
}

/** A throw song (D138, D151), from its button until it ends or the scene changes. */
export interface ThrowInfo extends ThrowTrackInfo {
  /** Which: a planned Throw's, or the corn-seed storm's. */
  song: ThrowSong;
  /** Playing now; false while a tap has stopped it (the next tap resumes it where it stopped). */
  playing: boolean;
  /** When it last started, resumed or stopped. */
  sinceMs: number;
  /** Its position at `sinceMs`: playing, it moves on in real time from there; stopped, it waits there. */
  posSec: number;
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
  /** The card type it will play. Optional in the type only: the engine always sends it. */
  cardType?: string;
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
  /** PRIVATE: the console's Futur tab; absent without cards in play or from an older engine. */
  future?: FutureInfo | null;
  /** PRIVATE (console only): in a Desgraciat round, the cards still standing; null otherwise or without cards in play. */
  standing?: StandingInfo | null;
  /** The rounds whose prizes were revealed, and how (the journal's `prizes.revealed`; plan.ts revealedRounds). */
  prizes?: { revealed: { round: number; by: 'presenters' | 'intro' }[] };
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
  /** The presenter-paced Check (D110): every card of the claim had its cue (or was discarded), the last one didn't pass
   * but an earlier one did, and this press (`checkNext { claimId, step }`) starts the shared Celebration; else null.
   * After a cued fail it's that Claim with its revealed count + 1; after a discard, that Claim with step 0. */
  celebrationNext: { claimId: string; step: number } | null;
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
  /** A throw song while it's on (D138, D151), else null. */
  throwSong: ThrowInfo | null;
  /** Each throw song's track, at all times: the buttons name it while idle. */
  throwSongs: Record<ThrowSong, ThrowTrackInfo>;
  /** The round in play is the night's last (the plan's last round, else `game.roundsTotal`): the corn-seed storm's
   * button shows in it (D155; SceneContext.lastRound). */
  lastRound: boolean;
  /** The Desgraciat's finale while it's on, else null (D161, D166–D172). */
  finale: FinaleInfo | null;
}

/** What `resumeAt` needs, plus `text`, the same as a short code to note on paper (protocol/resume.ts). */
export interface ResumeToken {
  round: number;
  kind: RoundKind;
  /** The round's card type (the Queue depends on it). Optional in the type only: the engine always sends it; a token
   * without one plays defaultCardType(kind). */
  cardType?: string;
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
  /** `cancel`: a Suspense cancelled (`suspense { on: false, cancel: true }`, D144, D145), its build backing out. */
  reason: 'back' | 'hold' | 'cancel' | 'panic' | 'newRound';
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
 * PRIVATE (tablets only, never a public screen): the answer to `getUpcoming` (D162, D170), the round's songs still to
 * come in the Queue's order. `songs[k]` lands `k + 1` songs from now (Queue index `position + 1 + k`).
 */
export interface Upcoming {
  v: ProtocolVersion;
  type: 'upcoming';
  reqId: string | null;
  round: number;
  /** The Queue index of the last counted landing (−1 before the first). */
  position: number;
  songs: SongRef[];
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

/** A Claim's Check is on screen, nothing revealed yet (D107): the first reveal waits for a press. */
export interface CheckStarted {
  v: ProtocolVersion;
  type: 'check.started';
  check: CheckInfo;
}

/** A press revealed the Check's song at `index` (its snippet, or the broken record, from `step.atMs`). */
export interface CheckRevealed {
  v: ProtocolVersion;
  type: 'check.revealed';
  claimId: string;
  index: number;
  step: CheckStep;
}

/** "Enrere" inside a Check (D127, D134): the mark at `index`, the last revealed, is removed; that cell is next again. */
export interface CheckUnrevealed {
  v: ProtocolVersion;
  type: 'check.unrevealed';
  claimId: string;
  index: number;
  atMs: number;
}

/** The cue: the card passed (the Claim is valid) or failed; `manual` when a Review won or lost it by hand (D121). */
export interface CheckCue {
  v: ProtocolVersion;
  type: 'check.cue';
  claimId: string;
  cue: 'pass' | 'fail';
  manual?: boolean;
  atMs: number;
}

/** A Check put under review before its cue (`checkReview`): the Claim `reviewing`, whatever was playing goes on
 * (D118–D120). What the projector's Review screen and the phones show is U76 and U79. */
export interface CheckReviewing {
  v: ProtocolVersion;
  type: 'check.reviewing';
  claimId: string;
  atMs: number;
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
  | Upcoming
  | HeatSample
  | SceneChanged
  | ShuffleScheduled
  | ClaimOpened
  | CheckStarted
  | CheckRevealed
  | CheckUnrevealed
  | CheckCue
  | CheckReviewing
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
  'upcoming',
  'heat.sample',
  'scene.changed',
  'shuffle.scheduled',
  'claim.opened',
  'check.started',
  'check.revealed',
  'check.unrevealed',
  'check.cue',
  'check.reviewing',
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

/**
 * The edition's Game plan, from the relay to every paired screen (the show page and its stage too) and from
 * the cloud to its consoles: on hello and whenever it changes, so a screen that never regains focus (the
 * projector) still follows Admin's edits. The relay sends the laptop's newest copy: the cloud's, or one saved
 * on the laptop's network with no cloud (newest `savedAtMs` wins). Public, like the plan itself.
 */
export interface RelayPlan {
  v: ProtocolVersion;
  type: 'relay.plan';
  plan: GamePlan | null;
  /** When that plan was saved (ms since the epoch, the saver's clock); null when there is no plan. */
  savedAtMs: number | null;
}

/**
 * The Wii Remote's status between consoles (Frontend's, 35573a0): the console the remote pairs with publishes it
 * through the relay, and every paired console shows the remote's badges and chip from it. PRIVATE: the relay
 * forwards it from the host console to the other paired consoles only (tablet and admin roles), never to the show
 * page, the drum, the cloud link or phones; it replays the last one per host on every console hello, and reports a
 * host as `{ connected: false, battery: null }` when its socket closes.
 */
export const REMOTE_STATUS_TYPE = 'remote.status';

export interface RemoteStatus {
  connected: boolean;
  /** 0..1, or null until the remote has said. */
  battery: number | null;
  /** When `connected` last changed (show clock, epoch ms). */
  sinceMs: number;
  /** How many times the remote dropped in the host's last 10 minutes (a rolling window; a reconnect doesn't clear it),
   * so the console and the preflight can warn of a remote at the edge of its range. Absent from an older host. */
  drops?: number;
  /** When the latest drop happened (show clock, epoch ms), or null. Absent from an older host. */
  lastDropMs?: number | null;
}

export interface RemoteStatusMessage extends RemoteStatus {
  v: ProtocolVersion;
  type: typeof REMOTE_STATUS_TYPE;
  /** Added by the relay: which console hosts the remote. */
  clientId?: string;
}

export const remoteStatusMessage = (s: RemoteStatus): RemoteStatusMessage => ({ v: PROTOCOL_VERSION, type: REMOTE_STATUS_TYPE, ...s });

/** A `remote.status` message (untrusted), or null. A battery outside 0..1 reads as unknown; malformed `drops` or
 * `lastDropMs` are left out. */
export function readRemoteStatus(message: unknown): (RemoteStatus & { clientId: string }) | null {
  if (!message || typeof message !== 'object') return null;
  const m = message as Record<string, unknown>;
  if (m.v !== PROTOCOL_VERSION || m.type !== REMOTE_STATUS_TYPE || typeof m.connected !== 'boolean' || typeof m.sinceMs !== 'number') return null;
  const battery = typeof m.battery === 'number' && m.battery >= 0 && m.battery <= 1 ? m.battery : null;
  const drops = Number.isInteger(m.drops) && (m.drops as number) >= 0 ? { drops: m.drops as number } : {};
  const lastDrop = m.lastDropMs === null || (typeof m.lastDropMs === 'number' && Number.isFinite(m.lastDropMs)) ? { lastDropMs: m.lastDropMs as number | null } : {};
  return { connected: m.connected, battery, sinceMs: m.sinceMs, ...drops, ...lastDrop, clientId: typeof m.clientId === 'string' ? m.clientId : '' };
}

/** What a remote receives: the engine's events plus the relay's client list and the Game plan. */
export type IncomingEvent = ShowEvent | RelayClients | RelayPlan;

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
  return (EVENT_TYPES as readonly string[]).includes(m.type) || m.type === 'relay.clients' || m.type === 'relay.plan';
}
