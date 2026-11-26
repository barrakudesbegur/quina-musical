<!--
  The round's played songs, newest first in the Shuffle's order (Estat's right side, and Cerca before anything is
  typed; the Consola-Pestanyes-Noves board): «Han sonat · 23», then each song with its place ("23a") and how long ago
  ("ara sona", "fa 1"). The list scrolls and keeps its place across tab switches (`scrollKey`). A console opened
  mid-round lists only the songs it saw, and says so.
-->
<script lang="ts">
  import { songTitle } from '../../../packages/ui/data/catalog.ts';
  import { getConsole } from '../context.ts';
  import { keepScroll } from '../keep-scroll.ts';
  import { playedHistory } from '../logic/upcoming.ts';
  import { S } from '../strings.ts';
  import SongRow from './SongRow.svelte';

  let { sub, scrollKey }: { sub: string; scrollKey: string } = $props();

  const model = getConsole();
  const uid = $props.id();
  const songs = $derived(model.roundSongs);
  const played = $derived(songs ? playedHistory(songs) : []);
  const count = $derived(songs ? songs.position + 1 : 0);
</script>

<section class="played" aria-labelledby="{uid}-title">
  <header class="played__head">
    <h3 class="panel__label" id="{uid}-title">{S.played.title(count)}</h3>
    <p class="played__sub">{sub}</p>
  </header>
  {#if count === 0}
    <p class="note">{S.played.none}</p>
  {:else}
    {#if songs && !songs.complete}<p class="note">{S.played.partial}</p>{/if}
    <ul class="song-list" {@attach keepScroll(model.scrolls, scrollKey)}>
      {#each played as p (p.songId)}
        {@const info = model.songInfo.get(p.songId)}
        <SongRow songId={p.songId} title={info?.title ?? songTitle(null, p.songId)} artist={info?.artist ?? ''} state={p.now ? 'now' : null}>
          {#snippet aside()}
            <span class="song-row__place">{S.played.place(p.place)}</span>
            <span class="song-row__when">{p.now ? S.played.now : S.played.ago(p.ago)}</span>
          {/snippet}
        </SongRow>
      {/each}
    </ul>
  {/if}
</section>
