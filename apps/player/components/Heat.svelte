<script lang="ts">
  // The Heat as a garland of lights across the top of every screen. Every light is always on: only their colour,
  // glow and twinkle follow the value (eased on its own clock, so it never moves at a landing). It never fills
  // like a bar. The glows twinkle in 3 groups, so the whole garland is 3 animated elements. With no Heat yet it
  // is calm decoration, hidden from screen readers.
  import { PLAYER_CONFIG } from '../config.ts';
  import { garlandLayout } from '../logic/garland.ts';
  import { heatLevel } from '../logic/view.ts';
  import { S } from '../strings.ts';

  let { value }: { value: number | null } = $props();
  const shape = PLAYER_CONFIG.garland;
  const layout = garlandLayout(shape);
  const GROUPS = [0, 1, 2] as const;
  const shown = $derived(value ?? shape.idleHeat);
  const level = $derived(heatLevel(shown));
</script>

<div
  class="heat"
  data-testid="heat"
  data-heat={value === null ? '' : value.toFixed(3)}
  data-level={level}
  data-state={value === null ? 'idle' : 'live'}
  style:--heat={shown.toFixed(3)}
  role={value === null ? undefined : 'img'}
  aria-label={value === null ? undefined : `${S.heatTitle}: ${S.heatLevel[level]}`}
  aria-hidden={value === null ? 'true' : undefined}
>
  <svg class="heat__wire" viewBox="0 0 {shape.width} {shape.height}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path d={layout.wire} vector-effect="non-scaling-stroke" />
  </svg>
  {#each GROUPS as group (group)}
    <div class="heat__glow" data-tone={group} style:--group={group} aria-hidden="true">
      {#each layout.lights as light, i (i)}
        {#if i % GROUPS.length === group}<span class="heat__halo" style:--x={light.x} style:--y="{light.y}px"></span>{/if}
      {/each}
    </div>
  {/each}
  <ul class="heat__garland" aria-hidden="true">
    {#each layout.lights as light, i (i)}
      <li class="heat__light" data-tone={i % GROUPS.length} style:--x={light.x} style:--y="{light.y}px" style:--tilt="{light.angle}deg"></li>
    {/each}
  </ul>
</div>
