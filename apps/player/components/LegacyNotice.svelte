<script lang="ts">
  import Button from '../../../packages/ui/components/Button.svelte';
  import { PLAYER } from '../actions.ts';
  // Opened from last year's link (?c=123) or another edition's: say so, and offer this year's card.
  import { S } from '../strings.ts';

  let { older, onadd, ondismiss }: { older: boolean; onadd: () => void; ondismiss: () => void } = $props();
</script>

<section class="legacy-notice" data-state={older ? 'older' : 'other'} role="alert">
  <h2 class="legacy-notice__title">{older ? S.legacyTitle : S.otherEditionTitle}</h2>
  <p class="legacy-notice__text">{S.legacyText}</p>
  <div class="legacy-notice__actions">
    <Button {...PLAYER.addCard} aria-label={S.addCardLabel} aria-haspopup="dialog" onclick={onadd} />
    <Button {...PLAYER.ok} onclick={ondismiss} />
  </div>
</section>
