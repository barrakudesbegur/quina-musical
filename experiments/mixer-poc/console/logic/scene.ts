// Which controls the console offers right now. The engine is the authority: it checks every command against
// its scene rules and rejects the rest (`wrongScene`), and the console shows that as a toast. This module
// mirrors those rules (engine/src/show/flow.ts › SCENE_RULES, proposed for @quina/protocol) only so the
// console can grey out what would be refused anyway, and stay put where the rules are unknown: a command
// missing from the table is allowed. Pure.
import type { ShowState } from '@quina/protocol';
import type { AnyCommandName, FlowFields, ShowScene, WinKind } from '../../ui/flow.ts';

/** What the scene rules look at. */
export interface SceneContext {
  scene: ShowScene;
  /** The Celebration's kind, in `celebration`. */
  celebrating: WinKind | null;
  /** In `roundStart`: a round is introduced and its Shuffle hasn't been drawn yet. */
  introduced: boolean;
  /** The technical pause is on. */
  paused: boolean;
}

export function sceneContext(flow: FlowFields): SceneContext {
  return {
    scene: flow.scene,
    celebrating: flow.scene === 'celebration' ? (flow.celebration?.kind ?? null) : null,
    introduced: flow.scene === 'roundStart' && flow.intro !== null,
    paused: flow.pause !== null,
  };
}

type Rule = 'any' | readonly ShowScene[] | ((ctx: SceneContext) => boolean);

const PLAY: readonly ShowScene[] = ['before', 'play'];
const scenes = (...list: ShowScene[]): readonly ShowScene[] => list;
const celebratingLine = (c: SceneContext) => c.scene === 'celebration' && c.celebrating === 'line';
const celebratingBingo = (c: SceneContext) => c.scene === 'celebration' && c.celebrating === 'bingo';

/** The engine's scene rules, mirrored. Commands not listed are allowed. */
export const SCENE_RULES: Readonly<Partial<Record<AnyCommandName, Rule>>> = Object.freeze({
  unlock: 'any',
  getState: 'any',
  setPace: 'any',
  setGame: 'any',
  setCardsInPlay: 'any',
  sfx: 'any',
  overrideNextRecipe: 'any',
  panic: 'any',
  pause: 'any',
  endGame: 'any',
  winnerInfo: 'any',
  next: (c: SceneContext) => PLAY.includes(c.scene) || (c.scene === 'roundStart' && !c.introduced) || celebratingLine(c),
  back: scenes('before', 'play', 'check'),
  // Not in a Check: releasing its Hold would bring the song back up mid-Check (Resume comes after the verdict).
  hold: (c: SceneContext) => PLAY.includes(c.scene) || celebratingLine(c),
  getJournal: 'any',
  holdMusic: scenes('before', 'play', 'check'),
  suspense: PLAY,
  confirmLine: scenes('before', 'play', 'celebration'),
  newRound: (c: SceneContext) => c.scene !== 'check',
  roundIntro: (c: SceneContext) => c.scene === 'before' || c.scene === 'interval' || c.scene === 'after' || celebratingBingo(c),
  claim: scenes('play', 'check', 'celebration'),
  checkStart: scenes('check'),
  decide: scenes('check'),
  celebrationMusic: scenes('celebration'),
  interval: celebratingBingo,
});

/** Whether the engine's scene rules would let `cmd` through now. */
export function sceneAllows(cmd: AnyCommandName, ctx: SceneContext): boolean {
  const rule = SCENE_RULES[cmd] ?? 'any';
  if (rule === 'any') return true;
  if (ctx.paused) return false;
  return typeof rule === 'function' ? rule(ctx) : rule.includes(ctx.scene);
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
  return sceneAllows(cmd, sceneContext(flow));
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
