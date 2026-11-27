<!--
  A line icon (H1 `line`) from the one registry (line.ts), drawn with the family's stroke (icons.css): the ink of the
  text beside it, round caps and joins, `currentColor`. `outline`: a big button's sticker look, the same line over an
  ink line a little wider all round (accent and two-tone parts keep their own look). Always decorative: the control
  or the text beside it names it. The context sets the box and the colour, never the stroke. Parts marked `behind`
  (line.ts) are drawn through a mask: the other parts' outlines, widened by a gap, cut them away (the crossed swords).
-->
<script lang="ts">
  import './icons.css';
  import { LINE_ICONS, isBehind, outlined, partClass, pathOf, type IconPath, type LineIconName } from './line.ts';

  interface Props {
    name: LineIconName;
    outline?: boolean;
    /** No text beside it: the ink is its box's size step, not a text's stem. */
    alone?: boolean;
    /** Extra classes (the apps keep their own `icon--<name>` hooks). */
    class?: string;
  }

  let { name, outline = false, alone = false, class: extra = '' }: Props = $props();
  const uid = $props.id();
  const parts: readonly IconPath[] = $derived(LINE_ICONS[name]);
  /** The `paper` part, which `clip` parts are drawn inside. */
  const paper = $derived(parts.find((p) => typeof p !== 'string' && p.part === 'paper'));
  const clipId = $derived(`icon-clip-${uid}`);
  /** The parts behind the others, drawn through the gap the front parts cut (a mask). */
  const back = $derived(parts.filter(isBehind));
  const front = $derived(parts.filter((p) => !isBehind(p)));
  const maskId = $derived(`icon-mask-${uid}`);
  const transformOf = (p: IconPath): string | undefined => (typeof p === 'string' ? undefined : p.transform);
</script>

<svg class="icon {extra}" class:icon--outline={outline} class:icon--alone={alone} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  {#snippet draw(list: readonly IconPath[], under: boolean)}
    {#each list as p, i (i)}
      {#if under}
        {#if outlined(p)}<path d={pathOf(p)} class={partClass(p)} transform={transformOf(p)} />{/if}
      {:else if typeof p !== 'string' && p.clip}
        <g clip-path="url(#{clipId})"><path d={p.d} class={partClass(p)} transform={p.transform} /></g>
      {:else}
        <path d={pathOf(p)} class={partClass(p)} transform={transformOf(p)} />
      {/if}
    {/each}
  {/snippet}
  {#snippet layer(under: boolean)}
    {#if back.length}<g mask="url(#{maskId})">{@render draw(back, under)}</g>{/if}
    {@render draw(front, under)}
  {/snippet}
  {#if paper || back.length}
    <defs>
      {#if paper}<clipPath id={clipId}><path d={pathOf(paper)} /></clipPath>{/if}
      {#if back.length}
        <!-- White shows the parts behind; each front part's outline, widened by the gap, hides them (icons.css) -->
        <mask id={maskId} maskUnits="userSpaceOnUse" x="-12" y="-12" width="48" height="48">
          <rect class="icon__reveal" x="-12" y="-12" width="48" height="48" />
          {#each front as p, i (i)}<path d={pathOf(p)} class="icon__cut" transform={transformOf(p)} />{/each}
        </mask>
      {/if}
    </defs>
  {/if}
  {#if outline}<g class="icon__under">{@render layer(true)}</g>{/if}
  {@render layer(false)}
</svg>
