<!--
  A line icon (H1 `line`) from the one registry (line.ts), drawn with the family's stroke (icons.css): the ink of the
  text beside it, round caps and joins, `currentColor`. `outline`: a big button's sticker look, the same line over an
  ink line a little wider all round (accent and two-tone parts keep their own look). Always decorative: the control
  or the text beside it names it. The context sets the box and the colour, never the stroke.
-->
<script lang="ts">
  import './icons.css';
  import { LINE_ICONS, outlined, partClass, pathOf, type IconPath, type LineIconName } from './line.ts';

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
</script>

<svg class="icon {extra}" class:icon--outline={outline} class:icon--alone={alone} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  {#if paper}
    <defs><clipPath id={clipId}><path d={pathOf(paper)} /></clipPath></defs>
  {/if}
  {#if outline}
    <g class="icon__under">
      {#each parts as p, i (i)}
        {#if outlined(p)}<path d={pathOf(p)} class={partClass(p)} transform={typeof p === 'string' ? undefined : p.transform} />{/if}
      {/each}
    </g>
  {/if}
  {#each parts as p, i (i)}
    {#if typeof p !== 'string' && p.clip}
      <g clip-path="url(#{clipId})"><path d={p.d} class={partClass(p)} transform={p.transform} /></g>
    {:else}
      <path d={pathOf(p)} class={partClass(p)} transform={typeof p === 'string' ? undefined : p.transform} />
    {/if}
  {/each}
</svg>
