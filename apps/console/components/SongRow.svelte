<!--
  One song in the tabs' lists (Estat's and Cerca's played songs, Cerca's results, Futur's upcoming songs; the
  Consola-Pestanyes-Noves board): an optional lead (Futur's "+3"), the cover, the title over the artist, and an
  aside on the right (its place, its status, what it brings). A search's matched letters are drawn as <mark> spans,
  built from text, never as HTML. `state` colours the row: on air, or a song that completes a win.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { highlightSpans, type MatchRange } from '../logic/fuzzy.ts';
  import Cover from './Cover.svelte';

  interface Props {
    songId: number;
    title: string;
    artist: string;
    /** The letters a search matched, in the title or in the artist. */
    match?: { field: 'title' | 'artist'; ranges: MatchRange[] } | null;
    state?: 'now' | 'win' | null;
    lead?: Snippet;
    aside?: Snippet;
  }

  let { songId, title, artist, match = null, state = null, lead, aside }: Props = $props();
  const spans = (text: string, field: 'title' | 'artist') => (match?.field === field ? highlightSpans(text, match.ranges) : [{ text, hit: false }]);
</script>

<li class="song-row" data-state={state ?? undefined}>
  {#if lead}<span class="song-row__lead">{@render lead()}</span>{/if}
  <Cover {songId} size="sm" />
  <span class="song-row__text">
    <span class="song-row__title">{#each spans(title, 'title') as span, i (i)}{#if span.hit}<mark>{span.text}</mark>{:else}{span.text}{/if}{/each}</span>
    {#if artist}<span class="song-row__artist">{#each spans(artist, 'artist') as span, i (i)}{#if span.hit}<mark>{span.text}</mark>{:else}{span.text}{/if}{/each}</span>{/if}
  </span>
  {#if aside}<span class="song-row__aside">{@render aside()}</span>{/if}
</li>
