<!--
  D5 · SongTile: a song as its cover, title and artist (components-v2.md § 5), in the layouts its surfaces use, named
  by their look: `row` (the phone's Historial), `tile` (the projector's last three), `feature` (the console's «Ara
  sona»), `compact` (the console's «Següent»), `result` (Cerca), `mini` (Futur), `headline` (the landed title, no
  cover). Long titles (#81, R9): two lines with an ellipsis where there's room (`row`, `tile`, `feature`,
  `headline`), one line where there isn't (`compact`, `result`, `mini`), hyphenated in `lang`, broken anywhere as the
  last resort. A cover inside a rounded frame keeps its corners concentric: its radius is the frame's minus the space
  between them (song-tile.css).

  Slots: `leading` (data: an index, «+1»), the cover (data: `songId`), `kicker` (data) or `head` (a snippet in its
  place: a panel's heading), `title` and `artist` (data), `meta` (a snippet under the artist: a chip or a tag),
  `trailing` (a snippet at the end: the ring, the card marks, a countdown). `morph` marks the cover, title and artist
  for the console's next-to-now morph (`data-morph`). Native attributes and `class` pass through; `as` picks the
  element (`li` in a list).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Cover from './Cover.svelte';
  import './song-tile.css';

  type Layout = 'row' | 'tile' | 'feature' | 'compact' | 'result' | 'mini' | 'headline';

  interface Props {
    songId: number | null;
    title: string;
    artist?: string | null;
    layout?: Layout;
    kicker?: string | null;
    leading?: string | null;
    lang?: string;
    as?: 'div' | 'li';
    coverFallback?: 'note' | 'empty';
    morph?: boolean;
    class?: string;
    head?: Snippet;
    meta?: Snippet;
    trailing?: Snippet;
    [key: `data-${string}`]: string | undefined;
  }

  let {
    songId,
    title,
    artist = null,
    layout = 'row',
    kicker = null,
    leading = null,
    lang,
    as = 'div',
    coverFallback = 'note',
    morph = false,
    class: className = '',
    head,
    meta,
    trailing,
    ...rest
  }: Props = $props();
</script>

<svelte:element this={as} {...rest} class="song-tile {className}" data-layout={layout}>
  {#if leading}<span class="song-tile__leading" aria-hidden="true">{leading}</span>{/if}
  {#if layout !== 'headline'}<Cover {songId} fallback={coverFallback} class="song-tile__cover" morph={morph ? 'cover' : null} />{/if}
  <span class="song-tile__text">
    {#if head}{@render head()}{:else if kicker}<span class="song-tile__kicker">{kicker}</span>{/if}
    <span class="song-tile__title" {lang} data-morph={morph ? 'title' : undefined}>{title}</span>
    {#if artist}<span class="song-tile__artist" data-morph={morph ? 'artist' : undefined}>{artist}</span>{/if}
    {@render meta?.()}
  </span>
  {@render trailing?.()}
</svelte:element>
