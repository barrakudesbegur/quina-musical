<!--
  The console's context for one gallery specimen: a ConsoleModel stand-in holding only what the console compositions
  read (the show's state, flow and clock, and the last Spin), from the fixtures, so they render with no relay and no
  device link. As Gallery.svelte stands in for the Wii remote (setWii). Development only.
-->
<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { setConsole } from '../../console/context.ts';
  import type { ConsoleModel } from '../../console/model.svelte.ts';

  let { model, children }: { model: Record<string, unknown>; children: Snippet } = $props();
  setConsole(untrack(() => model) as unknown as ConsoleModel);
</script>

{@render children()}
