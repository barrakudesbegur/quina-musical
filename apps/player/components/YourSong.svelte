<script lang="ts">
  // One landing's your-song look (ANIMATIONS.md `your-song`; board "App · quan la cançó és teva (animació final)"):
  // behind the drum, Historial and the cards, the gold background and two stage spotlights; over the content, option
  // A's particles (small and sparse, as on the board) and a comet falling from the sky (a new place and angle on every
  // pass, the user's comment #93: picked when the last pass ends, never per frame); over everything, for 600 ms, the
  // flash that hides the colour
  // change. The parent keys it per landing and removes it at the next Spin: each layer then leaves with its own out
  // transition (`|global`, so they play when the parent block goes). The entry is read once, at mount: a landing seen
  // live flashes, a later one (opening the app) fades in. The flash and the particles are over everything, open drawers
  // included (D90): a manual popover puts them in the top layer, shown again whenever a drawer opens (`layer` changes),
  // since the newest top-layer element is drawn on top. Where the browser has no popovers, they stay over the home.
  // The particles are the marks of the phone's cards that hold the song (`marks`, §8 Y1), in turn; while the look shows,
  // the browser's bar (`theme-color`) is gold too, and back to the night when it goes.
  import { untrack } from 'svelte';
  import { cubicInOut } from 'svelte/easing';
  import { COMET, THEME_COLOR, cometPass, yourSongEntry, type YourSong } from '../logic/your-song.ts';
  import CardMark from './CardMark.svelte';

  let {
    song,
    nowMs,
    reduced,
    layer = 0,
    marks = [],
  }: { song: YourSong; nowMs: number; reduced: boolean; layer?: number; /** The identities of the cards holding the song. */ marks?: readonly number[] } = $props();

  // The browser's bar: the tokens' colours as constants, so the landing's task never forces a style recalc to read them.
  $effect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', THEME_COLOR.gold);
    return () => meta.setAttribute('content', THEME_COLOR.night);
  });
  const entry = untrack(() => yourSongEntry(song, nowMs, reduced));
  /** The flash plays once, then goes, so showing the layer again never replays it. */
  const FLASH_MS = 600;
  let flashing = $state(entry === 'flash');
  /** Once the particles have come in, showing the layer again doesn't fade them in again. */
  let settled = $state(false);
  let top: HTMLDivElement | undefined = $state();
  /** The comet's pass: each one falls once, then the next is drawn somewhere else. */
  let comet = $state({ n: 0, ...cometPass(Math.random) });
  const nextComet = () => (comet = { n: comet.n + 1, ...cometPass(Math.random) });

  $effect(() => {
    const done = setTimeout(() => (flashing = false), FLASH_MS + 50);
    const calm = setTimeout(() => (settled = true), 1000);
    return () => {
      clearTimeout(done);
      clearTimeout(calm);
    };
  });

  // Shown in the next animation frame, before it is drawn: `showPopover()` brings the page's style up to date, so
  // called right after the landing's DOM changes it forced the whole recalc inside the landing's task (40 ms at 4×
  // CPU); in the frame that recalc is the frame's own. It still shows in the landing's first frame.
  $effect(() => {
    void layer;
    const el = top;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      if (el.matches(':popover-open')) el.hidePopover();
      el.showPopover();
    });
    return () => cancelAnimationFrame(raf);
  });

  // The out transitions (ms): the gold fades back to night blue, the spotlights lift and fade, the particles fade.
  const OUT = { gold: 900, beams: 760, particles: 520 } as const;
  const fadeOut = (_node: Element, { duration }: { duration: number }) => ({ duration, easing: cubicInOut, css: (t: number) => `opacity: ${t}` });
  const liftOut = (_node: Element, { duration }: { duration: number }) => ({
    duration,
    easing: cubicInOut,
    css: (t: number) => `opacity: ${t}; transform: scaleY(${0.15 + 0.85 * t})`,
  });

  // Option A's particles, placed as on the board (% of the screen); `mark` (corn 1, heart 5) only when no card is known.
  const PARTICLES: readonly { x: number; y: number; size: number; dur: number; delay: number; mark: number }[] = [
    { x: 34, y: 86, size: 34, dur: 3.47, delay: 1.11, mark: 1 },
    { x: 85, y: 85, size: 34, dur: 2.7, delay: 0.04, mark: 5 },
    { x: 36, y: 81, size: 34, dur: 2.97, delay: 2.99, mark: 5 },
    { x: 73, y: 81, size: 26, dur: 3.36, delay: 1.92, mark: 1 },
    { x: 4, y: 22, size: 22, dur: 2.86, delay: 2.87, mark: 1 },
    { x: 42, y: 18, size: 34, dur: 3.92, delay: 0.81, mark: 5 },
    { x: 58, y: 62, size: 26, dur: 3.77, delay: 1.73, mark: 1 },
    { x: 51, y: 26, size: 30, dur: 2.66, delay: 1.48, mark: 5 },
    { x: 78, y: 57, size: 26, dur: 3.45, delay: 1.22, mark: 1 },
    { x: 60, y: 90, size: 34, dur: 3.97, delay: 1.26, mark: 5 },
  ];
</script>

<div class="your-song" data-anim="your-song" data-entry={entry} data-testid="your-song" data-song-id={song.songId} aria-hidden="true">
  <div class="your-song__gold" out:fadeOut|global={{ duration: reduced ? 0 : OUT.gold }}></div>
  <div class="your-song__beams" out:liftOut|global={{ duration: reduced ? 0 : OUT.beams }}>
    <span class="your-song__beam your-song__beam--left"></span>
    <span class="your-song__beam your-song__beam--right"></span>
  </div>
</div>
{#if entry !== 'still'}
  <div class="your-song-top" popover="manual" bind:this={top} aria-hidden="true">
    <div class="your-song-particles" data-entry={settled ? 'settled' : entry} out:fadeOut|global={{ duration: OUT.particles }}>
      {#key comet.n}
        <span
          class="your-song-particles__comet"
          style:--from-x="{comet.fromX}vw"
          style:--from-y="{COMET.fromY}vh"
          style:--to-y="{COMET.toY}vh"
          style:--drift="{comet.driftVh}vh"
          style:--angle="{comet.angle}deg"
          onanimationend={nextComet}
        ></span>
      {/key}
      {#each PARTICLES as p, i (i)}
        <span class="your-song-particles__piece" style:left="{p.x}%" style:top="{p.y}%" style:--size="{p.size}px" style:--dur="{p.dur}s" style:--delay="{p.delay}s">
          <CardMark identity={marks.length ? marks[i % marks.length] : p.mark} decorative />
        </span>
      {/each}
    </div>
    {#if flashing}
      <div class="your-song-flash" data-anim="your-song-flash"></div>
    {/if}
  </div>
{/if}
