<script lang="ts">
  let { text }: { text: string | null } = $props();
</script>

<div class="toast" role="status" aria-live="polite" data-state={text ? 'shown' : 'hidden'}>
  {#if text}<p class="toast__text">{text}</p>{/if}
</div>
