<script lang="ts">
  // A card's mark: its own icon in its own colour (identity N = --card-color-N plus icon N), so a player who
  // follows several cards can tell them apart by shape alone, colour-blind or not. The first card is always
  // corn, like the seeds on the paper cards; the rest are the Christmas and New Year set the user chose.
  // Identity 9 is black, so its outline is paper instead of ink (--card-line-N), drawn outside the shape only.
  import { markName } from '../logic/marks-identity.ts';

  let { identity, decorative = false }: { identity: number; decorative?: boolean } = $props();
  const kind = $derived(markName(identity));
  // The big star (rounded tips) with one tail off its top-right: narrow at the star, forking out into a W.
  const STAR = 'M9.61 5.31Q10.30 3.60 10.99 5.31L12.95 10.16L18.17 10.52Q20.00 10.65 18.59 11.83L14.58 15.19L15.85 20.27Q16.30 22.05 14.74 21.08L10.30 18.30L5.86 21.08Q4.30 22.05 4.75 20.27L6.02 15.19L2.01 11.83Q0.60 10.65 2.43 10.52L7.65 10.16Z';
  const TAIL = 'M13.27 10.83L16.31 0.86L16.45 4.40L20.55 3.55L19.70 7.65L23.24 7.79Z';
  const FLAKE =
    'M12 12V3M12 6.4L9.81 4.21M12 6.4L14.19 4.21M12 12L4.21 7.5M7.15 9.2L4.16 10M7.15 9.2L6.35 6.21M12 12L4.21 16.5M7.15 14.8L6.35 17.79M7.15 14.8L4.16 14M12 12V21M12 17.6L14.19 19.79M12 17.6L9.81 19.79M12 12L19.79 16.5M16.85 14.8L19.84 14M16.85 14.8L17.65 17.79M12 12L19.79 7.5M16.85 9.2L17.65 6.21M16.85 9.2L19.84 10';
  // New Year's grapes, laid out like a play button (3, 2, 1) so they never read as the heart.
  const GRAPES: readonly [number, number][] = [[8.6, 6.6], [8.6, 11.8], [8.6, 17], [13.1, 9.2], [13.1, 14.4], [17.6, 11.8]];
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
    <!-- The dark shade at the bottom, as on the design system's corn (the user, 25 Nov). -->
    <path class="card-mark__shade" d="M12 18.6c-1.3 0-2.1-1.3-2.1-2.6" />
  {:else if kind === 'shootingStar'}
    <path class="card-mark__fill" d={TAIL} />
    <path class="card-mark__fill" d={STAR} />
  {:else if kind === 'bauble'}
    <path class="card-mark__line" d="M10.9 4.4a1.5 1.5 0 1 1 2.2 0" />
    <rect class="card-mark__gold" x="9.8" y="4.6" width="4.4" height="2.8" rx=".8" />
    <circle class="card-mark__fill" cx="12" cy="14.4" r="7.4" />
    <path class="card-mark__shine" d="M8.4 12.6a4.4 4.4 0 0 1 2.8-2.8" />
  {:else if kind === 'tree'}
    <path class="card-mark__fill" d="M12 2.2L16.6 8H14.6L18.8 13.4H16.4L20.6 19.2H3.4L7.6 13.4H5.2L9.4 8H7.4Z" />
    <rect class="card-mark__trunk" x="10.4" y="19.2" width="3.2" height="3" rx=".6" />
  {:else if kind === 'heart'}
    <path class="card-mark__fill" d="M12 20.6L4.4 13.3a4.7 4.7 0 0 1 6.6-6.7l1 1 1-1a4.7 4.7 0 0 1 6.6 6.7Z" />
    <path class="card-mark__shine" d="M6.6 9.6a2.4 2.4 0 0 1 2-1.6" />
  {:else if kind === 'crown'}
    <path class="card-mark__fill" d="M4 20.2V7.8L8.6 12L12 4.8L15.4 12L20 7.8V20.2Z" />
    <circle class="card-mark__pearl" cx="4" cy="7.4" r="1.6" />
    <circle class="card-mark__pearl" cx="12" cy="4.4" r="1.6" />
    <circle class="card-mark__pearl" cx="20" cy="7.4" r="1.6" />
    <path class="card-mark__jewel" d="M12 11.6L14.4 14.8L12 18L9.6 14.8Z" />
  {:else if kind === 'grapes'}
    <path class="card-mark__stem" d="M5.6 11.8C4.2 11.4 3 10.2 2.4 8.4" />
    <path class="card-mark__leaf" d="M2.8 9.4C1.2 8.2.8 6 1.6 4.2c1.8.6 3 2.6 2.6 4.6z" />
    {#each GRAPES as [cx, cy] (`${cx},${cy}`)}<circle class="card-mark__fill" {cx} {cy} r="2.9" />{/each}
    <path class="card-mark__shine card-mark__shine--thin" d="M7.2 5.7a1.7 1.7 0 0 1 1.5-1" />
  {:else if kind === 'snowflake'}
    <path class="card-mark__trail-under" d={FLAKE} />
    <path class="card-mark__trail" d={FLAKE} />
  {:else if kind === 'topHat'}
    <path class="card-mark__outside" d="M5.9 3.6h12.2l-.5 12.6h4.4a1.7 1.7 0 0 1 0 3.4H1.9a1.7 1.7 0 0 1 0-3.4h4.5Z" />
    <path class="card-mark__band" d="M6.25 12h11.5l-.14 3.4H6.39Z" />
  {:else}
    <path class="card-mark__fill" d="M3.6 18.4c0-2.2 1.7-3.6 3.6-3.6h9.6c1.9 0 3.6 1.4 3.6 3.6 0 1.7-1.4 2.8-3.2 2.8H6.8c-1.8 0-3.2-1.1-3.2-2.8Z" />
    <path class="card-mark__fill" d="M6 14.6c0-1.9 1.4-3.2 3.2-3.2h5.6c1.8 0 3.2 1.3 3.2 3.2 0 .3 0 .5-.1.8H6.1c-.1-.3-.1-.5-.1-.8Z" />
    <path class="card-mark__fill" d="M8.4 11.2c0-1.8 1.5-2.9 3.2-2.9.9 0 1.6-.6 1.7-1.5l.2-2.4c2 .8 3.4 2.6 3.4 4.6 0 .8-.2 1.5-.6 2.2Z" />
    <path class="card-mark__dent" d="M8.2 13.4a1.6 1.6 0 0 1 1.3-.9M6.2 17.4a1.6 1.6 0 0 1 1.3-.9" />
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
  /* The snowflake: a thick outline under a coloured stroke. */
  .card-mark__trail-under {
    fill: none;
    stroke: var(--card-line);
    stroke-width: 5.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .card-mark__trail {
    fill: none;
    stroke: var(--card-color);
    stroke-width: 3;
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
  .card-mark__shade {
    fill: none;
    stroke: #c98a00;
    stroke-width: 1.6;
    stroke-linecap: round;
  }
  .card-mark__shine--thin {
    stroke-width: 1.2;
  }
  /* The top hat: its paper outline only outside the shape (stroke painted under the fill). */
  .card-mark__outside {
    fill: var(--card-color);
    stroke: var(--card-line);
    stroke-width: 2.4;
    stroke-linejoin: round;
    paint-order: stroke;
  }
  .card-mark__band {
    fill: var(--color-red);
  }
  .card-mark__stem {
    fill: none;
    stroke: var(--color-line);
    stroke-width: 1.8;
    stroke-linecap: round;
  }
  .card-mark__leaf {
    fill: var(--color-green);
    stroke: var(--color-line);
    stroke-width: 1.6;
    stroke-linejoin: round;
  }
  .card-mark__dent {
    fill: none;
    stroke: var(--color-wood-light);
    stroke-width: 1.2;
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
