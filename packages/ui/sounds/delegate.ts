// One listener per page gives every control its touch sound (D206-D208; temp/design-canvas/ds/ui-sounds.md § 4),
// so components only say what they are (a class, or `data-touch`), never when to sound:
// - outside a scroller, the press plays on `pointerdown`, under the finger, and the release on the next `pointerup`
//   anywhere on the window (the package's own pattern: no lost release when the finger slides off); a cancelled
//   press (the browser took it for a scroll) plays no release;
// - inside a scroller (a list in a drawer), both play at the `click`, so a scroll that starts on a button is silent;
// - Enter or Space (a click with no pointer) play both, so a keyboard user hears what a finger hears;
// - a control that opens a dialog (`aria-haspopup="dialog"`, or `data-touch-release="none"`) plays no release: the
//   drawer's own sound takes its place;
// - a tap on a control that can't be used now plays the refused thud and shakes it (`refused-tap`, U185), when its
//   rule allows; the shake plays with sounds off too, since the motion is what says it.
// `data-touch="<class>"` on an element overrides the rules; `data-touch="none"` silences it (the hold buttons play
// their own, Sons plays its own).
// Haptics (R4, 27 Nov; ANIMATIONS.md › press): where the wiring asks for them (the phone only, never the console or the
// projector), each press the delegate sounds, the refused thud included, also gives a ~10 ms vibration, where the
// browser has the Vibration API (Android's Chrome; iOS Safari has none). It follows the press, not the sounds' switch:
// a phone with its sounds off still feels its taps.
import { touchPress, touchRelease, touchTap } from './touch.ts';
import type { TouchClass } from './types.ts';

export interface TouchRule {
  selector: string;
  /** The class, or a function of the element (a switch: the side it moves to; null: silent). */
  cls: TouchClass | ((el: Element) => TouchClass | null);
  /** A tap on it while it can't be used is refused (the thud and the shake). */
  refuse?: boolean;
}

export interface TouchWiring {
  rules: readonly TouchRule[];
  /** Containers that scroll: controls inside them sound at the click. */
  scrollers: string;
  /** What "can't be used now" looks like. */
  unusable?: string;
  /** A short vibration with each press (phones only). */
  haptics?: boolean;
}

/** The press's vibration, in ms (R4). */
export const HAPTIC_MS = 10;

interface VibratingNavigator {
  vibrate?: (pattern: number | number[]) => boolean;
  userActivation?: { hasBeenActive: boolean };
}

/** One short buzz, where the browser can and the page may (after the first tap: browsers ignore it before). */
export function buzz(nav: VibratingNavigator | undefined = typeof navigator === 'undefined' ? undefined : (navigator as VibratingNavigator)): boolean {
  if (!nav || typeof nav.vibrate !== 'function') return false;
  if (nav.userActivation && !nav.userActivation.hasBeenActive) return false;
  try {
    return nav.vibrate(HAPTIC_MS);
  } catch {
    return false;
  }
}

const DEFAULT_UNUSABLE = ':disabled, [aria-disabled="true"]';
/** How long the `refused-tap` hook stays on (longer than its 280 ms). */
const REFUSED_HOLD_MS = 400;
/** Two clicks on one control within this long are one tap (a label's click, forwarded to its input). */
const SAME_TAP_MS = 60;

interface Found {
  el: Element;
  cls: TouchClass;
  refuse: boolean;
}

/** The control the event is on, and its class (null: no sound). */
function find(target: EventTarget | null, wiring: TouchWiring, selector: string): Found | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest(selector);
  if (!el) return null;
  const own = el.getAttribute('data-touch');
  if (own === 'none') return null;
  const rule = wiring.rules.find((r) => el.matches(r.selector));
  const cls = own ? (own as TouchClass) : rule ? (typeof rule.cls === 'function' ? rule.cls(el) : rule.cls) : null;
  return cls ? { el, cls, refuse: rule?.refuse ?? false } : null;
}

const playsRelease = (el: Element) => el.getAttribute('aria-haspopup') !== 'dialog' && el.getAttribute('data-touch-release') !== 'none';

/** Shake a refused control (`refused-tap`): set the hook again, so a second tap shakes it again. */
function shake(el: Element): void {
  const anim = el.getAttribute('data-anim');
  if (anim !== null && anim !== 'refused-tap') return;
  el.removeAttribute('data-anim');
  requestAnimationFrame(() => {
    el.setAttribute('data-anim', 'refused-tap');
    setTimeout(() => {
      if (el.getAttribute('data-anim') === 'refused-tap') el.removeAttribute('data-anim');
    }, REFUSED_HOLD_MS);
  });
}

/** Wire the page's touch sounds; returns the unwiring. */
export function wireTouchSounds(doc: Document, wiring: TouchWiring): () => void {
  const selector = ['[data-touch]', ...wiring.rules.map((r) => r.selector)].join(', ');
  const unusable = wiring.unusable ?? DEFAULT_UNUSABLE;
  /** The control a pointer pressed: the clicks that follow it are not a second tap (a key press forgets it). */
  let pressed: Element | null = null;
  /** The last tap played at a click: a label's click forwarded to its input is the same tap. */
  let lastTap: { el: Element; atMs: number } | null = null;

  const feel = () => {
    if (wiring.haptics) buzz();
  };

  const refused = (found: Found): boolean => {
    if (!found.el.matches(unusable)) return false;
    if (found.refuse) {
      shake(found.el);
      touchPress('refused');
      feel();
    }
    return true;
  };

  function onPointerDown(e: PointerEvent): void {
    pressed = null;
    if (!e.isPrimary || e.button !== 0) return;
    const found = find(e.target, wiring, selector);
    if (!found || found.el.closest(wiring.scrollers)) return;
    if (refused(found)) return;
    pressed = found.el;
    touchPress(found.cls);
    feel();
    const release = playsRelease(found.el);
    const up = () => {
      stop();
      if (release) touchRelease(found.cls);
    };
    const stop = () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointerup', up, { once: true });
    window.addEventListener('pointercancel', stop, { once: true });
  }

  function onClick(e: MouseEvent): void {
    const found = find(e.target, wiring, selector);
    if (!found) return;
    const inScroller = found.el.closest(wiring.scrollers) !== null;
    // A pointer's click outside a scroller already sounded at its press.
    if (!inScroller && (e.detail !== 0 || pressed === found.el)) return;
    if (lastTap?.el === found.el && e.timeStamp - lastTap.atMs < SAME_TAP_MS) return;
    lastTap = { el: found.el, atMs: e.timeStamp };
    if (refused(found)) return;
    touchTap(found.cls, playsRelease(found.el));
    if (e.detail !== 0) feel();
  }

  const onKeyDown = () => {
    pressed = null;
  };

  doc.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
  doc.addEventListener('click', onClick, { capture: true });
  doc.addEventListener('keydown', onKeyDown, { capture: true, passive: true });
  return () => {
    doc.removeEventListener('keydown', onKeyDown, { capture: true });
    doc.removeEventListener('pointerdown', onPointerDown, { capture: true });
    doc.removeEventListener('click', onClick, { capture: true });
  };
}
