<!--
  The cheat sheet: the round's prize lines with sponsors, the special-round and claim rules (Game plan),
  the laptop's Plan B keys, and the setup checklist.
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { roundOnScreen } from '../logic/status.ts';
  import { S } from '../strings.ts';
  import PrizeList from './PrizeList.svelte';
  import SetupChecklist from './SetupChecklist.svelte';

  const model = getConsole();
  const flow = $derived(model.show.flow);
  const round = $derived(flow.scene === 'interval' && flow.interval ? flow.interval.nextRound : (roundOnScreen(model.show.state, flow)?.number ?? 1));
  const rules = $derived(model.plan?.cheatSheet ?? null);
</script>

<div class="cheat-sheet">
  <section class="cheat-sheet__section">
    <h3 class="panel__subtitle">{S.cheatSheet.prizes(round)}</h3>
    <PrizeList {round} />
  </section>

  {#if rules}
    {#if rules.specialRoundRules.length}
      <section class="cheat-sheet__section">
        <h3 class="panel__subtitle">{S.cheatSheet.specialRules}</h3>
        <ul class="rule-list">
          {#each rules.specialRoundRules as rule, i (i)}<li>{rule}</li>{/each}
        </ul>
      </section>
    {/if}
    {#if rules.claimRules.length}
      <section class="cheat-sheet__section">
        <h3 class="panel__subtitle">{S.cheatSheet.claimRules}</h3>
        <ul class="rule-list">
          {#each rules.claimRules as rule, i (i)}<li>{rule}</li>{/each}
        </ul>
      </section>
    {/if}
  {/if}

  <section class="cheat-sheet__section">
    <h3 class="panel__subtitle">{S.cheatSheet.keys}</h3>
    <dl class="key-list">
      {#each S.showKeys as k (k.keys)}
        <div class="key-list__item"><dt><kbd>{k.keys}</kbd></dt><dd>{k.action}</dd></div>
      {/each}
    </dl>
  </section>

  <SetupChecklist />
</div>
