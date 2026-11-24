// The planner with the runtime inputs the show machine does not pass itself: what the audio stores have
// decoded or rendered for the two songs of a transition. main.ts hands this to Show as `env.plan`.
//  - A: its stem lanes (P1), its stems' bar levels, its hooks' keys;
//  - B: its stems' bar levels, its pre-verb renders (P3, of its mix and of its vocals), its hooks' keys.
// Whatever a store does not have yet is simply left out, and the planner plans without it.
import { planTransition } from '../plan/planner.ts';
import type { BlendStore } from './blend.ts';
import type { PreverbStore } from './preverb.ts';
import type { StemStore } from './stems.ts';

export interface PlanInputStores {
  stems: StemStore;
  preverbs: PreverbStore;
  blends: BlendStore;
}

export function plannerWithInputs({ stems, preverbs, blends }: PlanInputStores): typeof planTransition {
  return (request) => {
    const { A, B } = request;
    return planTransition({
      ...request,
      A: A && {
        ...A,
        lanes: A.lanes ?? stems.laneSummary(A.songId),
        stemBars: A.stemBars ?? stems.barLevels(A.songId),
        keys: A.keys ?? blends.hookKeys(A.songId),
      },
      B: {
        ...B,
        stemBars: B.stemBars ?? stems.barLevels(B.songId),
        preverbs: B.preverbs ?? preverbs.hooksFor(B.songId),
        vocalPreverbs: B.vocalPreverbs ?? preverbs.vocalHooksFor(B.songId),
        keys: B.keys ?? blends.hookKeys(B.songId),
      },
    });
  };
}
