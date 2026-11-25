<script lang="ts" module>
  // Small line icons (inline SVG, currentColor), so the theme recolours them and nothing is downloaded. The
  // stroke width is the theme's (--icon-stroke).
  export type IconName = 'now' | 'cards' | 'history' | 'prizes' | 'schedule' | 'sound' | 'mute' | 'menu' | 'plus' | 'star' | 'sad' | 'lock' | 'edit' | 'trash' | 'offline' | 'close' | 'back' | 'chevron' | 'settings' | 'grip';
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
  {:else if name === 'menu'}
    <path d="M4 6.5h16M4 12h16M4 17.5h16" />
  {:else if name === 'edit'}
    <path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" />
  {:else if name === 'trash'}
    <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" />
  {:else if name === 'offline'}
    <path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M3 3l18 18" /><circle cx="12" cy="19" r="1.2" fill="currentColor" />
  {:else if name === 'plus'}
    <path d="M12 5v14M5 12h14" />
  {:else if name === 'star'}
    <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z" fill="currentColor" />
  {:else if name === 'sad'}
    <path d="M8 8.5v2.2M16 8.5v2.2M7 18c1.4-2.4 3-3.4 5-3.4s3.6 1 5 3.4" />
  {:else if name === 'close'}
    <path d="M6 6l12 12M18 6L6 18" />
  {:else if name === 'back'}
    <path d="M15 5l-7 7 7 7" />
  {:else if name === 'chevron'}
    <path d="M9 5l7 7-7 7" />
  {:else if name === 'settings'}
    <circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /><circle cx="12" cy="12" r="6.6" />
  {:else if name === 'grip'}
    <g fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.9" /><circle cx="15" cy="6" r="1.9" /><circle cx="9" cy="12" r="1.9" /><circle cx="15" cy="12" r="1.9" /><circle cx="9" cy="18" r="1.9" /><circle cx="15" cy="18" r="1.9" /></g>
  {:else if name === 'lock'}
    <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  {/if}
</svg>
