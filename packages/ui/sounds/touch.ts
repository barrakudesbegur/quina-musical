// The page's touch sounds, for the components and the delegate (delegate.ts) to call without passing them around:
// each app registers its own once (the phone: device/sounds.ts; the tablet: ui-sounds.ts). Before that, and in
// tests, every call is silent.
import type { TouchClass, TouchVariant } from './types.ts';

export interface TouchSounds {
  play(cls: TouchClass, variant: TouchVariant): void;
}

/** The gap between a tap's press and its release when both play at once (a click in a list, a key). */
export const TAP_GAP_MS = 50;

let current: TouchSounds | null = null;

export function registerTouchSounds(sounds: TouchSounds | null): void {
  current = sounds;
}

export function touchPress(cls: TouchClass): void {
  current?.play(cls, 'press');
}

export function touchRelease(cls: TouchClass): void {
  current?.play(cls, 'release');
}

/** Press, then release a moment later: a tap that wasn't heard as two moments (a click, a key, a confirmation). */
export function touchTap(cls: TouchClass, release = true): void {
  touchPress(cls);
  if (release) setTimeout(() => touchRelease(cls), TAP_GAP_MS);
}

/**
 * A hold button's sounds (the console's `long-press-confirm`, `escalate-hold`, `throw-hold`): its press on the way
 * down; `holdDone` as the hold fires; on lift, `holdDone`'s release if it fired, else the button's own (it was a tap).
 * The button carries `data-touch="none"`, so the page's delegate leaves it to this.
 */
export function holdSounds(button: TouchClass | (() => TouchClass)): { down(): void; done(): void; up(): void; cancel(): void } {
  const cls = typeof button === 'function' ? button : () => button;
  let pressed = false;
  let fired = false;
  return {
    down() {
      pressed = true;
      fired = false;
      touchPress(cls());
    },
    done() {
      if (!pressed || fired) return;
      fired = true;
      touchPress('holdDone');
    },
    up() {
      if (!pressed) return;
      pressed = false;
      touchRelease(fired ? 'holdDone' : cls());
    },
    cancel() {
      pressed = false;
    },
  };
}
