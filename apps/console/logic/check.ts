// The Check, as the console follows it song by song. The engine schedules every step in advance
// (`steps[i].atMs`, `durationMs`), so which step is playing is just the clock against those times
// (ANIMATIONS.md › check-step: the playing row is highlighted, its ✓/✗ shows at the step's end). The result
// shows once now ≥ `endAtMs`, never before, so the console stays in step with the projector. Pure.
import type { CheckInfo, CheckOutcome, WinKind } from '../../../packages/ui/flow.ts';

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

/** The songs of a Check that had not landed (the ones its result names), in step order. */
export function missingSongs(check: Pick<CheckInfo, 'steps'>): number[] {
  return check.steps.filter((s) => !s.landed).map((s) => s.songId);
}

/**
 * A done step's mark, which always means "good for the claim": for a Line or a Bingo a landed song is ✓ (`ok`); in a
 * standing Check (the Desgraciat round) a song that has NOT landed is, and the landed one is the ✗ that sank the card.
 * Null before the step is done.
 */
export function stepMark(kind: WinKind, landed: boolean | null): 'ok' | 'bad' | null {
  if (landed === null) return null;
  return landed !== (kind === 'standing') ? 'ok' : 'bad';
}

/** The song that sank a fallen card (a standing Check's landed step), or null. */
export function sinkingSong(check: Pick<CheckInfo, 'kind' | 'steps'>): number | null {
  if (check.kind !== 'standing') return null;
  return check.steps.find((s) => s.landed)?.songId ?? null;
}

/** The verdict the engine's finding points to. A presenter still always decides. */
export function suggestedVerdict(outcome: CheckOutcome): boolean {
  return outcome === 'complete';
}
