<!--
  A1 · Button: the game's sticker button, one component for every labelled action button on the console and the
  phone (components-v2.md § 2 › A1, with the 27 Nov comments' rules in comments-27nov.md).

  Props say what it draws, never a game concept: `color` (a palette, through `data-color`), `variant`
  (solid | soft | plain | dashed), `size` (xs | s | m | l; the surface's scale comes from the app root's
  `data-density`), `floating` (the pill, D189), `pattern` (R3: drawn only while `pressed`), `ring` and `ribbon` (R1,
  R11), its states `pressed` (a toggle; `aria-pressed`), `disabled`, `busy`, and the `sound` a press plays. The
  concept's look (the Hold is cyan, with the mic and «Parlem») comes from a preset in the domain layer, spread in:
  `<Button {...ACTIONS.next} ring={…} onclick={…} />`. There is no `hidden` and no `state` prop (D-b, D-c): the parent
  uses {#if}, and native attributes (`hidden`, `type`, `data-testid`, `aria-*`, events) pass through.

  Slots, in a fixed order: `icon` (data), `label` (data, the accessible name), `note` (data, the description),
  `children` (a snippet: free content such as a switch drawn inside); `ribbon` and `wii` overlay the body.
  Structure (packages/ui/ds/resources.css): the <button> is the static part (`ds-pushable`: the hit area, the hard
  shadow, the rings, the focus outline), and `.button__piece` (`ds-piece`) is what sinks when pressed.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Icon from '../icons/Icon.svelte';
  import { useDs } from './providers.ts';
  import type { ButtonLook } from './types.ts';
  import './button.css';

  type Props = ButtonLook &
    Omit<HTMLButtonAttributes, keyof ButtonLook | 'children' | 'class' | 'aria-pressed' | 'aria-busy'> & {
      children?: Snippet;
      class?: string;
      /** The <button> element, for a parent that must focus it (`bind:element`). */
      element?: HTMLButtonElement;
    };

  let {
    color = 'grey',
    variant = 'solid',
    size = 'm',
    floating = false,
    pattern = 'none',
    ring = null,
    ribbon = null,
    pressed = undefined,
    disabled = false,
    busy = false,
    sound = 'big',
    icon = null,
    iconPlacement = 'start',
    label,
    note = null,
    wii = null,
    children,
    class: className = '',
    element = $bindable(),
    type = 'button',
    ...rest
  }: Props = $props();

  const uid = $props.id();
  const { wii: Wii } = useDs();
  /** On: a toggle that's pressed and usable; only then is the pattern drawn (R3, #23). */
  const on = $derived(pressed === true && !disabled);
  const describedBy = $derived([note ? `${uid}-note` : null, rest['aria-describedby'] ?? null].filter(Boolean).join(' ') || undefined);
  /** The name is the label (and the ribbon: «…, recomanat»), never the note; an explicit aria-label wins. */
  const labelledBy = $derived(rest['aria-label'] || rest['aria-labelledby'] ? rest['aria-labelledby'] : `${uid}-label${ribbon ? ` ${uid}-ribbon` : ''}`);
</script>

<button
  bind:this={element}
  {...rest}
  {type}
  class="button ds-pushable {className}"
  data-color={color}
  data-variant={variant}
  data-size={size}
  data-icon-placement={iconPlacement}
  data-floating={floating || undefined}
  data-ring={ring ?? undefined}
  data-touch={sound ?? 'none'}
  aria-pressed={pressed}
  aria-busy={busy || undefined}
  aria-labelledby={labelledBy}
  aria-describedby={describedBy}
  {disabled}
>
  <span class="button__piece ds-piece">
    {#if on && pattern !== 'none'}<span class="ds-pattern" data-pattern={pattern} aria-hidden="true"></span>{/if}
    <span class="button__body">
      <span class="button__head">
        {#if icon}<span class="button__icon" aria-hidden="true"><Icon name={icon} outline={variant === 'solid' || variant === 'dashed'} /></span>{/if}
        <span class="button__label" id="{uid}-label">{label}</span>
        {#if busy}<span class="button__dots" aria-hidden="true"><span></span><span></span><span></span></span>{/if}
      </span>
      {#if note}<span class="button__note" id="{uid}-note">{note}</span>{/if}
      {@render children?.()}
    </span>
    {#if ribbon}<span class="ds-ribbon" id="{uid}-ribbon">{ribbon}</span>{/if}
    {#if wii && Wii}
      <span class="button__wii ds-corner" data-size={wii.size ?? 'md'} data-hold={wii.hold || undefined} aria-hidden="true"><Wii spec={wii} /></span>
    {/if}
  </span>
</button>
