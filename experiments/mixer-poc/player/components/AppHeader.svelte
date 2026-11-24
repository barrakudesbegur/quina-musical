<script lang="ts">
  // The top bar: where the show is ("Quina 3"), the sound switch and Help.
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
      {S.appTitle}
    {:else}
      <span class="app-header__round">{S.round(app.focusRound)}</span>
      {#if special}<span class="app-header__badge">{S.specialRound}</span>{/if}
    {/if}
  </h1>
  <div class="app-header__actions">
    <button
      type="button"
      class="icon-button app-header__sound"
      aria-pressed={app.soundsOn}
      aria-label={app.soundsOn ? S.soundOn : S.soundOff}
      onclick={() => app.toggleSounds()}
    >
      <Icon name={app.soundsOn ? 'sound' : 'mute'} />
    </button>
    <button type="button" class="icon-button app-header__help" aria-label={S.help} onclick={() => app.open({ kind: 'help' })}>
      <Icon name="help" />
    </button>
  </div>
</header>
