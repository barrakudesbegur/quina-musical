// The DOM side of the `a-glide` motion (ANIMATIONS.md): when Pausa starts or ends (D128), the Wii's A badge glides
// from the control it was on to the one that is the default now («Acaba la pausa», and back). The model calls
// `captureA()` when a snapshot turns Pausa on or off, before the screen changes; the A badge that mounts next calls
// `glideA()` and flies in from there (transforms only; logic/next-to-now.ts has the maths). Every other move of the
// default keeps the badge's pop (`wii-badge`). Never throws; with reduced motion, or without the Web Animations API, the
// badge just appears.
import { parseCssDurationMs } from '../../packages/ui/components/hold/long-press.ts';
import { invert, type Box } from './logic/next-to-now.ts';

/** A capture older than this is stale: the badge that mounts later isn't the one Pausa moved. */
const FRESH_MS = 600;
/** Used only when the `--dur-a-glide` token can't be read. */
const FALLBACK_MS = 320;

let from: { box: Box; atMs: number } | null = null;

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

/** Where the A badge (the default action's, not a hold's) is now, if one shows. */
export function captureA(): void {
  try {
    const el = document.querySelector('.console .wii-badge[data-wii="a"]:not([data-hold])');
    from = el ? { box: boxOf(el), atMs: performance.now() } : null;
  } catch {
    from = null;
  }
}

/** A new A badge: glide in from the captured place, if Pausa just moved it. */
export function glideA(el: HTMLElement): void {
  const start = from;
  from = null;
  try {
    if (!start || performance.now() - start.atMs > FRESH_MS || typeof el.animate !== 'function') return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Gliding, it doesn't also pop in; and it's measured at its full size, not mid-pop.
    el.dataset.glide = '';
    const { dx, dy, sx, sy } = invert(start.box, boxOf(el));
    const style = getComputedStyle(el);
    const duration = parseCssDurationMs(style.getPropertyValue('--dur-a-glide'), FALLBACK_MS);
    el.animate(
      [
        { transformOrigin: 'top left', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
        { transformOrigin: 'top left', transform: 'none' },
      ],
      { duration, easing: style.getPropertyValue('--ease-out').trim() },
    );
  } catch {
    // Motion is a bonus: the badge is already in its place.
  }
}
