<!--
  B1 · Switch: an on/off setting (components-v2.md § 3 › B1; comments-27nov.md #35, #36).

  It never toggles by itself: `checked` comes from the parent (the engine's state, a stored setting), and a press asks
  for the opposite through `onchange`, so a refused command can't leave it showing the wrong value. The whole row is
  the target: a <button role="switch"> named by its visible label, its note the description.
  `layout`: `row` (the label, then the track at its end: the menus), `inline` (the same in a line of words, no
  stretch), `embedded` (a drawing only, `aria-hidden`, inside a control that is itself the toggle: «Seguides» is a
  pressed Button, so its strip only shows the switch, with `onText` / `offText` beside it; never a switch inside an
  aria-pressed button).
  The knob is centred on the track by the layout, never by a hand-set offset (#35: the board's phone tracks had it
  1 px from the top of a 26 px inside). Sizes are custom properties in :where() (switch.css), set by the density.
  Motion: ANIMATIONS.md › switch-toggle (the knob slides with motion allowed; the track's colour fades either way).
-->
<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Icon from '../icons/Icon.svelte';
  import type { SwitchLayout, SwitchSound } from './control-types.ts';
  import type { IconName } from './types.ts';
  import './switch.css';

  type Props = Omit<HTMLButtonAttributes, 'children' | 'class' | 'role' | 'aria-checked' | 'onchange'> & {
    checked: boolean;
    label: string;
    /** An icon before the label (the finale's «Al revés»: the swap arrows). */
    icon?: IconName | null;
    note?: string | null;
    layout?: SwitchLayout;
    /** `embedded` only: the words beside the track («Sí» / «No»). */
    onText?: string | null;
    offText?: string | null;
    disabled?: boolean;
    sound?: SwitchSound | null;
    onchange?: (on: boolean) => void;
    class?: string;
  };

  let {
    checked,
    label,
    icon = null,
    note = null,
    layout = 'row',
    onText = null,
    offText = null,
    disabled = false,
    sound = { on: 'switchOn', off: 'switchOff' },
    onchange,
    class: className = '',
    ...rest
  }: Props = $props();

  const uid = $props.id();
  const text = $derived(checked ? onText : offText);
</script>

{#snippet track()}
  <span class="switch__track" aria-hidden="true"><span class="switch__knob"></span></span>
{/snippet}

{#if layout === 'embedded'}
  <span class="switch {className}" data-layout="embedded" data-checked={checked || undefined} aria-hidden="true">
    {@render track()}
    {#if text}<span class="switch__state">{text}</span>{/if}
  </span>
{:else}
  <button
    {...rest}
    type="button"
    role="switch"
    class="switch {className}"
    data-layout={layout}
    data-checked={checked || undefined}
    data-touch={sound ? (checked ? sound.off : sound.on) : 'none'}
    aria-checked={checked}
    aria-labelledby="{uid}-label"
    aria-describedby={note ? `${uid}-note` : undefined}
    {disabled}
    onclick={() => onchange?.(!checked)}
  >
    {#if icon}<span class="switch__icon" aria-hidden="true"><Icon name={icon} /></span>{/if}
    <span class="switch__text">
      <span class="switch__label" id="{uid}-label">{label}</span>
      {#if note}<span class="switch__note" id="{uid}-note">{note}</span>{/if}
    </span>
    {@render track()}
  </button>
{/if}
