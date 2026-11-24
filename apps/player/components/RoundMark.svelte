<script lang="ts">
  // A round's icon where rounds are listed (decided: a gold star for the Quina Especial, a sad face for the Quina
  // Desgraciada; a normal round has none). Decorative: the round's name says it in words.
  import type { RoundKind } from '../feed/public.ts';
  import Icon from './Icon.svelte';

  let { kind }: { kind: RoundKind } = $props();
</script>

{#if kind === 'special'}
  <span class="round-mark" data-kind="special" aria-hidden="true"><Icon name="star" /></span>
{:else if kind === 'desgraciat'}
  <span class="round-mark" data-kind="desgraciat" aria-hidden="true"><Icon name="sad" /></span>
{/if}
