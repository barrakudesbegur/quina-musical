<!-- Every problem with the plan, each with its JSON path, so all of them can be fixed at once. -->
<script lang="ts">
  import { S } from '../strings.ts';

  let { errors, title = null, help = true }: { errors: readonly string[]; title?: string | null; help?: boolean } = $props();
</script>

{#if errors.length}
  <section class="plan-errors notice notice--error" aria-live="polite">
    <h2 class="plan-errors__title">{title ?? S.errors.title(errors.length)}</h2>
    {#if help}<p class="plan-errors__help">{S.errors.help}</p>{/if}
    <ul class="error-list">
      {#each errors as error, i (i)}
        <li>{error}</li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  @layer app {
  .plan-errors {
    display: grid;
    gap: var(--space-2);
  }
  .plan-errors__title {
    font-size: var(--text-md);
  }
  .plan-errors__help {
    font-size: var(--text-xs);
  }
  }
</style>
