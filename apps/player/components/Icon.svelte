<script lang="ts" module>
  // Small line icons (inline SVG, currentColor), so the theme recolours them and nothing is downloaded. The
  // stroke width is the theme's (--icon-stroke): the active tab draws them a little bolder.
  export type IconName = 'now' | 'cards' | 'history' | 'prizes' | 'schedule' | 'sound' | 'mute' | 'help' | 'plus' | 'star';
</script>

<script lang="ts">
  let { name }: { name: IconName } = $props();
</script>

<svg
  class="icon icon--{name}"
  viewBox="0 0 24 24"
  width="24"
  height="24"
  fill="none"
  stroke="currentColor"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#if name === 'now'}
    <path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" />
  {:else if name === 'cards'}
    <rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 9.5h18M3 14.5h18M9 4v16M15 4v16" />
  {:else if name === 'history'}
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
  {:else if name === 'prizes'}
    <rect x="3.5" y="9" width="17" height="11" rx="2" /><path d="M2.5 9h19M12 9v11M12 9c-2-4-6-5-6-2s4 2 6 2c2 0 6 1 6-2s-4-2-6 2" />
  {:else if name === 'schedule'}
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" />
  {:else if name === 'sound'}
    <path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
  {:else if name === 'mute'}
    <path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" />
  {:else if name === 'help'}
    <circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7" /><path d="M12 17h.01" />
  {:else if name === 'plus'}
    <path d="M12 5v14M5 12h14" />
  {:else if name === 'star'}
    <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z" fill="currentColor" />
  {/if}
</svg>
