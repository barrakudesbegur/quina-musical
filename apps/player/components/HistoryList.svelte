<script lang="ts">
  // Historial: the current round's songs only (the user's decision), with their covers, newest first, in one
  // list the player just scrolls. The song playing now is the first, styled like the rest. A song on one of the player's
  // cards shows that card's icon (never its number), packed zig-zag at the row's right edge (logic/markers.ts).
  import { songTitle } from '../../../packages/ui/data/catalog.ts';
  import type { PlayerApp } from '../model.svelte.ts';
  import { historyOf, markedIdentities } from '../logic/view.ts';
  import { markName } from '../logic/marks-identity.ts';
  import { markerLayout } from '../logic/markers.ts';
  import { S } from '../strings.ts';
  import CardMark from './CardMark.svelte';
  import Cover from '../../../packages/ui/components/Cover.svelte';

  let { app }: { app: PlayerApp } = $props();
  const history = $derived(historyOf(app.state));
  const marks = $derived(markedIdentities(app.views));
</script>

<section class="history">
  <h2 class="history__heading">{S.historyTitle}</h2>
  {#if !history?.landings.length}
    <p class="history__empty">{S.noHistory}</p>
  {:else}
    <p class="history__round-title">{S.roundName({ number: history.round, kind: history.kind }, app.plan)} · {S.songCount(history.landings.length)}</p>
    <ol class="song-list" reversed>
      {#each history.landings as l, i (l.position)}
        {@const identities = marks.get(l.songId) ?? []}
        <!-- The song playing now has no style of its own (the user, 26 Nov): it's simply the first row. -->
        <li class="song-list__item" data-now={l.position === history.nowPosition ? 'true' : undefined} data-anim={i === 0 ? 'landing' : undefined}>
          <span class="song-list__cover">
            <Cover songId={l.songId} fallback="empty" />
          </span>
          <span class="song-list__text">
            <span class="song-list__title">{songTitle(app.catalog, l.songId)}</span>
            {#if app.catalog?.songs.get(l.songId)?.artist}<span class="song-list__artist">{app.catalog.songs.get(l.songId)?.artist}</span>{/if}
          </span>
          {#if identities.length}
            {@const layout = markerLayout(identities.length)}
            <span class="song-list__marks" role="img" aria-label={S.onCards(identities.map((n) => S.markLabel(markName(n))))} style:width="{layout.width}px">
              {#each identities as identity, mi (mi)}
                <span class="song-list__mark" style:left="{layout.spots[mi]?.left}px" style:top="{layout.spots[mi]?.top}px"><CardMark {identity} decorative /></span>
              {/each}
            </span>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}
</section>
