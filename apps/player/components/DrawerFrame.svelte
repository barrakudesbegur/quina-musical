<script lang="ts">
  // Tells the drawer inside it where it sits in the app's stack (Drawer.svelte reads it): how deep, whether one lies
  // under it, which corner it grows out of, and how to close them all.
  import { setContext, type Snippet } from 'svelte';
  import type { DrawerOrigin } from '../logic/drawers.ts';
  import { DRAWER_PLACE, type DrawerPlace } from './Drawer.svelte';

  let { depth, stacked, origin, closeAll, children }: { depth: number; stacked: boolean; origin: DrawerOrigin; closeAll: () => void; children: Snippet } = $props();
  setContext<DrawerPlace>(DRAWER_PLACE, {
    get depth() {
      return depth;
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
  });
</script>

{@render children()}
