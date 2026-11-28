<script lang="ts">
  // A card as printed: 3 lines of 4 songs, with the card's own mark on each marked song (corn for the first card).
  // A completed Line shows only plain marks (no glow, no row highlight). A marked song's cover and title fade a little,
  // so the songs still to come stand out (#70). The song playing now, when it's on the card, is marked as the player's,
  // very clearly (§8 Y1): its cover at full strength with no veil, the design system's running orange ring, slightly
  // see-through, and its glow (`cell-playing`, #74). (The near-win highlight is gone: §8 Y1.)
  // In the Desgraciat round (`crosses`) a landed song gets a red ✗ over a red-tinted cover instead of a mark: on
  // every screen a ✗ marks the song that sank the card. A fresh one stamps on (scale 2 → 1 at −12°).
  // Each cell is the design system's CardCell; its look comes from CardGrid's looks table (card-looks.ts).
  // A mark bobs on the beat (`mark-bob`: `data-bob` on an HTML box round the mark, inside the tilted kernel box, so the
  // tilt stays; an HTML box, as the browser runs an SVG element's animation on the main thread); a ✗ never does. Whether anything moves is the home's (AraHome's `data-beat`).
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
    stagger = 0,
    crosses = false,
    playing = null,
  }: {
    card: PlayerCard;
    identity: number;
    marks: CardMarks | null;
    catalog: Catalog | null;
    fresh: ReadonlySet<string>;
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
      {@const isPlaying = marked && playing === songId}
      <CardCell
        class="card-grid__cell{marked ? ' is-marked' : ''}{marked && crosses ? ' is-crossed' : ''}"
        {songId}
        {title}
        label={S.cell(title, marked, isPlaying)}
        coverFallback="empty"
        {...cellLook(marked ? (crosses ? 'crossed' : 'marked') : 'empty', { playing: isPlaying })}
        data-testid="card-cell"
        data-song-id={songId}
        data-marked={marked ? 'true' : 'false'}
        data-state={marked ? 'marked' : 'empty'}
        data-playing={isPlaying ? 'true' : undefined}
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
          ><span class="card-grid__bob" data-bob><CardMark {identity} decorative /></span></span>
        {/if}
      </CardCell>
    {/each}
  {/each}
</ul>
