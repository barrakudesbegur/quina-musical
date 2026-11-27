<!--
  A4 · MiniButton: the console's small secondary button, also the toggle (`pressed`) and the pace preset
  (components-v2.md § 2 › A4, with the 27 Nov comments). Props say what it draws: `color` (its fill at rest: grey is
  the soft chip, the others their palette's solid), `pressedColor` (the fill while pressed: gold or green), `size`
  (xs | s | m | l; xs is D-h's compact height for tight spots, #87), `variant` ('dashed' is R11's «suggested» look,
  its edge dashed too, #25), `ring` (R1), `pressed`, `disabled` and the `sound` a press plays. Slots: `icon`, `label`
  (one line; an icon-only mini takes `aria-label` instead), `sub` (a second line: the pace preset's «18 s»), `wii`.
  Built on the press resource (ds-pushable / ds-piece), so it sinks onto its shadow and a toggle that's on stays down.
-->
<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Icon from '../icons/Icon.svelte';
  import { useDs } from './providers.ts';
  import type { IconName, Ring, UiSound, WiiKeySpec } from './types.ts';
  import './mini-button.css';

  type Props = Omit<HTMLButtonAttributes, 'children' | 'class' | 'aria-pressed'> & {
    label?: string | null;
    sub?: string | null;
    icon?: IconName | null;
    color?: 'grey' | 'gold' | 'green' | 'orange';
    pressedColor?: 'gold' | 'green';
    size?: 'xs' | 's' | 'm' | 'l';
    variant?: 'solid' | 'dashed';
    ring?: Ring | null;
    pressed?: boolean;
    disabled?: boolean;
    sound?: UiSound | null;
    wii?: WiiKeySpec | null;
    class?: string;
    element?: HTMLButtonElement;
  };

  let {
    label = null,
    sub = null,
    icon = null,
    color = 'grey',
    pressedColor = 'gold',
    size = 'm',
    variant = 'solid',
    ring = null,
    pressed = undefined,
    disabled = false,
    sound = 'small',
    wii = null,
    class: className = '',
    element = $bindable(),
    type = 'button',
    ...rest
  }: Props = $props();

  const { wii: Wii } = useDs();
  const on = $derived(pressed === true);
</script>

<button
  bind:this={element}
  {...rest}
  {type}
  class="mini-button ds-pushable {className}"
  data-color={on ? pressedColor : color}
  data-rest={on ? undefined : color}
  data-size={size}
  data-variant={variant}
  data-ring={ring ?? undefined}
  data-touch={sound ?? 'none'}
  data-icon-only={!label || undefined}
  aria-pressed={pressed}
  {disabled}
>
  <span class="mini-button__piece ds-piece">
    {#if icon}<Icon name={icon} alone={!label} />{/if}
    {#if label}
      <span class="mini-button__words">
        <span class="mini-button__label">{label}</span>
        {#if sub}<span class="mini-button__sub">{sub}</span>{/if}
      </span>
    {/if}
    {#if wii && Wii}<span class="mini-button__wii" aria-hidden="true"><Wii spec={wii} /></span>{/if}
  </span>
</button>
