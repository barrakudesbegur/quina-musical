<script lang="ts">
  // Cartrons: the player's cards that count in this round as grids; the others listed so they can be managed.
  import type { PlayerApp } from '../model.svelte.ts';
  import { PLAYER_CONFIG } from '../config.ts';
  import { roundRule } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import AddCardPrompt from './AddCardPrompt.svelte';
  import CardPanel from './CardPanel.svelte';
  import Icon from './Icon.svelte';
  import Swatch from './Swatch.svelte';

  let { app }: { app: PlayerApp } = $props();
</script>

<section class="cards">
  <h2 class="cards__heading">{S.cardsTitle}</h2>
  {#if !app.data.cards.length}
    <AddCardPrompt onadd={() => app.open({ kind: 'pad' })} />
  {:else}
    {#if app.round && app.restingViews.length}
      {@const rule = roundRule(app.round, app.cardTypes)}
      <p class="cards__rule">{rule.kind === 'type' ? S.typeRule(rule.name) : rule.kind === 'special' ? S.specialRule : S.normalRule}</p>
    {/if}
    <ul class="cards__list">
      {#each app.playingViews as view, i (view.saved.id)}
        <li class="cards__item">
          <CardPanel
            {view}
            catalog={app.catalog}
            catalogFailed={app.catalogFailed}
            fresh={app.freshMarks}
            stagger={i * PLAYER_CONFIG.markStaggerMs}
            onrename={() => app.open({ kind: 'rename', cardId: view.saved.id })}
            onremove={() => app.open({ kind: 'remove', cardId: view.saved.id })}
          />
        </li>
      {/each}
    </ul>
    {#if app.restingViews.length}
      <section class="cards__resting">
        <h3 class="cards__subheading">{S.notPlaying}</h3>
        <ul class="cards__resting-list">
          {#each app.restingViews as view (view.saved.id)}
            <li class="cards__resting-item" style:--card-color="var(--card-color-{view.saved.color})">
              <Swatch color={view.saved.color} />
              <span class="cards__resting-label">{view.saved.name ? `${view.saved.name} · ` : ''}{S.card(view.saved.id)}</span>
              <button type="button" onclick={() => app.open({ kind: 'rename', cardId: view.saved.id })}>{S.rename}</button>
              <button type="button" onclick={() => app.open({ kind: 'remove', cardId: view.saved.id })}>{S.remove}</button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
    {#if app.data.cards.length < PLAYER_CONFIG.maxCards}
      <button type="button" class="big-button tone-primary cards__add" onclick={() => app.open({ kind: 'pad' })}><Icon name="plus" /> {S.addCard}</button>
    {/if}
  {/if}
</section>
