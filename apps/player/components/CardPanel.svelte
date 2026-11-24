<script lang="ts">
  // One of the player's cards: its icon (the card's identity), its name, its number ("#123") and the grid. Cards are
  // named by icon and name, never only by number. Naming and removing them is in the menu. `glow` rings it in its
  // own colour (the player's own confirmed win).
  // In the Desgraciat round (ANIMATIONS.md › The Desgraciat round › Player app) a playing card stands, with a green
  // DEMPEUS badge and a static green outline and glow, or sits: the ASSEGUT badge, a grey veil (an overlay's
  // opacity, never a filter), a slight drop and tilt, and the sitting nino on its header beside the badge (never
  // over the number). `fall` (its place in the 120 ms stagger) runs `card-fall` as it sits down; `standUp` (its
  // place in the 80 ms stagger) runs `stand-up` as the round starts.
  import { songTitle, type Catalog } from '../../../packages/ui/data/catalog.ts';
  import { PLAYER_CONFIG } from '../config.ts';
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
    fall = null,
    standUp = null,
  }: {
    view: CardView;
    catalog: Catalog | null;
    catalogFailed: boolean;
    fresh: ReadonlySet<string>;
    stagger: number;
    glow?: boolean;
    /** Falling right now: its place among the cards falling on this landing. */
    fall?: number | null;
    /** Standing up right now (the round just started): its place among the playing cards. */
    standUp?: number | null;
  } = $props();
  const stand = $derived(view.stand);
  const seated = $derived(Boolean(stand?.fall));
  const falling = $derived(seated && fall !== null);
  const standing = $derived(Boolean(stand && !seated));
  const anim = $derived(falling ? 'card-fall' : standing && standUp !== null ? 'stand-up' : undefined);
  const fallDelay = $derived(falling ? (fall ?? 0) * PLAYER_CONFIG.fallStaggerMs : 0);
</script>

<div
  class="player-card-wrap"
  data-stand={stand ? (seated ? 'seated' : 'standing') : undefined}
  data-fell-on={stand?.fall?.songId}
  data-anim={anim}
  style:--fall-delay="{fallDelay}ms"
  style:--stand-delay="{(standUp ?? 0) * PLAYER_CONFIG.standUpStaggerMs}ms"
>
  {#if standing || falling}<div class="player-card__glow" aria-hidden="true"></div>{/if}
  <article class="player-card" class:is-glowing={glow} data-color={view.saved.color} data-type={view.card?.type ?? 'unknown'} style:--card-color="var(--card-color-{view.saved.color})">
    <header class="player-card__header">
      <Swatch color={view.saved.color} />
      <h3 class="player-card__title">
        <span class="player-card__name">{view.saved.name ?? S.markLabel(markName(view.saved.color))}</span>
        <span class="player-card__number">{S.cardNumber(view.saved.id)}</span>
      </h3>
      {#if stand}
        <!-- The sitting nino's place, kept beside the badge so it never lands on the card number. -->
        <span class="player-card__nino-slot" aria-hidden="true">{#if seated}<span class="player-card__nino"></span>{/if}</span>
        <span class="player-card__stand">
          {#if falling}<span class="stand-badge stand-badge--out" data-state="standing" aria-hidden="true">{S.stand.standing}</span>{/if}
          {#if stand.fall}
            <span class="stand-badge" data-state="seated" role="img" aria-label={S.sankBy(songTitle(catalog, stand.fall.songId))}>{S.stand.seated}</span>
          {:else}
            <span class="stand-badge" data-state="standing">{S.stand.standing}</span>
          {/if}
        </span>
      {/if}
    </header>
    {#if view.card}
      <CardGrid
        card={view.card}
        identity={view.saved.color}
        marks={view.marks}
        near={view.near}
        crosses={stand !== null}
        {catalog}
        {fresh}
        stagger={falling ? fallDelay : stagger}
      />
    {:else if catalog}
      <p class="player-card__missing">{S.unknownCard}</p>
    {:else}
      <p class="player-card__loading">{catalogFailed ? S.catalogError : S.loadingCards}</p>
    {/if}
    {#if seated}<div class="player-card__veil" aria-hidden="true"></div>{/if}
  </article>
</div>
