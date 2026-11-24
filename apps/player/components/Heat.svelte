<script lang="ts">
  // The Heat as a garland of lights: its colour and twinkle follow the value (eased on its own clock, so it
  // never moves at a landing). It never fills like a bar.
  import { heatLevel } from '../logic/view.ts';
  import { S } from '../strings.ts';

  let { value }: { value: number } = $props();
  const level = $derived(heatLevel(value));
  const LIGHTS = 10;
</script>

<section class="heat" data-level={level} style:--heat={value.toFixed(3)} aria-label="{S.heatTitle}: {S.heatLevel[level]}">
  <h3 class="heat__title">{S.heatTitle}</h3>
  <ul class="heat__garland" aria-hidden="true">
    {#each Array.from({ length: LIGHTS }, (_, i) => i) as i (i)}
      <li class="heat__light" style:--i={i}></li>
    {/each}
  </ul>
  <p class="heat__label">{S.heatLevel[level]}</p>
</section>
