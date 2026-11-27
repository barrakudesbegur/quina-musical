<!--
  A5 · CornerButton: one of the phone's two corner discs, «Premis» (bottom left) and «Horari» (bottom right), each
  opening its drawer (components-v2.md § 2 › A5). Always floating (D189), so round; a quarter of the disc shows in the
  screen's corner (style B, D87: the paper disc at 80 % with the home blurred behind it). Props: `side` (which corner,
  and so which quarter shows), `label` (visible: the name), `icon` (a sticker icon by its drawing: `gift`,
  `alarm-clock`), `expanded` (its drawer is open: aria-expanded), `sound` (the corner's). It opens a dialog, so the
  page's touch delegate plays no release (drawer-open's sound takes its place). No `hidden` prop (D-b): the home
  leaves it out with {#if} (during a Celebration, open choice 16).
  Its press is `corner-press` (ANIMATIONS.md): the disc dips and springs back with --ease-kick, the sticker tilts 4°
  further. Placement: fixed to its corner of the page's column (`--corner-button-column`, the full width by default),
  centred on it; `--corner-button-size` is the disc (13rem).
-->
<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import StickerIcon, { type StickerIconName } from '../icons/StickerIcon.svelte';
  import type { UiSound } from './types.ts';
  import './corner-button.css';

  type Props = Omit<HTMLButtonAttributes, 'children' | 'class'> & {
    side: 'left' | 'right';
    label: string;
    icon: StickerIconName;
    expanded?: boolean;
    sound?: UiSound | null;
    class?: string;
  };

  let { side, label, icon, expanded = false, sound = 'corner', class: className = '', ...rest }: Props = $props();
</script>

<button
  {...rest}
  type="button"
  class="corner-button {className}"
  data-side={side}
  data-anim="corner-press"
  data-touch={sound ?? 'none'}
  aria-haspopup="dialog"
  aria-expanded={expanded}
>
  <span class="corner-button__in"><StickerIcon name={icon} /><span class="corner-button__label">{label}</span></span>
</button>
