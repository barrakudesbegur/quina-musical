<!-- The rounds plan: each round normal or special, with its Line's and Quina's prize bundles. Rounds are added, removed
     and reordered here; they are renumbered 1, 2, 3… every time. During the night the rounds already played and
     the one in play (or being introduced) are fixed; the upcoming ones can be moved and edited live. -->
<script lang="ts">
  import type { ShowStore } from '../../../packages/ui/client/show.svelte.ts';
  import { CA } from '../../../packages/ui/i18n/ca.ts';
  import { flowOf } from '../../../packages/ui/flow.ts';
  import type { PlanSession } from '../state/plan-session.svelte.ts';
  import type { CommandTracker } from '../state/commands.svelte.ts';
  import { addRound, lockedRoundCount, moveRound, removeRound } from '../logic/plan-edit.ts';
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
  /** Rounds 1..locked are fixed: played, in play, or being introduced. */
  const locked = $derived(show.state ? lockedRoundCount(show.state.round, flowOf(show.state).intro?.round ?? null) : 0);

  const move = (from: number, to: number) => session.update((p) => ({ ...p, rounds: moveRound(p.rounds, from, to, locked) }));
  function remove(index: number) {
    if (confirming !== index) {
      confirming = index;
      return;
    }
    confirming = null;
    session.update((p) => ({ ...p, rounds: removeRound(p.rounds, index, locked) }));
  }
</script>

<section class="panel surface rounds" aria-labelledby="rounds-title">
  <h2 class="panel__title" id="rounds-title">{S.rounds.title}</h2>
  <p class="panel__help">{S.rounds.help}</p>
  {#if locked > 0}<p class="panel__help rounds__live">{S.rounds.liveHelp}</p>{/if}

  <ol class="rounds__list">
    {#each session.draft.rounds as round, i (i)}
      {@const fixed = i < locked}
      <li class="rounds__item" data-kind={round.kind} data-state={fixed ? (round.number === locked ? 'current' : 'played') : 'upcoming'}>
        <fieldset class="round">
          <legend class="round__name">
            {CA.round(round.number)}{round.kind === 'special' ? ` · ${CA.specialRound}` : ''}
            {#if fixed}<span class="round__badge" title={S.rounds.fixedLabel(round.number)}>{round.number === locked ? S.rounds.inPlay : S.rounds.played}</span>{/if}
          </legend>
          <div class="round__head">
            <label class="field">
              <span class="field__label">{S.rounds.kind}</span>
              <select bind:value={round.kind} disabled={fixed}>
                <option value="normal">{S.rounds.normal}</option>
                <option value="special">{S.rounds.special}</option>
              </select>
            </label>
            <div class="round__tools">
              <button type="button" onclick={() => move(i, i - 1)} disabled={fixed || i <= locked} aria-label={S.rounds.upLabel(round.number)}>↑ {S.rounds.up}</button>
              <button type="button" onclick={() => move(i, i + 1)} disabled={fixed || i === planTotal - 1} aria-label={S.rounds.downLabel(round.number)}>↓ {S.rounds.down}</button>
              <button type="button" class={confirming === i ? 'tone-danger' : ''} onclick={() => remove(i)} onblur={() => confirming === i && (confirming = null)} aria-label={confirming === i ? S.rounds.confirmRemove : S.rounds.removeLabel(round.number)} disabled={fixed || planTotal === 1}>
                {confirming === i ? S.rounds.confirmRemove : S.rounds.remove}
              </button>
            </div>
          </div>
          <div class="round__prizes">
            <PrizeFields bind:bundle={round.line} kind="line" sponsors={session.draft.sponsors} idPrefix="round-{i}-line" errors={errorsAt(session.errors, `plan.rounds[${i}].line`)} />
            <PrizeFields bind:bundle={round.bingo} kind="bingo" sponsors={session.draft.sponsors} idPrefix="round-{i}-bingo" errors={errorsAt(session.errors, `plan.rounds[${i}].bingo`)} />
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
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .round__badge {
    padding: 0 var(--space-2);
    border-radius: var(--radius-pill);
    border: var(--line-width) solid var(--color-line);
    font-size: var(--text-xs);
    font-weight: var(--font-weight-strong);
    background: var(--color-surface);
    color: var(--color-text-muted);
  }
  .rounds__item[data-state='current'] .round__badge {
    background: var(--color-ok);
    color: var(--color-paper);
  }
  .rounds__item[data-state='played'] .round {
    opacity: 0.7;
  }
  .rounds__live {
    color: var(--color-text);
    font-weight: var(--font-weight-strong);
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
