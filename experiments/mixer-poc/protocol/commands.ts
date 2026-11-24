// Commands a remote sends to the show engine: `{ v, type: 'cmd', cmd, reqId, ...fields }`.
// COMMANDS is the single source of truth: the engine checks every arriving command against it, and the
// TypeScript types below are derived from it, so a field can never be documented in one place and
// checked differently in another. docs/protocol.md explains each command.
import { PROTOCOL_VERSION, PACE_LIMITS_SEC, SOUND_NAMES, isPhaseName, type PhaseName, type ProtocolVersion } from './vocabulary.ts';

export type FieldType = 'string' | 'number' | 'boolean' | 'phase' | 'integer';
export interface FieldSpec {
  readonly type: FieldType;
  readonly optional?: boolean;
  readonly nullable?: boolean;
  readonly allowEmpty?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly maxLength?: number;
  readonly oneOf?: readonly string[];
}

export const COMMANDS = Object.freeze({
  /** The show page's first click (browsers need a gesture to start audio). */
  unlock: {},
  /** Ask for the next song. Rejected `busy` while a transition is running. Releases a Hold. */
  next: {},
  /** Undo the last landing, or cancel the running Spin. Always ends in Hold. */
  back: {},
  /** Enter (`on: true`), leave (`on: false`) or toggle (no `on`) the Hold. */
  hold: { on: { type: 'boolean', optional: true } },
  /** Switch to Hold music now (enters Hold if needed). */
  holdMusic: {},
  /**
   * Suspense: start the next song's transition and hold it open (`on: true`, or no `on` when none is open):
   * the build loops and intensifies and the drum coasts. Release it (`on: false`, no `on`, or `next`) and the
   * song lands on the next bar; it releases by itself after about 30 s. Never started automatically.
   */
  suspense: { on: { type: 'boolean', optional: true } },
  /** Set the Pace in seconds (the engine clamps it to PACE_LIMITS_SEC), nudge it by `delta`, and/or lock it
   * against Drift nudges. */
  setPace: {
    pace: { type: 'number', optional: true, min: 1, max: 600 },
    delta: { type: 'number', optional: true, min: -PACE_LIMITS_SEC[1], max: PACE_LIMITS_SEC[1] },
    locked: { type: 'boolean', optional: true },
  },
  setGame: {
    autoAdvance: { type: 'boolean', optional: true },
    autoAdvanceFinal: { type: 'boolean', optional: true },
    songsUntilWinner: { type: 'integer', optional: true, min: 0, max: 999 },
    phaseOverride: { type: 'phase', optional: true, nullable: true },
    roundsTotal: { type: 'integer', optional: true, min: 1, max: 20 },
    holdMusicAfterSec: { type: 'number', optional: true, min: 0, max: 3600 },
    finalLapStinger: { type: 'boolean', optional: true },
  },
  /** A claimed Line passed its Check: the Phase starts climbing towards the Bingo. */
  confirmLine: {},
  /** Cards in play for the whole game, as ranges ("1-180, 200-215, 400-460"); empty clears them. */
  setCardsInPlay: { ranges: { type: 'string', allowEmpty: true, maxLength: 2000 } },
  /** Stop, then run a new secure Shuffle of the Pool for the round. */
  newRound: {
    number: { type: 'integer', optional: true, min: 1, max: 20 },
    kind: { type: 'string', optional: true, oneOf: ['normal', 'special'] },
  },
  /** Silence everything at once. Position is kept and the state becomes `idle`. */
  panic: {},
  /** Play a sound effect or a stinger. */
  sfx: { name: { type: 'string', oneOf: SOUND_NAMES } },
  /** Force the next transition's recipe (testing). */
  overrideNextRecipe: { recipe: { type: 'string', optional: true, nullable: true } },
  /** Ask for a fresh `state` event. */
  getState: {},
} as const satisfies Record<string, Record<string, FieldSpec>>);

type Specs = typeof COMMANDS;
export type CommandName = keyof Specs;
export const COMMAND_NAMES = Object.keys(COMMANDS) as CommandName[];

// ---- types derived from the specs ------------------------------------------------------------------
type ValueOf<F extends FieldSpec> = F extends { oneOf: readonly (infer O)[] }
  ? O
  : F['type'] extends 'boolean'
    ? boolean
    : F['type'] extends 'number' | 'integer'
      ? number
      : F['type'] extends 'phase'
        ? PhaseName
        : string;
type FieldValue<F extends FieldSpec> = F extends { nullable: true } ? ValueOf<F> | null : ValueOf<F>;
type OptionalKeys<S> = { [K in keyof S]: S[K] extends { optional: true } ? K : never }[keyof S];
type RequiredKeys<S> = Exclude<keyof S, OptionalKeys<S>>;
type Flatten<T> = { [K in keyof T]: T[K] } & {};
type FieldsOf<S extends Record<string, FieldSpec>> = Flatten<
  { [K in RequiredKeys<S>]: FieldValue<S[K]> } & { [K in OptionalKeys<S>]?: FieldValue<S[K]> }
>;

/** The fields each command carries besides the envelope, for example `CommandFields['setPace']`. */
export type CommandFields = { [C in CommandName]: FieldsOf<Specs[C]> };

/** The envelope every command carries. */
export interface CommandEnvelope<C extends CommandName = CommandName> {
  v: ProtocolVersion;
  type: 'cmd';
  cmd: C;
  /** Any unique string; a rejection quotes it back. */
  reqId: string;
}

/** A checked command, as a discriminated union on `cmd`: `switch (command.cmd)` narrows its fields. */
export type Command = { [C in CommandName]: Flatten<CommandEnvelope<C> & CommandFields[C]> }[CommandName];
/** One command by name, for example `CommandOf<'setPace'>`. */
export type CommandOf<C extends CommandName> = Extract<Command, { cmd: C }>;

export type CommandCheck =
  | { ok: true; command: Command }
  | { ok: false; error: string; reqId: string | null; cmd: string | null };

const ENVELOPE_KEYS = new Set(['v', 'type', 'cmd', 'reqId']);
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object';

/** Check a command as it arrives: right version, known command, known fields of the right type. Never throws. */
export function checkCommand(message: unknown): CommandCheck {
  if (!isRecord(message)) return { ok: false, error: 'not an object', reqId: null, cmd: null };
  const reqId = typeof message.reqId === 'string' ? message.reqId : null;
  const cmd = typeof message.cmd === 'string' ? message.cmd : null;
  const fail = (error: string): CommandCheck => ({ ok: false, error, reqId, cmd });
  if (message.v !== PROTOCOL_VERSION) return fail(`protocol version ${String(message.v)} (expected ${PROTOCOL_VERSION})`);
  if (message.type !== 'cmd') return fail('type must be "cmd"');
  if (!reqId) return fail('missing reqId');
  if (!cmd || !Object.hasOwn(COMMANDS, cmd)) return fail(`unknown command ${String(cmd)}`);
  const spec: Readonly<Record<string, FieldSpec>> = COMMANDS[cmd as CommandName];
  for (const key of Object.keys(message)) {
    if (!ENVELOPE_KEYS.has(key) && !Object.hasOwn(spec, key)) return fail(`unexpected field ${key}`);
  }
  for (const [key, field] of Object.entries(spec)) {
    const value = message[key];
    if (value === undefined) {
      if (field.optional) continue;
      return fail(`missing ${key}`);
    }
    if (value === null) {
      if (field.nullable) continue;
      return fail(`${key} may not be null`);
    }
    const error = fieldError(key, field, value);
    if (error) return fail(error);
  }
  return { ok: true, command: message as Command };
}

function fieldError(key: string, field: FieldSpec, value: unknown): string | null {
  switch (field.type) {
    case 'boolean':
      return typeof value === 'boolean' ? null : `${key} must be a boolean`;
    case 'string':
      if (typeof value !== 'string' || (!value && !field.allowEmpty)) return `${key} must be a non-empty string`;
      if (field.maxLength != null && value.length > field.maxLength) return `${key} is too long`;
      return field.oneOf && !field.oneOf.includes(value) ? `${key} must be one of ${field.oneOf.join(', ')}` : null;
    case 'phase':
      return isPhaseName(value) ? null : `${key} must be a phase name`;
    case 'number':
    case 'integer': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return `${key} must be a number`;
      if (field.type === 'integer' && !Number.isInteger(value)) return `${key} must be an integer`;
      if (field.min != null && value < field.min) return `${key} must be ≥ ${field.min}`;
      if (field.max != null && value > field.max) return `${key} must be ≤ ${field.max}`;
      return null;
    }
  }
}

/**
 * The arguments after `cmd` for `makeCommand` and for any wrapper around it: the fields, which may be left
 * out when the command has no required field. `send<C extends CommandName>(cmd: C, ...args: CommandArgs<C>)`.
 */
export type CommandArgs<C extends CommandName> = {} extends CommandFields[C] ? [fields?: CommandFields[C]] : [fields: CommandFields[C]];

/**
 * Build a command with a fresh `reqId`. Remotes use this so they always send a valid, versioned message;
 * the fields are typed per command (`makeCommand('setPace', { pace: 14 })`).
 */
export function makeCommand<C extends CommandName>(cmd: C, ...[fields]: CommandArgs<C>): CommandOf<C> {
  return { v: PROTOCOL_VERSION, type: 'cmd', cmd, reqId: newReqId(), ...fields } as unknown as CommandOf<C>;
}

let counter = 0;
/** A unique request id. */
export function newReqId(prefix = 'r'): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
