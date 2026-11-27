<!--
  «Ara sona» with the playlist of the breaks, Pausa or the end while it plays (state.intervalMusic): in the Interval,
  while a round is introduced and shuffled, after the Game, and in play until the first Spin. It opens the left column
  (D196), drawn like NowPlaying (the Consola-Llancament-Tempesta board): a music tile, the track's title, its artist,
  which music and which track («Música del descans · cançó 3 de 50»), and «Salta la cançó» (the engine hands over on
  the next downbeat). The volumes are in the menu (VolumeSliders, D139).
  While a throw song plays over it («Llançament» or «Tempesta», D138, D151), the panel names that song, with its chip,
  and says that the music underneath comes back when it ends; stopped by a tap, the music shows again with a word that
  the song is stopped and where («aturat a 1:05»).
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { throwClock, throwProgress } from '../logic/throw-songs.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  const model = getConsole();
  const uid = $props.id();
  const music = $derived(model.show.state?.intervalMusic ?? null);
  const track = $derived(music?.track ?? null);
  const thrown = $derived(model.show.state?.throwSong ?? null);
  const where = $derived(music && track ? S.intervalMusic.position(S.intervalMusic.sets[music.set], track.index, track.count) : null);
</script>

{#if music}
  <section class="panel now-playing interval-music" aria-labelledby="{uid}-title" data-set={music.set} data-throw={thrown ? (thrown.playing ? 'playing' : 'stopped') : undefined}>
    <span class="cover cover--md cover--missing interval-music__tile" aria-hidden="true"><Icon name="music" alone /></span>
    <div class="now-playing__song">
      {#if thrown?.playing}
        <h2 class="panel__label interval-music__label" id="{uid}-title">
          {S.intervalMusic.title}<span class="interval-music__chip" data-song={thrown.song}>{S.throws.names[thrown.song].label}</span>
        </h2>
        <p class="now-playing__name">{thrown.title}</p>
        {#if thrown.artist}<p class="now-playing__artist">{thrown.artist}</p>{/if}
        <p class="interval-music__where">{track ? S.throws.under(track.title) : S.throws.underWaiting}</p>
      {:else}
        <h2 class="panel__label" id="{uid}-title">{S.intervalMusic.title}</h2>
        {#if track}
          <p class="now-playing__name">{track.title}</p>
          {#if track.artist}<p class="now-playing__artist">{track.artist}</p>{/if}
          <p class="interval-music__where">{thrown && where ? S.throws.names[thrown.song].stopped(where, throwClock(throwProgress(thrown, model.show.now).atSec)) : where}</p>
        {:else}
          <p class="interval-music__where">{S.intervalMusic.waiting}</p>
        {/if}
      {/if}
    </div>
    {#if !thrown?.playing}
      <button type="button" class="action interval-music__skip" data-anim="press" disabled={!model.can('intervalSkip') || !track} onclick={() => model.act('intervalSkip')}>
        <Icon name="next" /><span>{S.intervalMusic.skip}</span>
      </button>
    {/if}
  </section>
{/if}

<style>
  .interval-music__label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .interval-music__chip {
    display: inline-block;
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
  .interval-music__where {
    font-size: var(--text-sm);
    font-weight: 800;
    color: var(--color-text-muted);
  }
  .interval-music__skip {
    flex: none;
    align-self: center;
  }
</style>
