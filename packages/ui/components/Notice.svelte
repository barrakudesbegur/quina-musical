<!--
  E4 · Notice (components-v2.md § 6; notice.css): a lasting message in a strip, a note, a box or a scene. Props say what
  it draws: `layout`, `color` (a palette), `fill` ('solid' | 'subtle'), `icon`, `text`, `progress='dots'` (the stepping
  dots), `live` (polite | assertive | off: status, alert, or none). Slots: `children` (the box's chip; the scene's
  figure, above the title) and `trailing` (after the text: actions). Which use is which look is a preset in the app.
  Other attributes (a role, data-*) pass through.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import Icon from '../icons/Icon.svelte';
  import type { IconName, NoticeColor } from './types.ts';
  import './notice.css';

  type Props = Omit<HTMLAttributes<HTMLElement>, 'class' | 'children'> & {
    layout?: 'strip' | 'note' | 'box' | 'scene';
    color?: NoticeColor;
    fill?: 'solid' | 'subtle';
    icon?: IconName | null;
    text: string;
    progress?: 'dots' | null;
    live?: 'polite' | 'assertive' | 'off';
    children?: Snippet;
    trailing?: Snippet;
    class?: string;
  };

  let {
    layout = 'note',
    color = 'navy',
    fill = 'solid',
    icon = null,
    text,
    progress = null,
    live = 'polite',
    children,
    trailing,
    class: className = '',
    ...rest
  }: Props = $props();
</script>

<svelte:element
  this={layout === 'scene' ? 'section' : 'p'}
  class="ds-notice {className}"
  data-layout={layout}
  data-color={color}
  data-fill={fill}
  role={live === 'assertive' ? 'alert' : live === 'polite' ? 'status' : undefined}
  {...rest}
>
  {#if layout === 'scene'}
    {@render children?.()}
    <h2 class="ds-notice__text">{text}</h2>
  {:else}
    {#if icon}<span class="ds-notice__icon" aria-hidden="true"><Icon name={icon} alone /></span>{/if}
    <span class="ds-notice__text">{text}</span>
    {#if progress === 'dots'}<span class="ds-notice__dots" aria-hidden="true"><span></span><span></span><span></span></span>{/if}
    {@render children?.()}
    {@render trailing?.()}
  {/if}
</svelte:element>
