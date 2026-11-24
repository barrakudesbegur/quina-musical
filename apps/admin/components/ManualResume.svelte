<!-- Plan B (ADR 0003): resume the show on this laptop or a replacement one.
     - Anywhere: type the resume code (the tablet keeps the latest; presenters may have it on paper). Preview the
       last counted song, confirm, and send `resumeAt`. The engine checks the song and refuses a wrong code.
     - Served from the cloud: also pick one of the cloud's Games, and the laptop takes it over when it connects. -->
<script lang="ts">
  import { formatResumeToken, sceneAllows } from '@quina/protocol';
  import type { ShowStore } from '../../../packages/ui/client/show.svelte.ts';
  import { songTitle, type Catalog } from '../../../packages/ui/data/catalog.ts';
  import type { FetchLike } from '../../../packages/ui/data/cloud-plan.ts';
  import { CA } from '../../../packages/ui/i18n/ca.ts';
  import { formatClock } from '../../../packages/rules/time.ts';
  import { readResume, resumeCommand, resumeSummary } from '../../../packages/rules/resume.ts';
  import { fetchGames, resumeGame, type CloudGame } from '../data/cloud-games.ts';
  import type { CommandTracker } from '../state/commands.svelte.ts';
  import { S } from '../strings.ts';
  import CommandStatus from './CommandStatus.svelte';

  let { show, commands, catalog, cloud }: { show: ShowStore; commands: CommandTracker; catalog: Catalog | null; cloud: boolean } = $props();

  const uid = $props.id();
  let draft = $state('');
  let asking = $state(false);
  const parsed = $derived(readResume(draft));
  const summary = $derived(parsed.point ? resumeSummary(parsed.point) : null);
  const roundName = $derived(summary ? `${CA.round(summary.round)}${summary.special ? ` · ${CA.specialRound}` : ''}` : '');
  const flow = $derived(show.flow);
  const allowed = $derived(
    sceneAllows('resumeAt', {
      scene: flow.scene,
      celebrating: flow.scene === 'celebration' ? (flow.celebration?.kind ?? null) : null,
      introduced: flow.scene === 'roundStart' && flow.intro !== null,
      paused: flow.pause !== null,
    }),
  );

  function send(): void {
    if (!parsed.point) return;
    commands.send('resumeAt', null, resumeCommand(parsed.point));
    asking = false;
  }

  // ---- the cloud's Games (only when Admin is served from the cloud) ----
  const fetchImpl: FetchLike = (input, init) => fetch(input, { ...init, credentials: 'same-origin' });
  let games = $state.raw<CloudGame[] | null>(null);
  let gamesError = $state(false);
  let revealed = $state<string | null>(null);
  let outcome = $state<{ gameId: string; text: string } | null>(null);

  async function loadGames(): Promise<void> {
    gamesError = false;
    const r = await fetchGames(fetchImpl);
    if (r.ok) games = r.games;
    else gamesError = true;
  }

  async function useGame(gameId: string): Promise<void> {
    const r = await resumeGame(fetchImpl, gameId);
    outcome = { gameId, text: r.ok ? (r.laptopOnline ? S.night.cloudDone : S.night.cloudWaiting) : S.night.cloudFailed(r.status) };
  }

  $effect(() => {
    if (cloud) void loadGames();
  });
</script>

<section class="panel surface manual-resume" aria-labelledby="{uid}-title">
  <h2 class="panel__title" id="{uid}-title">{S.night.resumeTitle}</h2>
  <p class="panel__help">{S.night.resumeHelp}</p>

  <label class="field" for="{uid}-code">
    <span class="field__label">{S.night.resumeField}</span>
    <input id="{uid}-code" class="manual-resume__code" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder={S.night.resumePlaceholder} bind:value={draft} />
  </label>
  {#if summary}
    <p class="manual-resume__preview" aria-live="polite">{S.night.resumePreview(roundName, summary.counted, songTitle(catalog, summary.lastSongId) || null)}</p>
    {#if summary.lineFromSong !== null}<p class="panel__help">{S.night.resumeLineFrom(summary.lineFromSong)}</p>{/if}
  {:else if parsed.error === 'invalid'}
    <p class="notice notice--warn" aria-live="polite">{S.night.resumeInvalid}</p>
  {/if}

  {#if asking}
    <div class="manual-resume__ask" role="group" aria-label={S.night.resumeAsk}>
      <p>{S.night.resumeAsk}</p>
      <button type="button" class="tone-accent" onclick={send}>{S.night.resumeConfirm}</button>
      <button type="button" onclick={() => (asking = false)}>{S.night.resumeCancel}</button>
    </div>
  {:else}
    <button type="button" class="tone-accent" disabled={!parsed.point || !allowed || !commands.canSend} onclick={() => (asking = true)}>{S.night.resume}</button>
  {/if}
  {#if !allowed}<p class="panel__help">{S.night.resumeNotNow}</p>{/if}
  <CommandStatus record={commands.last('resumeAt')} />

  {#if cloud}
    <h3 class="panel__subtitle">{S.night.cloudTitle}</h3>
    <p class="panel__help">{S.night.cloudHelp}</p>
    {#if gamesError}
      <p class="notice notice--warn">{S.night.cloudError}</p>
    {:else if games === null}
      <p class="panel__help">{S.night.cloudLoading}</p>
    {:else if games.length === 0}
      <p class="panel__help">{S.night.cloudNone}</p>
    {:else}
      <ul class="manual-resume__games">
        {#each games as game (game.gameId)}
          <li class="manual-resume__game" data-state={game.current ? 'current' : 'past'}>
            <span class="manual-resume__game-id">{game.gameId}{#if game.current}&nbsp;· {S.night.cloudCurrent}{/if}</span>
            <span class="panel__help">{S.night.cloudGame(game.rounds, formatClock(game.lastAtMs))}</span>
            {#if game.resumePoint}
              <button type="button" onclick={() => (revealed = revealed === game.gameId ? null : game.gameId)}>{revealed === game.gameId ? S.night.seedHide : S.night.seedReveal}</button>
              {#if revealed === game.gameId}
                <output class="manual-resume__code">{formatResumeToken(game.resumePoint)}</output>
                <p class="panel__help">{S.night.seedNote}</p>
              {/if}
            {/if}
            <button type="button" class="tone-accent" onclick={() => useGame(game.gameId)}>{S.night.cloudUse}</button>
            {#if outcome?.gameId === game.gameId}<p role="status">{outcome.text}</p>{/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style>
  .manual-resume__code {
    font-family: var(--font-mono, ui-monospace, monospace);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  output.manual-resume__code {
    display: block;
    font-size: var(--text-lg);
    font-weight: var(--font-weight-strong);
    user-select: all;
  }
  .manual-resume__preview {
    font-weight: var(--font-weight-strong);
  }
  .manual-resume__ask {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .manual-resume__games {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-3);
  }
  .manual-resume__game {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    border: var(--line-width) solid var(--color-line);
    border-radius: var(--radius-md);
  }
  .manual-resume__game[data-state='current'] {
    border-color: var(--color-accent);
  }
  .manual-resume__game-id {
    font-weight: var(--font-weight-strong);
  }
</style>
