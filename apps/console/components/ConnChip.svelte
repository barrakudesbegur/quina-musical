<!-- One connection chip (hook conn-change: the colour fades and the chip blinks once when it changes): the generic
     Chip (B4) with a status dot, the state also in words for assistive technology (a dot never says it alone). -->
<script lang="ts">
  import Chip from '../../../packages/ui/components/Chip.svelte';
  import type { LinkState } from '../logic/status.ts';
  import { S } from '../strings.ts';

  /** `value`: a count after the name ("Mòbils 312"), or `null` for a count not known yet ("Mòbils —"). The grey
   * dot already says a link is unknown. */
  let { id, label, link, value = undefined }: { id: string; label: string; link: LinkState; value?: number | null } = $props();
  const DOT = { up: 'on', down: 'alert', unknown: 'off' } as const satisfies Record<LinkState, string>;
</script>

{#key link}
  <li class="conn-chip" data-link={id} data-state={link} data-anim="conn-change">
    <Chip
      color={link === 'down' ? 'red' : 'grey'}
      dot={DOT[link]}
      {label}
      value={typeof value === 'number' ? value : value === null ? S.links.unknownShort : null}
    />
    <span class="visually-hidden">: {S.links.states[link]}</span>
  </li>
{/key}
