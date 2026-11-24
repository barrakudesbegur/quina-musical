// Two levels per button (docs/show-ui-and-platform-decisions.md, "Pause, a second level of Parlem"):
// - Parlem: a tap toggles Parlem (the Hold); holding it enters Pausa (`pause {on:true}`);
// - Aguanta: a tap toggles Aguanta (the Stay); holding it escalates to Suspens (`suspense {on:true}`), and
//   letting go lands, as the Suspens button always did (`suspense {on:false}`).
// Whether a press was a tap or a hold comes from pointer (or key) down and up and the time held: a pure
// state machine, timestamps in, actions out. The component feeds it events plus animation-frame ticks, and
// sends a command for each action. A tap acts on release (only then is it known to be a tap); a hold acts the
// moment it crosses `holdMs`, while the finger is still down. When the second level is already on (a Pausa,
// an open Suspens) or not allowed now, the button has a single level: any press is a tap.
// A tap while the second level is on leaves it; the component decides what each action sends.

export type TwoLevelPhase = 'idle' | 'pressing' | 'escalated';

export interface TwoLevelState {
  readonly phase: TwoLevelPhase;
  /** When the press started (pressing). */
  readonly downAtMs: number | null;
}

export type TwoLevelEvent =
  | { type: 'down'; atMs: number }
  | { type: 'up'; atMs: number }
  /** The press was taken away (pointercancel, blur, a hidden page): no tap; an escalated press lets go. */
  | { type: 'cancel'; atMs: number }
  | { type: 'tick'; atMs: number };

export interface TwoLevelConfig {
  /** How long a press must last to reach the second level (CONSOLE.escalateHoldMs). */
  holdMs: number;
  /** The second level can be entered now: allowed by the scene, and not already on. */
  canEscalate: boolean;
}

/**
 * - tap: a short press (or any press when it can't escalate), on release: the first level's action;
 * - escalate: the press crossed `holdMs`: enter the second level;
 * - release: an escalated press ended (Aguanta's Suspens lands; Parlem's Pausa stays on).
 */
export type TwoLevelAction = 'tap' | 'escalate' | 'release';

export interface TwoLevelStep {
  state: TwoLevelState;
  /** What to do now, in order (a release that came after a late frame both escalates and releases). */
  actions: TwoLevelAction[];
}

export const TWO_LEVEL_IDLE: TwoLevelState = Object.freeze({ phase: 'idle', downAtMs: null });

const step = (state: TwoLevelState, ...actions: TwoLevelAction[]): TwoLevelStep => ({ state, actions });
const heldLongEnough = (state: TwoLevelState, atMs: number, { holdMs, canEscalate }: TwoLevelConfig) =>
  canEscalate && state.downAtMs !== null && atMs - state.downAtMs >= holdMs;

export function twoLevel(state: TwoLevelState, event: TwoLevelEvent, config: TwoLevelConfig): TwoLevelStep {
  switch (state.phase) {
    case 'idle':
      return event.type === 'down' ? step({ phase: 'pressing', downAtMs: event.atMs }) : step(state);
    case 'pressing':
      switch (event.type) {
        case 'tick':
          return heldLongEnough(state, event.atMs, config) ? step({ phase: 'escalated', downAtMs: state.downAtMs }, 'escalate') : step(state);
        case 'up':
          // A release after the threshold (the last frame came late) still reached the second level.
          if (heldLongEnough(state, event.atMs, config)) return step(TWO_LEVEL_IDLE, 'escalate', 'release');
          return step(TWO_LEVEL_IDLE, 'tap');
        case 'cancel':
          return step(TWO_LEVEL_IDLE);
        case 'down':
          // Key auto-repeat or a second finger: the press goes on.
          return step(state);
      }
      break;
    case 'escalated':
      return event.type === 'up' || event.type === 'cancel' ? step(TWO_LEVEL_IDLE, 'release') : step(state);
  }
  return step(state);
}

/** How far the press is towards the second level, 0..1 (1 once escalated; 0 when it can't escalate). */
export function twoLevelProgress(state: TwoLevelState, nowMs: number, { holdMs, canEscalate }: TwoLevelConfig): number {
  if (state.phase === 'escalated') return 1;
  if (state.phase !== 'pressing' || state.downAtMs === null || !canEscalate) return 0;
  if (holdMs <= 0) return 1;
  return Math.min(1, Math.max(0, (nowMs - state.downAtMs) / holdMs));
}
