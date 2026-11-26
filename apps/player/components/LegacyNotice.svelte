<script lang="ts">
  // Opened from last year's link (?c=123) or another edition's: say so, and offer this year's card.
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  let { older, onadd, ondismiss }: { older: boolean; onadd: () => void; ondismiss: () => void } = $props();
</script>

<section class="legacy-notice" data-state={older ? 'older' : 'other'} role="alert">
  <h2 class="legacy-notice__title">{older ? S.legacyTitle : S.otherEditionTitle}</h2>
  <p class="legacy-notice__text">{S.legacyText}</p>
  <div class="legacy-notice__actions">
    <button type="button" class="big-button tone-primary" aria-label={S.addCardLabel} onclick={onadd}><Icon name="plus" /> {S.addCard}</button>
    <button type="button" class="big-button" onclick={ondismiss}>{S.ok}</button>
  </div>
</section>
