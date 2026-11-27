<!--
  D2 · CardCell: one of a card's songs as a list item, the cover with its title (components-v2.md § 5). Its look is
  generic (card-cell.ts › CellLook, named by what it draws): how the cover shows, a ring round it (`running`: the
  playing song's dashes go round; its glow; slightly see-through), a centred badge (✓, ✗, play: #75, #76), a tag on its
  bottom edge («SEGÜENT», «+2»). A state's look comes from CardGrid's looks table (card-looks.ts), spread in:
  `<CardCell {songId} {title} {...cellLook('landed')} />`. The projector builds the same parts (CellParts).

  Slots: the cover (data: `songId`), `title` (data; R9: two lines, hyphenated in `lang`), and `children`: a mark drawn
  on the cover (the phone card's identity mark, its ✗ stamp). The item's accessible name is `label` (the song and its
  state, in the app's words); everything drawn is aria-hidden. Native attributes and `class` pass through.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLLiAttributes } from 'svelte/elements';
  import Icon from '../icons/Icon.svelte';
  import { cellData, RING_RECT, type CellLook } from './card-cell.ts';
  import Cover from './Cover.svelte';
  import './card-cell.css';

  interface Props extends CellLook, Omit<HTMLLiAttributes, 'class' | 'title'> {
    songId: number;
    title: string;
    /** The title's language, for hyphenation (R9); omitted, the page's. */
    lang?: string;
    /** The item's accessible name: the song and its state. */
    label: string;
    /** The phone's card back when a cover is missing; elsewhere a note. */
    coverFallback?: 'note' | 'empty';
    class?: string;
    children?: Snippet;
  }

  let {
    songId,
    title,
    lang,
    label,
    coverFallback = 'note',
    cover,
    ring = null,
    ringStyle,
    glow,
    ringTranslucent,
    badge = null,
    badgeColor = 'green',
    badgeStyle = 'solid',
    tag = null,
    tagColor = 'orange',
    class: className = '',
    children,
    ...rest
  }: Props = $props();

  const data = $derived(cellData({ cover, ring, ringStyle, glow, ringTranslucent }));
</script>

<li
  {...rest}
  class="card-cell {className}"
  data-cover={data.cover}
  data-ring-style={data.ringStyle}
  data-glow={data.glow}
  data-ring-translucent={data.ringTranslucent}
  aria-label={label}
>
  <span class="card-cell__art">
    <Cover {songId} fallback={coverFallback} />
    {#if ring}
      <svg class="card-cell__ring" data-color={ring} aria-hidden="true" focusable="false"><rect {...RING_RECT} /></svg>
    {/if}
    {@render children?.()}
    {#if badge}
      <span class="card-cell__badge" data-color={badgeColor} data-style={badgeStyle} data-icon={badge} aria-hidden="true"><Icon name={badge} alone /></span>
    {/if}
    {#if tag}<span class="card-cell__tag" data-color={tagColor} aria-hidden="true">{tag}</span>{/if}
  </span>
  <span class="card-cell__title" {lang} aria-hidden="true">{title}</span>
</li>
