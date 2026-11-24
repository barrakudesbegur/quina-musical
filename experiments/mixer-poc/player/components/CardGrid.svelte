<script lang="ts">
  // A card as printed: 3 lines of 4 songs, with a corn kernel on each marked song. A completed Line shows only
  // plain marks (no glow, no row highlight). Marks come from cardMarks (the grace rule included).
  import { songTitle, type Catalog } from '../../ui/data/catalog.ts';
  import type { CardMarks, PlayerCard } from '../../ui/rules/marks.ts';
  import { kernelTilt } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import Cover from './Cover.svelte';

  let {
    card,
    marks,
    catalog,
    fresh,
    stagger = 0,
  }: { card: PlayerCard; marks: CardMarks | null; catalog: Catalog | null; fresh: ReadonlySet<string>; stagger?: number } = $props();
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
          ></span>
        {/if}
      </li>
    {/each}
  {/each}
</ul>
