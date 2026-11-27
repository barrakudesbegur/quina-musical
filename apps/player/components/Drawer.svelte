<script lang="ts" module>
  // Where a drawer sits in the stack: set by App's DrawerFrame (logic/drawers.ts), or by the drawer whose content
  // opened it (the QR camera over the pad).
  import type { DrawerOrigin } from '../logic/drawers.ts';
  export interface DrawerPlace {
    /** How many drawers lie over this one (0: it's the top one). */
    depth: number;
    /** Another drawer lies under this one: "‹" closes this one, ✕ closes them all. */
    stacked: boolean;
    origin: DrawerOrigin;
    closeAll: (() => void) | null;
    /** The drawer here is open, starts to leave, or is gone: the one under it steps back, and forward again as this
     *  one starts to leave (`drawer-stack`, 27 Nov: the reverse of the step back, not after it). */
    here: (state: 'open' | 'leaving' | 'gone') => void;
  }
  export const DRAWER_PLACE = Symbol('drawer-place');
</script>

<script lang="ts">
  // A drawer (D73, D87: the J2 look): the design system's Sheet (packages/ui/components, C3), placed in the app's stack
  // by DrawerFrame (logic/drawers.ts): its depth, its corner, whether one lies under it ("‹" closes this one, ✕ them
  // all). The motion, the drag and the dismissal are the Sheet's (ANIMATIONS.md `drawer-*`). `canClose` lets the
  // content hold it open first (the pad asks before leaving with a number typed); it gets the way to go on closing.
  // A drawer opened from this one's content (the QR camera over the pad, `qr-scan`) stacks on it: this one steps back
  // while it's open and forward as it starts to leave; its ✕ then asks this one to close as this one's ✕ would.
  import { getContext, onDestroy, setContext, type Snippet } from 'svelte';
  import Sheet from '../../../packages/ui/components/Sheet.svelte';
  import { S } from '../strings.ts';

  let {
    title,
    name,
    open = $bindable(true),
    onclose,
    canClose,
    onback,
    children,
  }: {
    title: string;
    name: string;
    /** Set false to close it with its motion and no sound (the app's own close: a QR found). */
    open?: boolean;
    onclose: () => void;
    canClose?: (proceed: () => void) => boolean;
    /** A step inside the drawer to go back from: "‹", Esc and the back gesture do this instead. */
    onback?: () => void;
    children: Snippet;
  } = $props();

  const outer = getContext<DrawerPlace | undefined>(DRAWER_PLACE);
  const place: DrawerPlace = outer ?? { depth: 0, stacked: false, origin: 'bottom', closeAll: null, here: () => {} };
  let sheet: Sheet | undefined = $state();
  /** A drawer opened from this one's content lies over it. */
  let covered = $state(false);
  setContext<DrawerPlace>(DRAWER_PLACE, {
    depth: 0,
    stacked: true,
    origin: 'bottom',
    closeAll: () => sheet?.requestClose(place.stacked && place.closeAll ? 'all' : 'self'),
    here: (state) => (covered = state === 'open'),
  });

  place.here('open');
  onDestroy(() => place.here('gone'));

  function gone(): void {
    place.here('gone');
    onclose();
  }

  /** ✕ on a stacked drawer: this one goes, then the ones under it (the app's stack, or the drawer that opened it). */
  const closeAll = $derived(place.stacked && place.closeAll ? () => (gone(), place.closeAll?.()) : null);
</script>

<Sheet
  bind:this={sheet}
  bind:open
  class="drawer drawer--{name}"
  {title}
  origin={place.origin}
  depth={place.depth > 0 || covered ? 'under' : 'top'}
  back={place.stacked}
  {onback}
  {canClose}
  onclose={gone}
  onleave={(which) => {
    if (which === 'self') place.here('leaving');
  }}
  {closeAll}
  closeLabel={S.close}
  backLabel={S.back}
>
  {@render children()}
</Sheet>
