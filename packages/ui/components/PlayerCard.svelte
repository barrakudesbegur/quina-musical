<!--
  D1 · PlayerCard: one card a player follows, as the printed card in its identity colour (components-v2.md § 5): a
  frame, a header band in the card's colour (its mark, its name, «#123»), the grid under it. The phone only (its
  density's look lives in apps/player/player.css with the card's other rules; this file's own parts in
  player-card.css). A recipe: the player app's CardPanel maps a card's view onto these props.

  Props say what it draws: `identity` (1–10: its colour --card-color-N; 8 is the white card, 9 the black one),
  `name`, `number`, `showNumber`, `compact` (the header band alone, a resting row), `glow` (gold: your song, a win or
  a card just saved; green: a card standing), `sunk` (the seated look: lowered, tilted, veiled), and the header's count
  pill: `showRemaining` with `remaining` (the songs the card still needs; at 0 a rosette, «complete: claim it», #72, in a
  full circle: an icon alone is never a pill)
  and `remainingLabel` (its accessible words), `countColor` (the pill's fill: paper, or orange with white figures) and
  `countRing` (`running`: CardCell's dashes run round the pill; 27 Nov, §8 Y1: the card holding the song playing now
  keeps its count and gets attention). Slots: `mark` (the card's mark, data drawn by the app), `status` (the
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
    /** The player's own name for the card; empty or null shows the number alone (never a generated name). */
    name: string | null;
    number: string;
    showNumber?: boolean;
    compact?: boolean;
    glow?: 'gold' | 'green' | null;
    sunk?: boolean;
    showRemaining?: boolean;
    remaining?: number | null;
    remainingLabel?: string;
    /** The count pill's fill. */
    countColor?: 'paper' | 'orange';
    /** A ring round the count pill: `running`, CardCell's orange dashes going round. */
    countRing?: 'running' | null;
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
    countColor = 'paper',
    countRing = null,
    headingLevel = 3,
    class: className = '',
    mark,
    status,
    perched,
    children,
    ...rest
  }: Props = $props();

  const counting = $derived(showRemaining && remaining !== null);
  /** The pill holds only an icon (the rosette at 0): it is a full circle then, never a pill (the user's canvas comment). */
  const iconOnly = $derived(remaining === 0);
</script>

<div {...rest} class="player-card-wrap {className}" data-compact={compact || undefined} data-sunk={sunk || undefined}>
  {#if glow === 'green'}<div class="player-card__glow" aria-hidden="true"></div>{/if}
  <article class="player-card" class:is-glowing={glow === 'gold'} data-identity={identity} style:--card-color="var(--card-color-{identity})">
    <header class="player-card__header">
      {@render mark?.()}
      <svelte:element this={`h${headingLevel}`} class="player-card__title">
        {#if name}<span class="player-card__name">{name}</span>{/if}
        {#if showNumber}<span class="player-card__number">{number}</span>{/if}
      </svelte:element>
      {@render perched?.()}
      {@render status?.()}
      {#if counting}
        <span
          class="player-card__count"
          data-done={remaining === 0 || undefined}
          data-icon-only={iconOnly || undefined}
          data-color={countColor === 'paper' ? undefined : countColor}
          role="img"
          aria-label={remainingLabel ?? String(remaining)}
        >{#if remaining === 0}<Icon name="rosette" alone />{:else}{remaining}{/if}{#if countRing}<svg class="player-card__count-ring" data-ring-style={countRing} aria-hidden="true" focusable="false"><rect x="0" y="0" width="100%" height="100%" pathLength="100" /></svg>{/if}</span>
      {/if}
    </header>
    {#if !compact}{@render children?.()}{/if}
    {#if sunk}<div class="player-card__veil" aria-hidden="true"></div>{/if}
  </article>
</div>
