// The Game journal: an append-only, numbered record of what happened in the Game (rounds, Queues, landings,
// undos, confirmed Lines, cards in play, settings, scenes, Claims and their verdicts, Winners). The show
// engine writes one entry per fact; a device that restarts, or another device that takes over, replays the
// journal to the same GameRecord and resumes from it. Whoever keeps the Game (the show laptop, and the
// cloud, which extends its record with each upload) keeps the entries in `seq` order; `replayJournal` and
// `extendJournal` share the one reducer every side uses, so they all agree on the result.
// Live playback (decks, effects, the Spin in flight, a Check's snippets) is deliberately not in here: it
// restarts fresh. PRIVATE as a whole: it holds the Queues and the Winners' names.
import { defaultCardType, type CheckOutcome, type ClimbTarget, type RoundKind, type ShowScene, type WinKind } from './vocabulary.ts';
import type { GameSettings, WinnerInfo } from './events.ts';

/** The settings a journal keeps (the one-off `nextRecipe` test override is not one of them). */
export type JournalSettings = Omit<GameSettings, 'nextRecipe'>;

interface EntryBase {
  /** The Game this entry belongs to. */
  gameId: string;
  /** 1, 2, 3… with no gaps within a Game. */
  seq: number;
  /** When it happened (epoch ms). */
  atMs: number;
}

/** A round started: its secure, tie-free Shuffle (the Queue) and the secret seed that blurs its Phase. */
export interface RoundStartedEntry extends EntryBase {
  kind: 'round.started';
  round: number;
  roundKind: RoundKind;
  /** The printed card type the round plays; absent in an older journal: defaultCardType(roundKind). */
  cardType?: string;
  queue: number[];
  phaseSeed: number;
  startedAtMs: number;
  targetEndMs: number;
  /** The settings as the round starts (the Pace may reset with a new round). */
  settings: JournalSettings;
  /** The Shuffle's secret seed, kept for debugging (0 for a fixed Queue). */
  shuffleSeed: number;
  /** How many times the Shuffle reshuffled to avoid a Tie: the Queue is draw number `shuffleAttempts` from
   * `shuffleSeed` (0: the first draw was kept). */
  shuffleAttempts: number;
}

/**
 * A round resumed by hand (`resumeAt`, plan B): the round as `round.started` would have it, with the songs up
 * to `position` already counted (their real times are unknown: they count from this entry's `atMs`).
 */
export interface RoundResumedEntry extends EntryBase {
  kind: 'round.resumed';
  round: number;
  roundKind: RoundKind;
  /** As in `round.started`. */
  cardType?: string;
  queue: number[];
  phaseSeed: number;
  startedAtMs: number;
  targetEndMs: number;
  settings: JournalSettings;
  shuffleSeed: number;
  shuffleAttempts: number;
  position: number;
  lineConfirmedFrom: number | null;
}

/** A song landed and counts from now. */
export interface SongLandedEntry extends EntryBase {
  kind: 'song.landed';
  round: number;
  /** Its Queue index. */
  position: number;
  songId: number;
}

/** Back undid the landing at `position`: the song no longer counts and is next again. */
export interface LandingUndoneEntry extends EntryBase {
  kind: 'landing.undone';
  round: number;
  position: number;
  songId: number;
}

/** A claimed Line passed its Check; the Phase climbs towards the Bingo from Queue index `fromPosition`. */
export interface LineConfirmedEntry extends EntryBase {
  kind: 'line.confirmed';
  round: number;
  fromPosition: number;
}

/** The cards in play changed (the ranges as entered; empty clears them). */
export interface CardsSetEntry extends EntryBase {
  kind: 'cards.set';
  ranges: string;
}

/** A setting changed. `settings` holds all of them, as they are now. */
export interface SettingsChangedEntry extends EntryBase {
  kind: 'settings.changed';
  settings: JournalSettings;
}

/** The show moved to another scene (a resumed laptop must come back in the Interval, not in play). `round` and
 * `roundKind` are the round the scene is about: in `roundStart`, the round being introduced. */
export interface SceneChangedEntry extends EntryBase {
  kind: 'scene.changed';
  scene: ShowScene;
  round: number;
  roundKind: RoundKind;
  /** The round's card type (in `roundStart`, the introduced round's); absent in an older journal. */
  cardType?: string;
}

/** A Claim was made. (`winKind`, because `kind` names the entry.) */
export interface ClaimOpenedEntry extends EntryBase {
  kind: 'claim.opened';
  round: number;
  claimId: string;
  cardId: number;
  winKind: WinKind;
  /** The Queue index of the last counted landing when it was made. */
  position: number;
}

/** The presenters decided a Claim. For a valid one, `winningSongId` and `position` are the Winning song and
 * its Queue index; for an invalid one, `winningSongId` is null and `position` is the claim's. */
export interface ClaimDecidedEntry extends EntryBase {
  kind: 'claim.decided';
  round: number;
  claimId: string;
  verdict: 'valid' | 'invalid';
  winningSongId: number | null;
  position: number;
  /** The Check's result when the presenters decided (absent in an older journal). A `valid` verdict is always a
   * passing one (isPassingOutcome), unless `manual`; the cloud flags any other. */
  outcome?: CheckOutcome;
  /** Won or lost by hand from a Review (D121), whatever the card shows; absent otherwise. */
  manual?: true;
}

/** A Claim's Check was put under review before its cue (D118–D120): undecided until the Review ends. */
export interface ClaimReviewingEntry extends EntryBase {
  kind: 'claim.reviewing';
  round: number;
  claimId: string;
}

/** A Review ended with `continue` (D121): the Claim's Check goes on from where it was. */
export interface ClaimContinuedEntry extends EntryBase {
  kind: 'claim.continued';
  round: number;
  claimId: string;
}

/** A Claim under review was discarded, without a verdict and without any sound (D121). */
export interface ClaimDiscardedEntry extends EntryBase {
  kind: 'claim.discarded';
  round: number;
  claimId: string;
}

/** A Winner's name and notes, as they are now. PRIVATE, like the whole journal. */
export interface WinnerNotedEntry extends EntryBase {
  kind: 'winner.noted';
  claimId: string;
  name: string | null;
  notes: string | null;
  /** The slip handed to the winner (absent in an older journal). */
  slip?: string | null;
}

/**
 * A round's prizes revealed: by the presenters (`revealPrizes`), or as the round is introduced (`roundIntro`, which
 * a plan with `prizeReveal: 'allSecret'` ignores: plan.ts revealedRounds).
 */
export interface PrizesRevealedEntry extends EntryBase {
  kind: 'prizes.revealed';
  round: number;
  by: 'presenters' | 'intro';
}

export type JournalEntry =
  | RoundStartedEntry
  | RoundResumedEntry
  | SongLandedEntry
  | LandingUndoneEntry
  | LineConfirmedEntry
  | CardsSetEntry
  | SettingsChangedEntry
  | SceneChangedEntry
  | ClaimOpenedEntry
  | ClaimDecidedEntry
  | ClaimReviewingEntry
  | ClaimContinuedEntry
  | ClaimDiscardedEntry
  | WinnerNotedEntry
  | PrizesRevealedEntry;
export type JournalEntryKind = JournalEntry['kind'];
type WithoutBase<E> = E extends unknown ? Omit<E, keyof EntryBase> : never;
/** An entry as the engine builds it, before the journal stamps `gameId`, `seq` and `atMs`. */
export type JournalEntryBody = WithoutBase<JournalEntry>;

export interface RecordedLanding {
  position: number;
  songId: number;
  atMs: number;
  undone: boolean;
}

/** The round in progress, as the journal knows it. */
export interface RecordedRound {
  number: number;
  kind: RoundKind;
  /** The printed card type it plays. Optional in the type only: the reducer always fills it (defaultCardType(kind)
   * for an older journal), but a record kept from before it may lack it. */
  cardType?: string;
  queue: number[];
  phaseSeed: number;
  startedAtMs: number;
  targetEndMs: number;
  /** Queue index of the last counted landing (−1 before the first). */
  position: number;
  /** What the Phase is climbing towards, and from which Queue index. */
  climbingTo: ClimbTarget;
  climbFrom: number;
  landings: RecordedLanding[];
  shuffleSeed: number;
  shuffleAttempts: number;
}

/** A Claim of the round in progress, as the journal knows it (its Check is live playback: not kept). */
export interface RecordedClaim {
  claimId: string;
  round: number;
  cardId: number;
  kind: WinKind;
  position: number;
  atMs: number;
  /** null while undecided; `discarded` set aside without a verdict (`claim.discarded`, D124). */
  verdict: 'valid' | 'invalid' | 'discarded' | null;
  /** Under review (`claim.reviewing`), until the Review ends; absent otherwise. */
  reviewing?: true;
}

/** Everything needed to resume the Game: the result of replaying its journal. */
export interface GameRecord {
  gameId: string;
  /** The last entry's `seq` (0 for an empty journal). */
  seq: number;
  cardsInPlay: string;
  settings: JournalSettings | null;
  round: RecordedRound | null;
  /** The scene, and since when (0: the Game has not left `before`). */
  scene: ShowScene;
  sceneSinceMs: number;
  /** In `roundStart` before its Shuffle, the round being introduced (`cardType` as for RecordedRound). */
  intro: { round: number; kind: RoundKind; cardType?: string } | null;
  /** The round in progress's Claims, oldest first. */
  claims: RecordedClaim[];
  /** Claims made in the whole Game: claim ids go on from it. */
  claimCount: number;
  /** The whole Game's Winners (`name` and `notes` are PRIVATE). */
  winners: WinnerInfo[];
  /** The rounds whose prizes were revealed, and how (plan.ts revealedRounds turns them into what phones see). */
  prizesRevealed: { round: number; by: 'presenters' | 'intro' }[];
}

export class JournalError extends Error {
  override name = 'JournalError';
}

/** The record of a Game before its first entry. */
export function emptyRecord(gameId: string): GameRecord {
  return {
    gameId, seq: 0, cardsInPlay: '', settings: null, round: null,
    scene: 'before', sceneSinceMs: 0, intro: null, claims: [], claimCount: 0, winners: [], prizesRevealed: [],
  };
}

/**
 * Replay a Game's journal into a GameRecord. Entries must be one Game's, in `seq` order with no gaps; a
 * broken journal throws a JournalError rather than resuming from a wrong state.
 */
export function replayJournal(entries: readonly JournalEntry[], gameId = entries[0]?.gameId ?? ''): GameRecord {
  return extendJournal(emptyRecord(gameId), entries);
}

/**
 * Apply more entries to a record: `extendJournal(replayJournal(a), b)` equals `replayJournal([...a, ...b])`.
 * The cloud keeps only the latest record and extends it with each upload, without reading the history
 * back. The record passed in is never changed. The entries must continue it (same Game, `seq` from
 * `record.seq + 1` with no gaps); otherwise it throws a JournalError.
 */
export function extendJournal(record: GameRecord, entries: readonly JournalEntry[]): GameRecord {
  const next = structuredClone(record);
  next.prizesRevealed ??= []; // a record kept from before prize reveals
  for (const entry of entries) {
    if (entry.gameId !== next.gameId) throw new JournalError(`entry ${entry.seq} belongs to game ${entry.gameId}, not ${next.gameId}`);
    if (entry.seq !== next.seq + 1) throw new JournalError(`entry ${entry.seq} follows ${next.seq}: missing or repeated entries`);
    next.seq = entry.seq;
    applyEntry(next, entry);
  }
  return next;
}

function applyEntry(record: GameRecord, entry: JournalEntry): void {
  switch (entry.kind) {
    case 'round.started':
      record.settings = { ...entry.settings };
      record.round = {
        number: entry.round,
        kind: entry.roundKind,
        cardType: entry.cardType ?? defaultCardType(entry.roundKind),
        queue: [...entry.queue],
        phaseSeed: entry.phaseSeed,
        startedAtMs: entry.startedAtMs,
        targetEndMs: entry.targetEndMs,
        position: -1,
        climbingTo: entry.roundKind === 'desgraciat' ? 'standing' : 'line',
        climbFrom: 0,
        landings: [],
        // A journal from before the tie-free Shuffle has neither.
        shuffleSeed: entry.shuffleSeed ?? 0,
        shuffleAttempts: entry.shuffleAttempts ?? 0,
      };
      record.intro = null; // the introduced round has started
      record.claims = [];
      return;
    case 'round.resumed':
      record.settings = { ...entry.settings };
      record.round = {
        number: entry.round,
        kind: entry.roundKind,
        cardType: entry.cardType ?? defaultCardType(entry.roundKind),
        queue: [...entry.queue],
        phaseSeed: entry.phaseSeed,
        startedAtMs: entry.startedAtMs,
        targetEndMs: entry.targetEndMs,
        position: entry.position,
        climbingTo: entry.roundKind === 'desgraciat' ? 'standing' : entry.lineConfirmedFrom != null ? 'bingo' : 'line',
        climbFrom: entry.lineConfirmedFrom ?? 0,
        landings: entry.queue.slice(0, entry.position + 1).map((songId, position) => ({ position, songId, atMs: entry.atMs, undone: false })),
        shuffleSeed: entry.shuffleSeed,
        shuffleAttempts: entry.shuffleAttempts,
      };
      record.intro = null;
      record.claims = [];
      record.scene = 'play';
      record.sceneSinceMs = entry.atMs;
      return;
    case 'song.landed': {
      const round = currentRound(record, entry);
      if (round.queue[entry.position] !== entry.songId) throw new JournalError(`entry ${entry.seq}: song ${entry.songId} is not at Queue index ${entry.position}`);
      round.position = entry.position;
      round.landings.push({ position: entry.position, songId: entry.songId, atMs: entry.atMs, undone: false });
      if (record.settings) record.settings.songsUntilWinner = Math.max(0, record.settings.songsUntilWinner - 1);
      return;
    }
    case 'landing.undone': {
      const round = currentRound(record, entry);
      const landing = round.landings.findLast((l) => !l.undone && l.position === entry.position);
      if (landing) landing.undone = true;
      round.position = entry.position - 1;
      if (record.settings) record.settings.songsUntilWinner += 1;
      return;
    }
    case 'line.confirmed': {
      const round = currentRound(record, entry);
      round.climbingTo = 'bingo';
      round.climbFrom = entry.fromPosition;
      return;
    }
    case 'cards.set':
      record.cardsInPlay = entry.ranges;
      return;
    case 'prizes.revealed':
      if (!record.prizesRevealed.some((r) => r.round === entry.round && r.by === entry.by)) record.prizesRevealed.push({ round: entry.round, by: entry.by });
      return;
    case 'settings.changed':
      record.settings = { ...entry.settings };
      return;
    case 'scene.changed':
      record.scene = entry.scene;
      record.sceneSinceMs = entry.atMs;
      // Entering `roundStart` introduces a round; its `round.started` (the Shuffle), or leaving, ends the intro.
      record.intro = entry.scene === 'roundStart' ? { round: entry.round, kind: entry.roundKind, cardType: entry.cardType ?? defaultCardType(entry.roundKind) } : null;
      return;
    case 'claim.opened': {
      currentRound(record, entry);
      if (record.claims.some((c) => c.claimId === entry.claimId) || record.winners.some((w) => w.claimId === entry.claimId)) {
        throw new JournalError(`entry ${entry.seq}: claim ${entry.claimId} already exists`);
      }
      record.claims.push({ claimId: entry.claimId, round: entry.round, cardId: entry.cardId, kind: entry.winKind, position: entry.position, atMs: entry.atMs, verdict: null });
      record.claimCount += 1;
      return;
    }
    case 'claim.decided': {
      currentRound(record, entry);
      const claim = record.claims.find((c) => c.claimId === entry.claimId);
      if (!claim) throw new JournalError(`entry ${entry.seq}: no claim ${entry.claimId} in round ${entry.round}`);
      if (claim.verdict) throw new JournalError(`entry ${entry.seq}: claim ${entry.claimId} was already decided`);
      claim.verdict = entry.verdict;
      delete claim.reviewing;
      if (entry.verdict === 'valid') {
        record.winners.push({
          round: entry.round, kind: claim.kind, cardId: claim.cardId, claimId: claim.claimId,
          winningSongId: entry.winningSongId, position: entry.position, atMs: entry.atMs, name: null, notes: null,
        });
      }
      return;
    }
    case 'claim.reviewing':
    case 'claim.continued':
    case 'claim.discarded': {
      currentRound(record, entry);
      const claim = record.claims.find((c) => c.claimId === entry.claimId);
      if (!claim) throw new JournalError(`entry ${entry.seq}: no claim ${entry.claimId} in round ${entry.round}`);
      if (claim.verdict) throw new JournalError(`entry ${entry.seq}: claim ${entry.claimId} was already ${claim.verdict === 'discarded' ? 'discarded' : 'decided'}`);
      if (entry.kind === 'claim.reviewing') {
        claim.reviewing = true;
        return;
      }
      // A Review ends with these: its Check goes on, or the Claim is discarded.
      if (!claim.reviewing) throw new JournalError(`entry ${entry.seq}: claim ${entry.claimId} is not under review`);
      delete claim.reviewing;
      if (entry.kind === 'claim.discarded') claim.verdict = 'discarded';
      return;
    }
    case 'winner.noted': {
      const winner = record.winners.find((w) => w.claimId === entry.claimId);
      if (!winner) throw new JournalError(`entry ${entry.seq}: no winner for claim ${entry.claimId}`);
      winner.name = entry.name;
      winner.notes = entry.notes;
      winner.slip = entry.slip ?? null;
      return;
    }
    default:
      entry satisfies never;
  }
}

function currentRound(record: GameRecord, entry: JournalEntry & { round: number }): RecordedRound {
  if (!record.round || record.round.number !== entry.round) throw new JournalError(`entry ${entry.seq} is for round ${entry.round}, which has not started`);
  return record.round;
}
