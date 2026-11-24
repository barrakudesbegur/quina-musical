// Taking in a journal upload from the show laptop. Pure: the Durable Object stores what this accepts.
// Uploads are idempotent by `seq`: an entry the cloud already has is skipped when it is the same, and is a
// conflict when it differs (another device wrote that Game). A gap is never applied out of order: the cloud
// keeps what came before it and asks for the rest again. A broken entry stops the upload where it is.
import { JournalError, extendJournal, type GameRecord, type JournalEntry } from '@quina/protocol';
import { canonicalJson, checkJournalEntry } from './journal-check.ts';

/** Why an upload stopped before its end. */
export type IngestStop =
  /** Entry `fromSeq` is missing: send again from it. Everything before it was taken. */
  | { kind: 'gap'; fromSeq: number }
  /** The cloud already has a different entry `seq` for this Game. Nothing after it was taken. */
  | { kind: 'conflict'; seq: number; detail: string }
  /** An entry failed its check, or the replay refused it. Nothing after it was taken. */
  | { kind: 'invalid'; seq: number | null; detail: string };

export interface IngestResult {
  /** The record after the accepted entries (the same object when none was accepted). */
  record: GameRecord;
  /** New entries to store, in `seq` order, with their canonical JSON and the record right after each. */
  accepted: { entry: JournalEntry; json: string; record: GameRecord }[];
  /** Entries the cloud already had, identical. */
  duplicates: number;
  stop: IngestStop | null;
}

/**
 * Take in `batch` for the Game of `record`. `stored(seq)` gives the canonical JSON of an entry the cloud already
 * has (only asked for `seq` ≤ `record.seq`). Never throws.
 */
export function ingest(record: GameRecord, batch: readonly unknown[], stored: (seq: number) => string | null): IngestResult {
  const result: IngestResult = { record, accepted: [], duplicates: 0, stop: null };
  const entries: JournalEntry[] = [];
  for (const value of batch) {
    const check = checkJournalEntry(value);
    if (!check.ok) return { ...result, stop: { kind: 'invalid', seq: seqOf(value), detail: check.error } };
    if (check.entry.gameId !== record.gameId) {
      return { ...result, stop: { kind: 'invalid', seq: check.entry.seq, detail: `entry ${check.entry.seq} is for game ${check.entry.gameId}, not ${record.gameId}` } };
    }
    entries.push(check.entry);
  }
  entries.sort((a, b) => a.seq - b.seq);

  let current = record;
  for (const entry of entries) {
    const json = canonicalJson(entry);
    if (entry.seq <= current.seq) {
      if (stored(entry.seq) === json) {
        result.duplicates += 1;
        continue;
      }
      result.stop = { kind: 'conflict', seq: entry.seq, detail: `the cloud already has a different entry ${entry.seq} for game ${entry.gameId}` };
      break;
    }
    if (entry.seq > current.seq + 1) {
      result.stop = { kind: 'gap', fromSeq: current.seq + 1 };
      break;
    }
    try {
      current = extendJournal(current, [entry]);
    } catch (error) {
      result.stop = { kind: 'invalid', seq: entry.seq, detail: error instanceof JournalError ? error.message : String(error) };
      break;
    }
    result.accepted.push({ entry, json, record: current });
  }
  result.record = current;
  return result;
}

function seqOf(value: unknown): number | null {
  const seq = value && typeof value === 'object' ? (value as { seq?: unknown }).seq : null;
  return Number.isInteger(seq) ? (seq as number) : null;
}
