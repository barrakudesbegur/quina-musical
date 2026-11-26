// The show flow (scenes, Claims, the Check, Celebration, Interval, Winners, the round intro, the Shuffle):
// these are now part of @quina/protocol, so this file re-exports the protocol's shapes and keeps `flowOf()`
// as the single place screens read them from. The `Any*` and `FLOW_COMMANDS` names are kept for the apps
// written against the proposal. They are the protocol's own command types now.
import {
  COMMANDS,
  isShowScene,
  type CommandArgs,
  type CommandFields,
  type CommandName,
  type ClaimInfo,
  type CelebrationInfo,
  type CheckInfo,
  type IntervalInfo,
  type IntroInfo,
  type PauseInfo,
  type ShowScene,
  type ShowState,
  type ShuffleInfo,
  type WinnerInfo,
} from '@quina/protocol';

export { SHOW_SCENES, WIN_KINDS, CELEBRATION_MUSIC, isShowScene } from '@quina/protocol';
export type {
  ShowScene,
  WinKind,
  ClaimStatus,
  CheckOutcome,
  ClaimWarning,
  CelebrationMusic,
  ClaimInfo,
  CheckStep,
  CheckInfo,
  CelebrationInfo,
  WinnerInfo,
  IntervalInfo,
  PauseInfo,
  ShuffleInfo,
  IntroInfo,
} from '@quina/protocol';

/** The show-flow fields of a `state` snapshot. */
export interface FlowFields {
  scene: ShowScene;
  pause: PauseInfo | null;
  shuffle: ShuffleInfo | null;
  intro: IntroInfo | null;
  claims: ClaimInfo[];
  check: CheckInfo | null;
  /** Every card of the claim had its cue, the last one failed and an earlier one passed: this press starts the shared
   * Celebration (`checkNext { claimId, step }`, D110). */
  celebrationNext: { claimId: string; step: number } | null;
  celebration: CelebrationInfo | null;
  interval: IntervalInfo | null;
  winners: WinnerInfo[];
}

/** A `state` snapshot. Older engines may still lack the flow fields, so they are read defensively. */
export type FlowState = ShowState;

/**
 * The show flow of a snapshot, with safe defaults when there is no snapshot yet or an older engine sends
 * one without the flow fields: `before` until the first landing of round 1, else `play`.
 */
export function flowOf(state: ShowState | null): FlowFields {
  const s = state as (Partial<FlowFields> & ShowState) | null;
  const derivedScene: ShowScene = !s || (s.queue.position < 0 && s.round.number <= 1 && s.landings.length === 0) ? 'before' : 'play';
  return {
    scene: isShowScene(s?.scene) ? s.scene : derivedScene,
    pause: s?.pause ?? null,
    shuffle: s?.shuffle ?? null,
    intro: s?.intro ?? null,
    claims: s?.claims ?? [],
    check: s?.check ?? null,
    celebrationNext: s?.celebrationNext ?? null,
    celebration: s?.celebration ?? null,
    interval: s?.interval ?? null,
    winners: s?.winners ?? [],
  };
}

// ---- commands (all in the protocol now) ---------------------------------------------------------------
export const FLOW_COMMANDS = Object.freeze({
  roundIntro: COMMANDS.roundIntro,
  claim: COMMANDS.claim,
  checkStart: COMMANDS.checkStart,
  checkNext: COMMANDS.checkNext,
  checkBack: COMMANDS.checkBack,
  checkAuto: COMMANDS.checkAuto,
  checkReview: COMMANDS.checkReview,
  reviewEnd: COMMANDS.reviewEnd,
  winnerInfo: COMMANDS.winnerInfo,
  celebrationMusic: COMMANDS.celebrationMusic,
  interval: COMMANDS.interval,
  endGame: COMMANDS.endGame,
  pause: COMMANDS.pause,
});
export type FlowCommandName = keyof typeof FLOW_COMMANDS;
export type FlowCommandFields = Pick<CommandFields, FlowCommandName>;

/** Every command a screen may send. */
export type AnyCommandFields = CommandFields;
export type AnyCommandName = CommandName;
/** A command's arguments, which may be left out when it has no required fields. */
export type AnyCommandArgs<C extends AnyCommandName> = CommandArgs<C>;
