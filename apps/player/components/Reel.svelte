<script lang="ts">
  // The Ara drum (board Mobil-B-J2), synced to the projector's Spin on the cloud's clock: a ring of ten cover tiles in
  // 3D, the front one in the gold window. The tiles show songs still to come (`songs`, logic/reel.ts drumSongs), in an
  // order with nothing to do with the Queue, blurred until a landing is public; then the landed song flips in on the
  // front tile. The ring turns tile by tile and stops on a whole one (ANIMATIONS.md `reel-spin`, `landing`). Reduced
  // motion: the ring stays still, with "Sona la ruleta…". `compact` draws it small in the strip over the cards;
  // `stopped` holds it still while the phone is offline (the drum stops).
  import { songTitle, type Catalog } from '../../../packages/ui/data/catalog.ts';
  import type { PublicLanding, PublicSpin } from '../feed/public.ts';
  import { DRUM_TILES, drumTurn, reelOffset, reelState } from '../logic/reel.ts';
  import { S } from '../strings.ts';
  import Cover from '../../../packages/ui/components/Cover.svelte';

  let {
    spin,
    latest,
    catalog,
    songs,
    nowMs,
    clockOffsetMs,
    reduced,
    compact = false,
    stopped = false,
    ontick,
  }: {
    spin: PublicSpin | null;
    latest: PublicLanding | null;
    catalog: Catalog | null;
    /** The song on each tile (drumSongs): songs still to come, `null` for a card back. */
    songs: readonly (number | null)[];
    /** The app's ticking cloud clock (4 per second). */
    nowMs: number;
    /** cloud − local, for the animation frames' own clock. */
    clockOffsetMs: number;
    reduced: boolean;
    compact?: boolean;
    stopped?: boolean;
    ontick?: () => void;
  } = $props();

  let frameNow = $state(0);
  const moving = $derived(reelState(spin, latest, reduced ? nowMs : Math.max(frameNow, nowMs)));
  // Offline, a spin in progress freezes where it is: nothing moves until the link is back.
  const reel = $derived(stopped && (moving.phase === 'spinning' || moving.phase === 'coasting') ? { phase: 'stopped' as const, offset: moving.offset } : moving);
  const turning = $derived(reel.phase === 'spinning' || reel.phase === 'coasting' || reel.phase === 'stopped');
  const song = $derived(latest ? catalog?.songs.get(latest.songId) : undefined);
  /** The tiles a Spin ends after, so the ring stops on a whole tile. */
  const final = $derived(spin && spin.landAtMs !== null ? reelOffset(spin.landAtMs - spin.startAtMs, spin.landAtMs - spin.startAtMs) : null);

  // Where the ring stands when still (whole tiles); while it turns, it moves on from there.
  let rest = $state(0);
  let lastTurn = 0;
  let wasTurning = false;
  // Offline it holds where it was (`stopped`); reduced motion keeps it still.
  const turn = $derived(turning && !reduced ? (stopped ? lastTurn : rest + drumTurn(reel.offset, final)) : rest);
  $effect(() => {
    if (turning) {
      lastTurn = turn;
      wasTurning = true;
    } else if (wasTurning) {
      wasTurning = false;
      rest = Math.round(lastTurn);
    }
  });
  const front = $derived(((rest % DRUM_TILES) + DRUM_TILES) % DRUM_TILES);
  const landed = $derived(reel.phase === 'landed' && latest ? latest : null);

  // While the drum turns, draw it every frame (transform only). Ticks as tiles pass the window, at most 10 per second.
  $effect(() => {
    if (reduced || stopped || !spin) return;
    let raf = 0;
    let lastTile = -1;
    let lastTickAt = 0;
    const loop = () => {
      frameNow = Date.now() + clockOffsetMs;
      const now = reelState(spin, latest, frameNow);
      const tile = Math.floor(drumTurn(now.offset, final));
      if (lastTile >= 0 && tile !== lastTile && performance.now() - lastTickAt >= 100) {
        lastTickAt = performance.now();
        ontick?.();
      }
      lastTile = tile;
      if (now.phase === 'spinning' || now.phase === 'coasting') raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });
</script>

<div class="reel" data-testid="reel" data-state={reel.phase} data-size={compact ? 'strip' : 'full'} data-blur={landed ? undefined : 'true'}>
  <div class="drum" aria-hidden="true">
    <div class="drum__ring" data-anim="reel-spin" data-turning={turning && !reduced ? 'true' : undefined} style:--turn={turn}>
      {#each songs as tileSong, i (i)}
        <span class="drum__tile" style:--i={i}>
          {#if landed && i === front}
            {#key landed.position}
              <span class="drum__landed" data-anim="landing"><Cover songId={landed.songId} class="cover--lg" fallback="empty" /></span>
            {/key}
          {:else if tileSong !== null}
            <Cover songId={tileSong} class="cover--lg" fallback="empty" />
          {:else}
            <span class="reel__back reel__back--{i % 3}"></span>
          {/if}
        </span>
      {/each}
    </div>
    <span class="drum__window"></span>
  </div>
  {#if landed}
    {#key landed.position}
      <p class="reel__caption" data-anim="landing">
        <span class="reel__label">{S.nowPlaying}</span>
        <strong class="reel__title">{songTitle(catalog, landed.songId)}</strong>
        {#if song?.artist}<span class="reel__artist">{song.artist}</span>{/if}
      </p>
    {/key}
  {:else if (reel.phase === 'spinning' || reel.phase === 'coasting') && reduced}
    <p class="reel__still">{S.reelSpinning}</p>
  {:else if reel.phase === 'spinning' || reel.phase === 'coasting'}
    <p class="reel__caption"><strong class="reel__title" aria-label={S.reelSpinning}>?</strong></p>
  {:else}
    <p class="reel__waiting">{reel.phase === 'stopped' ? S.reelWaiting : S.noSongYet}</p>
  {/if}
</div>
