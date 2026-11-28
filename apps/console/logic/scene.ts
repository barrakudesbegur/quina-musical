// Which controls the console offers right now. The engine is the authority: it checks every command against
// the scene rules in @quina/protocol and rejects the rest (`wrongScene`), and the console shows that as a
// toast. The console reads the same shared rules only to grey out what would be refused anyway. Pure.
import { BREAK_SETS, sceneAllows, type BreakSet, type MusicSet, type SceneContext, type ShowState } from '@quina/protocol';
import type { AnyCommandName, FlowFields } from '../../../packages/ui/flow.ts';

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
    // The night's last round is in play: the corn-seed storm's button shows (D155).
    ...(state ? { lastRound: state.lastRound === true } : {}),
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
  /** Aguanta: as Parlem, but a Celebration has nothing for it to hold (its music plays on and nothing lands). */
  stay: { enabled: boolean };
  suspense: { enabled: boolean; open: boolean };
  back: { enabled: boolean };
  claim: { enabled: boolean };
}

/** Whether a command can be sent now: the show is reachable and running, and the scene allows it. */
export function canSend(cmd: AnyCommandName, { state, flow, online }: ControlsInput): boolean {
  if (!online || !state || state.status === 'locked') return false;
  return sceneAllows(cmd, sceneContext(flow, state));
}

/**
 * Nothing lands while B is held (D133, D142): Next is refused (`nextBlocked`) during Aguanta and while a Suspens is on.
 * Parlem doesn't block it: Next ends Parlem. During Pausa Next plays the transition, from Aguanta too (D128).
 */
export function nextBlocked(state: Pick<ShowState, 'status' | 'hold' | 'suspense' | 'pause'> | null): boolean {
  if (!state) return false;
  return state.suspense != null || (state.pause == null && state.status === 'hold' && state.hold?.ducked === false);
}

/** In a Check, Enrere acts only while revealing (D127, D134): never once its cue is on screen, nor while a shared
 * Celebration waits for its press (the engine refuses it). */
const checkCued = (flow: Pick<FlowFields, 'scene' | 'check' | 'celebrationNext'>): boolean =>
  flow.scene === 'check' && (flow.check?.cue != null || flow.celebrationNext !== null);

export function controlsModel(input: ControlsInput): ControlsModel {
  const { state } = input;
  const live = input.online && state !== null && state.status !== 'locked';
  const suspenseOpen = state?.suspense != null;
  // A normal Spin is running: Next would be refused as `busy`.
  const spinning = state?.status === 'transition' && !suspenseOpen;
  const somethingToUndo = state !== null && (state.queue.position >= 0 || state.transition !== null || suspenseOpen);
  return {
    live,
    next: { enabled: canSend('next', input) && !spinning && !nextBlocked(state) },
    hold: { enabled: canSend('hold', input), holding: state?.status === 'hold' },
    stay: { enabled: canSend('hold', input) && input.flow.scene !== 'celebration' },
    suspense: { enabled: canSend('suspense', input) && !spinning, open: suspenseOpen },
    back: { enabled: canSend('back', input) && somethingToUndo && !checkCued(input.flow) },
    claim: { enabled: canSend('claim', input) },
  };
}

/** One of the two sets a break can play (D228: the Descans' picker shows while one of them plays, never the end's). */
export const isBreakSet = (set: MusicSet): set is BreakSet => (BREAK_SETS as readonly MusicSet[]).includes(set);
