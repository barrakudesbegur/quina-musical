<!--
  The headline prize card (C2's `PrizeCard` recipe, D-p, #66): a PaperCard `hero` with a clear order, top to bottom:
  the kind as a chip over the top edge («PREMI DE LÍNIA»), the prize's name big, its detail, the sponsor (with its
  logo when it has one), and «i 3 premis més». No columns: every line takes the card's width and wraps (R6). The
  projector shows no prizes for now (D311).
-->
<script lang="ts">
  import PaperCard from '../components/PaperCard.svelte';
  import { prizeCardText, type PrizeCardData } from './prizes.ts';
  import './prizes.css';

  let { prize, class: className = '' }: { prize: PrizeCardData; class?: string } = $props();
  const text = $derived(prizeCardText(prize));
</script>

<PaperCard class="prize-card {className}" layout="hero" ribbon={{ label: text.chip, color: text.color }} data-kind={prize.kind} aria-label={text.chip}>
  <p class="prize-card__title">{text.title}</p>
  {#if text.detail}<p class="prize-card__detail">{text.detail}</p>{/if}
  {#if text.sponsor}
    <p class="prize-card__sponsor">
      {#if prize.logo}<img class="prize-card__logo" src={prize.logo} alt="" />{/if}
      <span>{text.sponsor}</span>
    </p>
  {/if}
  {#if text.more}<p class="prize-card__more">{text.more}</p>{/if}
</PaperCard>
