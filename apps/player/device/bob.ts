// `mark-bob`'s browser side (ANIMATIONS.md; the timing is logic/beat.ts). Two jobs, both driven by the bob's own
// `animationstart` (it bubbles to the home), never by a script per frame:
// - pin each bob's start time to the document timeline's zero, the time its `--beat-delay` is in, so a mark that
//   comes later (a `mark-in`, a card added, a view shown) swings in step with the rest;
// - bob only what shows: an animated element costs the phone's main thread a little every frame even when the
//   compositor runs it (the frame's style, pre-paint and layerising, whenever anything else draws: the playing cell's
//   running ring, `your-song`), so a mark outside the screen gets `data-bob-out` and stops until it comes back.
import { BOB } from '../logic/beat.ts';

/** A bob's animation has started: pin it, whenever its element came. Every other animation is left alone. */
export function pinBob(event: AnimationEvent): void {
  if (event.animationName !== BOB.animation) return;
  const own = (event as AnimationEvent & { animation?: Animation }).animation;
  const target = event.target;
  const animations = own ? [own] : target instanceof Element ? target.getAnimations().filter((a) => (a as CSSAnimation).animationName === BOB.animation) : [];
  for (const a of animations) if (a.startTime !== 0) a.startTime = 0;
}

/** How far outside the screen a mark keeps bobbing, so one scrolled in is already moving. */
const MARGIN = '20% 0px';

/** Pins every bob as it starts and stops the ones outside the screen (`data-bob-out`). One per home. */
export class BobWatcher {
  private readonly io: IntersectionObserver | null;

  constructor() {
    this.io =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(
            (entries) => {
              for (const e of entries) {
                if (!e.target.isConnected) this.io?.unobserve(e.target);
                else e.target.toggleAttribute('data-bob-out', !e.isIntersecting);
              }
            },
            { rootMargin: MARGIN },
          )
        : null;
  }

  /** The home's `animationstart` handler. */
  readonly onanimationstart = (event: AnimationEvent): void => {
    if (event.animationName !== BOB.animation) return;
    pinBob(event);
    if (event.target instanceof Element) this.io?.observe(event.target);
  };

  stop(): void {
    this.io?.disconnect();
  }
}
