<script lang="ts">
  // One bundle on the Premis drawer's page (D244, P2's content; components-v2.md § 11.11): its kind as a chip with how
  // many prizes it holds and whether it was won ("Ja té guanyador", or the phone's own card marks: never a number), the
  // headline prizes on paper with their sponsor's logo (the gift when there's none), the sponsors' prizes in quiet rows
  // with their logos, and the plain ones (a hamper's staples) on one line, as written.
  import Chip from '../../../packages/ui/components/Chip.svelte';
  import type { ChipColor } from '../../../packages/ui/components/control-types.ts';
  import LogoTile from '../../../packages/ui/components/LogoTile.svelte';
  import PaperCard from '../../../packages/ui/components/PaperCard.svelte';
  import StickerIcon from '../../../packages/ui/icons/StickerIcon.svelte';
  import { CA } from '../../../packages/ui/i18n/ca.ts';
  import { PRIZE_COLOR } from '../../../packages/ui/recipes/prizes.ts';
  import { bundleView } from '../logic/prizes.ts';
  import type { SavedCard } from '../logic/storage.ts';
  import type { PrizeItem, PrizeLine } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import CardMark from './CardMark.svelte';

  let { line, mine = [], locked = false }: { line: PrizeLine; mine?: readonly SavedCard[]; locked?: boolean } = $props();
  const view = $derived(bundleView(line));
  const own = $derived(mine.filter((c) => line.ownCardIds.includes(c.id)));
  const uid = $props.id();
  /** The kind's colour from the concepts (the Line gold, the Quina orange, the last one standing green): chip colours. */
  const tag = $derived.by((): ChipColor => {
    const color = PRIZE_COLOR[line.kind];
    return color === 'gold' || color === 'orange' || color === 'green' ? color : 'grey';
  });
</script>

{#snippet badge(prize: PrizeItem)}
  <span class="prize-bundle__badge" aria-hidden="true">
    {#if prize.logo && prize.sponsor}
      <LogoTile sponsor={{ name: prize.sponsor, logo: prize.logo }} />
    {:else}
      <StickerIcon name="gift" />
    {/if}
  </span>
{/snippet}

<section class="prize-bundle" data-kind={line.kind} aria-labelledby="{uid}-kind">
  <header class="prize-bundle__head">
    <h3 class="prize-bundle__kind" id="{uid}-kind"><Chip class="prize-bundle__tag" label={CA[line.kind]} color={tag} variant="solid" /></h3>
    {#if !locked}<span class="prize-bundle__count">{S.prizeCount(view.count)}</span>{/if}
    {#if line.won}
      <span class="prize-bundle__won" data-state={own.length ? 'own' : 'other'}>
        {#each own as card (card.id)}<span class="prize-bundle__mark"><CardMark identity={card.color} decorative /></span>{/each}
        {own.length ? S.wonByYou : S.hasWinner}
      </span>
    {/if}
  </header>
  {#if !locked}
    {#each view.headline as prize, i (i)}
      <PaperCard class="prize-bundle__headline" layout="row">
        <div class="prize-bundle__item">
          {@render badge(prize)}
          <p class="prize-bundle__text">
            <span class="prize-bundle__title">{prize.title}</span>
            {#if prize.detail}<span class="prize-bundle__detail">{prize.detail}</span>{/if}
            {#if prize.sponsor}<span class="prize-bundle__sponsor">{prize.sponsor}</span>{/if}
          </p>
        </div>
      </PaperCard>
    {:else}
      <p class="prize-bundle__none">{S.noPrize}</p>
    {/each}
    {#if view.rows.length}
      <ul class="prize-bundle__rows">
        {#each view.rows as prize, i (i)}
          <li class="prize-bundle__item prize-bundle__row">
            {@render badge(prize)}
            <p class="prize-bundle__text">
              <span class="prize-bundle__title">{prize.title}</span>
              {#if prize.detail}<span class="prize-bundle__detail">{prize.detail}</span>{/if}
              {#if prize.sponsor}<span class="prize-bundle__sponsor">{prize.sponsor}</span>{/if}
            </p>
          </li>
        {/each}
      </ul>
    {/if}
    {#if view.plain.length}
      <p class="prize-bundle__plain">{S.prizesAlso} {view.plain.join(' · ')}</p>
    {/if}
  {/if}
</section>
