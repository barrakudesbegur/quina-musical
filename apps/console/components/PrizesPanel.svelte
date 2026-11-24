<!--
  The Premis tab: this round's prize bundles and sponsors (the next round's in the Interval), whether phones
  may see them yet with "Revelar premis" while they can't (GamePlan.prizeReveal), the claim rules under them,
  and the special round's rules when this round is the special one (Game plan).
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { prizeRevealOf, roundPrizes } from '../logic/show-data.ts';
  import { roundOnScreen } from '../logic/status.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import PrizeList from './PrizeList.svelte';

  const model = getConsole();
  const flow = $derived(model.show.flow);
  const round = $derived(flow.scene === 'interval' && flow.interval ? flow.interval.nextRound : (roundOnScreen(model.show.state, flow)?.number ?? 1));
  const planned = $derived(roundPrizes(model.plan, round));
  const rules = $derived(model.plan?.cheatSheet ?? null);
  const special = $derived(planned.status === 'ok' && planned.prizes.kind === 'special');
  const reveal = $derived(prizeRevealOf(model.plan, model.show.state, round));
</script>

<div class="prizes-tab">
  <section class="prizes-tab__section">
    <h3 class="panel__label">{S.cheatSheet.prizes(round)}</h3>
    {#if reveal === 'secret'}
      <div class="prizes-tab__reveal" data-state="secret">
        <p class="badge badge--warning"><Icon name="lock" /> {S.prizes.secret}</p>
        <button type="button" class="action" data-anim="press" disabled={!model.can('revealPrizes')} onclick={() => model.act('revealPrizes', { round })}>
          <Icon name="eye" /><span>{S.prizes.reveal}</span>
        </button>
      </div>
    {:else if reveal === 'revealed'}
      <p class="prizes-tab__reveal note" data-state="revealed"><Icon name="eye" /> {S.prizes.revealed}</p>
    {/if}
    <PrizeList {round} />
  </section>

  {#if rules && special && rules.specialRoundRules.length}
    <section class="prizes-tab__section">
      <h3 class="panel__label">{S.cheatSheet.specialRules}</h3>
      <ul class="rule-list">
        {#each rules.specialRoundRules as rule, i (i)}<li>{rule}</li>{/each}
      </ul>
    </section>
  {/if}

  {#if rules && rules.claimRules.length}
    <section class="prizes-tab__section">
      <h3 class="panel__label">{S.cheatSheet.claimRules}</h3>
      <ul class="rule-list">
        {#each rules.claimRules as rule, i (i)}<li>{rule}</li>{/each}
      </ul>
    </section>
  {/if}
</div>
