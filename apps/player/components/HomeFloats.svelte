<script lang="ts">
  // What floats over the home, outside its masked scroll box (so the fades at the screen's edges never hide it), as the
  // home tells it (logic/home-ui.svelte.ts):
  // - «+ Cartró» between the corners on Cartrons (D188, D218; `add-card-float`): the quiet navy preset, following the
  //   swipe's share; only with 1 … max − 1 cards, never during a Celebration (with no cards the empty state offers its own two, EmptyCards, D290).
  // - The hint to the card holding the playing song when none shows on Cartrons (§8 Y2; `card-hint`): a paper pill with
  //   the arrow and that card's mark, no words (its name is spoken), at the bottom above «+ Cartró» or under the strip
  //   at the top; the arrow nudges towards the card; a tap scrolls to the card (`drum-pick`).
  import { fade, fly } from 'svelte/transition';
  import Button from '../../../packages/ui/components/Button.svelte';
  import IconButton from '../../../packages/ui/components/IconButton.svelte';
  import { PLAYER } from '../actions.ts';
  import { PLAYER_CONFIG } from '../config.ts';
  import type { PlayerApp } from '../model.svelte.ts';
  import { homeUi } from '../logic/home-ui.svelte.ts';
  import { cardLabel } from '../logic/storage.ts';
  import { S } from '../strings.ts';
  import CardMark from './CardMark.svelte';

  let { app }: { app: PlayerApp } = $props();
  const canAdd = $derived(app.data.cards.length > 0 && app.data.cards.length < PLAYER_CONFIG.maxCards && !app.celebrationOpen);
  const hint = $derived(app.celebrationOpen || app.drawers.length ? null : homeUi.hint);
  const hintCard = $derived(hint ? app.data.cards.find((c) => c.id === hint.cardId) : undefined);
  const reduced = $derived(app.reducedMotion);
  const enter = (node: Element, side: 'up' | 'down') =>
    reduced ? fade(node, { duration: 200 }) : fly(node, { y: side === 'up' ? -8 : 8, duration: 200, opacity: 0 });
</script>

{#if canAdd}
  <div class="ara__add" style:--ara-add={homeUi.addShare} data-shown={homeUi.addShare > 0 || undefined} data-following={homeUi.following || undefined} inert={homeUi.addShare < 0.5}>
    <Button {...PLAYER.addCardFloating} class="ara__add-button" aria-label={S.addCardLabel} aria-haspopup="dialog" onclick={() => app.open({ kind: 'pad' })} />
  </div>
{/if}
{#if hint}
  {#key hint.side}
    <div
      class="home-hint"
      data-anim="card-hint"
      data-side={hint.side}
      data-above-add={hint.side === 'down' && canAdd && homeUi.addShare > 0.5 ? 'true' : undefined}
      style:--home-hint-top="{homeUi.hintTop}px"
      in:enter={hint.side}
      out:fade={{ duration: 160 }}
    >
      <IconButton
        floating
        icon={hint.side === 'up' ? 'arrow-up' : 'arrow-down'}
        label={S.cardHint(hintCard ? cardLabel(hintCard) : '')}
        class="home-hint__button"
        onclick={() => homeUi.pick?.()}
      >
        {#snippet trailing()}<CardMark identity={hint.identity} decorative />{/snippet}
      </IconButton>
    </div>
  {/key}
{/if}
