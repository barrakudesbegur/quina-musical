<!--
  The Wii remote, drawn: the front with each button group in its colour (wii/legend.ts › WII_COLOURS), and the
  side view with the B trigger under the A. Decorative (aria-hidden): the legend next to it says everything.
  The console's Comandament dialog and Admin's printed cheat sheet both draw it. Its size comes from the
  container: set `--wii-height` (the front's height; the side view is in proportion).
-->
<script lang="ts">
  import { WII_COLOURS } from './legend.ts';

  let { sideLabel = null }: { sideLabel?: string | null } = $props();

  const INK = 'var(--color-ink, #17132b)';
  const C = WII_COLOURS;
  const ARROWS = [
    { x: 90, y: 96, rot: 0 },
    { x: 122, y: 128, rot: 90 },
    { x: 90, y: 162, rot: 180 },
    { x: 58, y: 128, rot: 270 },
  ];
  const NUMBERS = [
    { n: '1', y: 430 },
    { n: '2', y: 488 },
  ];
</script>

<div class="wii-remote" aria-hidden="true">
  <svg class="wii-remote__front" viewBox="0 0 180 580" focusable="false">
    <rect x="20" y="10" width="140" height="560" rx="52" style:fill="#ffffff" style:stroke={INK} stroke-width="5" />
    <rect x="78" y="34" width="24" height="12" rx="6" style:fill={C.back} style:stroke={INK} stroke-width="3" />
    <!-- the D-pad -->
    <path d="M74 82h32v30h30v32h-30v30H74v-30H44v-32h30z" style:fill={C.dpad} style:stroke={INK} stroke-width="4" stroke-linejoin="round" />
    {#each ARROWS as a (a.rot)}
      <path d="M-6 4L0 -5L6 4Z" fill="#fff6e5" transform="translate({a.x} {a.y}) rotate({a.rot})" />
    {/each}
    <!-- A -->
    <circle cx="90" cy="238" r="30" style:fill={C.a} style:stroke={INK} stroke-width="5" />
    <text x="90" y="250" text-anchor="middle" class="wii-remote__letter" font-size="34" style:fill={INK}>A</text>
    <!-- − HOME + -->
    <circle cx="48" cy="330" r="14" style:fill={C.talk} style:stroke={INK} stroke-width="4" />
    <path d="M41 330h14" style:stroke={INK} stroke-width="4" stroke-linecap="round" />
    <circle cx="132" cy="330" r="14" style:fill={C.talk} style:stroke={INK} stroke-width="4" />
    <path d="M125 330h14M132 323v14" style:stroke={INK} stroke-width="4" stroke-linecap="round" />
    <circle cx="90" cy="330" r="16" style:fill={C.home} style:stroke={INK} stroke-width="4" />
    <path d="M82 334v-6l8-7 8 7v6z" fill="#fff6e5" style:stroke={INK} stroke-width="2" stroke-linejoin="round" />
    <!-- 1 2 -->
    {#each NUMBERS as b (b.n)}
      <circle cx="90" cy={b.y} r="22" style:fill={C.back} style:stroke={INK} stroke-width="4" />
      <text x="90" y={b.y + 10} text-anchor="middle" class="wii-remote__letter" font-size="28" style:fill={INK}>{b.n}</text>
    {/each}
    <!-- the LEDs: the first one lit -->
    {#each [0, 1, 2, 3] as i (i)}
      <rect x={57 + i * 18} y="540" width="10" height="10" rx="2" style:fill={i === 0 ? C.talk : '#cfcbdd'} style:stroke={INK} stroke-width="2" />
    {/each}
  </svg>

  <span class="wii-remote__side">
    <svg viewBox="0 0 110 240" focusable="false">
      <rect x="20" y="10" width="44" height="220" rx="20" style:fill="#ffffff" style:stroke={INK} stroke-width="5" />
      <path d="M64 70c18 4 20 40 0 46z" style:fill={C.b} style:stroke={INK} stroke-width="4" stroke-linejoin="round" />
      <text x="98" y="102" text-anchor="middle" class="wii-remote__letter" font-size="24" style:fill={INK}>B</text>
    </svg>
    {#if sideLabel}<span class="wii-remote__side-label">{sideLabel}</span>{/if}
  </span>
</div>

<style>
  @layer components {
  .wii-remote {
    --wii-height-used: var(--wii-height, 22rem);
    display: flex;
    align-items: center;
    gap: calc(var(--wii-height-used) * 0.04);
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .wii-remote__front {
    flex: none;
    width: auto;
    height: var(--wii-height-used);
    aspect-ratio: 180 / 580;
  }
  .wii-remote__side {
    display: flex;
    flex: none;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }
  .wii-remote__side svg {
    width: auto;
    height: calc(var(--wii-height-used) * 0.41);
    aspect-ratio: 110 / 240;
  }
  .wii-remote__side-label {
    color: var(--wii-muted, currentColor);
    font-size: 0.8125rem;
    font-weight: 800;
  }
  .wii-remote__letter {
    font-family: var(--font-display, 'Londrina Solid', system-ui, sans-serif);
    font-weight: 900;
  }
  }
</style>
