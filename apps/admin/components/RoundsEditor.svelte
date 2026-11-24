<!-- The rounds plan: each round normal or special, with its Line and Quina prizes. Rounds are added, removed
     and reordered here; they are renumbered 1, 2, 3… every time. -->
<script lang="ts">
  import type { ShowStore } from '../../ui/client/show.svelte.ts';
  import { CA } from '../../ui/i18n/ca.ts';
  import type { PlanSession } from '../state/plan-session.svelte.ts';
  import type { CommandTracker } from '../state/commands.svelte.ts';
  import { addRound, moveRound, removeRound } from '../logic/plan-edit.ts';
  import { errorsAt } from '../logic/plan-check.ts';
  import { S } from '../strings.ts';
  import PrizeFields from './PrizeFields.svelte';
  import CommandStatus from './CommandStatus.svelte';

  let { session, show, commands }: { session: PlanSession; show: ShowStore; commands: CommandTracker } = $props();

  /** The round whose "Treure" was pressed once, awaiting the second press. */
  let confirming = $state<number | null>(null);
  const engineTotal = $derived(show.state?.game.roundsTotal ?? null);
  const planTotal = $derived(session.draft.rounds.length);
  const listErrors = $derived(session.errors.filter((e) => e.startsWith('plan.rounds:')));

  const move = (from: number, to: number) => session.update((p) => ({ ...p, rounds: moveRound(p.rounds, from, to) }));
  function remove(index: number) {
    if (confirming !== index) {
      confirming = index;
      return;
    }
    confirming = null;
    session.update((p) => ({ ...p, rounds: removeRound(p.rounds, index) }));
  }
</script>

<section class="panel surface rounds" aria-labelledby="rounds-title">
  <h2 class="panel__title" id="rounds-title">{S.rounds.title}</h2>
  <p class="panel__help">{S.rounds.help}</p>

  <ol class="rounds__list">
    {#each session.draft.rounds as round, i (i)}
      <li class="rounds__item" data-kind={round.kind}>
        <fieldset class="round">
          <legend class="round__name">{CA.round(round.number)}{round.kind === 'special' ? ` · ${CA.specialRound}` : ''}</legend>
          <div class="round__head">
            <label class="field">
              <span class="field__label">{S.rounds.kind}</span>
              <select bind:value={round.kind}>
                <option value="normal">{S.rounds.normal}</option>
                <option value="special">{S.rounds.special}</option>
              </select>
            </label>
            <div class="round__tools">
              <button type="button" onclick={() => move(i, i - 1)} disabled={i === 0} aria-label={S.rounds.upLabel(round.number)}>↑ {S.rounds.up}</button>
              <button type="button" onclick={() => move(i, i + 1)} disabled={i === planTotal - 1} aria-label={S.rounds.downLabel(round.number)}>↓ {S.rounds.down}</button>
              <button type="button" class={confirming === i ? 'tone-danger' : ''} onclick={() => remove(i)} onblur={() => confirming === i && (confirming = null)} aria-label={confirming === i ? S.rounds.confirmRemove : S.rounds.removeLabel(round.number)} disabled={planTotal === 1}>
                {confirming === i ? S.rounds.confirmRemove : S.rounds.remove}
              </button>
            </div>
          </div>
          <div class="round__prizes">
            <PrizeFields bind:prize={round.line} kind="line" sponsors={session.draft.sponsors} idPrefix="round-{i}-line" errors={errorsAt(session.errors, `plan.rounds[${i}].line`)} />
            <PrizeFields bind:prize={round.bingo} kind="bingo" sponsors={session.draft.sponsors} idPrefix="round-{i}-bingo" errors={errorsAt(session.errors, `plan.rounds[${i}].bingo`)} />
          </div>
          <ul class="error-list">
            {#each errorsAt(session.errors, `plan.rounds[${i}]`).filter((e) => !e.includes('.line') && !e.includes('.bingo')) as error, j (j)}<li>{error}</li>{/each}
          </ul>
        </fieldset>
      </li>
    {/each}
  </ol>

  <ul class="error-list">
    {#each listErrors as error, i (i)}<li>{error}</li>{/each}
  </ul>

  <div class="panel__actions">
    <button type="button" onclick={() => session.update((p) => ({ ...p, rounds: addRound(p.rounds) }))}>+ {S.rounds.add}</button>
  </div>

  {#if engineTotal !== null && engineTotal !== planTotal}
    <div class="panel__actions rounds__sync">
      <p class="notice notice--warn">{S.rounds.engineTotal(engineTotal, planTotal)}</p>
      <button type="button" onclick={() => commands.send('setGame', null, { roundsTotal: planTotal })} disabled={!commands.canSend}>{S.rounds.syncTotal}</button>
      <CommandStatus record={commands.last('setGame')} />
    </div>
  {/if}
</section>

<style>
  .rounds__list {
    display: grid;
    gap: var(--space-4);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .round {
    display: grid;
    gap: var(--space-3);
  }
  .rounds__item[data-kind='special'] .round {
    border-color: var(--color-accent);
  }
  .round__name {
    font-size: var(--text-lg);
  }
  .round__head {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: end;
    justify-content: space-between;
  }
  .round__tools {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .round__prizes {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  }
</style>
