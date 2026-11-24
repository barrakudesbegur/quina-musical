<!-- One connection chip (hook conn-change: the colour fades and the chip blinks once when it changes). -->
<script lang="ts">
  import type { LinkState } from '../logic/status.ts';
  import { S } from '../strings.ts';

  /** `value`: a count after the name ("Mòbils 312"), or `null` for a count not known yet ("Mòbils —"). The grey
   * dot already says a link is unknown. */
  let { id, label, link, value = undefined }: { id: string; label: string; link: LinkState; value?: number | null } = $props();
</script>

{#key link}
  <li class="conn-chip" data-link={id} data-state={link} data-anim="conn-change">
    <span class="conn-chip__dot" aria-hidden="true"></span>
    <span class="conn-chip__name">{label}</span>
    {#if typeof value === 'number'}<span class="conn-chip__value">{value}</span>
    {:else if value === null}<span class="conn-chip__value" aria-hidden="true">{S.links.unknownShort}</span>{/if}
    <span class="visually-hidden">: {S.links.states[link]}</span>
  </li>
{/key}
