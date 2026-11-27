<!--
  G2 · Plate (components-v2.md § 8; sticker.css): a sticker plate carrying a short label drawn as a StickerTitle.
  Props: `color` (gold | orange | slate | periwinkle | live | snow | red; which plate is which colour is § 11's table:
  gold is always the round's name, orange only «CARTRÓ #57», U175 item 7), `size` (the title's ramp step), `tilt`,
  `icon` (before the label: the review's magnifier), `label`, `as`.
-->
<script lang="ts">
  import Icon from '../icons/Icon.svelte';
  import StickerTitle from './StickerTitle.svelte';
  import type { IconName, PlateColor } from './types.ts';
  import './sticker.css';

  let {
    color = 'gold',
    size = 'xs',
    tilt = 0,
    icon = null,
    label,
    as = 'p',
    class: className = '',
  }: {
    color?: PlateColor;
    size?: 'xl' | 'l' | 'm' | 's' | 'xs';
    tilt?: number;
    icon?: IconName | null;
    label: string;
    as?: 'p' | 'h1' | 'h2' | 'div';
    class?: string;
  } = $props();
</script>

<svelte:element this={as} class="plate {className}" data-color={color} style:--plate-tilt={tilt ? `${tilt}deg` : undefined}>
  {#if icon}<span class="plate__icon" aria-hidden="true"><Icon name={icon} alone /></span>{/if}
  <StickerTitle as="span" {size} text={label} />
</svelte:element>
