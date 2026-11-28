<!--
  The gallery's empty state (D290, the phone's home with no cards; apps/player/components/EmptyCards.svelte): the
  outlined «Afegir cartrons» over the two floating pills, «Escanejar el QR» (orange, l, the QR) and «Escriure el número»
  (navy, s, «#»), in the phone's column and in a 320 px phone's (the title shrinks to stay on one line). Captions in
  English; the words are UI content.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import EmptyCards from '../../player/components/EmptyCards.svelte';

  let { cell }: { cell: Snippet<[string, Snippet]> } = $props();
  const noop = () => {};
</script>

<section class="ds-gallery__section" aria-labelledby="empty-cards">
  <h2 id="empty-cards">Empty state: no cards (D290)</h2>
  <p class="ds-prose">
    A phone with no cards: no banner, a heading and two floating pills, centred in the view's free space under the switch
    (Cartrons always; Historial while no song is listed). The QR is the main one; the floating «+ Cartró» doesn't show
    meanwhile. No motion.
  </p>
  <div class="ds-gallery__grid ds-gallery__grid--empty">
    {#snippet e1()}<div class="ds-gallery__column" style:--column="358px"><EmptyCards onscan={noop} onwrite={noop} /></div>{/snippet}
    {@render cell('a 390 px phone’s column (358 px): the welcome’s title size', e1)}
    {#snippet e2()}<div class="ds-gallery__column" style:--column="288px"><EmptyCards onscan={noop} onwrite={noop} /></div>{/snippet}
    {@render cell('a 320 px phone’s column (288 px): the title shrinks to stay on one line; both labels still fit', e2)}
  </div>
</section>

<style>
  @layer app {
    .ds-gallery__grid--empty {
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 23rem), 1fr));
    }

    .ds-gallery__column {
      inline-size: min(100%, var(--column));
      justify-self: center;
    }
  }
</style>
