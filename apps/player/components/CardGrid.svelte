<script lang="ts">
  // A card as printed: 3 lines of 4 songs, with the card's own mark on each marked song (corn for the first card). A completed Line shows only
  // plain marks (no glow, no row highlight). Marks come from cardMarks (the grace rule included).
  import { songTitle, type Catalog } from '../../../packages/ui/data/catalog.ts';
  import type { CardMarks, PlayerCard } from '../../../packages/rules/marks.ts';
  import { kernelTilt } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import CardMark from './CardMark.svelte';
  import Cover from './Cover.svelte';

  let {
    card,
    identity,
    marks,
    catalog,
    fresh,
    stagger = 0,
  }: { card: PlayerCard; identity: number; marks: CardMarks | null; catalog: Catalog | null; fresh: ReadonlySet<string>; stagger?: number } = $props();
</script>

<ul class="card-grid" aria-label={S.card(card.id)}>
  {#each card.lines as line, li (li)}
    {#each line as songId, si (songId)}
      {@const marked = Boolean(marks?.marked[li]?.[si])}
      {@const title = songTitle(catalog, songId)}
      <li class="card-grid__cell" class:is-marked={marked} data-state={marked ? 'marked' : 'empty'} data-line={li} aria-label={S.cell(title, marked)}>
        <Cover {songId} size="sm" />
        <span class="card-grid__title" aria-hidden="true">{title}</span>
        {#if marked}
          <span
            class="card-grid__kernel"
            data-anim={fresh.has(`${card.id}:${songId}`) ? 'mark-in' : undefined}
            style:--tilt="{kernelTilt(card.id, songId)}deg"
            style:--stagger="{stagger}ms"
            aria-hidden="true"
          ><CardMark {identity} decorative /></span>
        {/if}
      </li>
    {/each}
  {/each}
</ul>
