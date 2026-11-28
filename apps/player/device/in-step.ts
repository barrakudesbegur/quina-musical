// The running dashes of the song playing now (`cell-playing`, `card-playing`) loop in step wherever they show: on every
// tile that holds the song and on the opened card over them (D289: "the same … they do on the normal song cards"). A
// CSS animation starts when its element gets it, so loops started at different moments drift apart; this sets each
// one's start to the timeline's origin, so loops of the same period run in phase. Only these loops are touched.
const LOOPS = new Set(['card-tile-run', 'card-cell-run', 'player-card-count-run']);

/** Puts the running-dash loops under `root` in step (call it after they appear: the next frame). */
export function inStep(root: Element): void {
  for (const anim of root.getAnimations({ subtree: true })) {
    if (anim instanceof CSSAnimation && LOOPS.has(anim.animationName) && anim.startTime !== 0) anim.startTime = 0;
  }
}
