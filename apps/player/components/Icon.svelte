<script lang="ts" module>
  // Small line icons (inline SVG, currentColor), so the theme recolours them and nothing is downloaded. The
  // stroke width is the theme's (--icon-stroke).
  export type IconName = 'now' | 'cards' | 'history' | 'prizes' | 'schedule' | 'sound' | 'mute' | 'menu' | 'plus' | 'star' | 'sad' | 'lock' | 'edit' | 'trash' | 'offline' | 'close' | 'back' | 'chevron' | 'settings' | 'grip' | 'clockBack' | 'flag' | 'tick' | 'plusOutlined';
</script>

<script lang="ts">
  let { name }: { name: IconName } = $props();
  // The flag's checks are clipped to its waving outline: one clip id per icon on the page.
  const uid = $props.id();
  const FLAG = 'M3 5c3-1.6 6-1.6 9 0s6 1.6 9 0v14.4c-3 1.6-6 1.6-9 0s-6-1.6-9 0z';
  const CHECKS = Array.from({ length: 20 }, (_, i) => [i % 5, Math.floor(i / 5)] as const).filter(([c, r]) => (r + c) % 2 === 0);
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
    <path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a7.5 7.5 0 0 1 0 11" />
  {:else if name === 'mute'}
    <path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" />
  {:else if name === 'menu'}
    <path d="M4 6.5h16M4 12h16M4 17.5h16" />
  {:else if name === 'edit'}
    <path d="M4 20l1-4L16 5l3 3L8 19z" /><path d="M14 7l3 3" />
  {:else if name === 'trash'}
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  {:else if name === 'offline'}
    <path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M3 3l18 18" /><circle cx="12" cy="19" r="1.2" fill="currentColor" />
  {:else if name === 'plus'}
    <path d="M12 5v14M5 12h14" />
  {:else if name === 'star'}
    <!-- The Especial's star: no outline, rounder points (the user, 25 Nov). -->
    <path d="M12 2.2c.6 0 1 .4 1.3 1l2.2 4.6 5 .7c1.2.2 1.6 1.6.8 2.4l-3.6 3.6.9 5c.2 1.2-1.1 2.1-2.2 1.5L12 18.7 7.6 21c-1.1.6-2.4-.3-2.2-1.5l.9-5-3.6-3.6c-.8-.8-.4-2.2.8-2.4l5-.7 2.2-4.6c.3-.6.7-1 1.3-1z" fill="currentColor" stroke="none" />
  {:else if name === 'sad'}
    <path d="M8 8.5v2.2M16 8.5v2.2M7 18c1.4-2.4 3-3.4 5-3.4s3.6 1 5 3.4" />
  {:else if name === 'close'}
    <path d="M6 6l12 12M18 6L6 18" />
  {:else if name === 'back'}
    <path d="M15 5l-7 7 7 7" />
  {:else if name === 'chevron'}
    <path d="M9 5l7 7-7 7" />
  {:else if name === 'settings'}
    <!-- A plain cog: one outline and a hole (the user, 25 Nov: the old one was too busy). -->
    <path d="M9.97 4.68V2h4.06v2.68l1.72.71 1.89-1.89 2.86 2.86-1.89 1.89.71 1.72H22v4.06h-2.68l-.71 1.72 1.89 1.89-2.86 2.86-1.89-1.89-1.72.71V22H9.97v-2.68l-1.72-.71-1.89 1.89-2.86-2.86 1.89-1.89-.71-1.72H2V9.97h2.68l.71-1.72L3.5 6.36 6.36 3.5l1.89 1.89Z" stroke-linejoin="round" /><circle cx="12" cy="12" r="3.1" />
  {:else if name === 'grip'}
    <g fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.9" /><circle cx="15" cy="6" r="1.9" /><circle cx="9" cy="12" r="1.9" /><circle cx="15" cy="12" r="1.9" /><circle cx="9" cy="18" r="1.9" /><circle cx="15" cy="18" r="1.9" /></g>
  {:else if name === 'clockBack'}
    <!-- Last year's card: a clock with a circular arrow going back (the user, 25 Nov). -->
    <path d="M4.6 13.4A7.6 7.6 0 1 0 6.3 6.8" /><path d="M3.6 3.8v4.4H8" /><path d="M12 8v4.4l3 1.8" />
  {:else if name === 'plusOutlined'}
    <!-- The orange pills' plus ("+ Afegir cartró"): the colour over a thick ink outline. -->
    <path d="M12 4v16M4 12h16" style:stroke="var(--color-line)" stroke-width="6.5" /><path d="M12 4v16M4 12h16" stroke-width="3" />
  {:else if name === 'tick'}
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  {:else if name === 'flag'}
    <!-- The finish flag: no pole, a waving flag with square checks (the user, 25 Nov). Paper and ink, not currentColor. -->
    <defs><clipPath id="flag-{uid}"><path d={FLAG} /></clipPath></defs>
    <g clip-path="url(#flag-{uid})" stroke="none">
      <rect width="24" height="24" style:fill="var(--color-paper)" />
      <g style:fill="var(--color-line)">{#each CHECKS as [c, r] (`${c},${r}`)}<rect x={3 + c * 3.6} y={5 + r * 3.6} width="3.6" height="3.6" />{/each}</g>
    </g>
    <path d={FLAG} style:stroke="var(--color-line)" stroke-width="1.6" />
  {:else if name === 'lock'}
    <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  {/if}
</svg>
