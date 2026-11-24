<script lang="ts">
  // Winning card numbers. If one is the player's own card it shows in that card's colour, with no "you won"
  // text or effect.
  import type { CardView } from '../logic/view.ts';

  let { cardIds, mine = [], anim = false }: { cardIds: readonly number[]; mine?: readonly CardView[]; anim?: boolean } = $props();
  const colorOf = (id: number) => mine.find((v) => v.saved.id === id)?.saved.color ?? null;
</script>

<span class="winner-numbers">
  {#each cardIds as id, i (id)}
    {@const color = colorOf(id)}
    <span
      class="winner-numbers__card"
      class:is-own={color !== null}
      data-anim={anim ? 'celebrate' : undefined}
      style:--stagger="{i * 120}ms"
      style:--card-color={color !== null ? `var(--card-color-${color})` : undefined}>{id}</span
    >{#if i < cardIds.length - 1}<span class="winner-numbers__sep">, </span>{/if}
  {/each}
</span>
