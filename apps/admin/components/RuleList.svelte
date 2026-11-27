<!-- One editable list of cheat-sheet rules (one rule per item). -->
<script lang="ts">
  import { S } from '../strings.ts';

  let { items = $bindable(), legend, idPrefix }: { items: string[]; legend: string; idPrefix: string } = $props();
</script>

<fieldset class="rule-list">
  <legend>{legend}</legend>
  <ol class="rule-list__items">
    {#each items as _, i (i)}
      <li class="rule-list__item">
        <label class="field">
          <span class="field__label">{S.rules.item(i + 1)}</span>
          <textarea id="{idPrefix}-{i}" rows="2" bind:value={items[i]} maxlength="400"></textarea>
        </label>
        <button type="button" onclick={() => (items = items.filter((_, j) => j !== i))} aria-label={S.rules.removeLabel(i + 1)}>{S.rules.remove}</button>
      </li>
    {/each}
  </ol>
  <button type="button" onclick={() => (items = [...items, ''])}>+ {S.rules.add}</button>
</fieldset>

<style>
  @layer app {
  .rule-list {
    display: grid;
    gap: var(--space-3);
  }
  .rule-list__items {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .rule-list__item {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-2);
    align-items: end;
  }
  }
</style>
