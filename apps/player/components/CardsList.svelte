<script lang="ts">
  // Cartrons: the player's cards that count in this round as grids, then the others listed by name. The cards simply
  // scroll (the stacking scroll waits for the user). «+ Cartró» floats over the home (AraHome, D218); with no cards the
  // empty view keeps its own. Naming and removing cards is in the menu. Cards never reorder, in the Desgraciat round
  // too: people find their card by its place.
  // `end` is the list's last spot, where «+ Cartró» used to be: kept for «Instal·la l'app» (D221, the PWA's work stream
  // W), which shows there once the floating «+ Cartró» has taken over and the phone can install. Nothing fills it yet.
  import type { Snippet } from 'svelte';
  import type { PlayerApp } from '../model.svelte.ts';
  import { PLAYER_CONFIG } from '../config.ts';
  import { standUpPlace } from '../logic/desgraciat.ts';
  import { S } from '../strings.ts';
  import AddCardPrompt from './AddCardPrompt.svelte';
  import CardPanel from './CardPanel.svelte';
  import Swatch from './Swatch.svelte';

  let { app, active = true, end }: { app: PlayerApp; /** The view is the one shown (AraHome). */ active?: boolean; end?: Snippet } = $props();
  // The card just added (or the pad's "Veure'l") is ringed in gold, and scrolled to at once (no motion) once this view
  // is the one shown (after the home has set the view's own scroll, so the card wins).
  let section: HTMLElement | undefined = $state();
  // The song playing now (#74): the latest landing, while the round plays (not during a Check or a pause).
  const playingSong = $derived(app.scene === 'play' && !app.paused ? (app.latest?.songId ?? null) : null);
  $effect(() => {
    if (app.highlightCard === null || !active) return;
    const raf = requestAnimationFrame(() => section?.querySelector('[data-highlight]')?.scrollIntoView({ block: 'center' }));
    return () => cancelAnimationFrame(raf);
  });
</script>

<section class="cards" bind:this={section}>
  <h2 class="cards__heading">{S.cardsTitle}</h2>
  {#if !app.data.cards.length}
    <AddCardPrompt onadd={() => app.open({ kind: 'pad' })} />
  {:else}
    <ul class="cards__list">
      {#each app.playingViews as view, i (view.saved.id)}
        <li class="cards__item" data-highlight={app.highlightCard === view.saved.id ? 'true' : undefined}>
          <CardPanel
            {view}
            catalog={app.catalog}
            catalogFailed={app.catalogFailed}
            fresh={app.freshMarks}
            stagger={i * PLAYER_CONFIG.markStaggerMs}
            fall={app.falls.get(view.saved.id) ?? null}
            standUp={standUpPlace(i, app.standUp)}
            playing={playingSong}
          />
        </li>
      {/each}
    </ul>
    {#if app.restingViews.length}
      <section class="cards__resting">
        <h3 class="cards__subheading">{S.notPlaying}</h3>
        <ul class="cards__resting-list">
          {#each app.restingViews as view (view.saved.id)}
            <li class="cards__resting-item" data-highlight={app.highlightCard === view.saved.id ? 'true' : undefined} style:--card-color="var(--card-color-{view.saved.color})">
              <Swatch color={view.saved.color} />
              <span class="cards__resting-label">{view.saved.name ? `${view.saved.name} · ` : ''}{S.cardNumber(view.saved.id)}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
    {#if end}<div class="cards__end">{@render end()}</div>{/if}
  {/if}
</section>
