<!--
  A7 · IconButton: a button with only an icon (components-v2.md § 2 › A7, with the 27 Nov comments). Its `label` is
  the accessible name, never drawn (also the tooltip with `tooltip`). `variant`: 'framed' (a rounded square on the press
  resource: it sinks onto its shadow and its 3D edge is the fill's own shade, never ink black, R2, #32) or 'bare' (the
  icon alone in its hit area: the icon itself travels when pressed, #33). `floating` (D189): a circle over content, the
  paper disc (the ✕ on a finalist). `color`: the frame's fill: 'surface' (the theme's surface, the default; its edge a
  darker shade of it), or a palette (navy, grey, red, gold, snow). `size`: s 44 / m 48 (the phone's floor). `pressed`
  for a toggle; `sound` (default the small button's). `trailing` (28 Nov): decorative content drawn after the icon, never
  part of the name (the card hint's card mark); a floating IconButton with it is a pill hugging the two.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Icon from '../icons/Icon.svelte';
  import type { IconName, UiSound } from './types.ts';
  import './icon-button.css';

  type Props = Omit<HTMLButtonAttributes, 'children' | 'class' | 'aria-pressed' | 'aria-label'> & {
    icon: IconName;
    /** The accessible name (required): never drawn. */
    label: string;
    /** Also show the label as the pointer's tooltip (`title`): the console, where a mouse may hover. */
    tooltip?: boolean;
    variant?: 'framed' | 'bare';
    floating?: boolean;
    color?: 'surface' | 'navy' | 'grey' | 'red' | 'gold' | 'snow';
    size?: 's' | 'm';
    pressed?: boolean;
    disabled?: boolean;
    sound?: UiSound | null;
    /** Decorative content after the icon (hidden from screen readers: `label` names the button). */
    trailing?: Snippet;
    class?: string;
    element?: HTMLButtonElement;
  };

  let {
    icon,
    label,
    tooltip = false,
    variant = 'framed',
    floating = false,
    color = floating ? 'snow' : 'surface',
    size = 'm',
    pressed = undefined,
    disabled = false,
    sound = 'small',
    trailing,
    class: className = '',
    element = $bindable(),
    type = 'button',
    ...rest
  }: Props = $props();

  const framed = $derived(variant === 'framed' || floating);
</script>

<button
  bind:this={element}
  {...rest}
  {type}
  class="icon-button {framed ? 'ds-pushable' : ''} {className}"
  data-variant={framed ? 'framed' : 'bare'}
  data-floating={floating || undefined}
  data-trailing={trailing ? '' : undefined}
  data-color={framed && color !== 'surface' ? color : undefined}
  data-size={size}
  data-touch={sound ?? 'none'}
  aria-label={label}
  title={tooltip ? label : undefined}
  aria-pressed={pressed}
  {disabled}
>
  <span class="icon-button__piece {framed ? 'ds-piece' : ''}"
    ><Icon name={icon} alone />{#if trailing}<span class="icon-button__trailing" aria-hidden="true">{@render trailing()}</span>{/if}</span
  >
</button>
