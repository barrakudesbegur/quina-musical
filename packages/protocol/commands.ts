// Commands a remote sends to the show engine: `{ v, type: 'cmd', cmd, reqId, ...fields }`.
// COMMANDS is the single source of truth: the engine checks every arriving command against it, and the
// TypeScript types below are derived from it, so a field can never be documented in one place and
// checked differently in another. docs/protocol.md explains each command.
import {
  PROTOCOL_VERSION,
  PACE_LIMITS_SEC,
  SOUND_NAMES,
  CELEBRATION_MUSIC,
  CARD_TYPE_ID_RE,
  ROUND_KINDS,
  WIN_KINDS,
  isPhaseName,
  type PhaseName,
  type ProtocolVersion,
} from './vocabulary.ts';

/** `integers`: a list of integers, each within `min`–`max`, 1 to `maxItems` long, no repeats. */
export type FieldType = 'string' | 'number' | 'boolean' | 'phase' | 'integer' | 'integers';
export interface FieldSpec {
  readonly type: FieldType;
  readonly optional?: boolean;
  readonly nullable?: boolean;
  readonly allowEmpty?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly maxLength?: number;
  readonly oneOf?: readonly string[];
  /** A string must match it. */
  readonly pattern?: RegExp;
  /** The longest list an `integers` field takes. */
  readonly maxItems?: number;
}

export const COMMANDS = Object.freeze({
  /** The show page's first click (browsers need a gesture to start audio). */
  unlock: {},
  /** Ask for the next song. Rejected `busy` while a transition is running. Releases a Hold. */
  next: {},
  /** Undo the last landing, or cancel the running Spin. Always ends in Hold. */
  back: {},
  /**
   * Enter (`on: true`), leave (`on: false`) or toggle (no `on`) the Hold. `duck` (default true) is Parlem: the
   * song ducks under the presenters' voices, and Hold music may take over. `duck: false` is Aguanta (Stay): the
   * song keeps playing at full volume, nothing lands and nothing advances, and near its end it loops its last
   * phrase. Sent while holding, `duck` switches between the two in place; `on: false` or `next` releases.
   */
  hold: { on: { type: 'boolean', optional: true }, duck: { type: 'boolean', optional: true } },
  /** Switch to Hold music now (enters Hold if needed). */
  holdMusic: {},
  /**
   * Suspense: start the next song's transition and hold it open (`on: true`, or no `on` when none is open):
   * the playing song repeats its phrase while the build intensifies over it, and the drum hovers over a few
   * pending songs as each is teased. Release it (`on: false`, no `on`, or `next`) and the
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
    /** Off: a Hold keeps the song ducked instead of switching to Hold music after `holdMusicAfterSec`. Hold music
     * still covers what would otherwise be silence (after Back, a cancelled Spin, a song that runs out). */
    holdMusicOn: { type: 'boolean', optional: true },
    /** The Interval playlist's level in dB (0 = the tracks at the songs' loudness), applied at once. */
    intervalVolumeDb: { type: 'number', optional: true, min: -30, max: 0 },
  },
  /** A claimed Line passed its Check: the Phase starts climbing towards the Bingo. A manual override for when
   * no Check was run (a valid `decide` confirms the Line by itself); allowed in play and in the Celebration. */
  confirmLine: {},
  /** Cards in play for the whole game, as ranges ("1-180, 200-215, 400-460"); empty clears them. */
  setCardsInPlay: { ranges: { type: 'string', allowEmpty: true, maxLength: 2000 } },
  /** Run the round's public, tie-free Shuffle (scene `roundStart`, `shuffle.scheduled`); the scene becomes
   * `play` when it ends, and the first Next waits for it. Without `number`/`kind`: the introduced round's
   * (`roundIntro`), else the next one. */
  newRound: {
    number: { type: 'integer', optional: true, min: 1, max: 20 },
    kind: { type: 'string', optional: true, oneOf: ROUND_KINDS },
    /** The printed card type the round plays (the plan round's `cardType`). Default: the introduced round's, else
     * defaultCardType(kind). */
    cardType: { type: 'string', optional: true, maxLength: 24, pattern: CARD_TYPE_ID_RE },
  },
  /** Silence everything at once. Position is kept and the state becomes `idle`. */
  panic: {},
  /** Play a sound effect or a stinger. */
  sfx: { name: { type: 'string', oneOf: SOUND_NAMES } },
  /** Force the next transition's recipe (testing). */
  overrideNextRecipe: { recipe: { type: 'string', optional: true, nullable: true } },
  /** Ask for a fresh `state` event. */
  getState: {},
  /** Ask for the current Game's journal from entry `fromSeq` on (all of it without `fromSeq`); answered by a
   * `journal.entries` event. The cloud link uses it to fill in entries it missed. */
  getJournal: { fromSeq: { type: 'integer', optional: true, min: 1 } },
  /**
   * Plan B: resume a round by hand on a show page with no journal (a replacement laptop, offline). The seeded
   * Shuffle rebuilds the round's Queue from its seed; the fields are the state's `resume` token. With
   * `shuffleAttempts` or `lastSongId`, a Queue that doesn't match (other cards in play, a mistyped seed or
   * position) is refused as `cannotResume` instead of resumed wrongly.
   */
  resumeAt: {
    round: { type: 'integer', min: 1, max: 20 },
    kind: { type: 'string', oneOf: ROUND_KINDS },
    shuffleSeed: { type: 'integer', min: 0, max: 4294967295 },
    position: { type: 'integer', min: -1, max: 999 },
    lineConfirmedFrom: { type: 'integer', optional: true, nullable: true, min: 0, max: 999 },
    lastSongId: { type: 'integer', optional: true, nullable: true, min: 1 },
    shuffleAttempts: { type: 'integer', optional: true, nullable: true, min: 0 },
    /** The round's card type (the token's; default defaultCardType(kind)): the Queue depends on it. */
    cardType: { type: 'string', optional: true, maxLength: 24, pattern: CARD_TYPE_ID_RE },
  },

  // ---- the show flow (docs/protocol.md › Scenes) ----
  /** Introduce the next round (scene `roundStart`): its name and prizes on screen, Interval music on. No
   * Queue yet: `newRound` runs the Shuffle. */
  roundIntro: {
    number: { type: 'integer', optional: true, min: 1, max: 20 },
    kind: { type: 'string', optional: true, oneOf: ROUND_KINDS },
    /** The printed card type the round plays (the plan round's `cardType`; default defaultCardType(kind)). */
    cardType: { type: 'string', optional: true, maxLength: 24, pattern: CARD_TYPE_ID_RE },
  },
  /**
   * The presenters reveal a round's prizes (GamePlan.prizeReveal): phones may show its bundles from now on. With
   * `perRound` a round is also revealed as it is introduced (`roundIntro`); with `allSecret` only by this.
   */
  revealPrizes: { round: { type: 'integer', min: 1, max: 20 } },
  /** A player claims a Line or the Bingo for a card, or in the Desgraciat round to be the last card standing
   * (`kind` defaults to what the Phase is climbing towards; a kind the round can't be won by is `invalid`).
   * Enters the Hold (cancelling a Spin like Hold does), queues the Claim and starts its Check when none is running. */
  claim: {
    /** One card. Exactly one of `cardId` and `cardIds`; `cardId` goes once the presenter-paced Check is built. */
    cardId: { type: 'integer', optional: true, min: 1, max: 9999 },
    /** Several cards from the claim pad (D110): one Claim each, checked in turn in this order. */
    cardIds: { type: 'integers', optional: true, min: 1, max: 9999, maxItems: 10 },
    kind: { type: 'string', optional: true, oneOf: WIN_KINDS },
  },
  /** (Re)start a Claim's Check from the start: a re-check, another order, or a stopped Claim checked again. */
  checkStart: { claimId: { type: 'string', maxLength: 40 } },
  /**
   * The presenter-paced Check (D107): the tap, or the Wii's A. `step` is the index the press expects, so two consoles
   * and the Wii pressing at once reveal once: `step` = the next song's index reveals it (in the card's grid order,
   * its snippet or the broken record); once the reveals stop (the last song, or the first ✗), `step` = the revealed
   * count is the cue (a pass: valid; a fail: the fail moment); with `celebrationNext`, `step` = that count + 1
   * starts the shared Celebration. Any other press is ignored, silently.
   */
  checkNext: { claimId: { type: 'string', maxLength: 40 }, step: { type: 'integer', min: 0, max: 20 } },
  /** Reveal in a row while on (the Wii's A held, or the tablet's toggle); it never makes the cue. */
  checkAuto: { on: { type: 'boolean' } },
  /** Stop a Check any time before its cue: no sound, back to the Hold the round was in; the Claim is `stopped`. */
  checkStop: { claimId: { type: 'string', maxLength: 40 } },
  /** Drop a stopped or queued Claim without a verdict, and without any sound. */
  claimDrop: { claimId: { type: 'string', maxLength: 40 } },
  /** The presenters' verdict on a Claim. Both are journaled. The Check's result decides (docs/event.md): a presenter
   * may reject a card that passed, but `valid: true` on a card whose Check failed is refused as `failedCheck`. */
  decide: { claimId: { type: 'string', maxLength: 40 }, valid: { type: 'boolean' } },
  /** Set or edit a Winner's name and notes (PRIVATE), at any time. An empty string clears one. */
  winnerInfo: {
    claimId: { type: 'string', maxLength: 40 },
    name: { type: 'string', optional: true, allowEmpty: true, maxLength: 80 },
    notes: { type: 'string', optional: true, allowEmpty: true, maxLength: 500 },
    /** The number of the slip handed to the winner (PRIVATE), e.g. "12" or "A12". */
    slip: { type: 'string', optional: true, allowEmpty: true, maxLength: 16 },
  },
  /** Change the Celebration's music without blocking anything. */
  celebrationMusic: { choice: { type: 'string', oneOf: CELEBRATION_MUSIC } },
  /** After a Bingo's Celebration: the Interval (it also starts by itself after a while). */
  interval: {},
  /** The Interval playlist moves on to its next track, with its usual transition on the playing track's next
   * downbeat. Only while the Interval music plays (state `intervalMusic`). */
  intervalSkip: {},
  /** The end of the Game (scene `after`). */
  endGame: {},
  /** The technical pause ("Tornem de seguida"): on, off, or toggle (no `on`). Hold music plays meanwhile. */
  pause: { on: { type: 'boolean', optional: true } },
} as const satisfies Record<string, Record<string, FieldSpec>>);

type Specs = typeof COMMANDS;
export type CommandName = keyof Specs;
export const COMMAND_NAMES = Object.keys(COMMANDS) as CommandName[];

// ---- types derived from the specs ------------------------------------------------------------------
type ValueOf<F extends FieldSpec> = F extends { oneOf: readonly (infer O)[] }
  ? O
  : F['type'] extends 'integers'
    ? number[]
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
  const error = REFINE[cmd as CommandName]?.(message);
  if (error) return fail(error);
  return { ok: true, command: message as Command };
}

/** Rules across a command's fields, which the per-field specs can't say. */
const REFINE: Partial<Record<CommandName, (message: Record<string, unknown>) => string | null>> = {
  claim: (m) => ((m.cardId === undefined) === (m.cardIds === undefined) ? 'claim needs exactly one of cardId and cardIds' : null),
};

function fieldError(key: string, field: FieldSpec, value: unknown): string | null {
  switch (field.type) {
    case 'boolean':
      return typeof value === 'boolean' ? null : `${key} must be a boolean`;
    case 'string':
      if (typeof value !== 'string' || (!value && !field.allowEmpty)) return `${key} must be a non-empty string`;
      if (field.maxLength != null && value.length > field.maxLength) return `${key} is too long`;
      if (field.pattern && !field.pattern.test(value)) return `${key} has the wrong format`;
      return field.oneOf && !field.oneOf.includes(value) ? `${key} must be one of ${field.oneOf.join(', ')}` : null;
    case 'phase':
      return isPhaseName(value) ? null : `${key} must be a phase name`;
    case 'integers': {
      if (!Array.isArray(value) || !value.length) return `${key} must be a non-empty list of integers`;
      if (field.maxItems != null && value.length > field.maxItems) return `${key} has more than ${field.maxItems} items`;
      for (const item of value) {
        const error = fieldError(`${key} item`, { ...field, type: 'integer' }, item);
        if (error) return error;
      }
      return new Set(value).size === value.length ? null : `${key} repeats an item`;
    }
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
