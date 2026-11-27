<script lang="ts" module>
  // Where a drawer sits in the stack, set by App's DrawerFrame (logic/drawers.ts). A drawer opened inside another
  // drawer's content (the pad's leave question) sits on top of it.
  import type { DrawerOrigin } from '../logic/drawers.ts';
  export interface DrawerPlace {
    /** How many drawers lie over this one (0: it's the top one). */
    depth: number;
    /** Another drawer lies under this one: "‹" closes this one, ✕ closes them all. */
    stacked: boolean;
    origin: DrawerOrigin;
    closeAll: (() => void) | null;
  }
  export const DRAWER_PLACE = Symbol('drawer-place');
</script>

<script lang="ts">
  // A drawer (D73, D87: the J2 look): the design system's Sheet (packages/ui/components, C3), placed in the app's stack
  // by DrawerFrame (logic/drawers.ts): its depth, its corner, whether one lies under it ("‹" closes this one, ✕ them
  // all). The motion, the drag and the dismissal are the Sheet's (ANIMATIONS.md `drawer-*`). `canClose` lets the
  // content hold it open first (the pad asks before leaving with a number typed); it gets the way to go on closing.
  import { getContext, setContext, type Snippet } from 'svelte';
  import Sheet from '../../../packages/ui/components/Sheet.svelte';
  import { S } from '../strings.ts';

  let {
    title,
    name,
    onclose,
    canClose,
    onback,
    children,
  }: {
    title: string;
    name: string;
    onclose: () => void;
    canClose?: (proceed: () => void) => boolean;
    /** A step inside the drawer to go back from (the pad's camera, D141): "‹", Esc and the back gesture do this instead. */
    onback?: () => void;
    children: Snippet;
  } = $props();

  const outer = getContext<DrawerPlace | undefined>(DRAWER_PLACE);
  const place: DrawerPlace = outer ?? { depth: 0, stacked: false, origin: 'bottom', closeAll: null };
  // A drawer opened from this one's content lies over it.
  setContext<DrawerPlace>(DRAWER_PLACE, { depth: 0, stacked: true, origin: 'bottom', closeAll: null });
</script>

<Sheet
  class="drawer drawer--{name}"
  {title}
  origin={place.origin}
  depth={place.depth > 0 ? 'under' : 'top'}
  back={place.stacked}
  {onback}
  {canClose}
  {onclose}
  closeAll={place.stacked ? place.closeAll : null}
  closeLabel={S.close}
  backLabel={S.back}
>
  {@render children()}
</Sheet>
