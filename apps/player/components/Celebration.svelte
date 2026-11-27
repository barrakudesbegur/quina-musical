<script lang="ts">
  import Button from '../../../packages/ui/components/Button.svelte';
  import PrizeCard from '../../../packages/ui/recipes/PrizeCard.svelte';
  import { PLAYER } from '../actions.ts';
  // The Celebration (ANIMATIONS.md `celebrate`). No winning card numbers, ever: people only care when it's them.
  // Someone else's win: "LÍNIA!" or "QUINA!" over the gold rays, a light confetti burst and the prize (not a Line's
  // for now, D242). The player's own confirmed card (a confirmed winner that is one of the phone's cards): "La teva
  // línia!" with that card's grid glowing in its own colour, and the confetti in its colours. The Desgraciat round's last card
  // standing ('standing'): on other phones no title (the user, U6), only the prize; on the winner's own phone
  // «Quina potra!» (D190), the hands-up nino with that card standing in its green glow, green rays and green confetti.
  // Reduced motion:
  // it all appears, with no confetti.
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
  // A Line's Celebration shows no prize for now (D242): only a Quina's and the last card standing's.
  const prize = $derived(celebration.kind === 'line' ? null : (round?.lines.find((l) => l.kind === celebration.kind) ?? null));
  const own = $derived(views.filter((v) => celebration.ownCardIds.includes(v.saved.id)));
  const NO_FRESH: ReadonlySet<string> = new Set();
  const standing = $derived(celebration.kind === 'standing');
  /** The shouted title; in the Desgraciat round only on the winner's own phone (U6, D190). */
  const title = $derived(own.length ? S.yourWin[celebration.kind] : S.shout[celebration.kind]);
  /** The last card standing's confetti: the standing green, gold, paper and ice. */
  const STANDING_CONFETTI = ['--color-online', '--color-accent', '--color-paper', '--color-cyan'];
  const palette = $derived(standing ? STANDING_CONFETTI : undefined);
</script>

<div
  class="celebration"
  data-anim="celebrate"
  data-kind={celebration.kind}
  data-state={own.length ? 'own' : 'other'}
  role="dialog"
  aria-labelledby={title ? 'celebration-shout' : undefined}
  aria-label={title ? undefined : S.prize[celebration.kind]}
>
  {#if !reduced}<Confetti tones={own.length ? own.map((v) => v.saved.color) : undefined} {palette} />{/if}
  <div class="celebration__panel">
    {#if title}<h2 class="celebration__shout" id="celebration-shout">{title}</h2>{/if}
    {#if standing && own.length}<span class="celebration__nino" aria-hidden="true"></span>{/if}
    {#each own as view (view.saved.id)}
      <div class="celebration__card">
        <!-- The last card standing keeps its own green glow (CardPanel's stand); other wins glow in the card's colour. -->
        <CardPanel {view} {catalog} catalogFailed={false} fresh={NO_FRESH} stagger={0} glow={!standing} />
      </div>
    {/each}
    {#if prize?.headline.length}
      <PrizeCard class="celebration__prize" prize={{ kind: celebration.kind, headline: prize.headline, more: prize.others.length }} />
    {/if}
    <Button {...PLAYER.close} class="celebration__close" onclick={onclose} />
  </div>
</div>
