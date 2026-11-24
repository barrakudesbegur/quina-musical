<!--
  The Claim number pad: a big pad to type the claimed card's number, what is claimed (Line or Quina,
  defaulting to what the Phase climbs towards; no choice in the Desgraciat round, where the only win is the last
  card standing), and a warning when the card isn't registered as sold.
  Physical keys work too: digits, Backspace, Delete, Enter, Escape.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { CONSOLE } from '../config.ts';
  import { getConsole } from '../context.ts';
  import { PAD_DIGITS, padKeyFromKeyboard, padPress, padValue, type PadKey } from '../logic/numpad.ts';
  import { isNotSold } from '../logic/possible-winners.ts';
  import { claimKindsOf, defaultClaimKind } from '../logic/show-data.ts';
  import type { ClaimKind } from '../logic/show-data.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  let { open = $bindable(false) }: { open: boolean } = $props();

  const model = getConsole();
  const uid = $props.id();
  const limits = { maxDigits: CONSOLE.cardDigits, max: CONSOLE.cardMax };
  let dialog: HTMLDialogElement | undefined = $state();
  let digits = $state('');
  /** What is claimed: Line or Quina, or 'standing' in the Desgraciat round. */
  let kind = $state<ClaimKind>('line');
  const value = $derived(padValue(digits, limits));
  const notSold = $derived(value !== null && isNotSold(value, model.inPlay));
  const kinds = $derived(claimKindsOf(model.show.state));

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      digits = '';
      kind = untrack(() => defaultClaimKind(model.show.state));
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  const press = (key: PadKey) => (digits = padPress(digits, key, limits));

  function onkeydown(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement) return;
    const key = padKeyFromKeyboard(e.key);
    if (key === null) return;
    e.preventDefault();
    press(key);
  }

  function submit(e: SubmitEvent): void {
    e.preventDefault();
    if (value === null || !model.can('claim')) return;
    // A kind the round can't be won by (the round changed while the pad was open) gives way to its default.
    model.act('claim', { cardId: value, kind: kinds.includes(kind) ? kind : defaultClaimKind(model.show.state) });
    open = false;
  }
</script>

<dialog bind:this={dialog} class="dialog numpad" aria-labelledby="{uid}-title" onclose={() => (open = false)} {onkeydown}>
  <form class="numpad__form" onsubmit={submit}>
    <header class="dialog__head">
      <h2 class="panel__title" id="{uid}-title">{S.numpad.title}</h2>
      <button type="button" class="dialog__close" onclick={() => (open = false)}><Icon name="close" /><span>{S.numpad.close}</span></button>
    </header>

    <output class="numpad__display" id="{uid}-display" aria-live="polite" aria-label={S.numpad.display} data-state={digits ? 'typed' : 'empty'}>
      {digits || S.numpad.empty}
    </output>
    <p class="numpad__warning" role="status">{#if notSold}<span class="badge badge--warning">{S.numpad.notSold}</span>{/if}</p>

    {#if kinds.length > 1}
      <div class="choice-group numpad__kind" role="group" aria-label={S.numpad.kind}>
        {#each kinds as k (k)}
          <button type="button" class="choice" data-anim="press" aria-pressed={kind === k} onclick={() => (kind = k)}>{S.numpad.kinds[k]}</button>
        {/each}
      </div>
    {/if}

    <div class="numpad__keys">
      {#each PAD_DIGITS.slice(0, 9) as d (d)}
        <button type="button" class="numpad__key" data-anim="press" onclick={() => press(d)}>{d}</button>
      {/each}
      <button type="button" class="numpad__key numpad__key--clear" data-anim="press" onclick={() => press('clear')}>
        <span aria-hidden="true">{S.numpad.clearKey}</span><span class="visually-hidden">{S.numpad.clear}</span>
      </button>
      <button type="button" class="numpad__key" data-anim="press" onclick={() => press('0')}>0</button>
      <button type="button" class="numpad__key numpad__key--back" data-anim="press" onclick={() => press('back')}>
        <Icon name="backspace" /><span class="visually-hidden">{S.numpad.back}</span>
      </button>
    </div>

    <button type="submit" class="big-button tone-ok numpad__submit" data-anim="press" disabled={value === null || !model.can('claim')}>
      <span class="big-button__content"><Icon name="claim" /><span class="big-button__label">{S.numpad.submit(value)}</span></span>
    </button>
  </form>
</dialog>
