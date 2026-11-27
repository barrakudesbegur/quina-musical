<!--
  «Ara sona» in one line (logic/now-line.ts; D196, D199), at the top of the left column where the full panel has no
  room: the claim pad, the finalists' pad, Cerca while its box has the focus (console.css shows it only then), and the
  Check board. Drawn as the Consola-Comprovacio-Revisio board's line: the cover (or a music tile), «Ara sona», a small
  «baixa, d'abans de la comprovació» chip in a Check (D118, D191), then the title and its artist. No motion: it changes
  with the song.
-->
<script lang="ts">
  import { CONSOLE } from '../config.ts';
  import { getConsole } from '../context.ts';
  import { nowLine } from '../logic/now-line.ts';
  import { nowRing } from '../logic/now-ring.ts';
  import { S } from '../strings.ts';
  import Cover from './Cover.svelte';
  import Icon from './Icon.svelte';

  const model = getConsole();
  const snap = $derived(model.show.state);
  const ring = $derived(snap ? nowRing({ state: snap, flow: model.show.flow, nowMs: model.show.now, lastSec: CONSOLE.ringLastSec }) : null);
  const view = $derived(snap ? nowLine(snap, model.show.flow.scene, !ring?.holdMusic ? null : ring.state === 'checkFailed' ? 'error' : 'hold') : null);
  const sound = $derived(view?.sound ?? null);
  const name = $derived.by(() => {
    switch (sound?.kind) {
      case 'throw':
      case 'playlist':
      case 'song':
        return { title: sound.title, artist: sound.artist };
      case 'music':
        return { title: sound.music === 'error' ? S.nowPlaying.errorMusic : S.nowPlaying.holdMusic, artist: '' };
      default:
        return { title: S.nowPlaying.nothing, artist: '' };
    }
  });
</script>

{#if view && sound}
  <section class="now-line" data-testid="now-line" data-sound={sound.kind} data-low={view.low || undefined} aria-label={S.nowLine.aria(name.artist ? `${name.title}, ${name.artist}` : name.title, view.low)}>
    {#if sound.kind === 'song'}
      <Cover songId={sound.songId} size="sm" />
    {:else}
      <span class="cover cover--sm cover--missing" data-music={sound.kind === 'music' ? sound.music : undefined} aria-hidden="true"><Icon name="music" alone /></span>
    {/if}
    <div class="now-line__text" aria-hidden="true">
      <p class="panel__label now-line__label">
        {S.nowLine.label}
        {#if sound.kind === 'throw'}<span class="now-line__chip" data-song={sound.song}>{S.throws.names[sound.song].label}</span>{/if}
        {#if view.low}<span class="now-line__chip now-line__chip--low"><Icon name="sound" />{S.nowLine.low}</span>{/if}
      </p>
      <p class="now-line__song">{name.title}{#if name.artist}<span class="now-line__artist">{name.artist}</span>{/if}</p>
    </div>
  </section>
{/if}
