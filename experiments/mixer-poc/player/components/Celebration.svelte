<script lang="ts">
  // The Celebration: "LÍNIA!" or "QUINA!", the winning card numbers popping in, confetti. A winning number that
  // is the player's own card shows in its colour, with no "you won" text or effect.
  import type { CardView, CelebrationView, PrizeRound } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import Confetti from './Confetti.svelte';
  import WinnerNumbers from './WinnerNumbers.svelte';

  let {
    celebration,
    round,
    mine,
    reduced,
    onclose,
  }: { celebration: CelebrationView; round: PrizeRound | null; mine: readonly CardView[]; reduced: boolean; onclose: () => void } = $props();
  const prize = $derived(round?.lines.find((l) => l.kind === celebration.kind) ?? null);
</script>

<div class="celebration" data-anim="celebrate" data-kind={celebration.kind} role="dialog" aria-labelledby="celebration-shout">
  {#if !reduced}<Confetti />{/if}
  <div class="celebration__panel">
    <h2 class="celebration__shout" id="celebration-shout">{S.shout[celebration.kind]}</h2>
    <p class="celebration__label">{S.winningCards}</p>
    <p class="celebration__numbers"><WinnerNumbers cardIds={celebration.cardIds} {mine} anim /></p>
    {#if prize?.prize}
      <p class="celebration__prize">
        <span class="celebration__prize-kind">{S.prize[celebration.kind]}:</span>
        {prize.prize.title}
        {#if prize.sponsor}<span class="celebration__sponsor">{S.sponsoredBy(prize.sponsor)}</span>{/if}
      </p>
    {/if}
    <button type="button" class="big-button celebration__close" onclick={onclose}>{S.close}</button>
  </div>
</div>
