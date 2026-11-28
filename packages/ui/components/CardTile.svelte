<!--
  D7 · CardTile: a card drawn small, as a tile the player taps to open the whole card (components-v2.md § 5, D289: the
  phone's collapsed cards, option A; boards Mobil-Plegats-*). A frame in the printed card's paper, a header band in
  the card's colour (its mark, its name, the count), and under it a map of the card's songs, 4 × 3, edge to edge with
  the same margin on every side: an empty cell, or a marked one in a pale of the card's colour with the card's mark on
  it; a cell can carry CardCell's running dashes (the song playing now). The phone only.

  Props say what it draws: `identity` (1–10: --card-color-N), `label` (the header's words: a name, or «#57»), `cells`
  (the map, row by row: `marked`, `ring`), `columns` (4), the count badge (`count`, its accessible `countLabel`,
  `countColor` paper or orange; at 0 the rosette alone, as a sticker), `stamp` (a big word that takes the map's place
  in the same footprint, «LÍNIA!», «QUINA!»: gold with rays, as the Celebration's), `stripes` (the header pans R3's
  stripes), `glow` (`own`: in the card's own colour; `gold`: the card just added), `compact` (the header band alone,
  not a button: a card that rests this round). Slots: `mark` (the header's mark, data), `cellMark` (what a marked
  cell shows, given its index: the app's CardMark). Native attributes pass through to the root (a <button>, or a <div>
  when compact): its accessible name, `onclick`, the app's motion hooks.
  Motion (ANIMATIONS.md `collapsed-grid`, `line-card`, `quina-card`): the stamp pops in over the map (the map folds
  away) and leaves the reverse way; the press is R4's.
-->
<script lang="ts" module>
  /** One song of the map. */
  export interface TileCell {
    /** It has landed: the card's mark on a pale of its colour. */
    marked: boolean;
    /** CardCell's running dashes round it (the song playing now). */
    ring: boolean;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import Icon from '../icons/Icon.svelte';
  import './card-tile.css';

  interface Props extends Omit<HTMLAttributes<HTMLElement>, 'class' | 'children'> {
    identity: number;
    label: string;
    cells?: readonly TileCell[];
    columns?: number;
    count?: number | null;
    countLabel?: string;
    countColor?: 'paper' | 'orange';
    stamp?: string | null;
    stripes?: boolean;
    glow?: 'own' | 'gold' | null;
    compact?: boolean;
    class?: string;
    mark?: Snippet;
    cellMark?: Snippet<[number]>;
  }

  let {
    identity,
    label,
    cells = [],
    columns = 4,
    count = null,
    countLabel,
    countColor = 'paper',
    stamp = null,
    stripes = false,
    glow = null,
    compact = false,
    class: className = '',
    mark,
    cellMark,
    ...rest
  }: Props = $props();

  /** The word shown last, kept while the stamp leaves (it fades out with its word). */
  let word = $state<string | null>(null);
  $effect.pre(() => {
    if (stamp) word = stamp;
  });
</script>

<svelte:element
  this={compact ? 'div' : 'button'}
  {...rest}
  type={compact ? undefined : 'button'}
  data-touch={compact ? undefined : 'big'}
  class="card-tile {compact ? '' : 'ds-pushable'} {className}"
  data-compact={compact || undefined}
  data-identity={identity}
  data-glow={glow ?? undefined}
  data-stamped={stamp ? 'true' : undefined}
  style:--card-color="var(--card-color-{identity})"
>
  {#if glow}<span class="card-tile__glow" aria-hidden="true"></span>{/if}
  <span class="card-tile__piece {compact ? '' : 'ds-piece'}">
    <span class="card-tile__header">
      {#if stripes}<span class="ds-pattern" data-pattern="stripes" aria-hidden="true"></span>{/if}
      {@render mark?.()}
      <span class="card-tile__label">{label}</span>
      {#if count !== null && !compact}
        <span
          class="card-tile__count"
          data-icon-only={count === 0 || undefined}
          data-color={countColor === 'paper' ? undefined : countColor}
          role="img"
          aria-label={countLabel ?? String(count)}
        >{#if count === 0}<Icon name="rosette" alone />{:else}{count}{/if}</span>
      {/if}
    </span>
    {#if !compact}
      <span class="card-tile__body">
        <span class="card-tile__map" style:--tile-columns={columns} aria-hidden="true">
          {#each cells as cell, i (i)}
            <span class="card-tile__cell" data-marked={cell.marked || undefined} data-ring={cell.ring || undefined}>
              {#if cell.marked}{@render cellMark?.(i)}{/if}
              {#if cell.ring}
                <svg class="card-tile__ring" aria-hidden="true" focusable="false"><rect x="0" y="0" width="100%" height="100%" pathLength="100" /></svg>
              {/if}
            </span>
          {/each}
        </span>
        <span class="card-tile__stamp" aria-hidden={stamp ? undefined : 'true'} role={stamp ? 'img' : undefined} aria-label={stamp ?? undefined}>
          <span class="card-tile__rays" aria-hidden="true"></span>
          <span class="card-tile__word" aria-hidden="true">{word}</span>
        </span>
      </span>
    {/if}
  </span>
</svelte:element>
