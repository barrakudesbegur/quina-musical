// What the laptop link uploads next: a pure state machine, driven by the cloud's replies and the journal copy.
// One upload in flight at a time; the cloud's ackSeq says where the next one starts. Resending is always safe
// (the cloud is idempotent by seq), so a lost reply only costs a resend after `ackTimeoutMs`.
import type { JournalEntry } from '@quina/protocol';
import { CLOUD, LINK } from '../src/config.ts';

/** What the uploader needs from the journal copy. */
export interface JournalSource {
  contiguous(gameId: string): number;
  slice(gameId: string, fromSeq: number, toSeq: number): JournalEntry[];
}

export interface Upload {
  gameId: string;
  entries: JournalEntry[];
}

export type UploaderState =
  /** Not connected, or waiting for the cloud's welcome. */
  | { kind: 'waiting' }
  /** Uploading or up to date. */
  | { kind: 'syncing' }
  /** The cloud has a different journal for this Game, or refused an entry: a person must decide. */
  | { kind: 'stopped'; reason: string };

export class Uploader {
  private readonly journal: JournalSource;
  private readonly maxEntries: number;
  private readonly ackTimeoutMs: number;
  gameId: string | null = null;
  /** The last entry the cloud has for `gameId`. */
  ackSeq = 0;
  private inFlight: { toSeq: number; sentAtMs: number } | null = null;
  state: UploaderState = { kind: 'waiting' };

  constructor(journal: JournalSource, maxEntries: number = CLOUD.maxEntriesPerUpload, ackTimeoutMs: number = LINK.ackTimeoutMs) {
    this.journal = journal;
    this.maxEntries = maxEntries;
    this.ackTimeoutMs = ackTimeoutMs;
  }

  /** The connection closed: wait for the next welcome. */
  disconnected(): void {
    this.inFlight = null;
    if (this.state.kind !== 'stopped') this.state = { kind: 'waiting' };
  }

  welcome(gameId: string | null, ackSeq: number, nowMs: number): Upload | null {
    this.gameId = gameId;
    this.ackSeq = ackSeq;
    this.inFlight = null;
    if (this.state.kind !== 'stopped') this.state = { kind: 'syncing' };
    return this.next(nowMs);
  }

  ack(gameId: string, ackSeq: number, nowMs: number): Upload | null {
    if (gameId !== this.gameId) return null;
    this.ackSeq = ackSeq;
    if (this.inFlight && ackSeq >= this.inFlight.toSeq) this.inFlight = null;
    return this.next(nowMs);
  }

  /** The cloud is missing entries from `fromSeq` (it will also have acked fromSeq − 1). */
  need(gameId: string, fromSeq: number, nowMs: number): Upload | null {
    if (gameId !== this.gameId) return null;
    this.ackSeq = Math.min(this.ackSeq, fromSeq - 1);
    this.inFlight = null;
    return this.next(nowMs);
  }

  stop(reason: string): void {
    this.inFlight = null;
    this.state = { kind: 'stopped', reason };
  }

  /** A new entry is in the copy, or time passed: anything to send? */
  next(nowMs: number): Upload | null {
    if (this.state.kind !== 'syncing' || !this.gameId) return null;
    if (this.inFlight) {
      if (nowMs - this.inFlight.sentAtMs < this.ackTimeoutMs) return null;
      this.inFlight = null; // no reply: send it again
    }
    const fromSeq = this.ackSeq + 1;
    const toSeq = Math.min(this.journal.contiguous(this.gameId), this.ackSeq + this.maxEntries);
    if (fromSeq > toSeq) return null;
    this.inFlight = { toSeq, sentAtMs: nowMs };
    return { gameId: this.gameId, entries: this.journal.slice(this.gameId, fromSeq, toSeq) };
  }

  /** Entries the cloud doesn't have yet. */
  pending(): number {
    return this.gameId ? Math.max(0, this.journal.contiguous(this.gameId) - this.ackSeq) : 0;
  }
}
