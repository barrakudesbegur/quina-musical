<!--
  The console's Wii keys for the generic components' `wii` slot (packages/ui/components/providers.ts): the keys named
  as the remote's (logic/wii-keys.ts), drawn by WiiBadge, which shows only while a remote is connected. The button
  places it (R7: the same inset from the top and the side).
-->
<script lang="ts">
  import type { WiiKeySpec } from '../../../packages/ui/components/types.ts';
  import { wiiBadgeButton } from '../logic/wii-keys.ts';
  import WiiBadge from './WiiBadge.svelte';

  let { spec }: { spec: WiiKeySpec } = $props();
  const button = $derived(wiiBadgeButton(spec.keys));
</script>

{#if button}<WiiBadge {button} hold={spec.hold ?? false} plus={spec.withA ? 'a' : null} size={spec.size ?? 'md'} />{/if}
