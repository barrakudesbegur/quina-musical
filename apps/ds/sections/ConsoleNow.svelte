<!--
  The gallery's console compositions (console density only): NowPlaying, NowLine and NextSong, the app's own
  components, each in its main looks from the demo fixtures (packages/ui/fixtures/states.ts) with the long title
  (R9: «All I Want for Christmas Is You») where a song shows. Each specimen gets a ConsoleModel stand-in
  (ConsoleStub.svelte) with that fixture's state and a clock fixed at the page's load, so a snapshot is the same every
  time. Captions in English (GLOSSARY.md); the panels' words are Catalan.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { flowOf } from '../../../packages/ui/flow.ts';
  import { FIXTURE_SONGS, FIXTURES, type FullState } from '../../../packages/ui/fixtures/states.ts';
  import NextSong from '../../console/components/NextSong.svelte';
  import NowLine from '../../console/components/NowLine.svelte';
  import NowPlaying from '../../console/components/NowPlaying.svelte';
  import ConsoleStub from './ConsoleStub.svelte';

  /** R9's long title, as a fixture song. */
  const LONG_ID = 1;
  const LONG = { songId: LONG_ID, title: FIXTURE_SONGS[LONG_ID]?.[0] ?? '', artist: FIXTURE_SONGS[LONG_ID]?.[1] ?? '' };
  const now = Date.now();

  /** A fixture's state at `now`, its playing song (or its next one) the long title. */
  function stub(fixture: string, { current = false, next = false, lastSpin = null }: { current?: boolean; next?: boolean; lastSpin?: { by: string | null; suspense: boolean } | null } = {}) {
    const script = FIXTURES[fixture]?.(now);
    if (!script) throw new Error(`ds: no fixture ${fixture}`);
    const base = script.state as FullState;
    const state = {
      ...base,
      ...(current && base.current ? { current: { ...base.current, ...LONG } } : {}),
      ...(next && base.next ? { next: { ...base.next, ...LONG } } : {}),
    };
    return { show: { state, flow: flowOf(state), now, demo: true }, lastSpin };
  }

  const NOW_PLAYING = [
    { caption: 'in play, auto-advance counting down to the next Spin; the long title stops at two lines (R9)', model: stub('play', { current: true }) },
    { caption: 'a Spin landing, started from this tablet', model: stub('spin', { current: true, lastSpin: { by: 'Taula', suspense: false } }) },
    { caption: 'Parlem (a Hold): the music low, the ring’s pause bars and how long it has lasted', model: stub('hold', { current: true }) },
  ];
  const NOW_LINE = [
    { caption: 'in a Check: the song playing, «baixa» (the music is low)', model: stub('check', { current: true }) },
    { caption: 'in play: the song playing', model: stub('play', { current: true }) },
    { caption: 'a throw song (the Interval’s): its chip in its colour', model: stub('intervalThrow') },
  ];
  const NEXT_SONG = [
    { caption: 'in play: the next song, private to the console (dashed), the long title', model: stub('play', { next: true }) },
    { caption: 'a Spin landing on it: its countdown', model: stub('spin', { next: true }) },
    { caption: 'a Suspense: its countdown', model: stub('suspense', { next: true }) },
  ];
</script>

{#snippet cell(caption: string, body: Snippet)}
  <figure class="ds-gallery__cell">
    <div class="ds-gallery__stage" lang="ca">{@render body()}</div>
    <figcaption>{caption}</figcaption>
  </figure>
{/snippet}

<section class="ds-gallery__section" aria-labelledby="cmp-now">
  <h2 id="cmp-now">Console compositions: NowPlaying, NowLine, NextSong</h2>
  <p class="ds-prose">
    The console’s own compositions of the design system’s pieces (SongTile, Ring, Cover, Panel), with the demo fixtures’ states.
    Their clock stands at the page’s load, so the rings and countdowns hold still here.
  </p>

  <h3>NowPlaying</h3>
  <div class="ds-gallery__grid ds-cmp__grid ds-cmp__grid--now">
    {#each NOW_PLAYING as s (s.caption)}
      {#snippet b()}<ConsoleStub model={s.model}><NowPlaying /></ConsoleStub>{/snippet}
      {@render cell(s.caption, b)}
    {/each}
  </div>

  <h3>NowLine</h3>
  <div class="ds-gallery__grid ds-cmp__grid ds-cmp__grid--line">
    {#each NOW_LINE as s (s.caption)}
      {#snippet b()}<ConsoleStub model={s.model}><NowLine /></ConsoleStub>{/snippet}
      {@render cell(s.caption, b)}
    {/each}
  </div>

  <h3>NextSong</h3>
  <div class="ds-gallery__grid ds-cmp__grid">
    {#each NEXT_SONG as s (s.caption)}
      {#snippet b()}<ConsoleStub model={s.model}><NextSong /></ConsoleStub>{/snippet}
      {@render cell(s.caption, b)}
    {/each}
  </div>
</section>

<style>
  @layer app {
  /* About a console column's width */
  .ds-cmp__grid {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 26rem), 1fr));
  }

  .ds-cmp__grid--now {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 34rem), 1fr));
  }

  /* The line runs across the Check's column: one a row */
  .ds-cmp__grid--line {
    grid-template-columns: minmax(0, 52rem);
  }
  }
</style>
