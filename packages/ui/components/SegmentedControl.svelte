<!--
  B2 · SegmentedControl: pick one of a few options in place (components-v2.md § 3 › B2).

  A track with the options side by side and a gold thumb under the chosen one, which slides between them
  (ANIMATIONS.md › segment-slide): the thumb is the track's own ::before, tethered by CSS anchor positioning to the
  chosen option and transitioned on its insets (modern-web-guidance anchor-positioning-tab-underline), so it follows
  any column widths (`weights`).
  `semantics`: `radio` (a radiogroup: the claim's Línia | Quina, the menu's choices) or `tabs` (a tablist, when it
  switches the view below it: the phone's Historial | Cartrons; the panel is labelled by `${idPrefix}-${id}`).
  Either way, one Tab stop (a roving tabindex) and the arrow keys, Home and End move and choose, skipping disabled
  options. The parent owns the value (`bind:value`, or `value` + `onchange`).
  Sizes: `s` (44 px, the console's floor), `m` (48 px), `l` (64 px); the surface's scale comes from `data-density`.
  `progress` (27 Nov, the phone home's swipe): a position from 0 (the first option) to the last option's index that the
  thumb follows instead of sliding to the chosen option on its own, so a parent can drive it with a gesture
  (ANIMATIONS.md › home-swipe); the option nearest to it reads ink on gold. Equal columns only.
-->
<script lang="ts" generics="T extends string">
  import Icon from '../icons/Icon.svelte';
  import type { SegmentOption, SegmentSize } from './control-types.ts';
  import type { UiSound } from './types.ts';
  import { nextEnabled } from './roving.ts';
  import './segmented.css';

  interface Props {
    options: readonly SegmentOption<T>[];
    /** The chosen option's id; null (or an id no option has) shows none chosen. */
    value: T | null;
    /** The group's name (an `aria-label`), unless `labelledby` names a visible heading. */
    label?: string;
    labelledby?: string;
    size?: SegmentSize;
    /** Column widths, e.g. [1.5, 1, 1]; equal by default. */
    weights?: readonly number[] | null;
    semantics?: 'radio' | 'tabs';
    /** The options' ids are `${idPrefix}-${id}` (a tab panel's aria-labelledby names one). */
    idPrefix?: string;
    disabled?: boolean;
    sound?: UiSound | null;
    /** The thumb's place, driven by the parent (0 … options − 1); null: it slides to the chosen option itself. */
    progress?: number | null;
    onchange?: (id: T) => void;
    class?: string;
    'data-testid'?: string;
  }

  let {
    options,
    value = $bindable(),
    label,
    labelledby,
    size = 'm',
    weights = null,
    semantics = 'radio',
    idPrefix,
    disabled = false,
    sound = 'tab',
    progress = null,
    onchange,
    class: className = '',
    'data-testid': testid,
  }: Props = $props();

  const uid = $props.id();
  const prefix = $derived(idPrefix ?? uid);
  const buttons: HTMLButtonElement[] = $state([]);
  const tabs = $derived(semantics === 'tabs');
  const columns = $derived(weights ? weights.map((w) => `minmax(0, ${w}fr)`).join(' ') : undefined);
  /** The one Tab stop: the chosen option, or the first usable one. */
  const lit = $derived(progress === null ? null : Math.round(Math.min(options.length - 1, Math.max(0, progress))));
  const stop = $derived(options.some((o) => o.id === value && !o.disabled) ? value : options.find((o) => !o.disabled)?.id);

  function choose(id: T): void {
    if (id === value) return;
    value = id;
    onchange?.(id);
  }

  function onkeydown(e: KeyboardEvent, index: number): void {
    const next = nextEnabled(options, index, e.key);
    if (next === null) return;
    e.preventDefault();
    choose(options[next].id);
    buttons[next]?.focus();
  }
</script>

<div
  class="segmented {className}"
  role={tabs ? 'tablist' : 'radiogroup'}
  aria-label={labelledby ? undefined : label}
  aria-labelledby={labelledby}
  aria-disabled={disabled || undefined}
  data-size={size}
  data-testid={testid}
  style:grid-template-columns={columns}
  style:--segment-anchor="--segment-{uid}"
  style:--segment-progress={progress}
  style:--segment-count={progress === null ? undefined : options.length}
  data-follow={progress === null ? undefined : 'true'}
>
  {#each options as option, i (option.id)}
    {@const chosen = option.id === value}
    <button
      bind:this={buttons[i]}
      type="button"
      class="segmented__option"
      id="{prefix}-{option.id}"
      role={tabs ? 'tab' : 'radio'}
      aria-selected={tabs ? chosen : undefined}
      aria-checked={tabs ? undefined : chosen}
      tabindex={option.id === stop ? 0 : -1}
      disabled={disabled || option.disabled}
      data-touch={sound ?? 'none'}
      data-chosen={chosen || undefined}
      data-lit={lit === null ? undefined : lit === i || undefined}
      onclick={() => choose(option.id)}
      onkeydown={(e) => onkeydown(e, i)}
    >
      <span class="segmented__head">
        {#if option.icon}<span class="segmented__icon" aria-hidden="true"><Icon name={option.icon} /></span>{/if}
        <span class="segmented__label">{option.label}</span>
      </span>
      {#if option.note}<span class="segmented__note">{option.note}</span>{/if}
    </button>
  {/each}
</div>
