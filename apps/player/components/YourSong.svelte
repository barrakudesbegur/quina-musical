<script lang="ts">
  // One landing's your-song look (ANIMATIONS.md `your-song`; board "App · quan la cançó és teva (animació final)"):
  // behind the drum, Historial and the cards, the gold background and two stage spotlights; over the content, option
  // A's particles (small and sparse, as on the board); over everything, for 600 ms, the flash that hides the colour
  // change. The parent keys it per landing and removes it at the next Spin: each layer then leaves with its own out
  // transition (`|global`, so they play when the parent block goes). The entry is read once, at mount: a landing seen
  // live flashes, a later one (opening the app) fades in.
  import { untrack } from 'svelte';
  import { cubicInOut } from 'svelte/easing';
  import { yourSongEntry, type YourSong } from '../logic/your-song.ts';
  import CardMark from './CardMark.svelte';

  let { song, nowMs, reduced }: { song: YourSong; nowMs: number; reduced: boolean } = $props();
  const entry = untrack(() => yourSongEntry(song, nowMs, reduced));

  // The out transitions (ms): the gold fades back to night blue, the spotlights lift and fade, the particles fade.
  const OUT = { gold: 900, beams: 760, particles: 520 } as const;
  const fadeOut = (_node: Element, { duration }: { duration: number }) => ({ duration, easing: cubicInOut, css: (t: number) => `opacity: ${t}` });
  const liftOut = (_node: Element, { duration }: { duration: number }) => ({
    duration,
    easing: cubicInOut,
    css: (t: number) => `opacity: ${t}; transform: scaleY(${0.15 + 0.85 * t})`,
  });

  // Option A's particles, placed as on the board (% of the screen); corn is identity 1, the heart identity 5.
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
  <div class="your-song-particles" data-entry={entry} aria-hidden="true" out:fadeOut|global={{ duration: OUT.particles }}>
    <span class="your-song-particles__streak"></span>
    {#each PARTICLES as p, i (i)}
      <span class="your-song-particles__piece" style:left="{p.x}%" style:top="{p.y}%" style:--size="{p.size}px" style:--dur="{p.dur}s" style:--delay="{p.delay}s">
        <CardMark identity={p.mark} decorative />
      </span>
    {/each}
  </div>
{/if}
{#if entry === 'flash'}
  <div class="your-song-flash" data-anim="your-song-flash" aria-hidden="true"></div>
{/if}
