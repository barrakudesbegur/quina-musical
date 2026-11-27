<!--
  G1 · StickerTitle (components-v2.md § 8; sticker.css): an outlined Londrina title in capitals. Props: `text` (or the
  `children` snippet when a part keeps its case: wrap it in `.unit`, D114), `size` (the ramp), `color` (white | gold |
  live | mist | title), `tilt` (degrees), `fit` (one line), `as` (h1 | h2 | p). Real text, never an image.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { StickerTitleSize } from './types.ts';
  import './sticker.css';

  let {
    text = '',
    children,
    size = 'm',
    color = 'white',
    tilt = 0,
    fit = false,
    as = 'h2',
    class: className = '',
  }: {
    text?: string;
    children?: Snippet;
    size?: StickerTitleSize;
    color?: 'white' | 'gold' | 'live' | 'mist' | 'title';
    tilt?: number;
    fit?: boolean;
    as?: 'h1' | 'h2' | 'p' | 'span';
    class?: string;
  } = $props();
</script>

<svelte:element this={as} class="sticker-title {className}" data-size={size} data-color={color} data-fit={fit || undefined} style:--st-tilt={tilt ? `${tilt}deg` : undefined}>
  {#if children}{@render children()}{:else}{text}{/if}
</svelte:element>
