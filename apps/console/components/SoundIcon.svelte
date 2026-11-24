<!--
  A sound pad's icon (sound-icons.ts): coloured shapes on a 24×24 grid, each tone from a token (console.css,
  `.sound-icon__…`). Decorative: the pad carries the sound's name as its accessible name and tooltip.
-->
<script lang="ts">
  import type { SoundName } from '@quina/protocol';
  import { SOUND_ICONS, SOUND_STROKE, type SoundShape } from '../sound-icons.ts';

  let { name }: { name: SoundName } = $props();
  const shapes = $derived(SOUND_ICONS[name].shapes);
  const cls = (s: SoundShape) => `sound-icon__fill-${s.fill ?? 'none'} sound-icon__stroke-${s.stroke ?? 'none'}`;
</script>

<svg class="sound-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  {#each shapes as s, i (i)}
    {#if s.tag === 'path'}
      <path {...s.geo} class={cls(s)} stroke-width={s.strokeWidth ?? SOUND_STROKE} />
    {:else if s.tag === 'circle'}
      <circle {...s.geo} class={cls(s)} stroke-width={s.strokeWidth ?? SOUND_STROKE} />
    {:else if s.tag === 'rect'}
      <rect {...s.geo} class={cls(s)} stroke-width={s.strokeWidth ?? SOUND_STROKE} />
    {:else}
      <ellipse {...s.geo} class={cls(s)} stroke-width={s.strokeWidth ?? SOUND_STROKE} />
    {/if}
  {/each}
</svg>
