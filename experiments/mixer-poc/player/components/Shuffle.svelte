<script lang="ts">
  // A simple Shuffle: generic tiles jiggling while the projector shuffles. It never shows songs or an order.
  import { S } from '../strings.ts';

  let { running }: { running: boolean } = $props();
  const TILES = 12;
</script>

<div class="shuffle" data-state={running ? 'running' : 'waiting'}>
  <ul class="shuffle__tiles" aria-hidden="true">
    {#each Array.from({ length: TILES }, (_, i) => i) as i (i)}
      <li class="shuffle__tile reel__back reel__back--{i % 3}" style:--i={i}></li>
    {/each}
  </ul>
  {#if running}<p class="shuffle__label">{S.shuffling}</p>{/if}
</div>
