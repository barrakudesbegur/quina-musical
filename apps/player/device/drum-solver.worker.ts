// The drum's Spin solver off the main thread (device/drum-solver.ts): the projector's solver for a Spin, onto its public
// target or its stand-in (logic/drum.ts spinSolution, the very same call), answered with the solution's sample arrays handed over, not copied.
// A solve is 70 or so runs of the drum's physics, tens of milliseconds on a phone: here it never holds up a frame.
// Bundled inline by Vite (`?worker&inline`), so it needs no file of its own and works offline like the rest of the app.
import { spinSolution, type SpinInputs } from '../logic/drum.ts';
import type { Solution } from '../../../packages/rules/drum-solver.ts';

export interface SolveRequest {
  key: string;
  inputs: SpinInputs;
}

export interface SolveReply {
  key: string;
  solution: Solution;
}

self.addEventListener('message', (event: MessageEvent<SolveRequest>) => {
  const { key, inputs } = event.data;
  const solution = spinSolution(inputs);
  const reply: SolveReply = { key, solution };
  self.postMessage(reply, { transfer: [solution.positions.buffer, solution.velocities.buffer] });
});

// One solve as the worker starts, so the first real Spin runs on code the engine has already optimised.
spinSolution({ cardCount: 40, fromIndex: 0, durationSec: 6, spinSeed: 1 });
