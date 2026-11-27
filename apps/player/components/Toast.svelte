<script lang="ts">
  // A short notice under the header, the generic Toast (E3) with its preset (actions.ts › PLAYER_TOASTS). About a card
  // (one just added: board "afegir cartró: casos especials", the third frame) it is green, with that card's mark; any
  // other is on paper. The slot is the live region; the toast inside it says nothing by itself.
  import Toast from '../../../packages/ui/components/Toast.svelte';
  import { PLAYER_TOASTS } from '../actions.ts';
  import type { ToastNote } from '../model.svelte.ts';
  import CardMark from './CardMark.svelte';

  let { toast }: { toast: ToastNote | null } = $props();
</script>

<div class="toast-slot" role="status" aria-live="polite" data-state={toast ? 'shown' : 'hidden'}>
  {#if toast}
    {@const identity = toast.identity}
    {#if identity !== null}
      {#snippet mark()}<CardMark {identity} decorative />{/snippet}
      <Toast {...PLAYER_TOASTS.card} role="none" text={toast.text} {mark} />
    {:else}
      <Toast {...PLAYER_TOASTS.info} role="none" text={toast.text} />
    {/if}
  {/if}
</div>
