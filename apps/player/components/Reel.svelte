<script lang="ts">
  // The Ara drum (board Mobil-B-J2): the projector's drum on the phone (D237; §8 Y1, the user's second production
  // test: "make sure the drum uses the same effects as the projector"). The same tiles in the same order (`order`, the
  // round's drumOrder; logic/drum.ts), on a ring with the projector's geometry, turned by the projector's solver with the
  // Spin's public seed, blurred sideways by its speed as the projector's is; it never rests before the landing is
  // public, then glides to the landed tile and selects it (the others fade, it comes forward) (ANIMATIONS.md `reel-spin`,
  // `landing`). Silent (§8 Y4). Reduced motion: the ring jumps, never turns. It has two looks, full and the compact
  // strip, and morphs between them by `--reel-collapse` (0 → 1, `drum-collapse`): a parent drives it (the home scrolls
  // it and swipes it); `compact` pins it to the strip (`data-size="strip"`). `stopped` holds it still while the phone is
  // offline. While still, a sideways drag tugs it a little and it springs back (`drum-tug`, D220: a stiff wobble that
  // never brings a tile into view, logic/drum-tug.ts); a vertical drag scrolls the page.
  // While it turns, the words never say «?»: the previous song stays under it, faded (`reel-spin`, §8 Y2), so nothing
  // changes size as a Spin starts, turns or stops; they change as it comes to rest on the landed tile (`landing`, §13).
  // `marks`: the identities of the phone's cards holding the song, shown in the strip (§8 Y2). `onpick`: a tap on the
  // drum (never a tug) goes to the first of those cards (`drum-pick`). The sides fade into whatever is behind by a mask
  // (§8 Y1: on the gold too), never a gradient painted in night blue.
  // Its phase is `data-phase`, not `data-state`: the covers' rules (`.cover[data-state…]`) made every change of a
  // `data-state` on the drum restyle each tile's cover.
  import { untrack } from 'svelte';
  import { songTitle, type Catalog } from '../../../packages/ui/data/catalog.ts';
  import type { PublicLanding, PublicSpin } from '../feed/public.ts';
  import { DRUM, PhoneDrum, wordsLanding, wordsStale, type DrumFrame } from '../logic/drum.ts';
  import { prepareSpinSolver, solveSpinOffThread } from '../device/drum-solver.ts';
  import { tugAxis, tugTurn, type DrumGeometry } from '../logic/drum-tug.ts';
  import { S } from '../strings.ts';
  import Cover from '../../../packages/ui/components/Cover.svelte';
  import CardMark from './CardMark.svelte';

  let {
    spin,
    latest,
    catalog,
    order,
    landings,
    nowMs,
    clockOffsetMs,
    reduced,
    compact = false,
    stopped = false,
    marks = [],
    onpick,
  }: {
    spin: PublicSpin | null;
    latest: PublicLanding | null;
    catalog: Catalog | null;
    /** The round's drum order (logic/drum.ts roundOrder): every song of the round, in the projector's order. */
    order: readonly number[];
    /** The round's public landings. */
    landings: readonly PublicLanding[];
    /** The app's ticking cloud clock (4 per second). */
    nowMs: number;
    /** cloud − local, for the animation frames' own clock. */
    clockOffsetMs: number;
    reduced: boolean;
    compact?: boolean;
    stopped?: boolean;
    /** The phone's cards holding the song, drawn in the strip. */
    marks?: readonly number[];
    /** A tap on the drum: go to the card holding the song. */
    onpick?: () => void;
  } = $props();

  const uid = $props.id();
  /** With no songs yet (no catalogue), a ring of card backs. */
  const BACKS = 10;
  // Each Spin is solved once, off the main thread (device/drum-solver.ts); the frames only sample its curve.
  const drum = new PhoneDrum(solveSpinOffThread);
  prepareSpinSolver();
  let frame: DrumFrame = $state.raw({ ring: [], position: 0, velocity: 0, phase: 'idle', selectedId: null, blurPx: 0 });
  const step = (now: number) => (frame = drum.frame({ order, landings, spin, nowMs: now, reduced }));
  // Every change of the inputs (and the app's clock), unless offline: then it holds where it is.
  $effect(() => {
    if (stopped) return;
    const now = Math.max(nowMs, Date.now() + clockOffsetMs);
    untrack(() => step(now));
  });
  const moving = $derived(frame.phase === 'spinning' || frame.phase === 'waiting' || frame.phase === 'gliding');
  // While it moves, a frame each animation frame (transform and the blur's width only). With reduced motion the ring
  // never turns, so there is nothing to draw between the clock's ticks.
  $effect(() => {
    if (!moving || stopped || reduced) return;
    let raf = 0;
    const loop = () => {
      step(Date.now() + clockOffsetMs);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  const tiles = $derived(frame.ring.length ? frame.ring : Array.from({ length: BACKS }, (_, i) => -1 - i));
  // The words wait for the drum (`landing`): the latest landing's once it rests on its tile, until then the last ones.
  let shownWords: PublicLanding | null = null;
  const titled = $derived((shownWords = wordsLanding(frame, latest, shownWords)));
  const stale = $derived(wordsStale(frame.phase));
  const song = $derived(titled ? catalog?.songs.get(titled.songId) : undefined);

  // The tug (drum-tug): only while still, never with reduced motion. `tug` is the ring's extra turn, in tiles.
  let width = $state(0);
  const geometry: DrumGeometry = $derived({ tiles: tiles.length, tilePx: DRUM.tilePx, gap: DRUM.gap, perspectiveTiles: DRUM.perspectiveTiles, widthPx: width || 390 });
  const canTug = $derived(!reduced && (frame.phase === 'idle' || frame.phase === 'landed'));
  let tug = $state(0);
  let tugging = $state(false);
  let springing = $state(false);
  let drag: { id: number; x: number; y: number; axis: 'x' | 'y' | null } | null = null;
  function tugStart(e: PointerEvent): void {
    if (!canTug || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: null };
  }
  function tugMove(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (drag.axis === null) {
      drag.axis = tugAxis(dx, e.clientY - drag.y);
      if (drag.axis === 'y') return void (drag = null);
      if (drag.axis === 'x') {
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          // A pointer the browser no longer tracks: the drag still follows its moves.
        }
        tugging = true;
        springing = false;
      }
    }
    if (drag?.axis === 'x') {
      tug = tugTurn(dx, geometry);
      tugged = true;
    }
  }
  /** The last press tugged: its click isn't a pick. */
  let tugged = false;
  function pick(): void {
    if (tugged) return void (tugged = false);
    onpick?.();
  }
  function pickKey(e: KeyboardEvent): void {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onpick?.();
  }
  function tugEnd(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    if (!tugging) return;
    tugging = false;
    springing = tug !== 0;
    tug = 0;
  }
  // A Spin starting mid-drag drops the drag at once.
  $effect(() => {
    if (!canTug && (tugging || tug !== 0)) {
      drag = null;
      tugging = false;
      springing = false;
      tug = 0;
    }
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  class="reel"
  data-testid="reel"
  data-phase={frame.phase}
  data-size={compact ? 'strip' : 'full'}
  data-stale={stale ? 'true' : undefined}
  data-pick={onpick ? 'true' : undefined}
  onclick={onpick ? pick : undefined}
  onpointerdown={() => (tugged = false)}
>
  <!-- The projector's motion blur (wheel/drum.ts): sideways only, its width from the drum's speed. -->
  <svg class="reel__filters" aria-hidden="true" focusable="false">
    <filter id="{uid}-blur" x="-5%" y="0" width="110%" height="100%" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="{frame.blurPx} 0" />
    </filter>
  </svg>
  <!-- The tug is decorative play (aria-hidden, no action). -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="drum-box"
    aria-hidden="true"
    bind:clientWidth={width}
    data-tug={canTug ? 'on' : undefined}
    onpointerdown={tugStart}
    onpointermove={tugMove}
    onpointerup={tugEnd}
    onpointercancel={tugEnd}
  >
    <!-- What a finger or the mouse meets over the drum (the drum itself lets them through): the tug's touch-action and
         cursor (player.css). -->
    <span class="drum-box__grip"></span>
    <div class="drum" data-blur={frame.blurPx > 0 ? frame.blurPx : undefined} style:filter={frame.blurPx > 0 ? `url(#${uid}-blur)` : undefined}>
      <div
        class="drum__ring"
        class:has-selection={frame.selectedId !== null}
        data-anim="reel-spin"
        data-turning={moving && !reduced ? 'true' : undefined}
        data-tugging={tugging || undefined}
        data-spring={springing || undefined}
        style:--drum-n={tiles.length}
        style:--drum-turn={frame.position + tug}
      >
        <!-- The tiles' own box, still while the ring turns: the tiles take the ring's tile count from it (player.css). -->
        <div class="drum__tiles">
          {#each tiles as tileSong, i (tileSong)}
            <span class="drum__tile" style:--drum-i={i} data-song-id={tileSong >= 0 ? tileSong : undefined} data-selected={tileSong === frame.selectedId || undefined}>
              {#if tileSong >= 0}
                <Cover songId={tileSong} class="cover--lg" fallback="empty" />
              {:else}
                <span class="reel__back reel__back--{i % 3}"></span>
              {/if}
            </span>
          {/each}
        </div>
      </div>
    </div>
    <span class="drum__window"></span>
  </div>
  <!-- The words in both looks (`drum-collapse`): the big ones under the ring, and the strip's beside it (a copy screen
       readers skip). Which one shows, and the morph between them, follow `--reel-collapse` (player.css). -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="reel__words" data-look="full" role={onpick ? 'button' : undefined} tabindex={onpick ? 0 : undefined} onkeydown={onpick ? pickKey : undefined}>
    {@render words(true)}
  </div>
  <div class="reel__words" data-look="strip" aria-hidden="true">
    {@render words(false)}
    {#if marks.length}
      <span class="reel__marks">{#each marks as identity, i (i)}<span class="reel__mark"><CardMark {identity} decorative /></span>{/each}</span>
    {/if}
  </div>
</div>

{#snippet words(spoken: boolean)}
  {#if titled}
    {#key titled.position}
      <p class="reel__caption" data-anim="landing">
        {#if spoken}<span class="reel__label">{stale ? S.reelSpinning : S.nowPlaying}</span>{/if}
        <strong class="reel__title">{songTitle(catalog, titled.songId)}</strong>
        {#if song?.artist}<span class="reel__artist">{song.artist}</span>{/if}
      </p>
    {/key}
  {:else}
    <p class="reel__waiting">
      {frame.phase === 'waiting' ? S.reelWaiting : S.noSongYet}
      {#if spoken && stale}<span class="reel__label">{S.reelSpinning}</span>{/if}
    </p>
  {/if}
{/snippet}
