<!--
  E6 · PriceTag (components-v2.md § 6; price-tag.css): the card price, only for the coming round (D61). Props: `amount`
  (the formatted price, «10,50 €», or «— €» while unknown), `variant` ('tag' | 'line'), `color` (the palette, gold).
  Real text; the owner names it with the card type beside it («Cartró normal: 10,50 €»).
-->
<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  import type { PaletteColor } from './types.ts';
  import './price-tag.css';

  let {
    amount,
    variant = 'tag',
    color = 'gold',
    class: className = '',
    ...rest
  }: Omit<HTMLAttributes<HTMLParagraphElement>, 'class'> & { amount: string; variant?: 'tag' | 'line'; color?: Extract<PaletteColor, 'gold' | 'orange'>; class?: string } = $props();
</script>

<p class="price-tag {className}" data-variant={variant} data-color={color} {...rest}>{amount}</p>
