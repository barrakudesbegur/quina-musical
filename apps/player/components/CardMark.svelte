<script lang="ts">
  // A card's mark: its own icon in its own colour (identity N = --card-color-N plus icon N), so a player who
  // follows several cards can tell them apart by shape alone, colour-blind or not. The first card is always
  // corn, like the seeds on the paper cards; the rest are the Christmas set the user chose. Identity 6 is black,
  // so its outline is paper instead of ink (--card-line-N).
  import { markName } from '../logic/marks-identity.ts';

  let { identity, decorative = false }: { identity: number; decorative?: boolean } = $props();
  const kind = $derived(markName(identity));
  const STAR = 'M15.4 2.2L16.99 6.42L21.49 6.62L17.97 9.43L19.16 13.78L15.4 11.3L11.64 13.78L12.83 9.43L9.31 6.62L13.81 6.42Z';
  const TAILS = 'M10.6 13.4L3.2 20.8M12.6 15.6L7.6 20.6M8.4 11.4L3.4 16.4';
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
    <path class="card-mark__fill" d="M4 17.6V7.8L8.6 12L12 4.8L15.4 12L20 7.8V17.6Z" />
    <rect class="card-mark__band" x="4" y="16.2" width="16" height="4" rx="1" />
    <circle class="card-mark__pearl" cx="4" cy="7.4" r="1.6" />
    <circle class="card-mark__pearl" cx="12" cy="4.4" r="1.6" />
    <circle class="card-mark__pearl" cx="20" cy="7.4" r="1.6" />
    <circle class="card-mark__jewel" cx="12" cy="18.2" r="1.1" />
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
  .card-mark__band,
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
  .card-mark__band {
    fill: var(--color-orange-edge);
    stroke-width: 2;
  }
  .card-mark__pearl {
    fill: var(--color-paper);
  }
  .card-mark__jewel {
    fill: var(--color-red);
    stroke-width: 1.2;
  }
</style>
