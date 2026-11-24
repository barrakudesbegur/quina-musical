// The show page's local copy of the Game journal (@quina/protocol journal.ts), in the browser's storage, so
// a reload or a crash resumes the Game where it was: same round, Queue, landings and settings. One key per
// Game holds its entries in `seq` order, and another names the current Game. Nothing is ever deleted
// here: starting a new Game only moves the "current" pointer, so an old Game can still be uploaded.
import { replayJournal, JournalError, type GameRecord, type JournalEntry } from '@quina/protocol';

/** The part of the Web Storage API this needs (tests pass a Map-backed fake). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type ResumeResult =
  | { ok: true; record: GameRecord; entries: JournalEntry[] }
  | { ok: false; reason: 'none' | 'stale' | 'broken'; detail?: string };

const isEntry = (value: unknown): value is JournalEntry => {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return typeof e.gameId === 'string' && Number.isInteger(e.seq) && typeof e.atMs === 'number' && typeof e.kind === 'string';
};

export class LocalJournal {
  readonly storage: KeyValueStorage | null;
  readonly prefix: string;
  /** Entries of the Game being written, as last saved. */
  entries: JournalEntry[] = [];
  gameId: string | null = null;

  /** `storage` null keeps the journal in memory only (a test show with a fixed Queue). */
  constructor(storage: KeyValueStorage | null, prefix = 'mixer.journal') {
    this.storage = storage;
    this.prefix = prefix;
  }

  private key(gameId: string): string {
    return `${this.prefix}.${gameId}`;
  }

  /** The current Game's journal, replayed, if its last entry is younger than `maxAgeMs`. */
  resume(nowMs: number, maxAgeMs: number): ResumeResult {
    const gameId = this.read(`${this.prefix}.current`);
    if (!gameId) return { ok: false, reason: 'none' };
    let entries: JournalEntry[];
    try {
      entries = this.load(gameId);
    } catch (error) {
      return { ok: false, reason: 'broken', detail: String(error) };
    }
    const last = entries.at(-1);
    if (!last) return { ok: false, reason: 'none' };
    if (nowMs - last.atMs > maxAgeMs) return { ok: false, reason: 'stale', detail: `last entry ${Math.round((nowMs - last.atMs) / 60000)} min ago` };
    try {
      const record = replayJournal(entries, gameId);
      this.gameId = gameId;
      this.entries = entries;
      return { ok: true, record, entries };
    } catch (error) {
      return { ok: false, reason: 'broken', detail: error instanceof JournalError ? error.message : String(error) };
    }
  }

  /** A Game's stored entries. Throws when they are not a list of entries. */
  load(gameId: string): JournalEntry[] {
    const text = this.read(this.key(gameId));
    if (!text) return [];
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed) || !parsed.every(isEntry)) throw new JournalError(`journal ${gameId} is not a list of entries`);
    return parsed;
  }

  /**
   * Keep one entry. A new Game id starts a new journal (the old one stays stored). An entry out of
   * sequence is still kept, with a warning: losing a landing is worse than a gap a replay will flag.
   */
  append(entry: JournalEntry): void {
    if (entry.gameId !== this.gameId) {
      this.gameId = entry.gameId;
      this.entries = [];
      this.write(`${this.prefix}.current`, entry.gameId);
    }
    const lastSeq = this.entries.at(-1)?.seq ?? 0;
    if (entry.seq !== lastSeq + 1) console.warn(`journal: entry ${entry.seq} follows ${lastSeq}`);
    this.entries.push(entry);
    this.write(this.key(entry.gameId), JSON.stringify(this.entries));
  }

  private read(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      this.storage?.setItem(key, value);
    } catch (error) {
      console.warn('journal: could not save', error); // storage full or blocked: the show goes on
    }
  }
}
