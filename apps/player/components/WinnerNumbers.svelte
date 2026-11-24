<script lang="ts">
  // Winning card numbers. If one is the player's own card it shows that card's icon next to it, with no "you won"
  // text or effect. (Not its colour: white and black are card colours too.)
  import type { CardView } from '../logic/view.ts';
  import CardMark from './CardMark.svelte';

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
      >{#if color !== null}<span class="winner-numbers__mark"><CardMark identity={color} decorative /></span>{/if}{id}</span
    >{#if i < cardIds.length - 1}<span class="winner-numbers__sep">, </span>{/if}
  {/each}
</span>
