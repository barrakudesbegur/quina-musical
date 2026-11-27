<!--
  B8 · IconPicker: choose one mark from a grid of round swatches (components-v2.md § 3 › B8; comments-27nov.md D-c,
  #50, #54, #55, #56).

  Native radios in a fieldset (arrows, a screen reader), each a full touch target. Options are generic (D-c, #50):
  `{ value, label, icon?, disabled?, tag? }`; which marks are "owned" by another card is the player app's preset
  (its IconPicker), never a component value. `tag` is a short label over the swatch's foot (the owner's name, #54):
  higher than before and overlapping the swatch, so it's clearly that swatch's and takes no room of its own; it joins
  the accessible name. The chosen swatch wears the gold ring of the ring resource (R1: one even gap all round, its
  drop included, #55, #56) and pops as it gets it (icon-pick). A swatch draws `icon` from the one family, or the
  parent's `mark` snippet (the phone's full-colour card marks).
-->
<script lang="ts" generics="V extends string | number">
  import type { Snippet } from 'svelte';
  import Icon from '../icons/Icon.svelte';
  import type { IconPickerOption } from './control-types.ts';
  import type { IconName, UiSound } from './types.ts';
  import './icon-picker.css';

  type Option = IconPickerOption<V> & { readonly icon?: IconName | null };

  interface Props {
    options: readonly Option[];
    value: V;
    legend: string;
    /** The legend stays for screen readers only (a board with none). */
    legendHidden?: boolean;
    /** A note beside the legend («Cada cartró en té una de diferent»). */
    hint?: string | null;
    /** The radios' group name (one per form). */
    name?: string;
    /** Draws an option's mark instead of its `icon`. */
    mark?: Snippet<[Option]>;
    /** A tagged option's accessible name («Barret, de l'Àvia»); by default the label and the tag. */
    nameOf?: (option: Option) => string;
    sound?: UiSound | null;
    onselect?: (value: V) => void;
    class?: string;
  }

  let {
    options,
    value = $bindable(),
    legend,
    legendHidden = false,
    hint = null,
    name,
    mark,
    nameOf = (o: Option) => (o.tag ? `${o.label}, ${o.tag}` : o.label),
    sound = 'iconPick',
    onselect,
    class: className = '',
  }: Props = $props();

  const uid = $props.id();
  /** The option picked here (not the one the picker opened with): only a pick pops. */
  let picked = $state<V | null>(null);
</script>

<fieldset class="icon-picker {className}">
  <legend class="icon-picker__legend" class:visually-hidden={legendHidden}>{legend}{#if hint && !legendHidden}<span class="icon-picker__hint">{hint}</span>{/if}</legend>
  <div class="icon-picker__grid">
    {#each options as o (o.value)}
      {@const chosen = o.value === value}
      <label class="icon-picker__option" data-disabled={o.disabled || undefined} data-touch={sound ?? 'none'}>
        <input
          type="radio"
          name={name ?? `icon-picker-${uid}`}
          class="icon-picker__input"
          value={o.value}
          checked={chosen}
          disabled={o.disabled}
          aria-label={nameOf(o)}
          onchange={() => {
            picked = o.value;
            value = o.value;
            onselect?.(o.value);
          }}
        />
        <span class="icon-picker__chip" data-ring={chosen ? 'gold' : undefined} data-anim={chosen && o.value === picked ? 'icon-pick' : undefined} aria-hidden="true">
          <span class="icon-picker__mark">{#if mark}{@render mark(o)}{:else if o.icon}<Icon name={o.icon} alone />{/if}</span>
        </span>
        {#if o.tag}<span class="icon-picker__tag" aria-hidden="true">{o.tag}</span>{/if}
      </label>
    {/each}
  </div>
</fieldset>
