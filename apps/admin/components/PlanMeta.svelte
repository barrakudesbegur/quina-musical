<!-- The night's name on screen and its edition (the year tag in the cards' QR links). -->
<script lang="ts">
  import type { PlanSession } from '../state/plan-session.svelte.ts';
  import { errorsAt } from '../logic/plan-check.ts';
  import { S } from '../strings.ts';

  let { session }: { session: PlanSession } = $props();
  const errors = $derived([...errorsAt(session.errors, 'plan.title'), ...errorsAt(session.errors, 'plan.edition')]);
</script>

<section class="panel surface plan-meta" aria-labelledby="plan-meta-title">
  <h2 class="panel__title" id="plan-meta-title">{S.plan.title}</h2>
  <div class="field-row">
    <label class="field">
      <span class="field__label">{S.plan.name}</span>
      <input type="text" bind:value={session.draft.title} maxlength="200" />
    </label>
    <label class="field">
      <span class="field__label">{S.plan.edition}</span>
      <input type="text" bind:value={session.draft.edition} inputmode="numeric" maxlength="2" pattern="[0-9]{2}" />
      <span class="field__help">{S.plan.editionHelp}</span>
    </label>
  </div>
  <ul class="error-list">
    {#each errors as error, i (i)}<li>{error}</li>{/each}
  </ul>
</section>
