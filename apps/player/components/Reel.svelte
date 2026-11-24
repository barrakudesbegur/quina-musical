<script lang="ts">
  // The Ara reel, synced to the projector's Spin on the cloud's clock. Generic card backs only: the song shows
  // once its landing is public, never before. Reduced motion: a still "Sona la ruleta…".
  import { songTitle, type Catalog } from '../../../packages/ui/data/catalog.ts';
  import type { PublicLanding, PublicSpin } from '../feed/public.ts';
  import { reelState } from '../logic/reel.ts';
  import { S } from '../strings.ts';
  import Cover from './Cover.svelte';

  let {
    spin,
    latest,
    catalog,
    nowMs,
    clockOffsetMs,
    reduced,
    ontick,
  }: {
    spin: PublicSpin | null;
    latest: PublicLanding | null;
    catalog: Catalog | null;
    /** The app's ticking cloud clock (4 per second). */
    nowMs: number;
    /** cloud − local, for the animation frames' own clock. */
    clockOffsetMs: number;
    reduced: boolean;
    ontick?: () => void;
  } = $props();

  const STRIP = 5;
  let frameNow = $state(0);
  const reel = $derived(reelState(spin, latest, reduced ? nowMs : Math.max(frameNow, nowMs)));
  const base = $derived(Math.floor(reel.offset));
  const shift = $derived(-(reel.offset - base) * (100 / STRIP));
  const song = $derived(latest ? catalog?.songs.get(latest.songId) : undefined);

  // While the reel moves, draw it every frame (transform only). Ticks as card backs pass, at most 10 per second.
  $effect(() => {
    if (reduced || !spin) return;
    let raf = 0;
    let lastCard = -1;
    let lastTickAt = 0;
    const loop = () => {
      frameNow = Date.now() + clockOffsetMs;
      const now = reelState(spin, latest, frameNow);
      const card = Math.floor(now.offset);
      if (lastCard >= 0 && card !== lastCard && performance.now() - lastTickAt >= 100) {
        lastTickAt = performance.now();
        ontick?.();
      }
      lastCard = card;
      if (now.phase === 'spinning' || now.phase === 'coasting') raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });
</script>

<div class="reel" data-state={reel.phase}>
  {#if reel.phase === 'landed' && latest}
    {#key latest.position}
      <figure class="reel__landed" data-anim="landing">
        <Cover songId={latest.songId} size="lg" alt="" />
        <figcaption class="reel__caption">
          <span class="reel__label">{S.nowPlaying}</span>
          <strong class="reel__title">{songTitle(catalog, latest.songId)}</strong>
          {#if song?.artist}<span class="reel__artist">{song.artist}</span>{/if}
        </figcaption>
      </figure>
    {/key}
  {:else if (reel.phase === 'spinning' || reel.phase === 'coasting') && reduced}
    <p class="reel__still">{S.reelSpinning}</p>
  {:else if reel.phase === 'spinning' || reel.phase === 'coasting'}
    <div class="reel__window" aria-label={S.reelSpinning} role="img">
      <div class="reel__strip" data-anim="reel-spin" style:transform="translate3d(0, {shift}%, 0)">
        {#each Array.from({ length: STRIP }, (_, i) => base + i) as n (n)}
          <span class="reel__back reel__back--{n % 3}"></span>
        {/each}
      </div>
    </div>
  {:else}
    <div class="reel__window" data-state={reel.phase}>
      <span class="reel__back reel__back--0"></span>
    </div>
    <p class="reel__waiting">{reel.phase === 'stopped' ? S.reelWaiting : S.noSongYet}</p>
  {/if}
</div>
