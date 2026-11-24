<script lang="ts">
  // A card's mark: its own icon in its own colour (identity N = --card-color-N plus icon N), so a player who
  // follows several cards can tell them apart by shape alone, colour-blind or not. The first card is always
  // corn, like the seeds on the paper cards. The set follows last year's app (star, moon, triangle, gift,
  // clubs, circle, square), with corn first.
  import { markName } from '../logic/marks-identity.ts';

  let { identity, decorative = false }: { identity: number; decorative?: boolean } = $props();
  const kind = $derived(markName(identity));
</script>

<svg
  class="card-mark"
  data-mark={kind}
  viewBox="0 0 24 24"
  style:--card-color="var(--card-color-{identity})"
  role={decorative ? undefined : 'img'}
  aria-hidden={decorative ? 'true' : undefined}
  aria-label={decorative ? undefined : kind}
>
  {#if kind === 'corn'}
    <path class="card-mark__fill" d="M12 2.5c4.5 0 8 3.2 7.6 8.5-.4 5.4-3.8 11-7.6 11s-7.2-5.6-7.6-11C4 5.7 7.5 2.5 12 2.5z" />
    <path class="card-mark__shine" d="M8.6 7.6c.8-1.6 2.2-2.4 3.8-2.4" />
  {:else if kind === 'star'}
    <path class="card-mark__fill" d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" />
  {:else if kind === 'moon'}
    <path class="card-mark__fill" d="M15.2 3.2a8.8 8.8 0 1 0 5.6 15.1A7.3 7.3 0 0 1 15.2 3.2z" />
  {:else if kind === 'triangle'}
    <path class="card-mark__fill" d="M12 3.4l9 16.2H3z" />
  {:else if kind === 'gift'}
    <path class="card-mark__fill" d="M4.5 10.5h15v9.5h-15zM3.5 7.5h17v3h-17z" />
    <path class="card-mark__line" d="M12 7.5V20M12 7.5c-1.5-3.5-5-3.5-5-1.5S10 7.5 12 7.5c2 0 5-.5 5-1.5s-3.5-2-5 1.5" />
  {:else if kind === 'clubs'}
    <path class="card-mark__fill" d="M12 3.6a3.7 3.7 0 0 1 3.3 5.4 3.7 3.7 0 1 1-1.6 6.3l1.1 5.2H9.2l1.1-5.2A3.7 3.7 0 1 1 8.7 9 3.7 3.7 0 0 1 12 3.6z" />
  {:else if kind === 'circle'}
    <circle class="card-mark__fill" cx="12" cy="12" r="8.4" />
  {:else}
    <rect class="card-mark__fill" x="4" y="4" width="16" height="16" rx="2.5" />
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
    stroke: var(--color-line);
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .card-mark__line {
    fill: none;
    stroke: var(--color-line);
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .card-mark__shine {
    fill: none;
    stroke: var(--color-paper);
    stroke-width: 2;
    stroke-linecap: round;
  }
</style>
