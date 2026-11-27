<!--
  D4 · Cover: a song's cover art, one component for the phone and the console (components-v2.md § 5); the projector
  builds the same markup with cover.ts › coverElement and shares cover.css.

  Props say what it draws: `songId` (null = no song: the Hold's music), `size` (a step of the ladder, any px, or none:
  the context sizes it), `alt` (decorative by default: the title sits beside it), `fallback` (a navy tile with a note,
  or the surface's own empty box), `blurred` (the phone's drum while it turns; set once, never animated), and `morph`
  (the console's next-to-now hook). JPEG XL with a JPEG fallback where the app's provider says the server has it
  (`provideDs({ covers })`, R2-Q28: never WebP). Native attributes and `class` pass through to the root.
-->
<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  import { coverFiles, coverPx, type CoverFallback, type CoverSize } from './cover.ts';
  import { useDs } from './providers.ts';
  import './cover.css';

  interface Props extends Omit<HTMLAttributes<HTMLSpanElement>, 'class'> {
    songId: number | null;
    size?: CoverSize | number | null;
    alt?: string;
    fallback?: CoverFallback;
    blurred?: boolean;
    morph?: string | null;
    class?: string;
  }

  let { songId, size = null, alt = '', fallback = 'note', blurred = false, morph = null, class: className = '', ...rest }: Props = $props();

  const { covers } = useDs();
  const files = $derived(songId === null ? null : coverFiles(songId, covers));
  const px = $derived(coverPx(size));
  /** The file that failed, so a new song tries again. */
  let failed = $state<string | null>(null);
  const missing = $derived(files === null || failed === files.jpg);
</script>

<span
  {...rest}
  class="cover {className}"
  data-size={typeof size === 'string' ? size : px !== null ? 'px' : undefined}
  data-state={missing ? 'missing' : 'ok'}
  data-fallback={fallback}
  data-blurred={blurred || undefined}
  data-morph={morph ?? undefined}
  style:--cover-px={px}
  role={alt && !missing ? 'img' : undefined}
  aria-label={alt && !missing ? alt : undefined}
  aria-hidden={alt ? undefined : 'true'}
>
  {#if files && !missing}
    {#key files.jpg}
      <picture class="cover__picture">
        {#if files.jxl}<source type="image/jxl" srcset={files.jxl} />{/if}
        <img class="cover__img" src={files.jpg} alt="" loading="lazy" decoding="async" draggable="false" onerror={() => (failed = files.jpg)} />
      </picture>
    {/key}
  {/if}
  <svg class="cover__note" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M9 18V5l11-2v13" /><path d="M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" /><path d="M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
  </svg>
</span>
