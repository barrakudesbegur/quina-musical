// The Game journal: an append-only, numbered record of what happened in the Game (rounds, Queues, landings,
// undos, confirmed Lines, cards in play, settings). The show engine writes one entry per fact; a device
// that restarts, or another device that takes over, replays the journal to the same GameRecord and resumes
// from it. Whoever owns the Game (the show laptop now; maybe a cloud store later) keeps the entries in
// `seq` order; `replayJournal` is the one reducer every side uses, so they all agree on the result.
// Live playback (decks, effects, the Spin in flight) is deliberately not in here: it restarts fresh.
import type { ClimbTarget, RoundKind } from './vocabulary.ts';
import type { GameSettings } from './events.ts';

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

/** A round started: its secure Shuffle (the Queue) and the secret seed that blurs its Phase. */
export interface RoundStartedEntry extends EntryBase {
  kind: 'round.started';
  round: number;
  roundKind: RoundKind;
  queue: number[];
  phaseSeed: number;
  startedAtMs: number;
  targetEndMs: number;
  /** The settings as the round starts (the Pace may reset with a new round). */
  settings: JournalSettings;
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

export type JournalEntry = RoundStartedEntry | SongLandedEntry | LandingUndoneEntry | LineConfirmedEntry | CardsSetEntry | SettingsChangedEntry;
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
}

/** Everything needed to resume the Game: the result of replaying its journal. */
export interface GameRecord {
  gameId: string;
  /** The last entry's `seq` (0 for an empty journal). */
  seq: number;
  cardsInPlay: string;
  settings: JournalSettings | null;
  round: RecordedRound | null;
}

export class JournalError extends Error {
  override name = 'JournalError';
}

/**
 * Replay a Game's journal into a GameRecord. Entries must be one Game's, in `seq` order with no gaps; a
 * broken journal throws a JournalError rather than resuming from a wrong state.
 */
export function replayJournal(entries: readonly JournalEntry[], gameId = entries[0]?.gameId ?? ''): GameRecord {
  const record: GameRecord = { gameId, seq: 0, cardsInPlay: '', settings: null, round: null };
  for (const entry of entries) {
    if (entry.gameId !== gameId) throw new JournalError(`entry ${entry.seq} belongs to game ${entry.gameId}, not ${gameId}`);
    if (entry.seq !== record.seq + 1) throw new JournalError(`entry ${entry.seq} follows ${record.seq}: missing or repeated entries`);
    record.seq = entry.seq;
    applyEntry(record, entry);
  }
  return record;
}

function applyEntry(record: GameRecord, entry: JournalEntry): void {
  switch (entry.kind) {
    case 'round.started':
      record.settings = { ...entry.settings };
      record.round = {
        number: entry.round,
        kind: entry.roundKind,
        queue: [...entry.queue],
        phaseSeed: entry.phaseSeed,
        startedAtMs: entry.startedAtMs,
        targetEndMs: entry.targetEndMs,
        position: -1,
        climbingTo: 'line',
        climbFrom: 0,
        landings: [],
      };
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
    case 'settings.changed':
      record.settings = { ...entry.settings };
      return;
    default:
      entry satisfies never;
  }
}

function currentRound(record: GameRecord, entry: JournalEntry & { round: number }): RecordedRound {
  if (!record.round || record.round.number !== entry.round) throw new JournalError(`entry ${entry.seq} is for round ${entry.round}, which has not started`);
  return record.round;
}
