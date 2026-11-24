<script lang="ts">
  // Historial: this round's songs with their covers, newest first, then earlier rounds'. A dot in a card's
  // colour shows the song is marked on that card (the same marks as the grids).
  import { songTitle } from '../../ui/data/catalog.ts';
  import type { PlayerApp } from '../model.svelte.ts';
  import { historyGroups, markedColors } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import Cover from './Cover.svelte';

  let { app }: { app: PlayerApp } = $props();
  const groups = $derived(historyGroups(app.state));
  const dots = $derived(markedColors(app.views));
</script>

<section class="history">
  <h2 class="history__heading">{S.historyTitle}</h2>
  {#if !groups.some((g) => g.landings.length)}
    <p class="history__empty">{S.noHistory}</p>
  {/if}
  {#each groups as group (group.round)}
    {#if group.landings.length}
      <section class="history__round" data-state={group.current ? 'current' : 'past'}>
        <h3 class="history__round-title">{group.current ? S.thisRound : S.round(group.round)}{group.kind === 'special' ? ` · ${S.specialRound}` : ''}</h3>
        <ol class="song-list" reversed>
          {#each group.landings as l, i (l.position)}
            {@const colors = group.current ? (dots.get(l.songId) ?? []) : []}
            <li class="song-list__item" data-anim={group.current && i === 0 ? 'landing' : undefined}>
              <Cover songId={l.songId} size="sm" />
              <span class="song-list__text">
                <span class="song-list__title">{songTitle(app.catalog, l.songId)}</span>
                {#if app.catalog?.songs.get(l.songId)?.artist}<span class="song-list__artist">{app.catalog.songs.get(l.songId)?.artist}</span>{/if}
              </span>
              {#if colors.length}
                <span class="song-list__dots" role="img" aria-label={S.onYourCards}>
                  {#each colors as color, ci (ci)}<span class="song-list__dot" style:--card-color="var(--card-color-{color})"></span>{/each}
                </span>
              {/if}
            </li>
          {/each}
        </ol>
      </section>
    {/if}
  {/each}
</section>
