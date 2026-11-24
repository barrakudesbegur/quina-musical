<script lang="ts">
  // The top bar: the edition's name (the plan's title) or where the show is ("Quina 3", or "Quina Desgraciada"),
  // and the menu (☰): the player's cards, sounds, last year's cards and "Esborrar dades" live there.
  import type { PlayerApp } from '../model.svelte.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  let { app }: { app: PlayerApp } = $props();
</script>

<header class="app-header">
  <h1 class="app-header__title">
    {#if app.scene === 'before' || app.scene === 'after' || app.focusRound === null}
      {app.plan?.title || S.appTitle}
    {:else}
      <span class="app-header__round" data-kind={app.focusKind}>{S.roundName(app.focusRound, app.focusKind)}</span>
      {#if app.focusKind === 'special'}<span class="app-header__badge">{S.specialRound}</span>{/if}
    {/if}
  </h1>
  <button type="button" class="icon-button app-header__menu" aria-label={S.menu} aria-haspopup="dialog" onclick={() => app.open({ kind: 'menu' })}>
    <Icon name="menu" />
  </button>
</header>
