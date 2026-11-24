<script lang="ts">
  // "Afegir cartró": a big number pad (keys ≥ 72 px), usable with one thumb.
  import { padValue } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import Sheet from './Sheet.svelte';

  let { onadd, onclose, onkey }: { onadd: (id: number) => string | null; onclose: () => void; onkey?: () => void } = $props();
  let value = $state('');
  let error = $state<string | null>(null);
  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok'] as const;

  function press(key: (typeof KEYS)[number]) {
    onkey?.();
    if (key === 'ok') {
      if (!value) return;
      error = onadd(Number(value));
      if (!error) onclose();
      return;
    }
    value = padValue(value, key);
    error = null;
  }
</script>

<Sheet name="pad" title={S.padTitle} {onclose}>
  <p class="number-pad__hint">{S.padHint}</p>
  <output class="number-pad__display" data-state={value ? 'typed' : 'empty'} aria-live="polite">{value || S.padEmpty}</output>
  {#if error}<p class="number-pad__error" role="alert">{error}</p>{/if}
  <div class="number-pad">
    {#each KEYS as key (key)}
      {#if key === 'back'}
        <button type="button" class="number-pad__key number-pad__key--back" aria-label={S.padDelete} disabled={!value} onclick={() => press(key)}>⌫</button>
      {:else if key === 'ok'}
        <button type="button" class="number-pad__key number-pad__key--ok tone-primary" disabled={!value} onclick={() => press(key)}>{S.padAdd}</button>
      {:else}
        <button type="button" class="number-pad__key" onclick={() => press(key)}>{key}</button>
      {/if}
    {/each}
  </div>
</Sheet>
