<!--
  The Interval playlist while it plays (state.intervalMusic): in the Interval, while a round is introduced and
  shuffled, after the Game, and in play until the first Spin. The track playing, Skip (the engine hands over
  on the next downbeat) and the playing set's volume slider (`setVolume`, D139: the breaks', Pausa's or the end's).
  While a throw song plays over it («Llançament» or «Tempesta», D138, D151), the panel says «Ara sona» with that song,
  and that the music underneath comes back when it ends; stopped by a tap, the music shows again with a word that the
  song is stopped and where («aturat a 1:05», the Consola-Llancament-Tempesta board).
-->
<script lang="ts">
  import { VOLUME_DEFAULTS, VOLUME_MAX } from '@quina/protocol';
  import { getConsole } from '../context.ts';
  import { throwClock, throwProgress } from '../logic/throw-songs.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  const model = getConsole();
  const uid = $props.id();
  const music = $derived(model.show.state?.intervalMusic ?? null);
  const track = $derived(music?.track ?? null);
  const key = $derived(music?.set ?? 'breaks');
  const percent = $derived(model.show.state?.game.volumes?.[key] ?? VOLUME_DEFAULTS[key]);
  const thrown = $derived(model.show.state?.throwSong ?? null);

  // Send the volume when the slider is released, not on every step.
  function setVolume(e: Event): void {
    const value = Number((e.currentTarget as HTMLInputElement).value);
    if (Number.isFinite(value)) model.act('setVolume', { key, percent: value });
  }
</script>

{#if music}
  <section class="panel interval-music" aria-labelledby="{uid}-title" data-throw={thrown ? (thrown.playing ? 'playing' : 'stopped') : undefined}>
    {#if thrown?.playing}
      <h2 class="panel__subtitle" id="{uid}-title">
        <Icon name="music" /> {S.throws.nowPlaying}
        <span class="interval-music__chip" data-song={thrown.song}>{S.throws.names[thrown.song].label}</span>
      </h2>
      <p class="interval-music__track">{S.intervalMusic.track(thrown.title, thrown.artist)}</p>
      <p class="note">{track ? S.throws.under(track.title) : S.throws.underWaiting}</p>
    {:else}
      <h2 class="panel__subtitle" id="{uid}-title"><Icon name="music" /> {S.intervalMusic.title}</h2>
      {#if track}
        <p class="interval-music__track">{S.intervalMusic.track(track.title, track.artist)}</p>
        <p class="note">{thrown ? S.throws.names[thrown.song].stopped(S.intervalMusic.position(track.index, track.count), throwClock(throwProgress(thrown, model.show.now).atSec)) : S.intervalMusic.position(track.index, track.count)}</p>
      {:else}
        <p class="note">{S.intervalMusic.waiting}</p>
      {/if}
      <div class="interval-music__controls">
        <button type="button" class="action" data-anim="press" disabled={!model.can('intervalSkip') || !track} onclick={() => model.act('intervalSkip')}>
          <Icon name="next" /><span>{S.intervalMusic.skip}</span>
        </button>
        <label class="field field--inline" for="{uid}-volume">
          <span class="field__label">{S.intervalMusic.volume}: {S.intervalMusic.volumeValue(percent)}</span>
          <input id="{uid}-volume" type="range" min="0" max={VOLUME_MAX[key]} step="1" value={percent} disabled={!model.can('setVolume')} onchange={setVolume} />
        </label>
      </div>
      <p class="note">{S.intervalMusic.skipNote}</p>
    {/if}
  </section>
{/if}

<style>
  .interval-music__track {
    font-weight: var(--font-weight-strong);
    font-size: var(--text-lg);
  }
  .interval-music__chip {
    display: inline-block;
    margin-left: var(--space-1);
    padding: 0 8px;
    border: var(--line-width-thin) solid var(--color-ink);
    border-radius: var(--radius-pill);
    background: var(--action-throw);
    color: var(--color-ink);
    font-size: var(--text-xs);
    letter-spacing: 0;
    text-transform: none;
  }
  .interval-music__chip[data-song='storm'] {
    background: var(--action-storm);
    color: #fff6e5;
  }
  .interval-music__controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-4);
  }
</style>
