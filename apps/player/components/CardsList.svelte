<script lang="ts">
  // Cartrons: the player's cards that count in this round as grids, the others listed by name, and "Afegir
  // cartró". The cards simply scroll (the stacking scroll waits for the user). Naming and removing them is in the
  // menu. Cards never reorder, in the Desgraciat round too: people find their card by its place.
  import type { PlayerApp } from '../model.svelte.ts';
  import { PLAYER_CONFIG } from '../config.ts';
  import { standUpPlace } from '../logic/desgraciat.ts';
  import { roundRule } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import AddCardPrompt from './AddCardPrompt.svelte';
  import CardPanel from './CardPanel.svelte';
  import Icon from './Icon.svelte';
  import Swatch from './Swatch.svelte';

  let { app }: { app: PlayerApp } = $props();
  // The card just added (or the pad's "Veure'l") is ringed in gold, and scrolled to at once (no motion).
  let section: HTMLElement | undefined = $state();
  $effect(() => {
    if (app.highlightCard !== null) section?.querySelector('[data-highlight]')?.scrollIntoView({ block: 'center' });
  });
</script>

<section class="cards" bind:this={section}>
  <h2 class="cards__heading">{S.cardsTitle}</h2>
  {#if !app.data.cards.length}
    <AddCardPrompt onadd={() => app.open({ kind: 'pad' })} />
  {:else}
    {#if app.round && app.restingViews.length}
      {@const rule = roundRule(app.round, app.cardTypes)}
      <p class="cards__rule">{S.typeRule(rule.name)}</p>
    {/if}
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
      <button type="button" class="big-button tone-primary cards__add" aria-label={S.addCardLabel} onclick={() => app.open({ kind: 'pad' })}><Icon name="plus" /> {S.addCard}</button>
    {/if}
  {/if}
</section>
