<script lang="ts">
  // The Heat as a garland of lights across the top of every screen (ANIMATIONS.md `heat` and "The garland's lights",
  // D-t). Its colour and glow follow the value (eased on its own clock, so it never moves at a landing); its lights play
  // a pattern for the Heat's level, `party` while the landed song is the player's (`your-song`) and `win` in a
  // Celebration's scene. It never fills like a bar. Each bulb is its dark glass, a lamp (the light and its halo: the
  // only part that moves, by opacity) and its outline with the cap; its part in the pattern is set once as custom
  // properties, so the CSS keyframes run it with no JS per frame. With no Heat yet it is calm decoration, hidden from
  // screen readers. `off`: the phone is offline, so the lights go out. `covered`: the Celebration's screen hides it, so
  // it pauses.
  import { PLAYER_CONFIG } from '../config.ts';
  import { garlandBulbs, garlandLayout, garlandLights, type GarlandBulb, type GarlandMood } from '../../../packages/ui/motion/garland.ts';
  import { S } from '../strings.ts';

  let {
    value,
    off = false,
    party = false,
    win = false,
    covered = false,
  }: { value: number | null; off?: boolean; party?: boolean; win?: boolean; covered?: boolean } = $props();
  const shape = PLAYER_CONFIG.garland;
  const layout = garlandLayout(shape);
  const bulbs = garlandBulbs(shape.bulbs, shape.flameEvery, Math.random);
  /** The `party` pattern blinks these groups (3 animated elements); the other patterns move each lamp. */
  const GROUPS = [0, 1, 2] as const;
  const shown = $derived(value ?? shape.idleHeat);
  const mood: GarlandMood = $derived(off ? 'off' : party ? 'party' : win ? 'win' : value === null ? 'idle' : 'live');
  const lights = $derived(garlandLights(shown, mood));
  /** A bulb's place on the wire and in the pattern, the same on each of its pieces. */
  const place = (bulb: GarlandBulb) => {
    const light = layout.lights[bulb.index];
    return `--x:${light.x};--y:${light.y}px;--tilt:${light.angle}deg;--i:${bulb.index};--seed:${bulb.seed}`;
  };
</script>

<div
  class="heat"
  data-testid="heat"
  data-heat={value === null ? '' : value.toFixed(3)}
  data-level={lights.level}
  data-state={off ? 'off' : value === null ? 'idle' : 'live'}
  data-pattern={lights.pattern}
  data-palette={lights.palette}
  data-fire={lights.fire ? 'on' : 'off'}
  data-covered={covered ? 'true' : 'false'}
  style:--heat={shown.toFixed(3)}
  style:--period="{lights.periodMs}ms"
  style:--n={bulbs.length}
  role={value === null ? undefined : 'img'}
  aria-label={value === null ? undefined : `${S.heatTitle}: ${S.heatLevel[lights.level]}`}
  aria-hidden={value === null ? 'true' : undefined}
>
  <svg class="heat__wire" viewBox="0 0 {shape.width} {shape.height}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path d={layout.wire} vector-effect="non-scaling-stroke" />
  </svg>
  <!-- Each bulb's pieces in layers, bottom first: its flame, its glass, its lamp (in its third's group, so `party` can
       blink a group by one opacity) and its outline. One layer per piece keeps every halo above every glass and
       under every outline, and dims only the light, never the ink. -->
  <div class="heat__garland" aria-hidden="true">
    <div class="heat__layer">
      {#each bulbs as bulb (bulb.index)}
        {#if bulb.flame}<span class="heat__flame" style={place(bulb)}></span>{/if}
      {/each}
    </div>
    <div class="heat__layer">
      {#each bulbs as bulb (bulb.index)}
        <span class="heat__piece heat__glass" data-tone={bulb.step} data-party={bulb.party} style={place(bulb)}></span>
      {/each}
    </div>
    {#each GROUPS as group (group)}
      <div class="heat__layer heat__group" style:--step={group}>
        {#each bulbs as bulb (bulb.index)}
          {#if bulb.step === group}
            <span
              class="heat__piece heat__lamp"
              data-tone={bulb.step}
              data-party={bulb.party}
              data-dim={bulb.index % 4 === 1 ? '' : undefined}
              style={place(bulb)}
            ></span>
          {/if}
        {/each}
      </div>
    {/each}
    <div class="heat__layer">
      {#each bulbs as bulb (bulb.index)}
        <span class="heat__piece heat__shell" style={place(bulb)}></span>
      {/each}
    </div>
  </div>
</div>
