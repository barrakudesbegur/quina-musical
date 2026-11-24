// The Check, as the console follows it song by song. The engine schedules every step in advance
// (`steps[i].atMs`, `durationMs`), so which step is playing is just the clock against those times
// (ANIMATIONS.md › check-step: the playing row is highlighted, its ✓/✗ shows at the step's end). The result
// shows once now ≥ `endAtMs`, never before, so the console stays in step with the projector. Pure.
import type { CheckInfo, CheckOutcome } from '../../ui/flow.ts';

export type StepState = 'pending' | 'playing' | 'done';

export interface StepView {
  index: number;
  songId: number;
  state: StepState;
  /** ✓ or ✗, known only once the step is done (null before). */
  landed: boolean | null;
}

/** waiting: before the first step; running: steps playing; result: now ≥ endAtMs. */
export type CheckStage = 'waiting' | 'running' | 'result';

export interface CheckProgress {
  steps: StepView[];
  /** The step playing now, or null (between steps, before or after). */
  playingIndex: number | null;
  /** Steps whose mark is shown. */
  doneCount: number;
  /** Of those, how many had landed. */
  landedCount: number;
  total: number;
  stage: CheckStage;
}

export function stepState(step: { atMs: number; durationMs: number }, nowMs: number): StepState {
  if (nowMs < step.atMs) return 'pending';
  if (nowMs < step.atMs + Math.max(0, step.durationMs)) return 'playing';
  return 'done';
}

export function checkProgress(check: CheckInfo, nowMs: number): CheckProgress {
  const stage: CheckStage = nowMs >= check.endAtMs ? 'result' : nowMs < check.startAtMs ? 'waiting' : 'running';
  let playingIndex: number | null = null;
  let doneCount = 0;
  let landedCount = 0;
  const steps = check.steps.map((s, index): StepView => {
    // Once the result shows, every mark shows too, whatever the step times say.
    const state = stage === 'result' ? 'done' : stepState(s, nowMs);
    if (state === 'playing' && playingIndex === null) playingIndex = index;
    if (state === 'done') {
      doneCount++;
      if (s.landed) landedCount++;
    }
    return { index, songId: s.songId, state, landed: state === 'done' ? s.landed : null };
  });
  return { steps, playingIndex, doneCount, landedCount, total: steps.length, stage };
}

/** The verdict the engine's finding points to. A presenter still always decides. */
export function suggestedVerdict(outcome: CheckOutcome): boolean {
  return outcome === 'complete';
}
