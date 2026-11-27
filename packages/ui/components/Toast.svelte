<!--
  E3 · Toast (components-v2.md § 6): a passing confirmation or rejection. Props say what it draws: `color` (a palette),
  `variant` ('solid': the fill, white words; 'paper': paper with the colour's outline and its coloured bottom edge,
  #85), `icon` or the `mark` snippet (a card's mark: it wins over the icon), `text`, `detail`, `onclose` (shows the ✕,
  labelled `closeLabel`), `urgent` (role alert instead of status). How long it stays is its owner's (the app's model);
  which toast is which colour is a preset in the app's actions.ts. Other attributes (a role, data-*) pass through.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import Icon from '../icons/Icon.svelte';
  import type { IconName, ToastColor } from './types.ts';
  import './toast.css';

  type Props = Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'children'> & {
    color?: ToastColor;
    variant?: 'solid' | 'paper';
    icon?: IconName | null;
    mark?: Snippet;
    text: string;
    detail?: string | null;
    urgent?: boolean;
    onclose?: (() => void) | null;
    closeLabel?: string;
    class?: string;
  };

  let {
    color = 'green',
    variant = 'solid',
    icon = null,
    mark,
    text,
    detail = null,
    urgent = false,
    onclose = null,
    closeLabel = 'Tanca',
    class: className = '',
    ...rest
  }: Props = $props();
</script>

<div class="toast {className}" data-color={color} data-variant={variant} role={urgent ? 'alert' : 'status'} {...rest}>
  {#if mark}
    <span class="toast__lead" aria-hidden="true">{@render mark()}</span>
  {:else if icon}
    <span class="toast__lead" aria-hidden="true"><Icon name={icon} alone /></span>
  {/if}
  <div class="toast__body">
    <p class="toast__text">{text}</p>
    {#if detail}<p class="toast__detail">{detail}</p>{/if}
  </div>
  {#if onclose}
    <button type="button" class="toast__close" data-touch="small" aria-label={closeLabel} onclick={onclose}><Icon name="close" alone /></button>
  {/if}
</div>
