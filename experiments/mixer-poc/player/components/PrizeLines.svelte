<script lang="ts">
  // One round's Line and Quina prizes, with sponsors and the winning card numbers.
  import type { CardView, PrizeRound } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import WinnerNumbers from './WinnerNumbers.svelte';

  let { round, mine = [] }: { round: PrizeRound; mine?: readonly CardView[] } = $props();
</script>

<dl class="prize-lines">
  {#each round.lines as line (line.kind)}
    <div class="prize-lines__row" data-kind={line.kind}>
      <dt class="prize-lines__kind">{S.prize[line.kind]}</dt>
      <dd class="prize-lines__prize">
        <span class="prize-lines__title">{line.prize?.title ?? S.noPrize}</span>
        {#if line.prize?.detail}<span class="prize-lines__detail">{line.prize.detail}</span>{/if}
        {#if line.sponsor}<span class="prize-lines__sponsor">{S.sponsoredBy(line.sponsor)}</span>{/if}
        {#if line.winners.length}
          <span class="prize-lines__winners">{S.winners}: <WinnerNumbers cardIds={line.winners} {mine} /></span>
        {/if}
      </dd>
    </div>
  {/each}
</dl>
