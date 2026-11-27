<script lang="ts">
  import Button from '../../../packages/ui/components/Button.svelte';
  import { PLAYER } from '../actions.ts';
  // Cartrons: the player's cards that count in this round as grids, the others listed by name, and "Afegir
  // cartró". The cards simply scroll (the stacking scroll waits for the user). Naming and removing them is in the
  // menu. Cards never reorder, in the Desgraciat round too: people find their card by its place.
  import type { PlayerApp } from '../model.svelte.ts';
  import { PLAYER_CONFIG } from '../config.ts';
  import { standUpPlace } from '../logic/desgraciat.ts';
  import { S } from '../strings.ts';
  import AddCardPrompt from './AddCardPrompt.svelte';
  import CardPanel from './CardPanel.svelte';
  import Swatch from './Swatch.svelte';

  let { app }: { app: PlayerApp } = $props();
  // The card just added (or the pad's "Veure'l") is ringed in gold, and scrolled to at once (no motion).
  let section: HTMLElement | undefined = $state();
  // The song playing now (#74): the latest landing, while the round plays (not during a Check or a pause).
  const playingSong = $derived(app.scene === 'play' && !app.paused ? (app.latest?.songId ?? null) : null);
  $effect(() => {
    if (app.highlightCard !== null) section?.querySelector('[data-highlight]')?.scrollIntoView({ block: 'center' });
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
    {#if app.data.cards.length < PLAYER_CONFIG.maxCards}
      <Button {...PLAYER.addCard} class="cards__add" sound="floating" aria-label={S.addCardLabel} aria-haspopup="dialog" onclick={() => app.open({ kind: 'pad' })} />
    {/if}
  {/if}
</section>
