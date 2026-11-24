<!-- A song's cover, decorative (the title is always next to it); a music note when there is none or it fails. -->
<script lang="ts">
  import { coverUrl } from '../../../packages/ui/data/catalog.ts';
  import Icon from './Icon.svelte';

  let { songId, size = 'md', morph }: { songId: number | null; size?: 'sm' | 'md' | 'lg'; morph?: string } = $props();
  let failed = $state<number | null>(null);
</script>

{#if songId === null || failed === songId}
  <span class="cover cover--{size} cover--missing" data-morph={morph} aria-hidden="true"><Icon name="music" /></span>
{:else}
  {#key songId}
    <img class="cover cover--{size}" data-morph={morph} src={coverUrl(songId)} alt="" onerror={() => (failed = songId)} />
  {/key}
{/if}
