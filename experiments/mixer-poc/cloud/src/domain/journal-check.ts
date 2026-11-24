// Checks Game journal entries that arrive over the network before the cloud replays or stores them.
// `replayJournal` trusts field types (it was written for the show page's own entries); the cloud must not.
// Known fields must have the right type; extra fields are allowed, so an additive protocol change doesn't stall
// uploads. An unknown `kind` is refused, because the cloud can't replay what it doesn't know.
// There is one checker per kind, so tsc flags a kind added to the protocol until it gets one here.
import { isPhaseName, isShowScene, type JournalEntry, type JournalEntryKind } from '@quina/protocol';
import { CLOUD } from '../config.ts';

export type EntryCheck = { ok: true; entry: JournalEntry } | { ok: false; error: string };

type Fields = Record<string, unknown>;
type FieldCheck = (value: unknown) => string | null;

const isRecord = (value: unknown): value is Fields => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const integer = (min: number, max = Number.MAX_SAFE_INTEGER): FieldCheck => (value) =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max ? null : `an integer from ${min} to ${max}`;
const finite: FieldCheck = (value) => (typeof value === 'number' && Number.isFinite(value) ? null : 'a number');
const boolean: FieldCheck = (value) => (typeof value === 'boolean' ? null : 'a boolean');
const text = (maxLength: number, allowEmpty = false): FieldCheck => (value) =>
  typeof value === 'string' && value.length <= maxLength && (allowEmpty || value.length > 0) ? null : `a string of at most ${maxLength} characters`;
const oneOf = (...options: string[]): FieldCheck => (value) => (typeof value === 'string' && options.includes(value) ? null : `one of ${options.join(', ')}`);
const nullable = (check: FieldCheck): FieldCheck => (value) => (value === null ? null : check(value));
/** Optional: a journal from an older engine may lack the field (the reducer has a default for it). */
const optional = (check: FieldCheck): FieldCheck => (value) => (value === undefined ? null : check(value));
const songIds: FieldCheck = (value) =>
  Array.isArray(value) && value.length > 0 && value.length <= 5000 && value.every((id) => Number.isInteger(id) && id >= 0) && new Set(value).size === value.length
    ? null
    : 'a list of distinct song ids';
const phase: FieldCheck = (value) => (isPhaseName(value) ? null : 'a phase name');
const scene: FieldCheck = (value) => (isShowScene(value) ? null : 'a scene name');

/** JournalSettings: every field the reducer and a resumed show read. */
const settings: FieldCheck = (value) => {
  if (!isRecord(value)) return 'an object';
  return fieldsError(value, {
    pace: finite,
    paceLocked: boolean,
    autoAdvance: boolean,
    autoAdvanceFinal: boolean,
    songsUntilWinner: integer(0),
    phaseOverride: nullable(phase),
    roundsTotal: integer(1, 99),
    holdMusicAfterSec: finite,
    finalLapStinger: boolean,
  });
};

const round = integer(1, 99);
const position = integer(0, 4999);
const roundKind = oneOf('normal', 'special');
const winKind = oneOf('line', 'bingo');
const claimId = text(40);

/** The fields of each kind, besides the base (`gameId`, `seq`, `atMs`, `kind`). */
const KINDS: Record<JournalEntryKind, Record<string, FieldCheck>> = {
  'round.started': {
    round,
    roundKind,
    queue: songIds,
    phaseSeed: finite,
    startedAtMs: finite,
    targetEndMs: finite,
    settings,
    shuffleSeed: optional(finite),
    shuffleAttempts: optional(integer(0)),
  },
  'round.resumed': {
    round,
    roundKind,
    queue: songIds,
    phaseSeed: finite,
    startedAtMs: finite,
    targetEndMs: finite,
    settings,
    shuffleSeed: finite,
    shuffleAttempts: integer(0),
    position: integer(-1, 4999),
    lineConfirmedFrom: nullable(integer(-1, 4999)),
  },
  'song.landed': { round, position, songId: integer(0) },
  'landing.undone': { round, position, songId: integer(0) },
  'line.confirmed': { round, fromPosition: integer(-1, 4999) },
  'cards.set': { ranges: text(2000, true) },
  'settings.changed': { settings },
  'scene.changed': { scene, round: integer(0, 99), roundKind },
  'claim.opened': { round, claimId, cardId: integer(0, 99_999), winKind, position: integer(-1, 4999) },
  'claim.decided': { round, claimId, verdict: oneOf('valid', 'invalid'), winningSongId: nullable(integer(0)), position: integer(-1, 4999) },
  'winner.noted': { claimId, name: nullable(text(80, true)), notes: nullable(text(500, true)) },
};

const BASE: Record<string, FieldCheck> = {
  gameId: text(100),
  seq: integer(1),
  atMs: finite,
};

function fieldsError(value: Fields, spec: Record<string, FieldCheck>): string | null {
  for (const [key, check] of Object.entries(spec)) {
    const error = check(value[key]);
    if (error) return `${key} must be ${error}`;
  }
  return null;
}

/** Check one entry as it arrives. Never throws. */
export function checkJournalEntry(value: unknown): EntryCheck {
  if (!isRecord(value)) return { ok: false, error: 'an entry must be an object' };
  const kind = value.kind;
  if (typeof kind !== 'string' || !Object.hasOwn(KINDS, kind)) return { ok: false, error: `unknown entry kind ${String(kind)}` };
  const error = fieldsError(value, BASE) ?? fieldsError(value, KINDS[kind as JournalEntryKind]) ?? crossError(value);
  if (error) return { ok: false, error: `entry ${String(value.seq)} (${kind}): ${error}` };
  if (canonicalJson(value).length > CLOUD.maxEntryBytes) return { ok: false, error: `entry ${String(value.seq)} is too big` };
  return { ok: true, entry: value as unknown as JournalEntry };
}

/** Checks across fields that the reducer doesn't make (it would accept them and record a wrong round). */
function crossError(value: Fields): string | null {
  if (value.kind === 'round.resumed' && (value.position as number) >= (value.queue as unknown[]).length) return 'position must be inside the Queue';
  return null;
}

/**
 * JSON with object keys sorted at every level, so the same entry always gives the same text: the cloud stores
 * entries this way and compares a resent entry with the stored one.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isRecord(value)) return value;
  const sorted: Fields = {};
  for (const key of Object.keys(value).sort()) sorted[key] = sortKeys(value[key]);
  return sorted;
}
