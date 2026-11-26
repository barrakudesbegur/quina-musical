<!--
  The two throw songs' stickers (the Consola-Llancament-Tempesta board): «Llançament», a wrapped sweet flying with
  speed lines; «Tempesta», three corn kernels with sparks. Coloured like the board (ink outlines, paper and gold), so
  they stay stickers on any button colour. Decorative: the button's label names it.
-->
<script lang="ts">
  import type { ThrowSong } from '@quina/protocol';

  let { song }: { song: ThrowSong } = $props();
  const KERNELS = [
    'translate(2 14) rotate(-38 12 12)',
    'translate(22 1) scale(0.82) rotate(28 12 12)',
    'translate(19 21) scale(1.1) rotate(10 12 12)',
  ];
</script>

{#if song === 'throw'}
  <svg class="throw-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path class="throw-icon__under" d="M1.5 15.5h5M3 19.5h5.5M4.5 11.5h3" />
    <path class="throw-icon__line" d="M1.5 15.5h5M3 19.5h5.5M4.5 11.5h3" />
    <g transform="rotate(-24 14.5 10.5)">
      <path class="throw-icon__wrap" d="M10.4 10.5L5.8 7.2v6.6zM18.6 10.5l4.6-3.3v6.6z" />
      <ellipse class="throw-icon__sweet" cx="14.5" cy="10.5" rx="4.6" ry="4" />
      <path class="throw-icon__stripes" d="M12.4 7.2l2.6 6.4M15.4 6.8l2 4.6M11 9.6l1.4 3.4" />
    </g>
  </svg>
{:else}
  <svg class="throw-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path class="throw-icon__under throw-icon__under--wide" d="M3 12l4 1.5M40 6l4.5-2M42 40l4 2.5M9 42l-3.5 3" />
    <path class="throw-icon__line throw-icon__line--wide" d="M3 12l4 1.5M40 6l4.5-2M42 40l4 2.5M9 42l-3.5 3" />
    {#each KERNELS as transform (transform)}
      <g {transform}>
        <path class="throw-icon__kernel" d="M12 2.5c4.5 0 8 3.2 7.6 8.5-.4 5.4-3.8 11-7.6 11s-7.2-5.6-7.6-11C4 5.7 7.5 2.5 12 2.5z" />
        <path class="throw-icon__shine" d="M8.6 7.6c.8-1.6 2.2-2.4 3.8-2.4" />
        <path class="throw-icon__tip" d="M12 18.6c-1.3 0-2.1-1.3-2.1-2.6" />
      </g>
    {/each}
  </svg>
{/if}

<style>
  .throw-icon {
    flex: none;
    width: 3.25rem;
    height: 3.25rem;
    overflow: visible;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .throw-icon__under {
    fill: none;
    stroke: var(--color-ink);
    stroke-width: 4.4;
  }
  .throw-icon__line {
    fill: none;
    stroke: #ffffff;
    stroke-width: 1.8;
  }
  .throw-icon__under--wide {
    stroke-width: 5;
  }
  .throw-icon__line--wide {
    stroke-width: 2;
  }
  .throw-icon__wrap {
    fill: #fff6e5;
    stroke: var(--color-ink);
    stroke-width: 1.7;
  }
  .throw-icon__sweet {
    fill: #ffffff;
    stroke: var(--color-ink);
    stroke-width: 1.7;
  }
  .throw-icon__stripes {
    fill: none;
    stroke: var(--action-throw, #ff4fa3);
    stroke-width: 1.5;
  }
  .throw-icon__kernel {
    fill: var(--color-gold);
    stroke: var(--color-ink);
    stroke-width: 2;
  }
  .throw-icon__shine {
    fill: none;
    stroke: #fff6e5;
    stroke-width: 2;
  }
  .throw-icon__tip {
    fill: none;
    stroke: var(--color-gold-edge);
    stroke-width: 1.6;
  }
</style>
