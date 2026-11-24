// The laptop link's own copy of the Game journal, on disk: one append-only JSON-lines file per Game, plus a
// pointer to the current Game. Entries can arrive twice or out of order (live `journal.entry` events and
// `journal.entries` backfills), so they are kept by `seq`; only the contiguous prefix (1..n with no hole) is
// uploaded. The show page's own LocalJournal stays the source; this copy survives the page, the browser and
// the link restarting, and is what goes to the cloud after an offline stretch.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { JournalEntry } from '@quina/protocol';
import { canonicalJson, checkJournalEntry } from '../src/domain/journal-check.ts';

export type AddResult = 'new' | 'duplicate' | 'conflict' | 'invalid';

interface GameCopy {
  entries: Map<number, JournalEntry>;
  /** The highest n with entries 1..n all present. */
  contiguous: number;
}

export class JournalCopy {
  readonly dir: string;
  private readonly games = new Map<string, GameCopy>();
  currentGameId: string | null = null;

  constructor(dir: string) {
    this.dir = dir;
    fs.mkdirSync(path.join(dir, 'journal'), { recursive: true });
    const current = readText(path.join(dir, 'current'));
    if (current) {
      this.currentGameId = current;
      this.game(current);
    }
  }

  /**
   * Keep an entry. A new Game id becomes the current Game (the show page started or resumed it). A known
   * `seq` with different content is a conflict: it is reported and not kept.
   */
  add(value: unknown): AddResult {
    const check = checkJournalEntry(value);
    if (!check.ok) return 'invalid';
    const entry = check.entry;
    const game = this.game(entry.gameId);
    if (entry.gameId !== this.currentGameId) {
      this.currentGameId = entry.gameId;
      writeAtomic(path.join(this.dir, 'current'), entry.gameId);
    }
    const known = game.entries.get(entry.seq);
    if (known) return canonicalJson(known) === canonicalJson(entry) ? 'duplicate' : 'conflict';
    fs.appendFileSync(this.file(entry.gameId), `${JSON.stringify(entry)}\n`, { flush: true });
    game.entries.set(entry.seq, entry);
    while (game.entries.has(game.contiguous + 1)) game.contiguous += 1;
    return 'new';
  }

  /** The last `seq` of the unbroken run 1..n for a Game (0 if none). */
  contiguous(gameId: string): number {
    return this.game(gameId).contiguous;
  }

  /** The first missing `seq` when later entries are already here (a hole to fill), else null. */
  firstMissing(gameId: string): number | null {
    const game = this.game(gameId);
    const highest = Math.max(0, ...game.entries.keys());
    return highest > game.contiguous ? game.contiguous + 1 : null;
  }

  /** Entries fromSeq..toSeq of a Game (only from the contiguous run). */
  slice(gameId: string, fromSeq: number, toSeq: number): JournalEntry[] {
    const game = this.game(gameId);
    const out: JournalEntry[] = [];
    for (let seq = fromSeq; seq <= Math.min(toSeq, game.contiguous); seq++) out.push(game.entries.get(seq) as JournalEntry);
    return out;
  }

  private game(gameId: string): GameCopy {
    let game = this.games.get(gameId);
    if (!game) {
      game = { entries: new Map(), contiguous: 0 };
      for (const line of (readText(this.file(gameId)) ?? '').split('\n')) {
        if (!line.trim()) continue;
        try {
          const check = checkJournalEntry(JSON.parse(line));
          if (check.ok && check.entry.gameId === gameId && !game.entries.has(check.entry.seq)) game.entries.set(check.entry.seq, check.entry);
        } catch {
          // a torn last line after a crash: the entry comes again from the show page
        }
      }
      while (game.entries.has(game.contiguous + 1)) game.contiguous += 1;
      this.games.set(gameId, game);
    }
    return game;
  }

  /** The file of a Game: its id when it is filename-safe, else a hash of it. */
  private file(gameId: string): string {
    const safe = /^[A-Za-z0-9._-]{1,100}$/.test(gameId) && !gameId.startsWith('.') ? gameId : createHash('sha256').update(gameId).digest('hex').slice(0, 32);
    return path.join(this.dir, 'journal', `${safe}.jsonl`);
  }
}

function readText(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function writeAtomic(file: string, text: string): void {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, text, { flush: true });
  fs.renameSync(temp, file);
}
