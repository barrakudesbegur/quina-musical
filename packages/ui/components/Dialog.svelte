<!--
  C4 · Dialog: a short question that must be answered before going on, or a small modal panel (components-v2.md § 4,
  with the 27 Nov comments' D-n: #69). The native <dialog> shown modal: the browser traps the focus, makes the page
  inert, sends Esc and the back gesture as `cancel` and returns the focus on close (modern-web-guidance: dialog).
  Focus starts on the control with `autofocus` (the safe action, D28); Esc means `oncancel` (the safe action), else it
  closes. `dismiss='any'` also closes it on a tap outside (Safari: lightDismiss()); the default only on Esc.

  Motion (ANIMATIONS.md `pad-leave`, `check-review`, `wii-dialog`): it pops in from @starting-style (scale 0.92 → 1
  for an `alertdialog`, 0.96 for a panel, fading in); set `open` false and it leaves the same way, still open while it
  does, then close(), then `onclose`. A parent that unmounts it instead makes it vanish at once.

  Props say what it draws: `title` (and its `icon`), `body` (the description, `aria-describedby`), `size`
  ('s' 320 phone, 'm' the console's 560, 'l' a panel such as «Comandament»), `fill` (the theme's surface or paper),
  `role`, `dismiss`. Slots, in order: `trailing` (the
  title row's end: a status, a ✕), `warning` (before the body, as on C12 ②), `body`, `children`, `actions`.
-->
<script lang="ts">
  import { tick, untrack, type Snippet } from 'svelte';
  import type { HTMLDialogAttributes } from 'svelte/elements';
  import Icon from '../icons/Icon.svelte';
  import { lightDismiss, settled } from './top-layer.ts';
  import type { IconName } from './types.ts';
  import './dialog.css';

  type Props = Omit<HTMLDialogAttributes, 'title' | 'children' | 'class' | 'open' | 'role' | 'oncancel'> & {
    title: string;
    icon?: IconName | null;
    body?: string | null;
    size?: 's' | 'm' | 'l';
    /** The card's fill: the theme's surface, or paper (the phone's question, M13 ②). */
    fill?: 'surface' | 'paper';
    role?: 'alertdialog' | 'dialog';
    /** Shown while true; set it false to close it with its motion (bindable). */
    open?: boolean;
    dismiss?: 'any' | 'closerequest';
    /** Esc or the back gesture: the safe action. Without it they close the dialog. */
    oncancel?: () => void;
    onclose?: () => void;
    class?: string;
    trailing?: Snippet;
    warning?: Snippet;
    children?: Snippet;
    actions?: Snippet;
  };

  let {
    title,
    icon = null,
    body = null,
    size = 's',
    fill = 'surface',
    role = 'alertdialog',
    open = $bindable(true),
    dismiss = 'closerequest',
    oncancel,
    onclose,
    class: className = '',
    trailing,
    warning,
    children,
    actions,
    ...rest
  }: Props = $props();

  const uid = $props.id();
  let dialog: HTMLDialogElement | undefined = $state();
  let closing = $state(false);

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      closing = false;
      dialog.showModal();
    } else if (!open && dialog.open && !closing) {
      untrack(() => void leave());
    }
  });

  $effect(() => (dialog && dismiss === 'any' ? lightDismiss(dialog, () => (open = false)) : undefined));

  /** Plays the exit while still open (Safari keeps no closing element in the top layer), then closes. */
  async function leave(): Promise<void> {
    if (!dialog || closing) return;
    closing = true;
    const shown = dialog;
    await tick();
    await settled(shown);
    if (shown.open) shown.close();
  }

  function onClosed(): void {
    // A close the browser made by itself (a second Esc) still tells the owner.
    closing = false;
    open = false;
    onclose?.();
  }
</script>

<dialog
  bind:this={dialog}
  {...rest}
  {...{ closedby: dismiss }}
  class="dialog {className}"
  {role}
  data-size={size}
  data-fill={fill}
  data-ground={fill === 'paper' ? 'paper' : undefined}
  data-state={closing ? 'closing' : 'open'}
  aria-labelledby="{uid}-title"
  aria-describedby={body ? `${uid}-body` : undefined}
  oncancel={(e) => {
    e.preventDefault();
    if (oncancel) oncancel();
    else open = false;
  }}
  onclose={onClosed}
>
  <header class="dialog__head">
    <h1 class="dialog__title" id="{uid}-title">{#if icon}<Icon name={icon} />{/if}{title}</h1>
    {@render trailing?.()}
  </header>
  {@render warning?.()}
  {#if body}<p class="dialog__body" id="{uid}-body">{body}</p>{/if}
  {@render children?.()}
  {#if actions}<div class="dialog__actions">{@render actions()}</div>{/if}
</dialog>
