// The show flow (scenes, Claims, the Check, Celebration, Interval, Winners): the additions to @quina/protocol
// proposed to the sound engine session (see the UI session's show-flow proposal). Until the engine merges
// them, the screens import these shapes from here and read them through `flowOf`, which falls back to
// sensible defaults when the engine does not send them yet. Once merged, this file only re-exports the
// protocol's types and `flowOf` stays as the single read path, so no screen changes.
import type { CommandFields, FieldSpec, ShowState } from '@quina/protocol';

export const SHOW_SCENES = ['before', 'roundStart', 'play', 'check', 'celebration', 'interval', 'after'] as const;
/** Where the show is in the Game. It sits on top of the engine's audio `status`. */
export type ShowScene = (typeof SHOW_SCENES)[number];
export type WinKind = 'line' | 'bingo';

export type ClaimStatus = 'queued' | 'checking' | 'checked' | 'valid' | 'invalid';
/** What the engine found; a presenter always decides. */
export type CheckOutcome = 'complete' | 'incomplete' | 'unknownCard' | 'wrongType';
export type ClaimWarning = 'notSold';
export type CelebrationMusic = 'winningSong' | 'victory' | 'holdMusic';

export interface ClaimInfo {
  claimId: string;
  round: number;
  cardId: number;
  kind: WinKind;
  atMs: number;
  /** Queue index of the last counted landing when the claim was made. */
  position: number;
  status: ClaimStatus;
  outcome: CheckOutcome | null;
  /** Queue index at which the card first completed this kind ("complete since song N" = index + 1). */
  completeSince: number | null;
  warnings: ClaimWarning[];
}

export interface CheckStep {
  songId: number;
  landed: boolean;
  /** Snippet start, scheduled in advance (epoch ms). */
  atMs: number;
  durationMs: number;
}

export interface CheckInfo {
  claimId: string;
  cardId: number;
  kind: WinKind;
  outcome: CheckOutcome;
  /** Line: the row being played (0–2). Bingo: null (all 12). */
  row: number | null;
  otherRows: number[];
  steps: CheckStep[];
  startAtMs: number;
  /** The result shows from here. */
  endAtMs: number;
}

export interface CelebrationInfo {
  kind: WinKind;
  round: number;
  cardIds: number[];
  winningSongId: number | null;
  sinceMs: number;
  music: CelebrationMusic;
}

export interface WinnerInfo {
  round: number;
  kind: WinKind;
  cardId: number;
  claimId: string;
  winningSongId: number | null;
  position: number;
  atMs: number;
  /** PRIVATE: console and cloud data only. */
  name: string | null;
  /** PRIVATE. */
  notes: string | null;
}

export interface IntervalInfo {
  sinceMs: number;
  nextRound: number;
  guideEndMs: number;
}

export interface PauseInfo {
  sinceMs: number;
}

export interface ShuffleInfo {
  round: number;
  startAtMs: number;
  endAtMs: number;
}

/** The fields the proposal adds to `ShowState`. */
export interface FlowFields {
  scene: ShowScene;
  pause: PauseInfo | null;
  shuffle: ShuffleInfo | null;
  claims: ClaimInfo[];
  check: CheckInfo | null;
  celebration: CelebrationInfo | null;
  interval: IntervalInfo | null;
  winners: WinnerInfo[];
}

/** A `state` snapshot from an engine that may or may not send the show flow yet. */
export type FlowState = ShowState & Partial<FlowFields>;

const isScene = (value: unknown): value is ShowScene => typeof value === 'string' && (SHOW_SCENES as readonly string[]).includes(value);

/**
 * The show flow of a snapshot. Reads the engine's fields when present; otherwise derives what it can
 * from today's protocol: `before` until the first landing of round 1, else `play`.
 */
export function flowOf(state: ShowState | null): FlowFields {
  const s = state as FlowState | null;
  const derivedScene: ShowScene = !s || (s.queue.position < 0 && s.round.number <= 1 && s.landings.length === 0) ? 'before' : 'play';
  return {
    scene: isScene(s?.scene) ? s.scene : derivedScene,
    pause: s?.pause ?? null,
    shuffle: s?.shuffle ?? null,
    claims: s?.claims ?? [],
    check: s?.check ?? null,
    celebration: s?.celebration ?? null,
    interval: s?.interval ?? null,
    winners: s?.winners ?? [],
  };
}

// ---- proposed commands ------------------------------------------------------------------------------
/** Field specs of the proposed commands, in the protocol's own format. */
export const FLOW_COMMANDS = Object.freeze({
  roundIntro: {
    number: { type: 'integer', optional: true, min: 1, max: 20 },
    kind: { type: 'string', optional: true, oneOf: ['normal', 'special'] },
  },
  claim: {
    cardId: { type: 'integer', min: 1, max: 9999 },
    kind: { type: 'string', optional: true, oneOf: ['line', 'bingo'] },
  },
  checkStart: { claimId: { type: 'string', maxLength: 40 } },
  decide: { claimId: { type: 'string', maxLength: 40 }, valid: { type: 'boolean' } },
  winnerInfo: {
    claimId: { type: 'string', maxLength: 40 },
    name: { type: 'string', optional: true, allowEmpty: true, maxLength: 80 },
    notes: { type: 'string', optional: true, allowEmpty: true, maxLength: 500 },
  },
  celebrationMusic: { choice: { type: 'string', oneOf: ['winningSong', 'victory', 'holdMusic'] } },
  interval: {},
  endGame: {},
  pause: { on: { type: 'boolean', optional: true } },
} as const satisfies Record<string, Record<string, FieldSpec>>);

/** The proposed commands' fields, typed by hand (they mirror FLOW_COMMANDS). */
export interface FlowCommandFields {
  roundIntro: { number?: number; kind?: 'normal' | 'special' };
  claim: { cardId: number; kind?: WinKind };
  checkStart: { claimId: string };
  decide: { claimId: string; valid: boolean };
  winnerInfo: { claimId: string; name?: string; notes?: string };
  celebrationMusic: { choice: CelebrationMusic };
  interval: Record<string, never>;
  endGame: Record<string, never>;
  pause: { on?: boolean };
}
export type FlowCommandName = keyof FlowCommandFields;

/** Every command a screen may send: the merged protocol's plus the proposed ones. */
export type AnyCommandFields = CommandFields & FlowCommandFields;
export type AnyCommandName = keyof AnyCommandFields;

/** A command's arguments, which may be left out when it has no required fields. */
export type AnyCommandArgs<C extends AnyCommandName> = {} extends AnyCommandFields[C] ? [fields?: AnyCommandFields[C]] : [fields: AnyCommandFields[C]];
