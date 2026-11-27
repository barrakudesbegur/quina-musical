<script lang="ts">
  // Leaving "Afegir cartró" with a number typed (✕, "‹", a drag, the back gesture): the design system's Dialog (C4) in
  // the middle, over the pad (board "afegir cartró: casos especials", the second frame; ANIMATIONS.md `pad-leave`).
  // Modal, so the pad under it takes no taps; Esc or the back gesture keep the pad, as "Continuar" does, and
  // "Continuar" has the focus. As on the board: the green way back to the pad on top, and under it "Descartar", the
  // soft red Button with the bin (D188). The words wait for U175.
  import Button from '../../../packages/ui/components/Button.svelte';
  import Dialog from '../../../packages/ui/components/Dialog.svelte';
  import { PLAYER } from '../actions.ts';
  import { S } from '../strings.ts';

  let { id, ondiscard, oncontinue }: { id: number; ondiscard: () => void; oncontinue: () => void } = $props();
</script>

<Dialog class="pad-leave" fill="paper" title={S.discardTitle(id)} body={S.discardText} data-anim="pad-leave" oncancel={oncontinue}>
  {#snippet actions()}
    <Button {...PLAYER.keepEditing} class="pad-leave__continue" autofocus onclick={oncontinue} />
    <Button {...PLAYER.discardChanges} class="pad-leave__discard" onclick={ondiscard} />
  {/snippet}
</Dialog>
