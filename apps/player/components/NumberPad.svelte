<script lang="ts">
  // "Afegir cartró": the card's icon (the first free one preselected) and a big number pad (keys ≥ 72 px),
  // usable with one thumb. Leaving with a number typed asks first ("Vols sortir sense afegir el cartró?").
  import { nextColor, type SavedCard } from '../logic/storage.ts';
  import { leaveNeedsConfirm, padValue } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import CardMark from './CardMark.svelte';
  import ConfirmSheet from './ConfirmSheet.svelte';
  import IconPicker from './IconPicker.svelte';
  import Sheet from './Sheet.svelte';

  let {
    cards,
    onadd,
    onclose,
    onkey,
  }: { cards: readonly SavedCard[]; onadd: (id: number, identity: number) => string | null; onclose: () => void; onkey?: () => void } = $props();
  // The pick starts at the first free icon of the cards the sheet opened with.
  // svelte-ignore state_referenced_locally
  let identity = $state(nextColor(cards));
  let value = $state('');
  let error = $state<string | null>(null);
  let leaving = $state(false);

  /** The sheet may close at once with nothing typed; otherwise the player confirms first. */
  function canClose(): boolean {
    if (!leaveNeedsConfirm(value)) return true;
    leaving = true;
    return false;
  }
  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok'] as const;

  function press(key: (typeof KEYS)[number]) {
    onkey?.();
    if (key === 'ok') {
      if (!value) return;
      error = onadd(Number(value), identity);
      if (!error) onclose();
      return;
    }
    value = padValue(value, key);
    error = null;
  }
</script>

<Sheet name="pad" title={S.padTitle} {onclose} {canClose}>
  <p class="number-pad__hint">{S.padHint}</p>
  <div class="number-pad__entry" style:--card-color="var(--card-color-{identity})">
    <span class="number-pad__mark" aria-hidden="true"><CardMark {identity} decorative /></span>
    <output class="number-pad__display" data-state={value ? 'typed' : 'empty'} aria-live="polite">{value || S.padEmpty}</output>
  </div>
  <IconPicker others={cards} selected={identity} onselect={(n) => (identity = n)} />
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
{#if leaving}
  <ConfirmSheet name="leave-pad" title={S.leaveTitle} text={S.leaveText} yes={S.leaveYes} no={S.leaveNo} danger={false} onyes={onclose} onclose={() => (leaving = false)} />
{/if}
