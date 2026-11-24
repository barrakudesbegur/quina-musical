// The contract between the stage controller and each scene's renderer.
import type { AnimDetail } from '../model/moments.ts';
import { CA } from '../../../packages/ui/i18n/ca.ts';
import type { SceneView, StageView } from '../view.ts';

export interface SceneEnv {
  /** Random source for purely visual choices (Shuffle order, confetti, twinkle). */
  random: () => number;
  reducedMotion: () => boolean;
}

/**
 * One scene. `render` runs when the view changes, `tick` on every frame while the scene is on screen (for
 * what depends on the clock), `onAnim` when a moment of the scene happens. They only touch their own nodes.
 */
export interface SceneRenderer<V extends SceneView> {
  readonly root: HTMLElement;
  render(body: V, view: StageView): void;
  tick(nowMs: number): void;
  onAnim?(detail: AnimDetail): void;
}

/** A scene's root: a section with `data-scene`, hidden until shown. */
export function sceneRoot(scene: SceneView['scene']): HTMLElement {
  const el = document.createElement('section');
  el.className = `scene scene--${scene}`;
  el.dataset.scene = scene;
  el.setAttribute('aria-label', CA.scene[scene]);
  el.hidden = true;
  return el;
}
