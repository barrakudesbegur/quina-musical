// The drum's motion as the projector may know it: when a Spin starts and lands, and whether a Suspense is
// open. Only timestamps: the incoming song (`to`, `drum.targetId`) never gets here. The source strips it
// from `transition.scheduled` and `suspense.started` (stage/source.ts). Pure.
import type { ShowState } from '@quina/protocol';

/** What the stage keeps from `transition.scheduled` (`landAtMs`) or `suspense.started` (`landAtMs: null`). */
export interface SpinNote {
  id: string;
  spinStartAtMs: number;
  /** Null while a Suspense is open (it lands once released). */
  landAtMs: number | null;
  /** Set for a Suspense: when it releases by itself. */
  autoReleaseAtMs: number | null;
}

export interface MotionView {
  kind: 'spin' | 'suspense';
  /** Null when only the snapshot is known (a late join): the Spin is already running. */
  startAtMs: number | null;
  landAtMs: number | null;
  sinceMs: number | null;
  autoReleaseAtMs: number | null;
}

/** What the drum is doing at a given time, as far as the stage shows it. */
export type MotionPhase = 'idle' | 'spin' | 'suspense';

/** After a snapshot, keep the note only while the snapshot still runs that same transition or Suspense. */
export function pruneSpinNote(note: SpinNote | null, state: Pick<ShowState, 'transition' | 'suspense'>): SpinNote | null {
  if (!note) return null;
  const runningId = state.transition?.id ?? state.suspense?.id ?? null;
  return runningId === note.id ? note : null;
}

/** The motion from the snapshot, refined by the note of the same id (which knows the exact start). */
export function motionView(state: Pick<ShowState, 'transition' | 'suspense'> | null, note: SpinNote | null): MotionView | null {
  const t = state?.transition ?? null;
  const s = state?.suspense ?? null;
  if (t) {
    const start = note?.id === t.id ? note.spinStartAtMs : null;
    return { kind: 'spin', startAtMs: start, landAtMs: t.landAtMs, sinceMs: null, autoReleaseAtMs: null };
  }
  if (s) {
    const start = note?.id === s.id ? note.spinStartAtMs : s.sinceMs;
    return { kind: 'suspense', startAtMs: start, landAtMs: null, sinceMs: s.sinceMs, autoReleaseAtMs: s.autoReleaseAtMs };
  }
  if (note) {
    // The event arrived before its snapshot.
    const suspense = note.landAtMs === null;
    return {
      kind: suspense ? 'suspense' : 'spin',
      startAtMs: note.spinStartAtMs,
      landAtMs: note.landAtMs,
      sinceMs: suspense ? note.spinStartAtMs : null,
      autoReleaseAtMs: note.autoReleaseAtMs,
    };
  }
  return null;
}

/** The motion at `nowMs`: a Spin runs from its start until its landing; a Suspense from its start until released. */
export function motionAt(motion: MotionView | null, nowMs: number): MotionPhase {
  if (!motion) return 'idle';
  if (motion.startAtMs !== null && nowMs < motion.startAtMs) return 'idle';
  if (motion.kind === 'suspense') return 'suspense';
  if (motion.landAtMs !== null && nowMs >= motion.landAtMs) return 'idle';
  return 'spin';
}

/**
 * The Suspense "?" breathing period at `nowMs`: `slowMs` when it opens, speeding up linearly to `fastMs` at
 * the auto-release (ANIMATIONS.md `suspense`).
 */
export function breathPeriodMs(motion: MotionView | null, nowMs: number, { slowMs, fastMs }: { slowMs: number; fastMs: number }): number {
  const since = motion?.sinceMs ?? motion?.startAtMs ?? null;
  const until = motion?.autoReleaseAtMs ?? null;
  if (since === null || until === null || until <= since) return slowMs;
  const t = Math.min(1, Math.max(0, (nowMs - since) / (until - since)));
  return Math.round(slowMs + (fastMs - slowMs) * t);
}
