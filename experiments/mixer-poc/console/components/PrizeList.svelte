<!-- A round's Line and Quina prizes with their sponsors, from the Game plan (which may be missing). -->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { roundPrizes } from '../logic/show-data.ts';
  import { S } from '../strings.ts';

  let { round }: { round: number } = $props();

  const model = getConsole();
  const result = $derived(roundPrizes(model.plan, round));
</script>

{#if result.status === 'noPlan'}
  <p class="note note--warning" data-state="no-plan">{S.prizes.noPlan}</p>
{:else if result.status === 'noRound'}
  <p class="note note--warning" data-state="no-round">{S.prizes.noRound(result.number)}</p>
{:else}
  {#if result.prizes.kind === 'special'}<p class="badge badge--special">{S.prizes.special}</p>{/if}
  <dl class="prize-list" data-kind={result.prizes.kind}>
    {#each [result.prizes.line, result.prizes.bingo] as prize, i (i)}
      <div class="prize-list__item" data-prize={i === 0 ? 'line' : 'bingo'}>
        <dt class="prize-list__kind">{i === 0 ? S.prizes.line : S.prizes.bingo}</dt>
        <dd class="prize-list__prize">
          {#if prize}
            <span class="prize-list__title">{prize.title}</span>
            {#if prize.detail}<span class="prize-list__detail">{prize.detail}</span>{/if}
            {#if prize.sponsor}<span class="prize-list__sponsor">{S.prizes.sponsoredBy(prize.sponsor)}</span>{/if}
          {:else}
            <span class="prize-list__none">{S.prizes.none}</span>
          {/if}
        </dd>
      </div>
    {/each}
  </dl>
{/if}
