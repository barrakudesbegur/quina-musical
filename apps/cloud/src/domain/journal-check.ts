// Checks Game journal entries that arrive over the network before the cloud replays or stores them.
// `replayJournal` trusts field types (it was written for the show page's own entries); the cloud must not.
// Known fields must have the right type; extra fields are allowed, so an additive protocol change doesn't stall
// uploads. An unknown `kind` is refused, because the cloud can't replay what it doesn't know.
// There is one checker per kind, so tsc flags a kind added to the protocol until it gets one here.
import { CHECK_OUTCOMES, isCardTypeId, isPhaseName, isShowScene, isVolumeKey, ROUND_KINDS, VOLUME_MAX, WIN_KINDS, type JournalEntry, type JournalEntryKind } from '@quina/protocol';
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

/**
 * The volume sliders (D139), percent from 0 to each one's VOLUME_MAX (150, D157). Absent until a slider or the plan
 * first sets them. A key this cloud doesn't
 * know is let through, like any extra field, so a new slider doesn't stall uploads; it's only never folded into the
 * plan (domain/volumes.ts).
 */
const volumes: FieldCheck = (value) => {
  if (!isRecord(value)) return 'an object of percents';
  for (const [key, percent] of Object.entries(value)) {
    if (isVolumeKey(key) && !(typeof percent === 'number' && Number.isFinite(percent) && percent >= 0 && percent <= VOLUME_MAX[key])) return `a percent from 0 to ${VOLUME_MAX[key]} for ${key}`;
  }
  return null;
};

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
    volumes: optional(volumes),
    remoteShake: optional(boolean),
  });
};

const round = integer(1, 99);
/** The finale's card numbers (as a claim's): distinct, at most 20 (none: the finale is off). */
const finalists: FieldCheck = (value) =>
  Array.isArray(value) && value.length <= 20 && value.every((id) => Number.isInteger(id) && id >= 0 && id <= 99_999) && new Set(value).size === value.length
    ? null
    : 'at most 20 distinct card numbers';
const position = integer(0, 4999);
// The protocol's own lists (normal, special, desgraciat; line, bingo, standing). A value outside them is refused,
// and a refused entry stops the link's uploads: so a new kind reaches the cloud (deployed) before any engine
// journals it.
const roundKind = oneOf(...ROUND_KINDS);
/** A card-types.json id. Older journals lack it: the round plays its kind's default type. */
const cardType = optional((value) => (isCardTypeId(value) ? null : 'a card type id (a-z, 0-9, at most 24)'));
const winKind = oneOf(...WIN_KINDS);
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
    cardType,
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
    cardType,
  },
  'song.landed': { round, position, songId: integer(0) },
  'landing.undone': { round, position, songId: integer(0) },
  'line.confirmed': { round, fromPosition: integer(-1, 4999) },
  'cards.set': { ranges: text(2000, true) },
  'settings.changed': { settings },
  'scene.changed': { scene, round: integer(0, 99), roundKind, cardType },
  'claim.opened': { round, claimId, cardId: integer(0, 99_999), winKind, position: integer(-1, 4999) },
  // `outcome`: the Check's result at the decision (absent in older journals), one of the protocol's CHECK_OUTCOMES.
  // `manual`: won or lost by hand, whatever the card shows: from a Review (D121), or the Desgraciat's finale when a
  // removal left one card; absent otherwise. `fellLast` (a shared win) is only in journals from before D180.
  'claim.decided': { round, claimId, verdict: oneOf('valid', 'invalid'), winningSongId: nullable(integer(0)), position: integer(-1, 4999), outcome: optional(oneOf(...CHECK_OUTCOMES)), manual: optional((value) => (value === true ? null : 'true when present')) },
  // The Desgraciat's finalists (D161, D166–D172 as D180 amends them): the whole set each time, empty when the finale is called off; `byHand`
  // when a removal left one standing, who wins. The reducer refuses it outside a Desgraciat round.
  'finale.set': { round, cardIds: finalists, byHand: optional((value) => (value === true ? null : 'true when present')) },
  // The presenter-paced Check's Review (D118–D121): a Check put under review before its cue leaves the claim
  // undecided; the Review ends with the Check going on (continued), a decision by hand (claim.decided with
  // `manual`), or the claim discarded (D124).
  'claim.reviewing': { round, claimId },
  'claim.continued': { round, claimId },
  'claim.discarded': { round, claimId },
  // `slip`: the numbered slip handed to the winner instead of a name (absent in older journals). Private, like the name.
  'winner.noted': { claimId, name: nullable(text(80, true)), notes: nullable(text(500, true)), slip: optional(nullable(text(16, true))) },
  'prizes.revealed': { round, by: oneOf('presenters', 'intro') },
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
