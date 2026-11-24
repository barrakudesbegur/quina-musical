<!-- The cheat sheet's rule lists: how claims work, and the special round's rules. -->
<script lang="ts">
  import type { PlanSession } from '../state/plan-session.svelte.ts';
  import { errorsAt } from '../logic/plan-check.ts';
  import { S } from '../strings.ts';
  import RuleList from './RuleList.svelte';

  let { session }: { session: PlanSession } = $props();
</script>

<section class="panel surface rules" aria-labelledby="rules-title">
  <h2 class="panel__title" id="rules-title">{S.rules.title}</h2>
  <div class="rules__lists">
    <RuleList bind:items={session.draft.cheatSheet.claimRules} legend={S.rules.claim} idPrefix="rule-claim" />
    <RuleList bind:items={session.draft.cheatSheet.specialRoundRules} legend={S.rules.special} idPrefix="rule-special" />
  </div>
  <ul class="error-list">
    {#each errorsAt(session.errors, 'plan.cheatSheet') as error, i (i)}<li>{error}</li>{/each}
  </ul>
</section>

<style>
  .rules__lists {
    display: grid;
    gap: var(--space-4);
    grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
  }
</style>
