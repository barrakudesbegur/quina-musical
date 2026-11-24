<script lang="ts">
  // A card's mark: its own icon in its own colour (identity N = --card-color-N plus icon N), so a player who
  // follows several cards can tell them apart by shape alone, colour-blind or not. The first card is always
  // corn, like the seeds on the paper cards; the rest are the Christmas set the user chose. Identity 6 is black,
  // so its outline is paper instead of ink (--card-line-N).
  import { markName } from '../logic/marks-identity.ts';

  let { identity, decorative = false }: { identity: number; decorative?: boolean } = $props();
  const kind = $derived(markName(identity));
  // The big star, a little down and left, with its tail streaking off the top-right (like fa-star-shooting).
  const STAR = 'M9.60 5.60L11.77 11.21L17.78 11.54L13.12 15.34L14.65 21.16L9.60 17.90L4.55 21.16L6.08 15.34L1.42 11.54L7.43 11.21Z';
  const TAILS = 'M11.72 7.27L15.40 3.59M14.83 8.97L20.21 3.59M16.53 12.08L20.21 8.40';
  const FLAKE =
    'M12 12V3M12 6.4L9.81 4.21M12 6.4L14.19 4.21M12 12L4.21 7.5M7.15 9.2L4.16 10M7.15 9.2L6.35 6.21M12 12L4.21 16.5M7.15 14.8L6.35 17.79M7.15 14.8L4.16 14M12 12V21M12 17.6L14.19 19.79M12 17.6L9.81 19.79M12 12L19.79 16.5M16.85 14.8L19.84 14M16.85 14.8L17.65 17.79M12 12L19.79 7.5M16.85 9.2L17.65 6.21M16.85 9.2L19.84 10';
</script>

<svg
  class="card-mark"
  data-mark={kind}
  viewBox="-1 -1 26 26"
  style:--card-color="var(--card-color-{identity})"
  style:--card-line="var(--card-line-{identity}, var(--color-line))"
  role={decorative ? undefined : 'img'}
  aria-hidden={decorative ? 'true' : undefined}
  aria-label={decorative ? undefined : kind}
>
  {#if kind === 'corn'}
    <path class="card-mark__fill" d="M12 2.5c4.5 0 8 3.2 7.6 8.5-.4 5.4-3.8 11-7.6 11s-7.2-5.6-7.6-11C4 5.7 7.5 2.5 12 2.5z" />
    <path class="card-mark__shine" d="M8.6 7.6c.8-1.6 2.2-2.4 3.8-2.4" />
  {:else if kind === 'shootingStar'}
    <path class="card-mark__trail-under" d={TAILS} />
    <path class="card-mark__trail" d={TAILS} />
    <path class="card-mark__fill" d={STAR} />
  {:else if kind === 'moon'}
    <path class="card-mark__fill" d="M15.2 3.2a8.8 8.8 0 1 0 5.6 15.1A7.3 7.3 0 0 1 15.2 3.2z" />
  {:else if kind === 'tree'}
    <path class="card-mark__fill" d="M12 2.2L16.6 8H14.6L18.8 13.4H16.4L20.6 19.2H3.4L7.6 13.4H5.2L9.4 8H7.4Z" />
    <rect class="card-mark__trunk" x="10.4" y="19.2" width="3.2" height="3" rx=".6" />
  {:else if kind === 'snowflake'}
    <path class="card-mark__trail-under" d={FLAKE} />
    <path class="card-mark__trail" d={FLAKE} />
  {:else if kind === 'clubs'}
    <path class="card-mark__fill" d="M12 3.6a3.7 3.7 0 0 1 3.3 5.4 3.7 3.7 0 1 1-1.6 6.3l1.1 5.2H9.2l1.1-5.2A3.7 3.7 0 1 1 8.7 9 3.7 3.7 0 0 1 12 3.6z" />
  {:else if kind === 'bauble'}
    <path class="card-mark__line" d="M10.9 4.4a1.5 1.5 0 1 1 2.2 0" />
    <rect class="card-mark__gold" x="9.8" y="4.6" width="4.4" height="2.8" rx=".8" />
    <circle class="card-mark__fill" cx="12" cy="14.4" r="7.4" />
    <path class="card-mark__shine" d="M8.4 12.6a4.4 4.4 0 0 1 2.8-2.8" />
  {:else}
    <path class="card-mark__fill" d="M4 20.2V7.8L8.6 12L12 4.8L15.4 12L20 7.8V20.2Z" />
    <circle class="card-mark__pearl" cx="4" cy="7.4" r="1.6" />
    <circle class="card-mark__pearl" cx="12" cy="4.4" r="1.6" />
    <circle class="card-mark__pearl" cx="20" cy="7.4" r="1.6" />
    <path class="card-mark__jewel" d="M12 11.6L14.4 14.8L12 18L9.6 14.8Z" />
  {/if}
</svg>

<style>
  .card-mark {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .card-mark__fill {
    fill: var(--card-color);
    stroke: var(--card-line);
    stroke-width: 2;
    stroke-linejoin: round;
  }
  /* Line icons (the shooting star's tails, the snowflake): a thick outline under a coloured stroke. */
  .card-mark__trail-under {
    fill: none;
    stroke: var(--card-line);
    stroke-width: 4.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .card-mark__trail {
    fill: none;
    stroke: var(--card-color);
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .card-mark__line {
    fill: none;
    stroke: var(--color-line);
    stroke-width: 1.6;
    stroke-linecap: round;
  }
  .card-mark__shine {
    fill: none;
    stroke: var(--color-paper);
    stroke-width: 2;
    stroke-linecap: round;
  }
  .card-mark__trunk,
  .card-mark__gold,
  .card-mark__pearl,
  .card-mark__jewel {
    stroke: var(--color-line);
    stroke-width: 1.6;
    stroke-linejoin: round;
  }
  .card-mark__trunk {
    fill: var(--color-wood);
  }
  .card-mark__gold {
    fill: var(--color-gold);
  }
  .card-mark__pearl {
    fill: var(--color-paper);
  }
  .card-mark__jewel {
    fill: var(--color-red);
    stroke-width: 1.4;
  }
</style>
