// What the Worker's HTTP API answers (/api/export, /api/stats). Types only, so Node code (the load test, the
// tests, a future Admin) can use them without the Workers runtime.
import type { GameRecord, JournalEntry } from '@quina/protocol';
import type { PublicState } from './feed/public.ts';

/** Counters since the GameRoom last woke (hibernation and restarts reset them). */
export interface RoomStats {
  sinceMs: number;
  phonesConnected: number;
  phonesAccepted: number;
  consolesConnected: number;
  consolesAccepted: number;
  /** Console commands handed to the laptop link. */
  commandsRelayed: number;
  showsAccepted: number;
  messagesIn: number;
  phoneMessagesIn: number;
  messagesOut: number;
  broadcasts: number;
  uploads: number;
  entriesStored: number;
  duplicates: number;
  gaps: number;
  conflicts: number;
  refused: number;
  rowsRead: number;
  rowsWritten: number;
}

/** The whole edition as JSON (Admin's export). */
export interface EditionExport {
  edition: string;
  exportedAtMs: number;
  currentGameId: string | null;
  games: { gameId: string; entries: JournalEntry[]; record: GameRecord | null; error: string | null }[];
  publicState: PublicState;
}
