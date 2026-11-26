<script lang="ts">
  // The first thing a player without cards sees: scan the QR, or type the number.
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  let { onadd }: { onadd: () => void } = $props();
</script>

<div class="add-prompt">
  <p class="add-prompt__text">{S.noCards}</p>
  <p class="add-prompt__hint">{S.noCardsHint}</p>
  <button type="button" class="big-button tone-primary add-prompt__button" aria-label={S.addCardLabel} onclick={onadd}><Icon name="plus" /> {S.addCard}</button>
</div>
