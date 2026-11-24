<!--
  A round's Line and Quina prize bundles with their sponsors, from the Game plan (which may be missing), as
  two prize tickets (the Consola-Pestanyes board): a ribbon names the prize ("LÍNIA", "QUINA"); the headline
  prizes come first, big, with their sponsor; a perforation; then the rest of the bundle, one line each. The Quina
  Desgraciada has one ticket, "DEMPEUS" (the last card standing's prize), and no Line.
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { roundPrizes } from '../logic/show-data.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

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
  {#if result.prizes.kind === 'desgraciat'}<p class="badge badge--special">{S.prizes.desgraciat}</p>{/if}
  <div class="prize-list" data-kind={result.prizes.kind}>
    {#each result.prizes.bundles as { kind, prizes: bundle } (kind)}
      {@const lead = bundle.filter((p) => p.headline)}
      {@const rest = bundle.filter((p) => !p.headline)}
      <article class="ticket" data-prize={kind} aria-label={S.prizes[kind]}>
        <span class="ticket__ribbon" aria-hidden="true">{S.prizes.ribbon[kind]}</span>
        {#if bundle.length === 0}
          <span class="ticket__none">{S.prizes.none}</span>
        {/if}
        {#each lead as prize, j (j)}
          <span class="ticket__title">{prize.title}</span>
          {#if prize.detail}<span class="ticket__detail">{prize.detail}</span>{/if}
          {#if prize.sponsor}<span class="ticket__sponsor"><Icon name="star" />{S.prizes.sponsoredBy(prize.sponsor)}</span>{/if}
        {/each}
        {#if rest.length}
          <span class="ticket__perf" aria-hidden="true"></span>
          <ul class="ticket__items">
            {#each rest as prize, j (j)}
              <li class="ticket__item">
                <b>+ {prize.title}</b>
                {#if prize.detail || prize.sponsor}<span>· {[prize.detail, prize.sponsor].filter(Boolean).join(' · ')}</span>{/if}
              </li>
            {/each}
          </ul>
        {/if}
      </article>
    {/each}
  </div>
{/if}
