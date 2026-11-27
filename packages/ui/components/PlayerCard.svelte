<!--
  D1 · PlayerCard: one card a player follows, as the printed card in its identity colour (components-v2.md § 5): a
  frame, a header band in the card's colour (its mark, its name, «#123»), the grid under it. The phone only (its
  density's look lives in apps/player/player.css with the card's other rules; this file's own parts in
  player-card.css). A recipe: the player app's CardPanel maps a card's view onto these props.

  Props say what it draws: `identity` (1–10: its colour --card-color-N; 8 is the white card, 9 the black one),
  `name`, `number`, `showNumber`, `compact` (the header band alone, a resting row), `glow` (gold: your song, a win or
  a card just saved; green: a card standing), `sunk` (the seated look: lowered, tilted, veiled), and the header's count
  pill: `showRemaining` with `remaining` (the songs the card still needs; at 0 a rosette, «complete: claim it», #72)
  and `remainingLabel` (its accessible words). Slots: `mark` (the card's mark, data drawn by the app), `status` (the
  header's DEMPEUS / ASSEGUT pill, modelled like the count: #73, compact too), `perched` (the sitting nino on the
  header), `children` (the grid). Native attributes pass through to the root (the app's motion hooks).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import Icon from '../icons/Icon.svelte';
  import './player-card.css';

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'children'> {
    identity: number;
    name: string;
    number: string;
    showNumber?: boolean;
    compact?: boolean;
    glow?: 'gold' | 'green' | null;
    sunk?: boolean;
    showRemaining?: boolean;
    remaining?: number | null;
    remainingLabel?: string;
    /** The header's title element (h3 in a list of cards). */
    headingLevel?: 2 | 3 | 4;
    class?: string;
    mark?: Snippet;
    status?: Snippet;
    perched?: Snippet;
    children?: Snippet;
  }

  let {
    identity,
    name,
    number,
    showNumber = true,
    compact = false,
    glow = null,
    sunk = false,
    showRemaining = false,
    remaining = null,
    remainingLabel,
    headingLevel = 3,
    class: className = '',
    mark,
    status,
    perched,
    children,
    ...rest
  }: Props = $props();

  const counting = $derived(showRemaining && remaining !== null);
</script>

<div {...rest} class="player-card-wrap {className}" data-compact={compact || undefined} data-sunk={sunk || undefined}>
  {#if glow === 'green'}<div class="player-card__glow" aria-hidden="true"></div>{/if}
  <article class="player-card" class:is-glowing={glow === 'gold'} data-identity={identity} style:--card-color="var(--card-color-{identity})">
    <header class="player-card__header">
      {@render mark?.()}
      <svelte:element this={`h${headingLevel}`} class="player-card__title">
        <span class="player-card__name">{name}</span>
        {#if showNumber}<span class="player-card__number">{number}</span>{/if}
      </svelte:element>
      {@render perched?.()}
      {@render status?.()}
      {#if counting}
        <span
          class="player-card__count"
          data-done={remaining === 0 || undefined}
          role="img"
          aria-label={remainingLabel ?? String(remaining)}
        >{#if remaining === 0}<Icon name="rosette" alone />{:else}{remaining}{/if}</span>
      {/if}
    </header>
    {#if !compact}{@render children?.()}{/if}
    {#if sunk}<div class="player-card__veil" aria-hidden="true"></div>{/if}
  </article>
</div>
