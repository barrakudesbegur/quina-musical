<script lang="ts">
  // A song's cover, lazy-loaded: JPEG XL where the browser reads it, else the JPEG. A missing cover leaves the
  // generic card back (no broken image).
  import { coverUrl } from '../../../packages/ui/data/catalog.ts';
  import { PLAYER_CONFIG } from '../config.ts';
  import { isLocalHost } from '../../../packages/ui/client/endpoints.ts';

  let { songId, alt = '', size = 'md' }: { songId: number; alt?: string; size?: 'sm' | 'md' | 'lg' } = $props();
  // The laptop's dev relay serves only the JPEGs; production adds a JPEG XL of each.
  const jxl = PLAYER_CONFIG.coverJxl && !isLocalHost(location.hostname);
  const src = $derived(coverUrl(songId, PLAYER_CONFIG.coverBase, 'jpg'));
  const jxlSrc = $derived(jxl ? coverUrl(songId, PLAYER_CONFIG.coverBase, 'jxl') : null);
  let failedSrc = $state<string | null>(null);
</script>

<span class="cover cover--{size}" data-state={failedSrc === src ? 'missing' : 'ok'}>
  {#if failedSrc !== src}
    <picture class="cover__picture">
      {#if jxlSrc}<source type="image/jxl" srcset={jxlSrc} />{/if}
      <img class="cover__img" {src} {alt} loading="lazy" decoding="async" onerror={() => (failedSrc = src)} />
    </picture>
  {/if}
</span>
