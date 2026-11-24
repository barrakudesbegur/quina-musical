<script lang="ts">
  // The connection strip across the top (ANIMATIONS.md `reconnect` and `offline`), one at a time:
  // "Reconnectant…" after a short drop of the phone's feed, "Sense connexió · reconnectant…" once offline (the
  // screen greys under it: App.svelte's veil), then green "Connectat" for 1 s before it slides away. It covers
  // only the garland, never the content, and takes no taps. It stays in the page, so it can slide out still
  // reading "Connectat" (a strip only ever hides after that).
  import type { Banner } from '../logic/status.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  let { banner }: { banner: Banner } = $props();
  const shown = $derived(banner ?? 'connected');
</script>

<div class="connection-strip" data-anim={shown === 'offline' ? 'offline' : 'reconnect'} data-state={shown} data-shown={banner ? 'true' : 'false'} role="status" aria-hidden={banner ? undefined : 'true'}>
  {#if shown !== 'connected'}<Icon name="offline" />{/if}
  <span class="connection-strip__text">{shown === 'offline' ? S.offline : shown === 'reconnecting' ? S.reconnecting : S.connected}</span>
</div>
