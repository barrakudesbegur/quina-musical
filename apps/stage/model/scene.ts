// Which scene the projector draws, and whether the drum shows through. Pure.
import type { FlowFields, ShowScene } from '../../ui/flow.ts';
import type { ShufflePhase } from './shuffle.ts';

/**
 * The scene to draw for a show flow. It follows `flow.scene`, except that a scene missing its data falls
 * back to play: a Check without `check` (the claim is queued, nothing to show yet) and a Celebration without
 * `celebration`. A Hold shows no visible change, so it is never a scene of its own.
 */
export function stageScene(flow: Pick<FlowFields, 'scene' | 'check' | 'celebration'>): ShowScene {
  if (flow.scene === 'check' && !flow.check) return 'play';
  if (flow.scene === 'celebration' && !flow.celebration) return 'play';
  return flow.scene;
}

/**
 * Whether the drum's band is open at this moment. The drum shows in play, in the Celebration (its victory
 * lap) and at the round start, except while the Shuffle's grid covers it (it appears once the covers are
 * in). A technical pause covers everything.
 */
export function drumShown(scene: ShowScene, shuffle: ShufflePhase | null, paused: boolean): boolean {
  if (paused) return false;
  if (scene === 'play' || scene === 'celebration') return true;
  if (scene === 'roundStart') return shuffle === null || shuffle === 'before' || shuffle === 'settle' || shuffle === 'done';
  return false;
}
