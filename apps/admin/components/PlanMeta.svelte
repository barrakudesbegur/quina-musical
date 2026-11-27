<!-- The night: the edition's name on every screen and its year tag (in the cards' QR links), when the prizes are
     revealed to phones, and the card types: read-only, from the printed cards (apps/cards' card-types.json). -->
<script lang="ts">
  import type { PrizeReveal } from '../../../packages/ui/plan.ts';
  import { knownCardTypes, roundsByCardType, type PrintedCardType } from '../../../packages/ui/data/card-types.ts';
  import type { PlanSession } from '../state/plan-session.svelte.ts';
  import { errorsAt } from '../logic/plan-check.ts';
  import { S } from '../strings.ts';

  let { session, printed = null }: { session: PlanSession; printed?: readonly PrintedCardType[] | null } = $props();
  const errors = $derived(['plan.title', 'plan.edition', 'plan.prizeReveal', 'plan.cardTypes'].flatMap((path) => errorsAt(session.errors, path)));
  const REVEALS: readonly PrizeReveal[] = ['perRound', 'allSecret'];
  /** card-types.json's types (else the plan's old copy), each with the rounds that pick it. */
  const types = $derived(knownCardTypes(printed));
  const plays = $derived(roundsByCardType(session.draft.rounds));
</script>

<section class="panel surface plan-meta" aria-labelledby="plan-meta-title">
  <h2 class="panel__title" id="plan-meta-title">{S.plan.title}</h2>
  <div class="field-row">
    <label class="field">
      <span class="field__label">{S.plan.name}</span>
      <input type="text" bind:value={session.draft.title} maxlength="200" />
      <span class="field__help">{S.plan.nameHelp}</span>
    </label>
    <label class="field">
      <span class="field__label">{S.plan.edition}</span>
      <input type="text" bind:value={session.draft.edition} inputmode="numeric" maxlength="2" pattern="[0-9]{2}" />
      <span class="field__help">{S.plan.editionHelp}</span>
    </label>
  </div>

  <label class="field">
    <span class="field__label">{S.plan.prizeReveal}</span>
    <select bind:value={session.draft.prizeReveal}>
      {#each REVEALS as reveal (reveal)}<option value={reveal}>{S.plan.prizeRevealOptions[reveal]}</option>{/each}
    </select>
    <span class="field__help">{S.plan.prizeRevealHelp[session.draft.prizeReveal] ?? ''}</span>
  </label>

  <fieldset class="plan-meta__cards">
    <legend>{S.plan.cardTypes}</legend>
    <p class="panel__help">{printed ? S.plan.cardTypesHelp : S.plan.cardTypesMissing}</p>
    <ul class="plan-meta__card-list">
      {#each types as cardType (cardType.type)}
        {@const rounds = plays.find((p) => p.type === cardType.type)}
        <li class="plan-meta__card" style:--card-color={cardType.color}>
          <span class="plan-meta__swatch" aria-hidden="true"></span>
          <span class="plan-meta__card-name">{cardType.name}</span>
          <span class="plan-meta__card-price">{S.plan.cardPriceLabel(cardType.priceCents)}</span>
          <span class="field__help">{S.plan.cardRounds(rounds?.regularRounds ?? [], rounds?.special ?? false, rounds?.desgraciat ?? false)}</span>
        </li>
      {/each}
    </ul>
  </fieldset>

  <ul class="error-list">
    {#each errors as error, i (i)}<li>{error}</li>{/each}
  </ul>
</section>

<style>
  @layer app {
  .plan-meta {
    display: grid;
    gap: var(--space-3);
  }
  .plan-meta__cards {
    display: grid;
    gap: var(--space-3);
  }
  .plan-meta__card-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: var(--space-2);
  }
  .plan-meta__card {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: var(--space-1) var(--space-3);
  }
  .plan-meta__card .field__help {
    grid-column: 2 / -1;
  }
  .plan-meta__swatch {
    width: 2rem;
    height: 2.5rem;
    grid-row: span 2;
    border-radius: var(--radius-sm, 6px);
    border: 2px solid var(--color-line);
    background: var(--card-color, var(--color-line));
  }
  .plan-meta__card-name {
    font-weight: 800;
  }
  }
</style>
