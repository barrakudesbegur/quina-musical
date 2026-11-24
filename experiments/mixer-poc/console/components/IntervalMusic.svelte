<!--
  The Interval playlist while it plays (state.intervalMusic): in the Interval, while a round is introduced and
  shuffled, after the Game, and in play until the first Spin. The track playing, Skip (the engine hands over
  on the next downbeat) and the playlist's volume.
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  const model = getConsole();
  const uid = $props.id();
  const music = $derived(model.show.state?.intervalMusic ?? null);
  const track = $derived(music?.track ?? null);
  const volumeDb = $derived(model.show.state?.game.intervalVolumeDb ?? -6);

  // Send the volume when the slider is released, not on every step.
  function setVolume(e: Event): void {
    const db = Number((e.currentTarget as HTMLInputElement).value);
    if (Number.isFinite(db)) model.act('setGame', { intervalVolumeDb: db });
  }
</script>

{#if music}
  <section class="panel interval-music" aria-labelledby="{uid}-title">
    <h2 class="panel__subtitle" id="{uid}-title"><Icon name="music" /> {S.intervalMusic.title}</h2>
    {#if track}
      <p class="interval-music__track">{S.intervalMusic.track(track.title, track.artist)}</p>
      <p class="note">{S.intervalMusic.position(track.index, track.count)}</p>
    {:else}
      <p class="note">{S.intervalMusic.waiting}</p>
    {/if}
    <div class="interval-music__controls">
      <button type="button" class="action" data-anim="press" disabled={!model.can('intervalSkip') || !track} onclick={() => model.act('intervalSkip')}>
        <Icon name="next" /><span>{S.intervalMusic.skip}</span>
      </button>
      <label class="field field--inline" for="{uid}-volume">
        <span class="field__label">{S.intervalMusic.volume}: {S.intervalMusic.volumeValue(volumeDb)}</span>
        <input id="{uid}-volume" type="range" min="-30" max="0" step="1" value={volumeDb} disabled={!model.can('setGame')} onchange={setVolume} />
      </label>
    </div>
    <p class="note">{S.intervalMusic.skipNote}</p>
  </section>
{/if}

<style>
  .interval-music__track {
    font-weight: var(--font-weight-strong);
    font-size: var(--text-lg);
  }
  .interval-music__controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-4);
  }
</style>
