<script lang="ts">
  // The top bar: the edition's name (the plan's title) or where the show is ("Quina 3", "Quina Especial", "Quina Desgraciada"),
  // and Ajustos (D87): the player's cards, sounds, last year's card and "Esborrar dades" live in its drawer.
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
      <span class="app-header__round" data-kind={app.focusKind}>{S.roundName({ number: app.focusRound, kind: app.focusKind }, app.plan)}</span>
    {/if}
  </h1>
  <button type="button" class="icon-button app-header__menu" data-testid="open-settings" aria-label={S.settings} aria-haspopup="dialog" onclick={() => app.open({ kind: 'ajustos' })}>
    <Icon name="settings" />
  </button>
</header>
