// Which controls the console offers right now. The engine is the authority: it checks every command against
// the scene rules in @quina/protocol and rejects the rest (`wrongScene`), and the console shows that as a
// toast. The console reads the same shared rules only to grey out what would be refused anyway. Pure.
import { sceneAllows, type SceneContext, type ShowState } from '@quina/protocol';
import type { AnyCommandName, FlowFields } from '../../ui/flow.ts';

/** The engine's scene rules, shared through @quina/protocol (protocol/scenes.ts), so the console can't drift. */
export { SCENE_RULES, sceneAllows, type SceneContext } from '@quina/protocol';

export function sceneContext(flow: FlowFields, state: ShowState | null = null): SceneContext {
  return {
    scene: flow.scene,
    celebrating: flow.scene === 'celebration' ? (flow.celebration?.kind ?? null) : null,
    introduced: flow.scene === 'roundStart' && flow.intro !== null,
    paused: flow.pause !== null,
    // The Interval playlist is playing: exactly the engine's own test for `intervalSkip`.
    ...(state && 'intervalMusic' in state ? { intervalMusic: state.intervalMusic != null } : {}),
  };
}

export interface ControlsInput {
  state: ShowState | null;
  flow: FlowFields;
  /** The relay is connected and the show page is on it. */
  online: boolean;
}

/** The thumb cluster's buttons. */
export interface ControlsModel {
  /** Commands can reach a running show at all. */
  live: boolean;
  next: { enabled: boolean };
  hold: { enabled: boolean; holding: boolean };
  suspense: { enabled: boolean; open: boolean };
  back: { enabled: boolean };
  claim: { enabled: boolean };
}

/** Whether a command can be sent now: the show is reachable and running, and the scene allows it. */
export function canSend(cmd: AnyCommandName, { state, flow, online }: ControlsInput): boolean {
  if (!online || !state || state.status === 'locked') return false;
  return sceneAllows(cmd, sceneContext(flow, state));
}

export function controlsModel(input: ControlsInput): ControlsModel {
  const { state } = input;
  const live = input.online && state !== null && state.status !== 'locked';
  const suspenseOpen = state?.suspense != null;
  // A normal Spin is running: Next would be refused as `busy` (a Suspense is released by Next instead).
  const spinning = state?.status === 'transition' && !suspenseOpen;
  const somethingToUndo = state !== null && (state.queue.position >= 0 || state.transition !== null || suspenseOpen);
  return {
    live,
    next: { enabled: canSend('next', input) && !spinning },
    hold: { enabled: canSend('hold', input), holding: state?.status === 'hold' },
    suspense: { enabled: canSend('suspense', input) && !spinning, open: suspenseOpen },
    back: { enabled: canSend('back', input) && somethingToUndo },
    claim: { enabled: canSend('claim', input) },
  };
}
