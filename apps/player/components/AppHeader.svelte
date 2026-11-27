<script lang="ts">
  // The top bar: the edition's name (the plan's title) or where the show is ("Quina 3", "Quina Especial", "Quina del
  // Desgraciat"), and Ajustos (D87): the player's cards, sounds, last year's card and "Esborrar dades" live in its drawer.
  // A round with a short name (the Desgraciat's «Desgraciat», D251) renders both: the title's container query shows the
  // short one when the full one doesn't fit beside the cog, and the full one stays the heading's text for screen readers.
  import type { PlayerApp } from '../model.svelte.ts';
  import { S } from '../strings.ts';
  import IconButton from '../../../packages/ui/components/IconButton.svelte';
  import { PLAYER_ICONS } from '../actions.ts';

  let { app }: { app: PlayerApp } = $props();
</script>

<header class="app-header">
  <h1 class="app-header__title">
    {#if app.scene === 'before' || app.scene === 'after' || app.focusRound === null}
      {app.plan?.title || S.appTitle}
    {:else}
      {@const round = { number: app.focusRound, kind: app.focusKind }}
      {@const full = S.roundName(round, app.plan)}
      {@const short = S.roundShort(round, app.plan)}
      <span class="app-header__round" data-kind={app.focusKind}>
        <span class="app-header__round-full">{full}</span>
        {#if short !== full}<span class="app-header__round-short" aria-hidden="true">{short}</span>{/if}
      </span>
    {/if}
  </h1>
  <!-- On the your-song gold the cog sits on paper, as the corners do (§8 Y1). -->
  <IconButton {...PLAYER_ICONS.settings} color={app.yourSong ? 'snow' : undefined} class="app-header__menu" data-testid="open-settings" aria-haspopup="dialog" onclick={() => app.open({ kind: 'ajustos' })} />
</header>
