<!-- The whole Game's Winners by round, each with its name and notes editable (PRIVATE). -->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { winnersByRound } from '../logic/show-data.ts';
  import { roundAt } from '../../../packages/ui/plan.ts';
  import { S } from '../strings.ts';
  import WinnerForm from './WinnerForm.svelte';

  const model = getConsole();
  const groups = $derived(winnersByRound(model.show.flow.winners));
  let editing = $state<string | null>(null);
</script>

<section class="winners-list" data-private="true">
  {#if groups.length === 0}
    <p class="note">{S.winnersList.empty}</p>
  {:else}
    {#each groups as group (group.round)}
      <h3 class="panel__subtitle">{S.round(roundAt(model.plan, group.round), model.plan)}</h3>
      <ul class="winners-list__items">
        {#each group.winners as w (w.claimId)}
          <li class="winners-list__item" data-kind={w.kind}>
            <div class="winners-list__row">
              <span class="winners-list__what">{S.winnersList.item(w.kind, w.cardId)}</span>
              <span class="winners-list__name" data-state={w.name || w.slip ? 'named' : 'unnamed'}>{w.name ?? (w.slip ? S.winnersList.slip(w.slip) : S.winnersList.noName)}{#if w.name && w.slip}<span class="winners-list__slip"> · {S.winnersList.slip(w.slip)}</span>{/if}</span>
              <button type="button" class="winners-list__edit" data-anim="press" aria-expanded={editing === w.claimId} onclick={() => (editing = editing === w.claimId ? null : w.claimId)}>
                {editing === w.claimId ? S.winnerForm.close : S.winnerForm.edit}
              </button>
            </div>
            {#if w.notes && editing !== w.claimId}<p class="winners-list__notes">{w.notes}</p>{/if}
            {#if editing === w.claimId}<WinnerForm claimId={w.claimId} name={w.name} slip={w.slip ?? null} notes={w.notes} />{/if}
          </li>
        {/each}
      </ul>
    {/each}
  {/if}
</section>
