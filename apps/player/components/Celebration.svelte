<script lang="ts">
  // The Celebration (ANIMATIONS.md `celebrate`). No winning card numbers, ever: people only care when it's them.
  // Someone else's win: "LÍNIA!" or "QUINA!" over the gold rays, a light confetti burst and the prize. The
  // player's own confirmed card (a confirmed winner that is one of the phone's cards): "La teva línia!" with
  // that card's grid glowing in its own colour, and the confetti in its colours. Reduced motion: it all appears,
  // with no confetti.
  import type { Catalog } from '../../../packages/ui/data/catalog.ts';
  import type { CardView, CelebrationView, PrizeRound } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import CardPanel from './CardPanel.svelte';
  import Confetti from './Confetti.svelte';

  let {
    celebration,
    round,
    views,
    catalog,
    reduced,
    onclose,
  }: {
    celebration: CelebrationView;
    round: PrizeRound | null;
    /** The phone's cards; only those among the winners show. */
    views: readonly CardView[];
    catalog: Catalog | null;
    reduced: boolean;
    onclose: () => void;
  } = $props();
  const prize = $derived(round?.lines.find((l) => l.kind === celebration.kind) ?? null);
  const own = $derived(views.filter((v) => celebration.ownCardIds.includes(v.saved.id)));
  const NO_FRESH: ReadonlySet<string> = new Set();
</script>

<div
  class="celebration"
  data-anim="celebrate"
  data-kind={celebration.kind}
  data-state={own.length ? 'own' : 'other'}
  role="dialog"
  aria-labelledby="celebration-shout"
>
  {#if !reduced}<Confetti tones={own.length ? own.map((v) => v.saved.color) : undefined} />{/if}
  <div class="celebration__panel">
    <h2 class="celebration__shout" id="celebration-shout">{own.length ? S.yourWin[celebration.kind] : S.shout[celebration.kind]}</h2>
    {#each own as view (view.saved.id)}
      <div class="celebration__card">
        <CardPanel {view} {catalog} catalogFailed={false} fresh={NO_FRESH} stagger={0} glow />
      </div>
    {/each}
    {#if prize?.headline.length}
      <p class="celebration__prize">
        <span class="celebration__prize-kind">{S.prize[celebration.kind]}:</span>
        {prize.headline.map((p) => p.title).join(' · ')}
        {#if prize.others.length}<span class="celebration__more">{S.morePrizes(prize.others.length)}</span>{/if}
        {#if prize.headline[0].sponsor}<span class="celebration__sponsor">{S.sponsoredBy(prize.headline[0].sponsor)}</span>{/if}
      </p>
    {/if}
    <button type="button" class="big-button celebration__close" onclick={onclose}>{S.close}</button>
  </div>
</div>
