<script lang="ts">
  // A short notice under the header. About a card (one just added: board "afegir cartró: casos especials", the third
  // frame) it is green, with that card's icon.
  import type { ToastNote } from '../model.svelte.ts';
  import CardMark from './CardMark.svelte';

  let { toast }: { toast: ToastNote | null } = $props();
</script>

<div class="toast" role="status" aria-live="polite" data-state={toast ? 'shown' : 'hidden'}>
  {#if toast}
    <p class="toast__text" data-tone={toast.identity === null ? undefined : 'card'}>
      {#if toast.identity !== null}<span class="toast__mark" aria-hidden="true"><CardMark identity={toast.identity} decorative /></span>{/if}
      {toast.text}
    </p>
  {/if}
</div>
