<script lang="ts">
  // A modal sheet on the native <dialog>: focus stays inside, Esc and the close button close it.
  import type { Snippet } from 'svelte';
  import { S } from '../strings.ts';

  let { title, name, onclose, children }: { title: string; name: string; onclose: () => void; children: Snippet } = $props();
  let dialog: HTMLDialogElement | undefined = $state();

  $effect(() => {
    if (dialog && !dialog.open) dialog.showModal();
  });
</script>

<dialog class="sheet sheet--{name}" bind:this={dialog} onclose={onclose} aria-labelledby="sheet-title-{name}">
  <header class="sheet__header">
    <h2 class="sheet__title" id="sheet-title-{name}">{title}</h2>
    <button type="button" class="sheet__close" onclick={() => dialog?.close()}>{S.close}</button>
  </header>
  <div class="sheet__body">
    {@render children()}
  </div>
</dialog>
