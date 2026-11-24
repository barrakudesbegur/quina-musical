<script lang="ts">
  // A song's cover, lazy-loaded. A missing cover leaves the generic card back (no broken image).
  import { coverUrl } from '../../../packages/ui/data/catalog.ts';
  import { PLAYER_CONFIG } from '../config.ts';
  import { isLocalHost } from '../../../packages/ui/client/endpoints.ts';

  let { songId, alt = '', size = 'md' }: { songId: number; alt?: string; size?: 'sm' | 'md' | 'lg' } = $props();
  // The laptop's dev relay serves the original JPEGs; production serves WebP.
  const ext = isLocalHost(location.hostname) ? PLAYER_CONFIG.coverExtDev : PLAYER_CONFIG.coverExt;
  const src = $derived(coverUrl(songId, PLAYER_CONFIG.coverBase, ext));
  let failedSrc = $state<string | null>(null);
</script>

<span class="cover cover--{size}" data-state={failedSrc === src ? 'missing' : 'ok'}>
  {#if failedSrc !== src}
    <img class="cover__img" {src} {alt} loading="lazy" decoding="async" onerror={() => (failedSrc = src)} />
  {/if}
</span>
