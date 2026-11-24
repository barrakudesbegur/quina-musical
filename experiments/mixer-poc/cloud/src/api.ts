// What the Worker's HTTP API answers (/api/export, /api/stats). Types only, so Node code (the load test, the
// tests, a future Admin) can use them without the Workers runtime.
import type { GamePlan, GameRecord, JournalEntry } from '@quina/protocol';
import type { PublicState } from '@quina/protocol';

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

/** The answer to PUT /api/plan, and to the GameRoom's setPlan. */
export type PlanSave = { ok: true; plan: GamePlan } | { ok: false; errors: string[] };

/** The answer to POST /api/media: where the file is served. */
export type MediaSave = { ok: true; path: string } | { ok: false; status: 413 | 415 | 507; error: string };

/** One Game of the edition, for Admin's resume picker (GET /api/games). */
export interface GameSummary {
  gameId: string;
  /** Its last entry. */
  seq: number;
  firstAtMs: number;
  lastAtMs: number;
  /** The rounds it reached. */
  rounds: number;
  current: boolean;
  /**
   * For the current Game: where its round stands, to prefill Admin's manual resume (`resumeAt`). SECRET: the
   * seed, with the Pool and the cards in play, gives the whole Queue; organizers only, never on a screen.
   */
  resumePoint: { round: number; kind: 'normal' | 'special'; shuffleSeed: number; shuffleAttempts: number; position: number; lineConfirmedFrom: number | null } | null;
}

/** The answer to POST /api/resume. */
export type ResumeResult = { ok: true; gameId: string; seq: number; laptopOnline: boolean } | { ok: false; error: string };

/** The whole edition as JSON (Admin's export). */
export interface EditionExport {
  edition: string;
  exportedAtMs: number;
  currentGameId: string | null;
  games: { gameId: string; entries: JournalEntry[]; record: GameRecord | null; error: string | null }[];
  publicState: PublicState;
}
