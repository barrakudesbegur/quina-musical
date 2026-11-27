<script lang="ts" module>
  /** The top drawer of the app's stack has started to leave: the ones under it step forward meanwhile (drawer-stack). */
  const stack = $state({ topLeaving: false });
</script>

<script lang="ts">
  // Tells the drawer inside it where it sits in the app's stack (Drawer.svelte reads it): how deep, whether one lies
  // under it, which corner it grows out of, and how to close them all. While the top drawer slides away, every drawer
  // under it is one step less deep, so it steps forward as the top one goes, not after.
  import { setContext, type Snippet } from 'svelte';
  import type { DrawerOrigin } from '../logic/drawers.ts';
  import { DRAWER_PLACE, type DrawerPlace } from './Drawer.svelte';

  let { depth, stacked, origin, closeAll, children }: { depth: number; stacked: boolean; origin: DrawerOrigin; closeAll: () => void; children: Snippet } = $props();
  setContext<DrawerPlace>(DRAWER_PLACE, {
    get depth() {
      return depth > 0 && stack.topLeaving ? depth - 1 : depth;
    },
    get stacked() {
      return stacked;
    },
    get origin() {
      return origin;
    },
    get closeAll() {
      return closeAll;
    },
    here(state) {
      if (state === 'leaving') stack.topLeaving = depth === 0;
      else stack.topLeaving = false;
    },
  });
</script>

{@render children()}
