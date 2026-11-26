<script lang="ts">
  // Leaving "Afegir cartró" with a number typed (✕, "‹", a drag, the back gesture): a small dialog in the middle, over
  // the pad (board "afegir cartró: casos especials", the second frame; ANIMATIONS.md `pad-leave`). Modal, so the pad
  // under it takes no taps; Esc or the back gesture keep the pad, as "Continuar" does, and "Continuar" has the focus.
  import { S } from '../strings.ts';

  let { id, ondiscard, oncontinue }: { id: number; ondiscard: () => void; oncontinue: () => void } = $props();
  let dialog: HTMLDialogElement | undefined = $state();
  let stay: HTMLButtonElement | undefined = $state();

  $effect(() => {
    if (!dialog || dialog.open) return;
    dialog.showModal();
    stay?.focus();
  });
</script>

<dialog
  class="pad-leave"
  bind:this={dialog}
  role="alertdialog"
  aria-labelledby="pad-leave-title"
  aria-describedby="pad-leave-text"
  data-anim="pad-leave"
  oncancel={(e) => {
    e.preventDefault();
    oncontinue();
  }}
>
  <h2 class="pad-leave__title" id="pad-leave-title">{S.discardTitle(id)}</h2>
  <p class="pad-leave__text" id="pad-leave-text">{S.discardText}</p>
  <div class="pad-leave__actions">
    <button type="button" class="pad-leave__discard" onclick={ondiscard}>{S.discardYes}</button>
    <button type="button" class="big-button tone-ok pad-leave__continue" bind:this={stay} onclick={oncontinue}>{S.discardNo}</button>
  </div>
</dialog>
