// The phone's Spin solver, off the main thread (ANIMATIONS.md `reel-spin`). A Spin is solved once, by the projector's
// solver (logic/drum.ts spinSolution, run in drum-solver.worker.ts): tens of milliseconds on a mid-range phone, which on
// the main thread was a long task at every Spin's start. The drum (logic/drum.ts PhoneDrum) asks on each frame; until
// the answer is back (a frame or a few) it waits on its start tile, veiled, which is how a Spin's first instant looks
// anyway (the push starts from rest), and then follows the solved curve from the moment it has reached.
//
// The last few solutions are kept by their inputs, so every drum that shows the same Spin (a remounted one, the
// gallery's) shares one solve. Where no worker can start, the same call runs here instead.
import SolverWorker from './drum-solver.worker.ts?worker&inline';
import { spinSolution, type SpinInputs } from '../logic/drum.ts';
import type { Solution } from '../../../packages/rules/drum-solver.ts';
import type { SolveReply, SolveRequest } from './drum-solver.worker.ts';

/** Solutions kept, oldest first. */
const KEEP = 4;
const solved = new Map<string, Solution>();
const asked = new Set<string>();
/** Not started yet (undefined), running, or unavailable (null: solve here). */
let worker: Worker | null | undefined;

const keyOf = (i: SpinInputs): string => `${i.cardCount}:${i.fromIndex}:${i.durationSec}:${i.spinSeed}`;

function keep(key: string, solution: Solution): void {
  solved.delete(key);
  solved.set(key, solution);
  for (const old of solved.keys()) {
    if (solved.size <= KEEP) break;
    solved.delete(old);
  }
}

function start(): Worker | null {
  try {
    const w = new SolverWorker({ name: 'drum-solver' });
    w.addEventListener('message', (event: MessageEvent<SolveReply>) => {
      asked.delete(event.data.key);
      keep(event.data.key, event.data.solution);
    });
    // A worker that fails: solve here from now on (the drums ask again on their next frame).
    w.addEventListener('error', () => {
      worker = null;
      asked.clear();
      w.terminate();
    });
    return w;
  } catch {
    return null;
  }
}

/** Starts the worker ahead of the first Spin (it warms its solver up as it starts). */
export function prepareSpinSolver(): void {
  if (worker === undefined) worker = start();
}

/** The stand-in Spin for these inputs (logic/drum.ts SpinSolver): its solution, or null while the worker solves it. */
export function solveSpinOffThread(inputs: SpinInputs): Solution | null {
  const key = keyOf(inputs);
  const done = solved.get(key);
  if (done) return done;
  prepareSpinSolver();
  if (!worker) {
    const solution = spinSolution(inputs);
    keep(key, solution);
    return solution;
  }
  if (!asked.has(key)) {
    asked.add(key);
    const request: SolveRequest = { key, inputs };
    worker.postMessage(request);
  }
  return null;
}
