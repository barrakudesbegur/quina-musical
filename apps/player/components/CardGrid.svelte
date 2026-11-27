<script lang="ts">
  // A card as printed: 3 lines of 4 songs, with the card's own mark on each marked song (corn for the first card).
  // A completed Line shows only plain marks (no glow, no row highlight). A marked song's cover and title fade a little,
  // so the songs still to come stand out (#70). The near-win cue: a song that is all the card is missing for a Line or
  // the Quina is gently highlighted in the card's colour (ANIMATIONS.md `near-win`). The song playing now, when it's on
  // the card, is marked as the player's and its dashed orange ring runs round it (`cell-playing`, #74).
  // In the Desgraciat round (`crosses`) a landed song gets a red ✗ over a red-tinted cover instead of a mark: on
  // every screen a ✗ marks the song that sank the card. A fresh one stamps on (scale 2 → 1 at −12°).
  // Each cell is the design system's CardCell; its look comes from CardGrid's looks table (card-looks.ts).
  import { songTitle, type Catalog } from '../../../packages/ui/data/catalog.ts';
  import type { CardMarks, PlayerCard } from '../../../packages/rules/marks.ts';
  import CardCell from '../../../packages/ui/components/CardCell.svelte';
  import { cellLook } from '../../../packages/ui/components/card-looks.ts';
  import { kernelTilt } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import CardMark from './CardMark.svelte';

  let {
    card,
    identity,
    marks,
    catalog,
    fresh,
    near = new Set(),
    stagger = 0,
    crosses = false,
    playing = null,
  }: {
    card: PlayerCard;
    identity: number;
    marks: CardMarks | null;
    catalog: Catalog | null;
    fresh: ReadonlySet<string>;
    near?: ReadonlySet<number>;
    stagger?: number;
    /** The Desgraciat round: landed songs get a ✗, not the card's mark. */
    crosses?: boolean;
    /** The song playing now (the latest landing), or null. */
    playing?: number | null;
  } = $props();
</script>

<ul class="card-grid" data-testid="card" data-card-id={card.id} aria-label={S.card(card.id)}>
  {#each card.lines as line, li (li)}
    {#each line as songId, si (songId)}
      {@const marked = Boolean(marks?.marked[li]?.[si])}
      {@const title = songTitle(catalog, songId)}
      {@const isNear = !marked && near.has(songId)}
      {@const isPlaying = marked && playing === songId}
      <CardCell
        class="card-grid__cell{marked ? ' is-marked' : ''}{marked && crosses ? ' is-crossed' : ''}{isNear ? ' is-near' : ''}"
        {songId}
        {title}
        label={S.cell(title, marked, isPlaying)}
        coverFallback="empty"
        {...cellLook(marked ? (crosses ? 'crossed' : 'marked') : isNear ? 'near' : 'empty', { playing: isPlaying })}
        data-testid="card-cell"
        data-song-id={songId}
        data-marked={marked ? 'true' : 'false'}
        data-state={marked ? 'marked' : isNear ? 'near' : 'empty'}
        data-playing={isPlaying ? 'true' : undefined}
        data-anim={isNear ? 'near-win' : undefined}
        data-line={li}
      >
        {#if marked && crosses}
          <span
            class="card-grid__cross"
            data-anim={fresh.has(`${card.id}:${songId}`) ? 'mark-in' : undefined}
            style:--stagger="{stagger}ms"
            aria-hidden="true"
          ><svg class="cross" viewBox="0 0 24 24" focusable="false"><path class="cross__edge" d="M6 6l12 12M18 6L6 18" /><path class="cross__mark" d="M6 6l12 12M18 6L6 18" /></svg></span>
        {:else if marked}
          <span
            class="card-grid__kernel"
            data-anim={fresh.has(`${card.id}:${songId}`) ? 'mark-in' : undefined}
            style:--tilt="{kernelTilt(card.id, songId)}deg"
            style:--stagger="{stagger}ms"
            aria-hidden="true"
          ><CardMark {identity} decorative /></span>
        {/if}
      </CardCell>
    {/each}
  {/each}
</ul>
