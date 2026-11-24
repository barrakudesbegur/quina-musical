<script lang="ts">
  // One of the player's cards: its icon (the card's identity), its name, its number ("#123") and the grid. Cards are
  // named by icon and name, never only by number. Naming and removing them is in the menu. `glow` rings it in its
  // own colour (the player's own confirmed win).
  import type { Catalog } from '../../../packages/ui/data/catalog.ts';
  import type { CardView } from '../logic/view.ts';
  import { markName } from '../logic/marks-identity.ts';
  import { S } from '../strings.ts';
  import CardGrid from './CardGrid.svelte';
  import Swatch from './Swatch.svelte';

  let {
    view,
    catalog,
    catalogFailed,
    fresh,
    stagger,
    glow = false,
  }: {
    view: CardView;
    catalog: Catalog | null;
    catalogFailed: boolean;
    fresh: ReadonlySet<string>;
    stagger: number;
    glow?: boolean;
  } = $props();
</script>

<article class="player-card" class:is-glowing={glow} data-color={view.saved.color} data-type={view.card?.type ?? 'unknown'} style:--card-color="var(--card-color-{view.saved.color})">
  <header class="player-card__header">
    <Swatch color={view.saved.color} />
    <h3 class="player-card__title">
      <span class="player-card__name">{view.saved.name ?? S.markLabel(markName(view.saved.color))}</span>
      <span class="player-card__number">{S.cardNumber(view.saved.id)}</span>
    </h3>
  </header>
  {#if view.card}
    <CardGrid card={view.card} identity={view.saved.color} marks={view.marks} near={view.near} {catalog} {fresh} {stagger} />
  {:else if catalog}
    <p class="player-card__missing">{S.unknownCard}</p>
  {:else}
    <p class="player-card__loading">{catalogFailed ? S.catalogError : S.loadingCards}</p>
  {/if}
</article>
