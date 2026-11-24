<script lang="ts">
  // Historial: the current round's songs only (the user's decision), with their covers, newest first, in one
  // list the player just scrolls. The song playing now is the first, highlighted. A song on one of the player's
  // cards shows that card's icon (never its number).
  import { songTitle } from '../../../packages/ui/data/catalog.ts';
  import type { PlayerApp } from '../model.svelte.ts';
  import { historyOf, markedIdentities } from '../logic/view.ts';
  import { markName } from '../logic/marks-identity.ts';
  import { S } from '../strings.ts';
  import CardMark from './CardMark.svelte';
  import Cover from './Cover.svelte';
  import Icon from './Icon.svelte';

  let { app }: { app: PlayerApp } = $props();
  const history = $derived(historyOf(app.state));
  const marks = $derived(markedIdentities(app.views));
</script>

<section class="history">
  <h2 class="history__heading">{S.historyTitle}</h2>
  {#if !history?.landings.length}
    <p class="history__empty">{S.noHistory}</p>
  {:else}
    <p class="history__round-title">{S.roundName(history.round, history.kind)}{history.kind === 'special' ? ` · ${S.specialRound}` : ''} · {S.songCount(history.landings.length)}</p>
    <ol class="song-list" reversed>
      {#each history.landings as l, i (l.position)}
        {@const identities = marks.get(l.songId) ?? []}
        {@const now = l.position === history.nowPosition}
        <li class="song-list__item" class:is-now={now} data-anim={i === 0 ? 'landing' : undefined}>
          <span class="song-list__cover">
            <Cover songId={l.songId} size="sm" />
            {#if now}<span class="song-list__now" role="img" aria-label={S.nowPlaying}><Icon name="now" /></span>{/if}
          </span>
          <span class="song-list__text">
            <span class="song-list__title">{songTitle(app.catalog, l.songId)}</span>
            {#if app.catalog?.songs.get(l.songId)?.artist}<span class="song-list__artist">{app.catalog.songs.get(l.songId)?.artist}</span>{/if}
          </span>
          {#if identities.length}
            <span class="song-list__marks" role="img" aria-label={S.onCards(identities.map((n) => S.markLabel(markName(n))))}>
              {#each identities as identity, mi (mi)}<span class="song-list__mark"><CardMark {identity} decorative /></span>{/each}
            </span>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}
</section>
