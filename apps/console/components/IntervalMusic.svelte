<!--
  «Ara sona» with the playlist of the breaks, Pausa or the end while it plays (state.intervalMusic): in the Interval,
  while a round is introduced and shuffled, after the Game, and in play until the first Spin. It opens the left column
  (D196), drawn like NowPlaying (the Consola-Llancament-Tempesta board): a music tile, the track's title, its artist,
  which music and which track («Música del descans · cançó 3 de 50»), and «Salta la cançó» (the engine hands over on
  the next downbeat). The volumes are in the menu (VolumeSliders, D139).
  While a throw song plays over it («Llançament» or «Tempesta», D138, D151), the panel names that song, with its chip,
  and says that the music underneath comes back when it ends; stopped by a tap, the music shows again with a word that
  the song is stopped and where («aturat a 1:05»).
  In a break (the Interval scene), under «Salta la cançó», a picker of which set plays (D228, `intervalSet`):
  «Descans | Pausa», the SegmentedControl (B2, BREAK_SET_OPTIONS, size s) showing the engine's `intervalMusic.set`;
  each break starts on the breaks' own. Stacked with the skip, it keeps the panel's height (the column below keeps its
  place). Motion: ANIMATIONS.md › break-set-pick.
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { throwClock, throwProgress } from '../logic/throw-songs.ts';
  import { ACTIONS, BREAK_SET_OPTIONS } from '../actions.ts';
  import { isBreakSet } from '../logic/scene.ts';
  import SegmentedControl from '../../../packages/ui/components/SegmentedControl.svelte';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  const model = getConsole();
  const uid = $props.id();
  const music = $derived(model.show.state?.intervalMusic ?? null);
  const track = $derived(music?.track ?? null);
  const thrown = $derived(model.show.state?.throwSong ?? null);
  /** The Descans' picker: in a break, while one of its two sets plays. */
  const pickable = $derived(model.show.flow.scene === 'interval' && music !== null && isBreakSet(music.set));
  const where = $derived(music && track ? S.intervalMusic.position(S.intervalMusic.sets[music.set], track.index, track.count) : null);
</script>

{#if music}
  <section class="panel now-playing interval-music" aria-labelledby="{uid}-title" data-set={music.set} data-throw={thrown ? (thrown.playing ? 'playing' : 'stopped') : undefined}>
    <span class="cover cover--md cover--missing interval-music__tile" aria-hidden="true"><Icon name="music" alone /></span>
    <div class="now-playing__song">
      {#if thrown?.playing}
        <h2 class="panel__label interval-music__label" id="{uid}-title">
          {S.intervalMusic.title}<span class="interval-music__chip" data-color={ACTIONS[thrown.song].color}>{S.throws.names[thrown.song].label}</span>
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
    {#if !thrown?.playing || pickable}
      <div class="interval-music__side">
        {#if !thrown?.playing}
          <button type="button" class="action interval-music__skip" data-anim="press" disabled={!model.can('intervalSkip') || !track} onclick={() => model.act('intervalSkip')}>
            <Icon name="next" /><span>{S.intervalMusic.skip}</span>
          </button>
        {/if}
        {#if pickable && isBreakSet(music.set)}
          <SegmentedControl
            size="s"
            label={S.intervalMusic.pick}
            options={BREAK_SET_OPTIONS}
            value={music.set}
            disabled={!model.can('intervalSet')}
            data-testid="break-set"
            onchange={(set) => model.act('intervalSet', { set })}
          />
        {/if}
      </div>
    {/if}
  </section>
{/if}

<style>
  /* «Salta la cançó» over the Descans' picker, at the panel's end; the picker as wide as the button. */
  .interval-music__side {
    display: flex;
    flex: none;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }

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
    background: var(--palette-solid);
    color: var(--palette-contrast);
    font-size: var(--text-xs);
    letter-spacing: 0;
    text-transform: none;
  }
  .interval-music__where {
    font-size: var(--text-sm);
    font-weight: 800;
    color: var(--color-text-muted);
  }
  .interval-music__skip {
    flex: none;
  }
</style>
