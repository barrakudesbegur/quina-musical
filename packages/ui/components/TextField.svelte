<!--
  B9 · TextField: free text with a visible label (components-v2.md § 3 › B9; comments-27nov.md D-e, D-f, #57, #59).

  A <label for> above the box (the placeholder is a hint, never the label: modern-web-guidance `forms`), the box with
  an optional leading icon, the native <input> (or a <textarea> with `rows`), and an optional clear button at the
  end when `clearable` and not empty («Esborra»: a rounded square, the same inset from the box's top, end and bottom,
  #59, R7). `hint` goes under the box, lined up with the text inside it (#57), and describes the input
  (`aria-describedby`); with `invalid` it turns red and the input says `aria-invalid`.
  The text inside an input is never highlighted (D-e): a search's matched letters are drawn in its results, with the
  match-highlight resource (`.ds-mark`, ds/mark.css).
  `size`: `m` (48 px, the canonical field) or `l` (big text: the console's «Cerca», read while talking). Native
  attributes (type, maxlength, autocomplete, enterkeyhint, spellcheck, inputmode, events) pass through to the input.
  No UI sound: typing is the keyboard's (the phone's touch delegate plays the keypad's taps, `typing`).
-->
<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import Icon from '../icons/Icon.svelte';
  import type { IconName } from './types.ts';
  import './text-field.css';

  type Props = Omit<HTMLInputAttributes, 'value' | 'class' | 'size' | 'children'> & {
    label: string;
    value?: string;
    hint?: string | null;
    invalid?: boolean;
    prefixIcon?: IconName | null;
    clearable?: boolean;
    /** The clear button's name (UI words come from the app). */
    clearLabel?: string;
    onclear?: () => void;
    /** A multi-line field (a <textarea>) of this many rows. */
    rows?: number | null;
    size?: 'm' | 'l';
    class?: string;
    /** The <input> (or <textarea>), for a parent that must focus it. */
    element?: HTMLInputElement | HTMLTextAreaElement;
  };

  let {
    label,
    value = $bindable(''),
    hint = null,
    invalid = false,
    prefixIcon = null,
    clearable = false,
    clearLabel = 'Esborra',
    onclear,
    rows = null,
    size = 'm',
    class: className = '',
    element = $bindable(),
    id,
    type = 'text',
    disabled = false,
    ...rest
  }: Props = $props();

  const uid = $props.id();
  const inputId = $derived(id ?? `${uid}-input`);
  const describedBy = $derived([hint ? `${uid}-hint` : null, rest['aria-describedby'] ?? null].filter(Boolean).join(' ') || undefined);

  function clear(): void {
    value = '';
    onclear?.();
    element?.focus();
  }
</script>

<div class="text-field {className}" data-size={size} data-invalid={invalid || undefined} data-disabled={disabled || undefined} data-multiline={rows ? '' : undefined}>
  <label class="text-field__label" for={inputId}>{label}</label>
  <div class="text-field__box">
    {#if prefixIcon}<span class="text-field__icon" aria-hidden="true"><Icon name={prefixIcon} /></span>{/if}
    {#if rows}
      <textarea
        bind:this={element}
        {...rest as Record<string, unknown>}
        class="text-field__input"
        id={inputId}
        {rows}
        {disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        bind:value
      ></textarea>
    {:else}
      <input
        bind:this={element}
        {...rest}
        class="text-field__input"
        id={inputId}
        {type}
        {disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        bind:value
      />
    {/if}
    {#if clearable && value}
      <button type="button" class="text-field__clear" aria-label={clearLabel} data-touch="small" onclick={clear}><Icon name="close" alone /></button>
    {/if}
  </div>
  {#if hint}<p class="text-field__hint" id="{uid}-hint">{hint}</p>{/if}
</div>
