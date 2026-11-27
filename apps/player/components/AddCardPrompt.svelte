<script lang="ts">
  import Button from '../../../packages/ui/components/Button.svelte';
  import { PLAYER } from '../actions.ts';
  // The first thing a player without cards sees: scan the QR, or type the number.
  import { S } from '../strings.ts';

  let { onadd }: { onadd: () => void } = $props();
</script>

<div class="add-prompt">
  <p class="add-prompt__text">{S.noCards}</p>
  <p class="add-prompt__hint">{S.noCardsHint}</p>
  <Button {...PLAYER.addCard} class="add-prompt__button" aria-label={S.addCardLabel} aria-haspopup="dialog" onclick={onadd} />
</div>
