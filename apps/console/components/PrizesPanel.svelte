<!--
  The Premis tab: this round's prizes and sponsors (the next round's in the Interval), with the claim rules
  under them, and the special round's rules when this round is the special one (Game plan).
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { roundPrizes } from '../logic/show-data.ts';
  import { roundOnScreen } from '../logic/status.ts';
  import { S } from '../strings.ts';
  import PrizeList from './PrizeList.svelte';

  const model = getConsole();
  const flow = $derived(model.show.flow);
  const round = $derived(flow.scene === 'interval' && flow.interval ? flow.interval.nextRound : (roundOnScreen(model.show.state, flow)?.number ?? 1));
  const planned = $derived(roundPrizes(model.plan, round));
  const rules = $derived(model.plan?.cheatSheet ?? null);
  const special = $derived(planned.status === 'ok' && planned.prizes.kind === 'special');
</script>

<div class="prizes-tab">
  <section class="prizes-tab__section">
    <h3 class="panel__label">{S.cheatSheet.prizes(round)}</h3>
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
