<script lang="ts" module>
  // Small line icons (inline SVG, currentColor), so the theme recolours them and nothing is downloaded.
  export type IconName = 'now' | 'cards' | 'history' | 'prizes' | 'schedule' | 'sound' | 'mute' | 'help' | 'plus' | 'star';
</script>

<script lang="ts">
  let { name }: { name: IconName } = $props();
</script>

<svg class="icon icon--{name}" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
  {#if name === 'now'}
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.5" /><circle cx="12" cy="12" r="3" fill="currentColor" />
  {:else if name === 'cards'}
    <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2.5" /><path d="M3 10h18M3 14h18M9 5v14M15 5v14" stroke="currentColor" stroke-width="1.5" />
  {:else if name === 'history'}
    <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
  {:else if name === 'prizes'}
    <rect x="4" y="9" width="16" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="2.5" /><path d="M3 9h18M12 9v11M12 9c-2-4-6-4-6-1s6 1 6 1c2-4 6-4 6-1s-6 1-6 1" fill="none" stroke="currentColor" stroke-width="2" />
  {:else if name === 'schedule'}
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.5" /><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
  {:else if name === 'sound'}
    <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" /><path d="M16 8c1.5 1 1.5 7 0 8M19 5c3 3 3 11 0 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  {:else if name === 'mute'}
    <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" /><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
  {:else if name === 'help'}
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.5" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" /><circle cx="12" cy="17" r="1.3" fill="currentColor" />
  {:else if name === 'plus'}
    <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
  {:else if name === 'star'}
    <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z" fill="currentColor" />
  {/if}
</svg>
