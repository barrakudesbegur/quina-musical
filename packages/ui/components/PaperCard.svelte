<!--
  C2 · PaperCard: a piece of paper on the night ground (components-v2.md § 4, with the 27 Nov comments' D-o, D-p).
  Props say what it draws: `layout` ('ticket' | 'hero' | 'row'), `ribbon` (the chip over its top edge, in a palette
  colour), `ring` (R1's ring round it). Slots: `children` (the paper), `tail` (a second piece after a perforation:
  the ticket's punched holes are cut by a CSS mask, D-o). The game's recipes fill it: Ticket and PrizeCard
  (packages/ui/recipes). It's an <article>; its `aria-label` (passed through) names it.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { PaletteColor } from './types.ts';
  import './paper-card.css';

  type Props = Omit<HTMLAttributes<HTMLElement>, 'children' | 'class'> & {
    layout?: 'ticket' | 'hero' | 'row';
    ribbon?: { label: string; color: PaletteColor } | null;
    ring?: 'gold' | null;
    class?: string;
    children: Snippet;
    tail?: Snippet;
  };

  let { layout = 'ticket', ribbon = null, ring = null, class: className = '', children, tail, ...rest }: Props = $props();
</script>

<article {...rest} class="paper-card {className}" data-layout={layout} data-ring={ring ?? undefined}>
  {#if ribbon}<span class="paper-card__ribbon" data-color={ribbon.color}>{ribbon.label}</span>{/if}
  <div class="paper-card__paper">
    <div class="paper-card__part">{@render children()}</div>
    {#if tail}<div class="paper-card__part">{@render tail()}</div>{/if}
  </div>
</article>
