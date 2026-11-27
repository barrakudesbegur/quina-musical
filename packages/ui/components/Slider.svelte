<!--
  B10 · Slider: a value on a track, the volumes' (components-v2.md § 3 › B10; comments-27nov.md D-m, #60–#63).

  A native <input type="range"> (modern-web-guidance `slider`: keyboard, touch and screen readers for free), its
  visible <label> and its value in an <output> («80%», no space, #62) at the head's right end, flush with the
  track's (#60): the head spans the track's column only, between the − and + buttons. − and + step by 1 (#61); the
  keyboard: the arrows 1, Page Up / Page Down 10, Home / End the ends. `defaultValue` draws a notch on the track
  with its value under it, and the fill past it turns gold (D157). The thumb is a paper disc with no drop, so its
  focus ring keeps one gap all round (#63, R1). The value is the parent's: `oninput` on every step, `onchange` when
  the finger lifts (the parent may show the engine's value again).
  No UI sound (D139): the sliders and their buttons are silent.
-->
<script lang="ts">
  import Icon from '../icons/Icon.svelte';
  import './slider.css';

  interface Props {
    label: string;
    value: number;
    min?: number;
    max?: number;
    /** The native step (the arrows' and a drag's); − and + step by `nudge`. */
    step?: number;
    nudge?: number;
    /** Page Up / Page Down. */
    page?: number;
    /** A notch at this value, its text under it; the fill past it turns gold. */
    defaultValue?: number | null;
    note?: string | null;
    /** The value as words: the output, the notch and `aria-valuetext`. */
    format?: (value: number) => string;
    /** Words read with the slider (the default, «Per defecte: 100%»). */
    description?: string | null;
    /** The − and + buttons' names (UI words come from the app). */
    lessLabel?: string;
    moreLabel?: string;
    disabled?: boolean;
    oninput?: (value: number) => void;
    onchange?: (value: number) => void;
    class?: string;
    'data-testid'?: string;
  }

  let {
    label,
    value,
    min = 0,
    max = 100,
    step = 1,
    nudge = 1,
    page = 10,
    defaultValue = null,
    note = null,
    format = (v: number) => `${v}%`,
    description = null,
    lessLabel = '−1',
    moreLabel = '+1',
    disabled = false,
    oninput,
    onchange,
    class: className = '',
    'data-testid': testid,
  }: Props = $props();

  const uid = $props.id();
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const at = (v: number) => (max > min ? (v - min) / (max - min) : 0);
  const describedBy = $derived([note ? `${uid}-note` : null, description ? `${uid}-desc` : null].filter(Boolean).join(' ') || undefined);

  function set(v: number, commit: boolean): void {
    const next = clamp(v);
    if (next === value) return;
    oninput?.(next);
    if (commit) onchange?.(next);
  }

  function onkeydown(e: KeyboardEvent): void {
    if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
    e.preventDefault();
    set(value + (e.key === 'PageUp' ? page : -page), true);
  }
</script>

<div
  class="slider {className}"
  data-over={defaultValue !== null && value > defaultValue ? '' : undefined}
  data-at-default={defaultValue !== null && value === defaultValue ? '' : undefined}
  style:--slider-at={at(value)}
  style:--slider-default-at={defaultValue === null ? null : at(defaultValue)}
>
  <div class="slider__head">
    <label class="slider__label" for="{uid}-range">{label}</label>
    {#if note}<span class="slider__note" id="{uid}-note">{note}</span>{/if}
    <output class="slider__value" for="{uid}-range">{format(value)}</output>
  </div>
  <button type="button" class="slider__step" data-step="less" aria-label={lessLabel} data-touch="none" disabled={disabled || value <= min} onclick={() => set(value - nudge, true)}>
    <Icon name="minus" alone />
  </button>
  <span class="slider__track">
    <!-- Under the input: its ends show past the track, and the thumb covers it at the default. -->
    {#if defaultValue !== null}
      <span class="slider__notch" aria-hidden="true"><span class="slider__notch-text">{format(defaultValue)}</span></span>
    {/if}
    <input
      id="{uid}-range"
      class="slider__input"
      type="range"
      {min}
      {max}
      {step}
      {value}
      {disabled}
      data-testid={testid}
      aria-valuetext={format(value)}
      aria-describedby={describedBy}
      oninput={(e) => set(Number(e.currentTarget.value), false)}
      onchange={(e) => onchange?.(clamp(Number(e.currentTarget.value)))}
      {onkeydown}
    />
  </span>
  <button type="button" class="slider__step" data-step="more" aria-label={moreLabel} data-touch="none" disabled={disabled || value >= max} onclick={() => set(value + nudge, true)}>
    <Icon name="plus" alone />
  </button>
  {#if description}<span class="visually-hidden" id="{uid}-desc">{description}</span>{/if}
</div>
