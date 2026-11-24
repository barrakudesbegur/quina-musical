// The DOM side of the `next-to-now` morph (logic/next-to-now.ts has the rule and the maths). The two panels
// mark their parts with `data-morph="cover|title|artist"` and register their roots here. At the landing, before
// the snapshot changes them, `capture()` records where the next song's parts are and clones Ara sona's old
// content; once Ara sona shows the landed song, `play()` flies its parts in from there (transforms only) and
// fades the clone out. Never throws; without the Web Animations API it does nothing.
import { invert, type Box } from './logic/next-to-now.ts';

const PARTS = ['cover', 'title', 'artist'] as const;
type Part = (typeof PARTS)[number];

const roots: { next: HTMLElement | null; now: HTMLElement | null } = { next: null, now: null };

/** A panel registers its root (null on destroy). */
export function registerMorphRoot(role: 'next' | 'now', el: HTMLElement | null): void {
  roots[role] = el;
}

export interface Captured {
  songId: number;
  from: Partial<Record<Part, Box>>;
  ghost: HTMLElement | null;
}

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

/** Where the next song's parts are now, and a clone of Ara sona's current content. */
export function capture(songId: number): Captured | null {
  try {
    const next = roots.next;
    if (!next) return null;
    const from: Partial<Record<Part, Box>> = {};
    for (const part of PARTS) {
      const el = next.querySelector(`[data-morph="${part}"]`);
      if (el) from[part] = boxOf(el);
    }
    let ghost: HTMLElement | null = null;
    const now = roots.now;
    if (now) {
      const box = boxOf(now);
      ghost = now.cloneNode(true) as HTMLElement;
      ghost.removeAttribute('id');
      // The ghost is decoration: no test hooks on it (the real panel keeps them).
      for (const el of [ghost, ...ghost.querySelectorAll('[data-testid]')]) el.removeAttribute('data-testid');
      ghost.setAttribute('aria-hidden', 'true');
      Object.assign(ghost.style, {
        position: 'fixed',
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
        margin: '0',
        pointerEvents: 'none',
        zIndex: '5',
      });
    }
    return { songId, from, ghost };
  } catch {
    return null;
  }
}

/** Fly the landed song's parts in from where they were in "Següent", and fade the old content out. */
export function play(captured: Captured): void {
  try {
    const now = roots.now;
    if (!now || typeof now.animate !== 'function') return;
    const ease = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
    for (const part of PARTS) {
      const from = captured.from[part];
      const el = now.querySelector<HTMLElement>(`[data-morph="${part}"]`);
      if (!from || !el) continue;
      const { dx, dy, sx, sy } = invert(from, boxOf(el));
      el.animate([{ transformOrigin: 'top left', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transformOrigin: 'top left', transform: 'none' }], {
        duration: 450,
        easing: ease,
      });
    }
    const ghost = captured.ghost;
    if (ghost) {
      document.body.append(ghost);
      ghost
        .animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(8px)' }], { duration: 120, easing: 'ease-out', fill: 'forwards' })
        .finished.finally(() => ghost.remove());
    }
    const next = roots.next;
    next?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 300, easing: 'ease-out', fill: 'backwards' });
  } catch {
    // Motion is a bonus: the panels already show the right songs.
  }
}
