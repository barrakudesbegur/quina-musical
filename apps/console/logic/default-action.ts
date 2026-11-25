// The default action: "go ahead" in the current context (docs/show-ui-and-platform-decisions.md › the Wii
// remote follows the screen's default action). The console draws that control as the primary one, and the
// Wii's A sends exactly it, resolved at the moment of the press. Pure.
//   - the technical pause (Pausa): end it (the pause panel's button);
//   - a Check: nothing while it runs; once its result is due, the verdict the result points to (approve a
//     complete card, reject the rest: suggestedVerdict), until it's decided;
//   - play: Següent;
//   - round start: Barreja once the round is introduced, nothing while the Shuffle runs, then Següent;
//   - the Desgraciat round with one card left standing: "Comprovar #57" (`claim` for the last card standing,
//     ANIMATIONS.md › standing-last); the engine's auto-advance stops there;
//   - a Line's Celebration: Següent (back to the round); a Bingo's or the last card standing's: the Interval;
//   - the Interval: start the next round;
//   - before the night and after it: nothing. Starting the night stays in the menu, on purpose: an A pressed
//     while testing the remote mustn't start the show.
import type { CommandFields, ShowState } from '@quina/protocol';
import type { AnyCommandArgs, AnyCommandName, FlowFields } from '../../../packages/ui/flow.ts';
import type { GamePlan } from '../../../packages/ui/plan.ts';
import { checkProgress, suggestedVerdict } from './check.ts';
import { summarizeClaims } from './claims.ts';
import { shuffleCountdown } from './countdown.ts';
import { roundIntroArgs } from './show-data.ts';
import { nextFellLast, standingSummary } from './standing.ts';

/** The console control that does it (each carries `data-default` when it's the one). */
export type DefaultControl = 'next' | 'confirm' | 'reject' | 'shuffle' | 'interval' | 'roundIntro' | 'endPause' | 'claimLast';

export type DefaultCommand =
  | { cmd: 'next' }
  | { cmd: 'decide'; args: CommandFields['decide'] }
  | { cmd: 'newRound' }
  | { cmd: 'interval' }
  | { cmd: 'roundIntro'; args: CommandFields['roundIntro'] }
  | { cmd: 'pause'; args: CommandFields['pause'] }
  | { cmd: 'claim'; args: CommandFields['claim'] };

export interface DefaultAction {
  control: DefaultControl;
  command: DefaultCommand;
  /** The control is enabled now. A disabled default stays highlighted, but sends nothing. */
  enabled: boolean;
}

export interface DefaultActionInput {
  state: ShowState | null;
  flow: FlowFields;
  nowMs: number;
  plan: GamePlan | null;
  /** The thumb cluster's Següent is enabled (logic/scene.ts controlsModel: not during a Spin). */
  nextEnabled: boolean;
  /** Whether a command would be accepted now (ConsoleModel.can). */
  can: (cmd: AnyCommandName) => boolean;
}

const next = (input: DefaultActionInput): DefaultAction => ({ control: 'next', command: { cmd: 'next' }, enabled: input.nextEnabled });

export function defaultAction(input: DefaultActionInput): DefaultAction | null {
  const { state, flow, nowMs, plan, can } = input;
  if (!state) return null;
  if (flow.pause) return { control: 'endPause', command: { cmd: 'pause', args: { on: false } }, enabled: can('pause') };

  switch (flow.scene) {
    case 'check': {
      const check = flow.check;
      if (!check || checkProgress(check, nowMs).stage !== 'result') return null;
      const current = summarizeClaims(flow.claims, check).items.find((c) => c.current);
      if (!current || current.decided) return null;
      const valid = suggestedVerdict(check.outcome, check.kind);
      return { control: valid ? 'confirm' : 'reject', command: { cmd: 'decide', args: { claimId: check.claimId, valid } }, enabled: can('decide') };
    }
    case 'play': {
      // The Desgraciat's end: the last card standing; with none left, the next card that sat with the last song.
      const last = lastStanding(state) ?? fellLastToClaim(state, flow.claims);
      if (last !== null) return { control: 'claimLast', command: { cmd: 'claim', args: { cardId: last, kind: 'standing' } }, enabled: can('claim') };
      return next(input);
    }
    case 'roundStart':
      if (flow.intro !== null) return { control: 'shuffle', command: { cmd: 'newRound' }, enabled: can('newRound') };
      if (shuffleCountdown(flow.shuffle, nowMs)) return null;
      return next(input);
    case 'celebration':
      if (flow.celebration?.kind === 'line') return next(input);
      if (flow.celebration?.kind === 'bingo' || flow.celebration?.kind === 'standing') return { control: 'interval', command: { cmd: 'interval' }, enabled: can('interval') };
      return null;
    case 'interval':
      if (!flow.interval) return null;
      return { control: 'roundIntro', command: { cmd: 'roundIntro', args: roundIntroArgs(plan, flow.interval.nextRound) }, enabled: can('roundIntro') };
    case 'before':
    case 'after':
      return null;
  }
}

/** With nobody left standing, the next card that sat down with the last song and has no claim yet (the shared win). */
function fellLastToClaim(state: ShowState, claims: readonly { cardId: number; round: number }[]): number | null {
  const summary = standingSummary(state.standing, state.cards.validCount);
  if (!summary || summary.count !== 0) return null;
  return nextFellLast(summary.fellLast, claims, state.round.number);
}

/** The Desgraciat round's last card standing, when exactly one is left (its number, from the private `standing`). */
function lastStanding(state: ShowState): number | null {
  if (state.round.kind !== 'desgraciat') return null;
  return standingSummary(state.standing, state.cards.validCount)?.last ?? null;
}

/** How a command leaves the console (ConsoleModel.act). */
export type Act = <C extends AnyCommandName>(cmd: C, ...args: AnyCommandArgs<C>) => string | null;

/** Send a default action's command, exactly as its console control does. Null when there is nothing to send. */
export function sendDefault(act: Act, action: DefaultAction | null): string | null {
  if (!action?.enabled) return null;
  const c = action.command;
  switch (c.cmd) {
    case 'next':
      return act('next');
    case 'newRound':
      return act('newRound');
    case 'interval':
      return act('interval');
    case 'decide':
      return act('decide', c.args);
    case 'roundIntro':
      return act('roundIntro', c.args);
    case 'pause':
      return act('pause', c.args);
    case 'claim':
      return act('claim', c.args);
  }
}
