<script lang="ts">
  // One round's Line and Quina prize bundles (headline prizes first and bigger, then the rest), with sponsors, and
  // whether each was won: "Ja té guanyador", never by which card number (the user's decision). A prize won by one
  // of the player's own cards shows that card's icon instead. A round whose prizes aren't revealed yet shows a lock.
  import type { SavedCard } from '../logic/storage.ts';
  import type { PrizeRound } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import CardMark from './CardMark.svelte';
  import Icon from './Icon.svelte';

  let { round, mine = [] }: { round: PrizeRound; mine?: readonly SavedCard[] } = $props();
  const own = (ids: readonly number[]) => mine.filter((c) => ids.includes(c.id));
</script>

{#if round.lockedUntil}
  <p class="prize-lines__locked" data-locked={round.lockedUntil}><Icon name="lock" /><span>{S.prizesLocked[round.lockedUntil]}</span></p>
{/if}
{#if !round.lockedUntil || round.lines.some((l) => l.won)}
  <dl class="prize-lines">
    {#each round.lines as line (line.kind)}
      {#if !round.lockedUntil || line.won}
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
            {#if line.won}
              {@const cards = own(line.ownCardIds)}
              <span class="prize-lines__won" data-state={cards.length ? 'own' : 'other'}>
                {#if cards.length}
                  {#each cards as card (card.id)}<span class="prize-lines__mark"><CardMark identity={card.color} decorative /></span>{/each}
                  {S.wonByYou}
                {:else}
                  {S.hasWinner}
                {/if}
              </span>
            {/if}
          </dd>
        </div>
      {/if}
    {/each}
  </dl>
{/if}
