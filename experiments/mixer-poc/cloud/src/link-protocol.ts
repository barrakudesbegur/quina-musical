// The wire protocol between the show laptop's cloud link (laptop/) and the GameRoom (src/game-room.ts), over
// the WebSocket at /ws/show. Both ends are Platform's; the shared contracts (commands, events, the journal, the
// public feed) stay in @quina/protocol. Every message carries `v` (the protocol version) and the sender's clock.
//
//   link → cloud   link.hello    once per connection: which Game the laptop is playing and how far its journal goes
//                  link.journal  journal entries, in seq order (idempotent: resending is always safe)
//                  link.event    one live show event (only FORWARDED_EVENT_TYPES)
//                  link.ping     a keepalive when nothing else was sent for a while (laptop only; phones never)
//   cloud → link   cloud.welcome the cloud's edition, and the last entry it has for the hello's Game
//                  cloud.ack     the last entry it has after an upload (send from ackSeq + 1)
//                  cloud.need    entries are missing: send again from fromSeq
//                  cloud.conflict the cloud has a different entry `seq` for this Game: stop uploading, a person decides
//                  cloud.refused a message it could not take (bad shape, broken entry)
// Close codes: 4001 another laptop connected (this one stops reconnecting), 4002 silent for too long,
// 4400 a malformed hello.
import { PROTOCOL_VERSION, type ProtocolVersion, type ShowEvent } from '@quina/protocol';
import { isForwardedEventType, type ForwardedEventType } from './domain/projection.ts';

export interface LinkHello {
  v: ProtocolVersion;
  type: 'link.hello';
  /** Identifies this link process (log lines, the console's connection list). */
  clientId: string;
  /** The Game the laptop's journal is for, or null before its first entry. */
  gameId: string | null;
  /** The last `seq` in the laptop's journal for that Game (0 if none). */
  lastSeq: number;
  sentAtMs: number;
}

export interface LinkJournal {
  v: ProtocolVersion;
  type: 'link.journal';
  gameId: string;
  /** JournalEntry values; the cloud checks each one (src/domain/journal-check.ts). */
  entries: unknown[];
  sentAtMs: number;
}

export interface LinkEvent {
  v: ProtocolVersion;
  type: 'link.event';
  event: Extract<ShowEvent, { type: ForwardedEventType }>;
  sentAtMs: number;
}

export interface LinkPing {
  v: ProtocolVersion;
  type: 'link.ping';
  sentAtMs: number;
}

export type LinkMessage = LinkHello | LinkJournal | LinkEvent | LinkPing;

export interface CloudWelcome {
  v: ProtocolVersion;
  type: 'cloud.welcome';
  edition: string;
  /** The hello's Game, which is now the cloud's current Game (null when the hello had none). */
  gameId: string | null;
  /** The last entry the cloud has for that Game: upload from ackSeq + 1. */
  ackSeq: number;
  nowMs: number;
}

export interface CloudAck {
  v: ProtocolVersion;
  type: 'cloud.ack';
  gameId: string;
  ackSeq: number;
  nowMs: number;
}

export interface CloudNeed {
  v: ProtocolVersion;
  type: 'cloud.need';
  gameId: string;
  fromSeq: number;
  nowMs: number;
}

export interface CloudConflict {
  v: ProtocolVersion;
  type: 'cloud.conflict';
  gameId: string;
  seq: number;
  detail: string;
  nowMs: number;
}

export interface CloudRefused {
  v: ProtocolVersion;
  type: 'cloud.refused';
  detail: string;
  /** The entry that broke an upload, when one did. */
  seq: number | null;
  nowMs: number;
}

export type CloudMessage = CloudWelcome | CloudAck | CloudNeed | CloudConflict | CloudRefused;

export const CLOSE = Object.freeze({
  /** Another laptop connected and took over: don't reconnect. */
  replaced: 4001,
  /** Nothing arrived for CLOUD.showSilenceMs. */
  silent: 4002,
  /** The first message wasn't a valid link.hello. */
  badHello: 4400,
});

export type LinkCheck = { ok: true; message: LinkMessage } | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isGameId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 100;
const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Check a message from the laptop. Never throws. Entries inside `link.journal` are checked by `ingest`. */
export function checkLinkMessage(value: unknown): LinkCheck {
  if (!isRecord(value)) return { ok: false, error: 'not an object' };
  if (value.v !== PROTOCOL_VERSION) return { ok: false, error: `protocol version ${String(value.v)} (expected ${PROTOCOL_VERSION})` };
  if (!isTime(value.sentAtMs)) return { ok: false, error: 'sentAtMs must be a number' };
  switch (value.type) {
    case 'link.hello':
      if (typeof value.clientId !== 'string' || !value.clientId || value.clientId.length > 100) return { ok: false, error: 'clientId must be a short string' };
      if (value.gameId !== null && !isGameId(value.gameId)) return { ok: false, error: 'gameId must be a short string or null' };
      if (!Number.isInteger(value.lastSeq) || (value.lastSeq as number) < 0) return { ok: false, error: 'lastSeq must be an integer ≥ 0' };
      return { ok: true, message: value as unknown as LinkHello };
    case 'link.journal':
      if (!isGameId(value.gameId)) return { ok: false, error: 'gameId must be a short string' };
      if (!Array.isArray(value.entries)) return { ok: false, error: 'entries must be a list' };
      return { ok: true, message: value as unknown as LinkJournal };
    case 'link.event': {
      const error = forwardedEventError(value.event);
      return error ? { ok: false, error } : { ok: true, message: value as unknown as LinkEvent };
    }
    case 'link.ping':
      return { ok: true, message: value as unknown as LinkPing };
    default:
      return { ok: false, error: `unknown message type ${String(value.type)}` };
  }
}

const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

/** The fields of a forwarded event that the cloud reads (src/domain/projection.ts). */
function forwardedEventError(event: unknown): string | null {
  if (!isRecord(event) || event.v !== PROTOCOL_VERSION) return 'event must be a show event';
  if (!isForwardedEventType(event.type)) return `event type ${String(event.type)} is not forwarded`;
  switch (event.type) {
    case 'state': {
      const { pause, interval, schedule } = event;
      if (pause !== null && !(isRecord(pause) && isTime(pause.sinceMs))) return 'state.pause must be null or {sinceMs}';
      if (interval !== null && !(isRecord(interval) && isCount(interval.nextRound) && isTime(interval.guideEndMs))) return 'state.interval must be null or {nextRound, guideEndMs}';
      if (!isRecord(schedule) || !isTime(schedule.gameEndMs)) return 'state.schedule.gameEndMs must be a number';
      return null;
    }
    case 'transition.scheduled':
      return isTime(event.spinStartAtMs) && isTime(event.landAtMs) ? null : 'transition.scheduled needs spinStartAtMs and landAtMs';
    case 'suspense.started':
      return isTime(event.spinStartAtMs) ? null : 'suspense.started needs spinStartAtMs';
    case 'shuffle.scheduled':
      return isCount(event.round) && isTime(event.startAtMs) && isTime(event.endAtMs) ? null : 'shuffle.scheduled needs round, startAtMs and endAtMs';
    case 'check.scheduled': {
      const check = event.check;
      return isRecord(check) && isCount(check.cardId) && (check.kind === 'line' || check.kind === 'bingo') ? null : 'check.scheduled needs check.cardId and check.kind';
    }
    case 'transition.cancelled':
    case 'transition.landed':
      return null;
  }
}

/** Build a link message, stamping the version and the clock. */
export function linkMessage<M extends LinkMessage>(body: Omit<M, 'v' | 'sentAtMs'>, nowMs: number): M {
  return { v: PROTOCOL_VERSION, ...body, sentAtMs: nowMs } as M;
}

/** Accept a message from the cloud on the laptop. It trusts the cloud for the fields. */
export function isCloudMessage(value: unknown): value is CloudMessage {
  if (!isRecord(value) || value.v !== PROTOCOL_VERSION || typeof value.type !== 'string') return false;
  return ['cloud.welcome', 'cloud.ack', 'cloud.need', 'cloud.conflict', 'cloud.refused'].includes(value.type);
}
