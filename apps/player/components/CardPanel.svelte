<script lang="ts">
  // One of the player's cards: its icon (the card's identity), its name, its number small, the grid, and its
  // edit and remove buttons. Cards are named by icon and name, never only by number.
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
    onrename,
    onremove,
  }: {
    view: CardView;
    catalog: Catalog | null;
    catalogFailed: boolean;
    fresh: ReadonlySet<string>;
    stagger: number;
    onrename: () => void;
    onremove: () => void;
  } = $props();
</script>

<article class="player-card" data-color={view.saved.color} data-type={view.card?.type ?? 'unknown'} style:--card-color="var(--card-color-{view.saved.color})">
  <header class="player-card__header">
    <Swatch color={view.saved.color} />
    <h3 class="player-card__title">
      <span class="player-card__name">{view.saved.name ?? S.markLabel(markName(view.saved.color))}</span>
      <span class="player-card__number">{S.cardNumber(view.saved.id)}</span>
    </h3>
    <div class="player-card__actions">
      <button type="button" class="player-card__rename" onclick={onrename}>{S.rename}</button>
      <button type="button" class="player-card__remove" onclick={onremove}>{S.remove}</button>
    </div>
  </header>
  {#if view.card}
    <CardGrid card={view.card} identity={view.saved.color} marks={view.marks} near={view.near} {catalog} {fresh} {stagger} />
  {:else if catalog}
    <p class="player-card__missing">{S.unknownCard}</p>
  {:else}
    <p class="player-card__loading">{catalogFailed ? S.catalogError : S.loadingCards}</p>
  {/if}
</article>
