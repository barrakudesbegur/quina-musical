<!-- A round's Line and Quina prize bundles with their sponsors, from the Game plan (which may be missing):
     headline prizes first and bigger, then the rest. -->
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
    {#each [result.prizes.line, result.prizes.bingo] as bundle, i (i)}
      <div class="prize-list__item" data-prize={i === 0 ? 'line' : 'bingo'}>
        <dt class="prize-list__kind">{i === 0 ? S.prizes.line : S.prizes.bingo}</dt>
        <dd class="prize-list__prize">
          {#if bundle.length}
            <ul class="prize-list__bundle">
              {#each bundle as prize, j (j)}
                <li class="prize-list__entry" data-headline={prize.headline}>
                  <span class="prize-list__title">{prize.title}</span>
                  {#if prize.detail}<span class="prize-list__detail">{prize.detail}</span>{/if}
                  {#if prize.sponsor}<span class="prize-list__sponsor">{S.prizes.sponsoredBy(prize.sponsor)}</span>{/if}
                </li>
              {/each}
            </ul>
          {:else}
            <span class="prize-list__none">{S.prizes.none}</span>
          {/if}
        </dd>
      </div>
    {/each}
  </dl>
{/if}
