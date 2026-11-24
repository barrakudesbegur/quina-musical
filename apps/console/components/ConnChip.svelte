<!-- One connection chip (hook conn-change: the colour fades and the chip blinks once when it changes). -->
<script lang="ts">
  import type { LinkName, LinkState } from '../logic/status.ts';
  import { S } from '../strings.ts';

  let { name, link }: { name: LinkName; link: LinkState } = $props();
</script>

{#key link}
  <li class="conn-chip" data-link={name} data-state={link} data-anim="conn-change">
    <span class="conn-chip__dot" aria-hidden="true"></span>
    <span class="conn-chip__name">{S.links.names[name]}</span>
    {#if link === 'unknown'}<span class="conn-chip__value" aria-hidden="true">{S.links.unknownShort}</span>{/if}
    <span class="visually-hidden">: {S.links.states[link]}</span>
  </li>
{/key}
