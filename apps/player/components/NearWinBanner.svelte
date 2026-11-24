<script lang="ts">
  // "1 song away": unmissable, on every tab. It names the card (colour and name) and the missing song, and has
  // no effect tied to songs (no "playing now!"). Items come from logic/banner.ts, which latches them.
  import { songTitle, type Catalog } from '../../ui/data/catalog.ts';
  import type { BannerItem } from '../logic/banner.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import Swatch from './Swatch.svelte';

  let { items, catalog }: { items: readonly BannerItem[]; catalog: Catalog | null } = $props();
</script>

{#if items.length}
  <section class="near-win" data-anim="near-win" data-state={items.some((i) => i.kind === 'bingo') ? 'bingo' : 'line'} aria-live="polite" aria-labelledby="near-win-title">
    <h2 class="near-win__title" id="near-win-title"><span class="near-win__star"><Icon name="star" /></span>{S.bannerTitle}</h2>
    <ul class="near-win__list">
      {#each items as item (item.key)}
        <li class="near-win__item" data-anim="near-win" data-kind={item.kind} style:--card-color="var(--card-color-{item.color})">
          <Swatch color={item.color} />
          <span class="near-win__card">
            {#if item.name}<strong class="near-win__name">{item.name}</strong>{/if}
            <span class="near-win__number">{S.card(item.cardId)}</span>
          </span>
          <span class="near-win__kind">{S.bannerKind[item.kind]}</span>
          <span class="near-win__songs">{S.missing}: <strong>{item.songIds.map((id) => songTitle(catalog, id)).join(S.or)}</strong></span>
        </li>
      {/each}
    </ul>
    <p class="near-win__note">{S.attention}</p>
  </section>
{/if}
