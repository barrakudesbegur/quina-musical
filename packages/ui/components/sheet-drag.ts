// C3 · Sheet: the drag to close (ANIMATIONS.md `drawer-drag`), as pure functions the component feeds with the
// finger's positions. The sheet follows the finger 1:1 downwards and resists upwards (a rubber band); on release the
// finger's speed over its last moments decides: a flick down closes it, a flick up keeps it, otherwise it closes when
// pulled past a share of its height. Pure, so the feel is unit-tested (tests/ui/ds/sheet-drag.test.ts).

/** One position of the finger: its y in px and its time in ms (an event's `timeStamp`). */
export interface DragSample {
  readonly y: number;
  readonly t: number;
}

export const SHEET_DRAG = {
  /** A release past this share of the sheet's height closes it (unless flicked back up). */
  threshold: 0.3,
  /** px/ms: faster than this down closes it whatever the distance; this fast up keeps it open. */
  flick: 0.5,
  /** The finger's speed is measured over its last this many ms (older samples are a pause, not a flick). */
  window: 80,
  /** Upwards, the sheet moves this share of the finger's travel… */
  resistance: 1 / 3,
  /** …and never more than this many px above its resting place. */
  maxUp: 24,
  /** A move this many px long decides whether a touch on the content is a drag or a scroll. */
  slop: 6,
  /** A close from a drag goes at least this fast (px/ms), in this many ms at most and at least. */
  minCloseSpeed: 1.2,
  closeMs: { min: 120, max: 240 },
} as const;

/**
 * Where the sheet sits for a finger `raw` px below where it started: 1:1 downwards, a rubber band upwards (it moves a
 * third as far and eases out towards `maxUp`).
 */
export function dragOffset(raw: number, d = SHEET_DRAG): number {
  if (raw >= 0) return raw;
  const up = -raw * d.resistance;
  return -d.maxUp * (1 - Math.exp(-up / d.maxUp));
}

/**
 * The finger's speed in px/ms (positive: down) over the last `window` ms of `samples` (oldest first). Fewer than two
 * samples in that window (the finger stopped before letting go) is no speed at all.
 */
export function releaseVelocity(samples: readonly DragSample[], d = SHEET_DRAG): number {
  const last = samples.at(-1);
  if (!last) return 0;
  const recent = samples.filter((s) => last.t - s.t <= d.window);
  const first = recent[0];
  if (!first || first === last || last.t === first.t) return 0;
  return (last.y - first.y) / (last.t - first.t);
}

/** On release: does the sheet close, or spring back? `offset` is where it sits (px), `height` its height. */
export function releaseCloses(offset: number, height: number, velocity: number, d = SHEET_DRAG): boolean {
  if (offset <= 0 || velocity < -d.flick) return false;
  return velocity > d.flick || offset > height * d.threshold;
}

/** How long a close from a drag takes: the distance left at the finger's speed (never slower than `minCloseSpeed`). */
export function closeDuration(offset: number, height: number, velocity: number, d = SHEET_DRAG): number {
  const left = Math.max(0, height - offset);
  const speed = Math.max(velocity, d.minCloseSpeed);
  return Math.round(Math.min(d.closeMs.max, Math.max(d.closeMs.min, left / speed)));
}

/** The share of the sheet pulled away (0 at rest, 1 gone): the backdrop lightens by it. */
export function pullShare(offset: number, height: number): number {
  return height > 0 ? Math.min(1, Math.max(0, offset / height)) : 0;
}

/**
 * A touch on the sheet's content: once it has moved `slop` px, is it the sheet's drag (pulling down while the content
 * is scrolled to its top) or the content's own scroll? `null` while it hasn't moved enough to tell.
 */
export function contentGesture(dy: number, dx: number, scrollTop: number, d = SHEET_DRAG): 'drag' | 'scroll' | null {
  if (Math.hypot(dx, dy) < d.slop) return null;
  return dy > 0 && Math.abs(dy) > Math.abs(dx) && scrollTop <= 0 ? 'drag' : 'scroll';
}

/**
 * The content was scrolling and reaches its top while the finger goes on pulling down (`step`: this move's px, down
 * positive): the same gesture becomes the sheet's drag, as a native sheet does.
 */
export function handsOver(scrollTop: number, step: number): boolean {
  return scrollTop <= 0 && step > 0;
}

/** A drag on the title bar: after `slop` px, which axis it's on (`null`: not moved enough). Sideways never drags. */
export function barAxis(dy: number, dx: number, d = SHEET_DRAG): 'y' | 'x' | null {
  if (Math.hypot(dx, dy) < d.slop) return null;
  return Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
}
