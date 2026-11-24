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

  /** The current Game's id and its last entry's time, however old, or null. */
  latest(): { gameId: string; atMs: number } | null {
    const gameId = this.read(`${this.prefix}.current`);
    if (!gameId) return null;
    try {
      const last = this.load(gameId).at(-1);
      return last ? { gameId, atMs: last.atMs } : null;
    } catch {
      return null;
    }
  }

  /**
   * Make `entries` (from the cloud) this page's journal for `gameId` and its current Game. Whatever was stored
   * for that Game before is archived under `<prefix>.archive.<gameId>.<nowMs>`, never deleted: a resume to an
   * earlier entry leaves the later local ones there.
   */
  adopt(gameId: string, entries: JournalEntry[], nowMs: number): void {
    const before = this.read(this.key(gameId));
    if (before && before !== JSON.stringify(entries)) this.write(`${this.prefix}.archive.${gameId}.${nowMs}`, before);
    this.gameId = gameId;
    this.entries = [...entries];
    this.write(this.key(gameId), JSON.stringify(this.entries));
    this.write(`${this.prefix}.current`, gameId);
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

/** A journal copy as the cloud link writes it (one entry per line, in arrival order), sorted by `seq`. */
export function parseJournalLines(text: string): JournalEntry[] {
  const entries: JournalEntry[] = [];
  for (const [i, line] of text.split('\n').entries()) {
    if (!line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new JournalError(`journal line ${i + 1} is not JSON`);
    }
    if (!isEntry(value)) throw new JournalError(`journal line ${i + 1} is not an entry`);
    entries.push(value);
  }
  return entries.sort((a, b) => a.seq - b.seq);
}

/** What the laptop's cloud link left for this page (relay `/cloud/`); every method resolves null when absent. */
export interface CloudCopy {
  /** Admin's manual resume: Game, entry to resume at, and when (the cloud's clock). */
  resume(): Promise<{ gameId: string; seq: number; atMs: number } | null>;
  /** The Game the copy is following. */
  current(): Promise<string | null>;
  journal(gameId: string): Promise<JournalEntry[] | null>;
}

export type ResumeChoice =
  | { source: 'cloud' | 'local'; record: GameRecord; entries: JournalEntry[]; warnings: string[] }
  | { source: 'none'; warnings: string[] };

/**
 * Which Game a show page resumes as it boots (decided with the Platform session):
 * 1. Admin's manual resume (`resume.json`), when it is newer than this page's last local entry: that Game,
 *    up to its entry `seq`.
 * 2. Otherwise this page's own journal, if its last entry is recent (`maxAgeMs`).
 * 3. Otherwise the cloud copy's current Game, if its last entry is recent (a new laptop).
 * A cloud journal is adopted as this page's journal, so new entries continue its numbering. A broken one is
 * never resumed from: the warning says why, and the next source is tried.
 */
export async function chooseResume({ local, cloud, nowMs, maxAgeMs }: { local: LocalJournal; cloud: CloudCopy | null; nowMs: number; maxAgeMs: number }): Promise<ResumeChoice> {
  const warnings: string[] = [];
  const fetchJournal = (gameId: string, why: string) =>
    cloud?.journal(gameId).catch((error: unknown) => {
      warnings.push(`${why}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }) ?? Promise.resolve(null);
  const fromCloud = (gameId: string, all: JournalEntry[] | null, upTo: number | null, why: string): ResumeChoice | null => {
    if (!all?.length) return null;
    const entries = upTo == null ? all : all.filter((e) => e.seq <= upTo);
    try {
      const record = replayJournal(entries, gameId);
      if (!record.round) return null;
      local.adopt(gameId, entries, nowMs);
      return { source: 'cloud', record, entries, warnings };
    } catch (error) {
      warnings.push(`${why}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  };
  const latest = local.latest();
  const resume = await cloud?.resume().catch(() => null);
  if (resume && (!latest || resume.atMs > latest.atMs)) {
    const why = 'cloud resume not used';
    const chosen = fromCloud(resume.gameId, await fetchJournal(resume.gameId, why), resume.seq, why);
    if (chosen) return chosen;
  }
  const mine = local.resume(nowMs, maxAgeMs);
  if (mine.ok) return { source: 'local', record: mine.record, entries: mine.entries, warnings };
  if (mine.reason === 'broken') warnings.push(`local journal not resumed: ${mine.detail ?? ''}`);
  const current = await cloud?.current().catch(() => null);
  if (current) {
    const why = 'cloud journal not used';
    const all = await fetchJournal(current, why);
    const last = all?.at(-1);
    if (last && nowMs - last.atMs <= maxAgeMs) {
      const chosen = fromCloud(current, all, null, why);
      if (chosen) return chosen;
    }
  }
  return { source: 'none', warnings };
}
