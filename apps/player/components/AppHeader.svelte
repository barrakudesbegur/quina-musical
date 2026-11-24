<script lang="ts">
  // The top bar: the edition's name (the plan's title) or where the show is ("Quina 3"), and the menu (☰): the
  // player's cards, sounds, last year's cards and "Esborrar dades" live there.
  import type { PlayerApp } from '../model.svelte.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  let { app }: { app: PlayerApp } = $props();
  const special = $derived(
    (app.state?.intro?.kind ?? (app.focusRound === app.round?.number ? app.round?.kind : null) ?? app.plan?.rounds.find((r) => r.number === app.focusRound)?.kind) === 'special',
  );
</script>

<header class="app-header">
  <h1 class="app-header__title">
    {#if app.scene === 'before' || app.scene === 'after' || app.focusRound === null}
      {app.plan?.title || S.appTitle}
    {:else}
      <span class="app-header__round">{S.round(app.focusRound)}</span>
      {#if special}<span class="app-header__badge">{S.specialRound}</span>{/if}
    {/if}
  </h1>
  <button type="button" class="icon-button app-header__menu" aria-label={S.menu} aria-haspopup="dialog" onclick={() => app.open({ kind: 'menu' })}>
    <Icon name="menu" />
  </button>
</header>
