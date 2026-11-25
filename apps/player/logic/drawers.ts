// The player app's drawers (D73, D87): one home screen, and everything else in drawers that stack. Premis grows out
// of the bottom-left corner and Horari out of the bottom-right; Ajustos (the header's button), "Afegir cartró", a card's
// edit or remove and "Esborrar dades" slide up from the bottom. A round tapped in Horari stacks its prizes on top.
// "‹" and the phone's back gesture close the top drawer; ✕ closes them all. Pure.

/** Where a drawer comes from (ANIMATIONS.md `drawer-open`): a corner button, or the bottom edge. */
export type DrawerOrigin = 'left' | 'right' | 'bottom';

export type Drawer =
  /** The prizes: every round, or one round when opened from Horari. */
  | { kind: 'premis'; round?: number }
  | { kind: 'horari' }
  /** The player's cards (rename, reorder, remove, add), sounds, last year's card, "Esborrar dades" (D87: was "Menú"). */
  | { kind: 'ajustos' }
  /** "Afegir cartró": the icon and the number pad. */
  | { kind: 'pad' }
  /** Last year's card: what changed and what to do. */
  | { kind: 'anyPassat' }
  | { kind: 'wipe' }
  | { kind: 'rename' | 'remove'; cardId: number };

export type DrawerKind = Drawer['kind'];

/** The drawers a review link may open (`?open=`). */
export const OPENABLE = ['premis', 'horari', 'ajustos', 'pad'] as const satisfies readonly DrawerKind[];
export type OpenableDrawer = (typeof OPENABLE)[number];
export const isOpenable = (v: unknown): v is OpenableDrawer => typeof v === 'string' && (OPENABLE as readonly string[]).includes(v);

/** The corner it grows out of, else the bottom edge. */
export function drawerOrigin(drawer: Drawer, stacked: boolean): DrawerOrigin {
  if (stacked) return 'bottom';
  return drawer.kind === 'premis' && drawer.round === undefined ? 'left' : drawer.kind === 'horari' ? 'right' : 'bottom';
}

const same = (a: Drawer, b: Drawer): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Open a drawer over the others; the same drawer already on top stays as it is. */
export function pushDrawer(stack: readonly Drawer[], drawer: Drawer): Drawer[] {
  const top = stack.at(-1);
  return top && same(top, drawer) ? [...stack] : [...stack, drawer];
}

/** Close the top drawer ("‹", the back gesture, a swipe down). */
export const popDrawer = (stack: readonly Drawer[]): Drawer[] => stack.slice(0, -1);

/** How many drawers lie over the one at `index` (0: it's the top one). */
export const depthOf = (stack: readonly Drawer[], index: number): number => stack.length - 1 - index;

/**
 * A drag on a drawer's handle ends: close it when pulled past `threshold` of its height, or flicked down faster than
 * `flick` px/ms (ANIMATIONS.md `drawer-drag`).
 */
export function dragCloses(dy: number, height: number, velocity: number, threshold = 0.3, flick = 0.5): boolean {
  return dy > 0 && (dy > height * threshold || velocity > flick);
}
