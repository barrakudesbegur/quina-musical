<script lang="ts">
  // One round's Line and Quina prize bundles (headline prizes first and bigger, then the rest), with sponsors and
  // the winning card numbers. A round whose prizes aren't revealed yet shows a lock instead.
  import type { CardView, PrizeRound } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import WinnerNumbers from './WinnerNumbers.svelte';

  let { round, mine = [] }: { round: PrizeRound; mine?: readonly CardView[] } = $props();
</script>

{#if round.lockedUntil}
  <p class="prize-lines__locked" data-locked={round.lockedUntil}><Icon name="lock" /><span>{S.prizesLocked[round.lockedUntil]}</span></p>
{/if}
{#if !round.lockedUntil || round.lines.some((l) => l.winners.length)}
  <dl class="prize-lines">
    {#each round.lines as line (line.kind)}
      {#if !round.lockedUntil || line.winners.length}
        <div class="prize-lines__row" data-kind={line.kind}>
          <dt class="prize-lines__kind">{S.prize[line.kind]}</dt>
          <dd class="prize-lines__prize">
            {#if line.headline.length}
              {#each line.headline as prize, i (i)}
                <span class="prize-lines__title">{prize.title}</span>
                {#if prize.detail}<span class="prize-lines__detail">{prize.detail}</span>{/if}
                {#if prize.sponsor}<span class="prize-lines__sponsor">{S.sponsoredBy(prize.sponsor)}</span>{/if}
              {/each}
              {#if line.others.length}
                <ul class="prize-lines__others">
                  {#each line.others as prize, i (i)}
                    <li class="prize-lines__other">
                      {prize.title}{#if prize.sponsor}<span class="prize-lines__sponsor"> · {S.sponsoredBy(prize.sponsor)}</span>{/if}
                    </li>
                  {/each}
                </ul>
              {/if}
            {:else if !round.lockedUntil}
              <span class="prize-lines__title">{S.noPrize}</span>
            {/if}
            {#if line.winners.length}
              <span class="prize-lines__winners">{S.winners}: <WinnerNumbers cardIds={line.winners} {mine} /></span>
            {/if}
          </dd>
        </div>
      {/if}
    {/each}
  </dl>
{/if}
