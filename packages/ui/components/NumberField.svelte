<!--
  B7 · NumberField: a card's number, «#» and its digits (components-v2.md § 3 › B7; comments-27nov.md D-c, #51, #53).

  Its look comes from its real inputs, never a `state` prop (D-c, #51): empty or typed from `value`, red from
  `invalid` (the parent's validity: a number that isn't a card, «Aquest cartró no existeix»), dimmed by `disabled`.
  `keyboard`: `pad` (the digits come from a NumberPad: an <output> read out as it changes, with a caret after them,
  so the phone's keyboard never opens) or `system` (a real <input inputmode="numeric">: the card's edit drawer).
  `trailing`: a control at the field's end (the phone's QR button, D141), whose found number the parent writes
  into `value` (`bind:value`). A one-off flash (the QR's green ring, `qr-found`) is the parent's `data-anim` on it.
  Sizes come from the density: the phone's 72 px field, the console's display row.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';
  import './number-pad.css';

  type Props = Omit<HTMLInputAttributes, 'value' | 'class' | 'children' | 'size'> & {
    value?: string;
    /** The field's name for assistive technology («Número del cartró»). */
    label: string;
    invalid?: boolean;
    keyboard?: 'pad' | 'system';
    prefix?: string;
    trailing?: Snippet;
    class?: string;
    element?: HTMLInputElement;
  };

  let {
    value = $bindable(''),
    label,
    invalid = false,
    keyboard = 'pad',
    prefix = '#',
    trailing,
    disabled = false,
    class: className = '',
    element = $bindable(),
    ...rest
  }: Props = $props();

  /** Typing on the phone's own keyboard: digits only. */
  function oninput(e: Event & { currentTarget: HTMLInputElement }): void {
    const digits = e.currentTarget.value.replace(/\D+/g, '');
    if (digits !== e.currentTarget.value) e.currentTarget.value = digits;
    value = digits;
  }
</script>

<div
  {...(keyboard === 'pad' ? (rest as Record<string, unknown>) : {})}
  class="number-field {className}"
  data-keyboard={keyboard}
  data-empty={value === '' || undefined}
  data-invalid={invalid || undefined}
  data-disabled={disabled || undefined}
>
  <span class="number-field__prefix" aria-hidden="true">{prefix}</span>
  {#if keyboard === 'pad'}
    <output class="number-field__digits" aria-label={label} aria-live="polite">{value}</output>
    <span class="number-field__caret" aria-hidden="true"></span>
  {:else}
    <input
      bind:this={element}
      {...rest}
      class="number-field__digits"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      autocomplete="off"
      aria-label={label}
      aria-invalid={invalid || undefined}
      {disabled}
      {value}
      {oninput}
    />
  {/if}
  {#if trailing}<span class="number-field__end">{@render trailing()}</span>{/if}
</div>
