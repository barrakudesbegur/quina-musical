// Long press to confirm a risky action (Back, End the night, Panic): a press must last `holdMs` to fire;
// anything shorter shows the "Mantén premut per confirmar" hint for `hintMs`. A pure state machine:
// timestamps in, state out. The component feeds it pointer and key events plus animation-frame ticks, and
// runs the action when a step says `fire`. It fires at most once per press.

export type LongPressPhase = 'idle' | 'pressing' | 'confirmed' | 'hint';

export interface LongPressState {
  readonly phase: LongPressPhase;
  /** When the press started (pressing, confirmed). */
  readonly downAtMs: number | null;
  /** Until when the hint shows (hint). */
  readonly hintUntilMs: number | null;
}

export type LongPressEvent =
  | { type: 'down'; atMs: number }
  | { type: 'up'; atMs: number }
  /** The press was taken away (pointercancel, blur, the button got disabled): no action, no hint. */
  | { type: 'cancel'; atMs: number }
  | { type: 'tick'; atMs: number };

export interface LongPressConfig {
  holdMs: number;
  hintMs: number;
}

export interface LongPressStep {
  state: LongPressState;
  /** Run the action now. */
  fire: boolean;
}

export const LONG_PRESS_IDLE: LongPressState = Object.freeze({ phase: 'idle', downAtMs: null, hintUntilMs: null });

const step = (state: LongPressState, fire = false): LongPressStep => ({ state, fire });
const held = (state: LongPressState, atMs: number, { holdMs }: LongPressConfig) => state.downAtMs !== null && atMs - state.downAtMs >= holdMs;

export function longPress(state: LongPressState, event: LongPressEvent, config: LongPressConfig): LongPressStep {
  switch (state.phase) {
    case 'idle':
    case 'hint':
      if (event.type === 'down') return step({ phase: 'pressing', downAtMs: event.atMs, hintUntilMs: null });
      if (state.phase === 'hint' && event.type === 'tick' && state.hintUntilMs !== null && event.atMs >= state.hintUntilMs) return step(LONG_PRESS_IDLE);
      return step(state);
    case 'pressing':
      return whilePressing(state, event, config);
    case 'confirmed':
      return event.type === 'up' || event.type === 'cancel' ? step(LONG_PRESS_IDLE) : step(state);
  }
}

function whilePressing(state: LongPressState, event: LongPressEvent, config: LongPressConfig): LongPressStep {
  switch (event.type) {
    case 'tick':
      return held(state, event.atMs, config) ? step({ ...state, phase: 'confirmed' }, true) : step(state);
    case 'up':
      // A release after the threshold (the last frame came late) still counts.
      if (held(state, event.atMs, config)) return step(LONG_PRESS_IDLE, true);
      return step({ phase: 'hint', downAtMs: null, hintUntilMs: event.atMs + config.hintMs });
    case 'cancel':
      return step(LONG_PRESS_IDLE);
    case 'down':
      // Key auto-repeat or a second finger: the press goes on.
      return step(state);
  }
}

/** How far the press is, 0..1 (1 once confirmed). */
export function longPressProgress(state: LongPressState, nowMs: number, { holdMs }: LongPressConfig): number {
  if (state.phase === 'confirmed') return 1;
  if (state.phase !== 'pressing' || state.downAtMs === null) return 0;
  if (holdMs <= 0) return 1;
  return Math.min(1, Math.max(0, (nowMs - state.downAtMs) / holdMs));
}

/** Milliseconds of a CSS time ("900ms", "1.2s", " 0.5s "), or `fallbackMs` when it can't be read. */
export function parseCssDurationMs(value: string | null | undefined, fallbackMs: number): number {
  const match = /^\s*(-?\d*\.?\d+)\s*(ms|s)\s*$/i.exec(value ?? '');
  if (!match) return fallbackMs;
  const n = Number(match[1]) * (match[2].toLowerCase() === 's' ? 1000 : 1);
  return Number.isFinite(n) && n >= 0 ? n : fallbackMs;
}
