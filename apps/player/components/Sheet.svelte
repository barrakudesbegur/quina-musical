<script lang="ts">
  // A modal sheet on the native <dialog>: focus stays inside, Esc and the close button close it. `canClose`
  // lets the content hold the sheet open first (adding a card asks before leaving with a number typed): it is
  // asked on the close button and on Esc or the phone's back gesture (the dialog's cancel event).
  import type { Snippet } from 'svelte';
  import { S } from '../strings.ts';

  let {
    title,
    name,
    onclose,
    canClose,
    children,
  }: { title: string; name: string; onclose: () => void; canClose?: () => boolean; children: Snippet } = $props();
  let dialog: HTMLDialogElement | undefined = $state();

  $effect(() => {
    if (dialog && !dialog.open) dialog.showModal();
  });

  function requestClose(): void {
    if (!canClose || canClose()) dialog?.close();
  }
</script>

<dialog
  class="sheet sheet--{name}"
  bind:this={dialog}
  onclose={onclose}
  oncancel={(e) => {
    if (canClose && !canClose()) e.preventDefault();
  }}
  aria-labelledby="sheet-title-{name}"
>
  <header class="sheet__header">
    <h2 class="sheet__title" id="sheet-title-{name}">{title}</h2>
    <button type="button" class="sheet__close" onclick={requestClose}>{S.close}</button>
  </header>
  <div class="sheet__body">
    {@render children()}
  </div>
</dialog>
