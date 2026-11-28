// The default action: "go ahead" in the current context (docs/show-ui-and-platform-decisions.md › the Wii
// remote follows the screen's default action). The console draws that control as the primary one, and the
// Wii's A sends exactly it, resolved at the moment of the press. Pure.
//   - the claim pad, while it's open: «Comprovar» its numbers (nothing while it has none);
//   - the finalists' pad, while it's open: «Començar final» (or «Afegir a la final») once it can send (D184);
//   - the technical pause (Pausa): end it (the pause panel's button);
//   - a Check (D107): the big button. «Destapa» reveals the next song (`checkNext` with the step it expects, so a
//     press that comes twice reveals once), then the cue («Celebrem!», «Vàlid · següent» or «Fallada»), or the shared
//     Celebration's press (`celebrationNext`); while «Seguides» reveals in a row, a press stops it. Nothing under
//     review (D135: the review's choices are the tablet's only) or between two cards;
//   - play: Següent;
//   - round start: Barreja once the round is introduced, nothing while the Shuffle runs, then Següent;
//   - the Desgraciat round with one card left standing: "Comprovar #57" (`claim` for the last card standing,
//     ANIMATIONS.md › standing-last); the engine's auto-advance stops there;
//   - the Desgraciat's finale: Següent while it goes on (D187: A never opens it), then «Celebrem!» (`finaleCue`) once
//     one finalist is left, with no public Check (D166, D169);
//   - a Line's Celebration: Següent (back to the round); a Bingo's or the last card standing's: the Interval;
//   - the Interval: start the next round;
//   - before the night and after it: nothing. Starting the night stays in the menu, on purpose: an A pressed
//     while testing the remote mustn't start the show.
import type { CommandFields, ShowState } from '@quina/protocol';
import type { AnyCommandArgs, AnyCommandName, FlowFields } from '../../../packages/ui/flow.ts';
import type { GamePlan } from '../../../packages/ui/plan.ts';
import { checkPress } from './check.ts';
import { shuffleCountdown } from './countdown.ts';
import { roundIntroArgs } from './show-data.ts';
import { standingSummary } from './standing.ts';

/** The console control that does it (each carries `data-default` when it's the one). */
export type DefaultControl = 'next' | 'check' | 'claimPad' | 'finalePad' | 'finaleCue' | 'shuffle' | 'interval' | 'roundIntro' | 'endPause' | 'claimLast';

export type DefaultCommand =
  | { cmd: 'next' }
  | { cmd: 'checkNext'; args: CommandFields['checkNext'] }
  | { cmd: 'checkAuto'; args: CommandFields['checkAuto'] }
  | { cmd: 'newRound' }
  | { cmd: 'interval' }
  | { cmd: 'roundIntro'; args: CommandFields['roundIntro'] }
  | { cmd: 'pause'; args: CommandFields['pause'] }
  | { cmd: 'claim'; args: CommandFields['claim'] }
  | { cmd: 'finale'; args: CommandFields['finale'] }
  | { cmd: 'finaleCue' };

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
  /** The claim pad is open, with the claim its «Comprovar» would send (null: nothing to claim yet). */
  pad?: { claim: CommandFields['claim'] | null } | null;
  /** The finalists' pad is open, with what its big button would send (null: not yet). */
  finalePad?: { command: CommandFields['finale'] | null } | null;
}

const next = (input: DefaultActionInput): DefaultAction => ({ control: 'next', command: { cmd: 'next' }, enabled: input.nextEnabled });

export function defaultAction(input: DefaultActionInput): DefaultAction | null {
  const { state, flow, nowMs, plan, can, pad, finalePad } = input;
  if (!state) return null;
  // The pad covers the screen: A claims its numbers, never what's underneath (a Check's next reveal).
  if (pad) return pad.claim ? { control: 'claimPad', command: { cmd: 'claim', args: pad.claim }, enabled: can('claim') } : null;
  if (finalePad) return finalePad.command ? { control: 'finalePad', command: { cmd: 'finale', args: finalePad.command }, enabled: can('finale') } : null;
  if (flow.pause) return { control: 'endPause', command: { cmd: 'pause', args: { on: false } }, enabled: can('pause') };

  switch (flow.scene) {
    case 'check': {
      const press = checkPress(flow);
      return press ? { control: 'check', command: press, enabled: can(press.cmd) } : null;
    }
    case 'play': {
      // The finale has its winner: the cue starts the fanfare and the Celebration (Next is refused until then).
      if (state.finale) return state.finale.winner && !state.finale.cued ? { control: 'finaleCue', command: { cmd: 'finaleCue' }, enabled: can('finaleCue') } : next(input);
      // The Desgraciat's end: the last card standing (a landing never takes out everyone left, D180).
      const last = lastStanding(state);
      if (last !== null) return { control: 'claimLast', command: { cmd: 'claim', args: { cardId: last, kind: 'standing' } }, enabled: can('claim') };
      return next(input);
    }
    case 'roundStart':
      if (flow.intro !== null) return { control: 'shuffle', command: { cmd: 'newRound' }, enabled: can('newRound') };
      if (shuffleCountdown(flow.shuffle, nowMs)) return null;
      return next(input);
    case 'celebration':
      if (flow.celebration?.kind === 'line') return next(input);
      // The night's last round has no Interval after it (whats-left 1.2): the night ends from the menu.
      if (state.lastRound) return null;
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
    case 'checkNext':
      return act('checkNext', c.args);
    case 'checkAuto':
      return act('checkAuto', c.args);
    case 'roundIntro':
      return act('roundIntro', c.args);
    case 'pause':
      return act('pause', c.args);
    case 'claim':
      return act('claim', c.args);
    case 'finale':
      return act('finale', c.args);
    case 'finaleCue':
      return act('finaleCue');
  }
}
