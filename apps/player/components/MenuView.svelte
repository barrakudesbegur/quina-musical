<script lang="ts">
  // The menu (☰): the player's cards (icon, name and number, to rename or remove, and "Afegir cartró"), the
  // sounds switch, a note on last year's cards, privacy, and "Esborrar dades". Content only: App.svelte puts it
  // in a sheet, and it would sit in a drawer just the same. A card's sheets come back here when they close.
  import { PLAYER_CONFIG } from '../config.ts';
  import { markName } from '../logic/marks-identity.ts';
  import type { PlayerApp } from '../model.svelte.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import Swatch from './Swatch.svelte';

  let { app }: { app: PlayerApp } = $props();
</script>

<div class="menu">
  <section class="menu__cards" aria-labelledby="menu-cards">
    <h3 class="menu__heading" id="menu-cards">{S.myCards}</h3>
    {#if app.data.cards.length}
      <ul class="menu__card-list">
        {#each app.data.cards as card (card.id)}
          {@const who = card.name ?? S.markLabel(markName(card.color))}
          <li class="menu__card" style:--card-color="var(--card-color-{card.color})">
            <Swatch color={card.color} />
            <span class="menu__card-name">{who}</span>
            <span class="menu__card-number">{S.cardNumber(card.id)}</span>
            <button type="button" class="icon-button menu__card-edit" aria-label={S.editLabel(who)} onclick={() => app.open({ kind: 'rename', cardId: card.id, from: 'menu' })}>
              <Icon name="edit" />
            </button>
            <button type="button" class="icon-button menu__card-remove" aria-label={S.removeLabel(who)} onclick={() => app.open({ kind: 'remove', cardId: card.id, from: 'menu' })}>
              <Icon name="trash" />
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="menu__empty">{S.noCards}</p>
    {/if}
    {#if app.data.cards.length < PLAYER_CONFIG.maxCards}
      <button type="button" class="big-button tone-primary menu__add" onclick={() => app.open({ kind: 'pad', from: 'menu' })}><Icon name="plus" /> {S.addCard}</button>
    {/if}
  </section>

  <p class="menu__row">
    <Icon name={app.soundsOn ? 'sound' : 'mute'} />
    <span class="menu__label" id="menu-sounds">{S.soundsLabel}</span>
    <button type="button" class="menu__toggle" role="switch" aria-labelledby="menu-sounds" aria-checked={app.soundsOn} onclick={() => app.toggleSounds()}>
      <span class="menu__toggle-text">{app.soundsOn ? S.on : S.off}</span>
    </button>
  </p>

  <section class="menu__legacy" aria-labelledby="menu-legacy">
    <h3 class="menu__heading" id="menu-legacy">{S.legacyMenuTitle}</h3>
    <p class="menu__note">{S.legacyMenuText}</p>
  </section>

  <p class="menu__note">{S.privacy}</p>
  <button type="button" class="big-button tone-danger menu__wipe" onclick={() => app.open({ kind: 'wipe', from: 'menu' })}>{S.wipeData}</button>
</div>
