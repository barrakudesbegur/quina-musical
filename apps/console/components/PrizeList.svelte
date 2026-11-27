<!--
  A round's Line and Quina prize bundles with their sponsors, from the Game plan (which may be missing), as two prize
  tickets (the design system's Ticket recipe, packages/ui/recipes; the Consola-Pestanyes board): a ribbon names the
  prize ("LÍNIA", "QUINA"); the headline prizes come first, big, with their sponsor; a perforation; then the rest of
  the bundle (a real hamper holds 17–19 prizes; the tab scrolls). The Quina del Desgraciat has one ticket, "DEMPEUS"
  (the last card standing's prize), and no Line.
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { roundAt } from '../../../packages/ui/plan.ts';
  import Ticket from '../../../packages/ui/recipes/Ticket.svelte';
  import { roundPrizes } from '../logic/show-data.ts';
  import { S } from '../strings.ts';

  let { round }: { round: number } = $props();

  const model = getConsole();
  const result = $derived(roundPrizes(model.plan, round));
</script>

{#if result.status === 'noPlan'}
  <p class="note note--warning" data-state="no-plan">{S.prizes.noPlan}</p>
{:else if result.status === 'noRound'}
  <p class="note note--warning" data-state="no-round">{S.prizes.noRound(S.round(roundAt(model.plan, result.number), model.plan))}</p>
{:else}
  {#if result.prizes.kind === 'special'}<p class="badge badge--special">{S.prizes.special}</p>{/if}
  {#if result.prizes.kind === 'desgraciat'}<p class="badge badge--special">{S.prizes.desgraciat}</p>{/if}
  <div class="prize-list" data-kind={result.prizes.kind}>
    {#each result.prizes.bundles as { kind, prizes: bundle } (kind)}
      <Ticket {kind} prizes={bundle} label={S.prizes[kind]} empty={S.prizes.none} />
    {/each}
  </div>
{/if}
