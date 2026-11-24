<!-- The night: the edition's name on every screen and its year tag (in the cards' QR links), when the prizes are
     revealed to phones, and the card types (name, colour, price; where they play is fixed by the engine). -->
<script lang="ts">
  import type { PrizeReveal } from '../../../packages/ui/plan.ts';
  import type { PlanSession } from '../state/plan-session.svelte.ts';
  import { errorsAt } from '../logic/plan-check.ts';
  import { fromPriceInput, priceInput } from '../logic/plan-edit.ts';
  import { S } from '../strings.ts';

  let { session }: { session: PlanSession } = $props();
  const errors = $derived(['plan.title', 'plan.edition', 'plan.prizeReveal', 'plan.cardTypes'].flatMap((path) => errorsAt(session.errors, path)));
  const REVEALS: readonly PrizeReveal[] = ['perRound', 'allSecret'];
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
    <p class="panel__help">{S.plan.cardTypesHelp}</p>
    {#each session.draft.cardTypes as cardType, i (i)}
      <div class="field-row plan-meta__card" style:--card-color={cardType.color}>
        <label class="field">
          <span class="field__label">{S.plan.cardName}</span>
          <input type="text" bind:value={cardType.name} maxlength="200" />
          <span class="field__help">{S.plan.cardRounds(cardType.rounds)}</span>
        </label>
        <label class="field plan-meta__color">
          <span class="field__label">{S.plan.cardColor}</span>
          <input type="color" bind:value={cardType.color} />
        </label>
        <label class="field plan-meta__price">
          <span class="field__label">{S.plan.cardPrice}</span>
          <input type="number" min="0" step="0.5" inputmode="decimal" value={priceInput(cardType.priceCents)} oninput={(e) => (cardType.priceCents = fromPriceInput(e.currentTarget.value))} />
          <span class="field__help">{S.plan.cardPriceHelp}</span>
        </label>
      </div>
    {/each}
  </fieldset>

  <ul class="error-list">
    {#each errors as error, i (i)}<li>{error}</li>{/each}
  </ul>
</section>

<style>
  .plan-meta {
    display: grid;
    gap: var(--space-3);
  }
  .plan-meta__cards {
    display: grid;
    gap: var(--space-3);
  }
  .plan-meta__card {
    padding-left: var(--space-3);
    border-left: 0.5rem solid var(--card-color, var(--color-line));
  }
  .plan-meta__color input {
    min-width: 4rem;
    min-height: 2.5rem;
    padding: 0;
  }
  .plan-meta__price input {
    max-width: 8rem;
  }
</style>
