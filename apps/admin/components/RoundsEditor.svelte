<!-- The rounds plan: each round normal, special or the night's one Desgraciat round, the printed card type it plays
     (card-types.json) and its side (D193's default: Quines 1–5 side 1, later normal rounds side 2, the Desgraciat and
     the Especial side 1; sideWarnings says what doesn't fit the printed cards), with its Line's and Quina's prize
     bundles (the Desgraciat round: only the last card standing's,
     its `bingo` bundle; Line prizes it had move there, with a notice). Rounds are added, removed
     and reordered here; they are renumbered 1, 2, 3… every time. During the night the rounds already played and
     the one in play (or being introduced) are fixed; the upcoming ones can be moved and edited live. -->
<script lang="ts">
  import type { ShowStore } from '../../../packages/ui/client/show.svelte.ts';
  import { flowOf } from '../../../packages/ui/flow.ts';
  import type { PlanSession } from '../state/plan-session.svelte.ts';
  import type { CommandTracker } from '../state/commands.svelte.ts';
  import { roundCardType, roundSide, sideWarnings, type RoundKind } from '@quina/protocol';
  import { cardTypeLabel, knownCardTypes, type PrintedCardType } from '../../../packages/ui/data/card-types.ts';
  import {
    addRound,
    cardTypeChoices,
    desgraciatTaken,
    isUnknownCardType,
    lockedRoundCount,
    movedLinePrizes,
    moveRound,
    removeRound,
    sideChoices,
    withCardType,
    withLineMoved,
    withRoundKind,
  } from '../logic/plan-edit.ts';
  import { errorsAt } from '../logic/plan-check.ts';
  import { S } from '../strings.ts';
  import PrizeFields from './PrizeFields.svelte';
  import CommandStatus from './CommandStatus.svelte';

  let { session, show, commands, printed = null }: { session: PlanSession; show: ShowStore; commands: CommandTracker; printed?: readonly PrintedCardType[] | null } = $props();

  /** The types to pick from and name: card-types.json's (knownCardTypes). */
  const types = $derived(knownCardTypes(printed));
  /** Rounds whose Line prizes just moved into their last-card-standing bundle, by index, with how many (a notice). */
  let moved = $state<Record<number, number>>({});
  function setKind(index: number, kind: RoundKind) {
    const round = session.draft.rounds[index];
    const count = round ? movedLinePrizes(round, kind) : 0;
    moved = { ...moved, [index]: count };
    session.update((p) => ({ ...p, rounds: p.rounds.map((r, i) => (i === index ? withRoundKind(r, kind, types, p.rounds) : r)) }));
  }
  const moveLine = (index: number) => session.update((p) => ({ ...p, rounds: p.rounds.map((r, i) => (i === index ? withLineMoved(r) : r)) }));
  const setCardType = (index: number, cardType: string) =>
    session.update((p) => ({ ...p, rounds: p.rounds.map((r, i) => (i === index ? withCardType(r, cardType, types, p.rounds) : r)) }));
  const setSide = (index: number, side: number) => session.update((p) => ({ ...p, rounds: p.rounds.map((r, i) => (i === index ? { ...r, side } : r)) }));
  /** What doesn't fit between the rounds' sides and the printed cards; unknowable without card-types.json. */
  const warnings = $derived(printed ? sideWarnings(session.draft, printed) : []);
  const planWarnings = $derived(warnings.filter((w) => w.path === 'plan.rounds'));

  /** The round whose "Treure" was pressed once, awaiting the second press. */
  let confirming = $state<number | null>(null);
  const engineTotal = $derived(show.state?.game.roundsTotal ?? null);
  const planTotal = $derived(session.draft.rounds.length);
  const listErrors = $derived(session.errors.filter((e) => e.startsWith('plan.rounds:')));
  /** Rounds 1..locked are fixed: played, in play, or being introduced. */
  const locked = $derived(show.state ? lockedRoundCount(show.state.round, flowOf(show.state).intro?.round ?? null) : 0);

  const move = (from: number, to: number) => {
    moved = {};
    session.update((p) => ({ ...p, rounds: moveRound(p.rounds, from, to, locked) }));
  };
  function remove(index: number) {
    if (confirming !== index) {
      confirming = index;
      return;
    }
    confirming = null;
    moved = {};
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
      {@const cardType = roundCardType(round)}
      {@const side = roundSide(round)}
      {@const taken = desgraciatTaken(session.draft.rounds, i)}
      {@const name = S.round(round, session.draft)}
      <li class="rounds__item" data-kind={round.kind} data-state={fixed ? (round.number === locked ? 'current' : 'played') : 'upcoming'}>
        <fieldset class="round">
          <legend class="round__name">
            {name}
            {#if fixed}<span class="round__badge" title={S.rounds.fixedLabel(name)}>{round.number === locked ? S.rounds.inPlay : S.rounds.played}</span>{/if}
          </legend>
          <div class="round__head">
            <label class="field">
              <span class="field__label">{S.rounds.kind}</span>
              <select value={round.kind} onchange={(e) => setKind(i, e.currentTarget.value as RoundKind)} disabled={fixed} data-testid="round-kind">
                <option value="normal">{S.rounds.normal}</option>
                <option value="special">{S.rounds.special}</option>
                <!-- One per night: offered while no other round is the Desgraciat one (checkGamePlan refuses a second). -->
                <option value="desgraciat" disabled={taken && round.kind !== 'desgraciat'}>{taken && round.kind !== 'desgraciat' ? S.rounds.desgraciatTaken : S.rounds.desgraciat}</option>
              </select>
            </label>
            <label class="field">
              <span class="field__label">{S.rounds.cardType}</span>
              <select value={cardType} onchange={(e) => setCardType(i, e.currentTarget.value)} disabled={fixed} data-testid="round-card-type">
                {#each cardTypeChoices(types, cardType) as type (type)}<option value={type}>{cardTypeLabel(type, types).name}</option>{/each}
              </select>
            </label>
            <label class="field">
              <span class="field__label">{S.rounds.side}</span>
              <select value={side} onchange={(e) => setSide(i, Number(e.currentTarget.value))} disabled={fixed} data-testid="round-side">
                {#each sideChoices(types, cardType, side) as choice (choice.side)}<option value={choice.side}>{S.rounds.sideOption(choice.side, choice.label)}</option>{/each}
              </select>
            </label>
            <div class="round__tools">
              <button type="button" onclick={() => move(i, i - 1)} disabled={fixed || i <= locked} aria-label={S.rounds.upLabel(name)}>↑ {S.rounds.up}</button>
              <button type="button" onclick={() => move(i, i + 1)} disabled={fixed || i === planTotal - 1} aria-label={S.rounds.downLabel(name)}>↓ {S.rounds.down}</button>
              <button type="button" data-color={confirming === i ? 'red' : undefined} onclick={() => remove(i)} onblur={() => confirming === i && (confirming = null)} aria-label={confirming === i ? S.rounds.confirmRemove : S.rounds.removeLabel(name)} disabled={fixed || planTotal === 1}>
                {confirming === i ? S.rounds.confirmRemove : S.rounds.remove}
              </button>
            </div>
          </div>
          {#if round.kind === 'desgraciat'}
            <p class="panel__help">{S.rounds.desgraciatHelp}</p>
            {#if taken}<p class="notice notice--warn" role="alert" data-testid="round-desgraciat-twice">{S.rounds.oneDesgraciat}</p>{/if}
            {#if moved[i]}<p class="notice" role="status" data-testid="round-lines-moved">{S.rounds.linesMoved(moved[i])}</p>{/if}
          {/if}
          {#if isUnknownCardType(cardType, printed)}
            <p class="notice notice--warn" role="alert" data-testid="round-card-type-unknown">{S.rounds.unknownCardType(cardType)}</p>
          {/if}
          {#each warnings.filter((w) => w.path === `plan.rounds[${i}].side`) as warning, j (j)}
            <p class="notice notice--warn" role="alert" data-testid="round-side-warning">{warning.message}</p>
          {/each}
          <div class="round__prizes">
            {#if round.kind !== 'desgraciat'}
              <PrizeFields bind:bundle={round.line} kind="line" sponsors={session.draft.sponsors} idPrefix="round-{i}-line" errors={errorsAt(session.errors, `plan.rounds[${i}].line`)} />
            {:else if round.line.length}
              <!-- Line prizes in a Desgraciat round (an imported plan): shown, so they can be moved or removed. -->
              <div class="round__stray-line">
                <p class="notice notice--warn" role="alert">{S.rounds.lineInDesgraciat}</p>
                <button type="button" onclick={() => moveLine(i)} disabled={fixed} data-testid="round-move-line">{S.rounds.moveLine}</button>
                <PrizeFields bind:bundle={round.line} kind="line" sponsors={session.draft.sponsors} idPrefix="round-{i}-line" errors={errorsAt(session.errors, `plan.rounds[${i}].line`)} />
              </div>
            {/if}
            <!-- The Desgraciat round's one bundle (the plan's `bingo`) is the last card standing's prize. -->
            <PrizeFields bind:bundle={round.bingo} kind={round.kind === 'desgraciat' ? 'standing' : 'bingo'} sponsors={session.draft.sponsors} idPrefix="round-{i}-bingo" errors={errorsAt(session.errors, `plan.rounds[${i}].bingo`)} />
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
  {#if planWarnings.length}
    <div class="notice notice--warn" role="status" data-testid="side-warnings">
      <p>{S.rounds.sideWarnings}</p>
      <ul>
        {#each planWarnings as warning, i (i)}<li>{warning.message}</li>{/each}
      </ul>
    </div>
  {/if}

  <div class="panel__actions">
    <button type="button" onclick={() => session.update((p) => ({ ...p, rounds: addRound(p.rounds, 'normal', types) }))}>+ {S.rounds.add}</button>
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
  .rounds__item[data-kind='special'] .round,
  .rounds__item[data-kind='desgraciat'] .round {
    border-color: var(--color-accent);
  }
  .round__stray-line {
    display: grid;
    gap: var(--space-2);
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
