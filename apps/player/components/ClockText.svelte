<script lang="ts">
  // Text with clock times, each am/pm in its own `.unit`, so Londrina's capitals leave it lowercase (D114).
  import { clockTextParts } from '../logic/clock-text.ts';

  let { text }: { text: string } = $props();
  const parts = $derived(clockTextParts(text));
</script>

{#each parts as part, i (i)}{#if part.unit}<span class="unit">{part.text}</span>{:else}{part.text}{/if}{/each}
