<!--
  A3 · TwoLevelButton: a button whose tap is level 1 and whose hold escalates to level 2, shown as a strip at its foot
  (components-v2.md § 2 › A3, with the 27 Nov comments). The console's Parlem → Pausa and Aguanta → Suspens, and the
  Throw's two buttons («Llançament», «Tempesta»: a tap starts, stops or resumes; the hold restarts from the hook).

  It knows nothing of the game: a preset gives its look (`color`, `pattern`, `icon` or the `art` snippet, `label`,
  `sub`, `note`, `wii`, and `level2`: the strip's words, icon and keys), and the app's thin wrapper gives its state
  and gets its gestures: `active` (null, 1 or 2: which level is on), `canEscalate`, `disabled`, and `ontap`,
  `onescalate` (the hold crossed `holdMs`, finger still down), `onrelease` (an escalated press ended); `onpress` and
  `onletgo` say when any press starts and ends (let go, or taken away: cancelled, blurred, disabled, the page hidden,
  unmounted), whatever it turns out to be (the console's lock mirror, D234).

  The look of each state (R3, D-k, #14, #17–#23):
  - off: the body in its palette, no pattern; the strip pale (its palette's `pale`), «mantén» before its words;
  - level 1 on: the body sunk (aria-pressed), its `pattern` (stripes) panning;
  - escalating: the strip fills with light left to right (hook escalate-hold), clipped to the strip;
  - level 2 on: the strip in its palette's dark `edge`, white words, the hexagonal dots panning; the body sunk with
    no pattern (level 2 is what's on). `badge` draws a small disc in its top-left corner (the padlock while Parlem is
    locked on during a Pausa, #23: locked never shows a pattern);
  - `level2={null}`: no strip; the hold's light sweeps the whole body (the last round's top row).
  `pulse` (0..1) makes the strip pulse while level 2 is on, faster towards 1 (hook suspense-hold); `timer` is the
  strip's countdown text; `meter` a time bar in the body (a Throw song's position). Structure as Button's
  (button.css): the <button> is `ds-pushable`, `.button__piece` (`ds-piece`) sinks.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Icon from '../icons/Icon.svelte';
  import { CA } from '../i18n/ca.ts';
  import { holdSounds } from '../sounds/touch.ts';
  import { HoldGesture } from './hold/gesture.svelte.ts';
  import { TWO_LEVEL_IDLE, twoLevel, twoLevelProgress, type TwoLevelState } from './hold/two-level.ts';
  import { useDs } from './providers.ts';
  import type { ButtonColor, ButtonSize, IconName, Level2, Meter, Pattern, Ring, UiSound, WiiKeySpec } from './types.ts';
  import './button.css';
  import './two-level.css';

  type Props = Omit<HTMLButtonAttributes, 'children' | 'class' | 'disabled' | 'aria-pressed'> & {
    color?: ButtonColor;
    size?: ButtonSize;
    pattern?: Pattern;
    ring?: Ring | null;
    icon?: IconName | null;
    iconPlacement?: 'start' | 'top';
    /** A multicolour sticker in the icon's place (a Throw song's, until the icon family draws it: H1, U170). */
    art?: Snippet;
    label: string;
    /** A second line beside the label, under it (a Throw's «de blat de moro»). */
    sub?: string | null;
    note?: string | null;
    wii?: WiiKeySpec | null;
    level2?: Level2 | null;
    /** The strip's small lead-in while idle («mantén»). */
    lead?: string | null;
    active?: 1 | 2 | null;
    canEscalate?: boolean;
    disabled?: boolean;
    holdMs?: number;
    badge?: { icon: IconName; label: string } | null;
    timer?: string | null;
    pulse?: number | null;
    /** What the hold does, for screen readers; by default «Mantén premut per passar a <level 2>». */
    how?: string | null;
    meter?: Meter | null;
    /** The press's touch sound; the escalation plays `holdDone` (holdSounds). */
    sound?: UiSound | null;
    ontap?: () => void;
    onescalate?: () => void;
    onrelease?: () => void;
    /** A press started (finger or key down); `onletgo` always follows, after the press's own actions. */
    onpress?: () => void;
    /** The press ended: let go, or taken away. */
    onletgo?: () => void;
    class?: string;
    element?: HTMLButtonElement;
  };

  let {
    color = 'grey',
    size = 'm',
    pattern = 'none',
    ring = null,
    icon = null,
    iconPlacement = 'start',
    art,
    label,
    sub = null,
    note = null,
    wii = null,
    level2 = null,
    lead = null,
    active = null,
    canEscalate = true,
    disabled = false,
    holdMs = 800,
    badge = null,
    timer = null,
    pulse = null,
    how = null,
    meter = null,
    sound = 'big',
    ontap,
    onescalate,
    onrelease,
    onpress,
    onletgo,
    class: className = '',
    element = $bindable(),
    ...rest
  }: Props = $props();

  const uid = $props.id();
  const { wii: Wii } = useDs();
  const sounds = holdSounds(() => sound ?? 'big');
  const config = () => ({ holdMs, canEscalate });

  const hold = new HoldGesture<TwoLevelState>({
    idle: TWO_LEVEL_IDLE,
    usable: () => !disabled,
    pressing: (s) => s.phase !== 'idle',
    next: (s) => (s.phase === 'pressing' ? 'frame' : null),
    progress: (s, at) => twoLevelProgress(s, at, config()),
    step(state, event) {
      const result = twoLevel(state, event, config());
      if (event.type === 'down' && state.phase === 'idle') onpress?.();
      if (sound !== null) {
        if (event.type === 'down' && state.phase === 'idle') sounds.down();
        if (result.actions.includes('escalate')) sounds.done();
        if (event.type === 'up') sounds.up();
        if (event.type === 'cancel') sounds.cancel();
      }
      for (const action of result.actions) {
        if (action === 'tap') ontap?.();
        else if (action === 'escalate') onescalate?.();
        else onrelease?.();
      }
      if (state.phase !== 'idle' && result.state.phase === 'idle') onletgo?.();
      return result.state;
    },
  });

  /** Level 2 shows on while it's on, and from the moment the hold reaches it (finger still down). */
  const level2On = $derived(active === 2 || hold.state.phase === 'escalated');
  /** R3: level 1's pattern only while level 1 is what's on, never disabled or with a badge (locked, #23). */
  const bodyPattern = $derived(active === 1 && !disabled && !badge && pattern !== 'none' ? pattern : null);
  const howText = $derived([badge?.label, how ?? (level2 ? CA.controls.holdFor(level2.label) : null)].filter(Boolean).join('. '));
  const describedBy = $derived([note ? `${uid}-note` : null, howText ? `${uid}-how` : null, rest['aria-describedby'] ?? null].filter(Boolean).join(' ') || undefined);
</script>

<button
  bind:this={element}
  {...rest}
  type="button"
  class="button two-level ds-pushable {className}"
  data-color={color}
  data-variant="solid"
  data-size={size}
  data-icon-placement={iconPlacement}
  data-ring={ring ?? undefined}
  data-touch="none"
  data-state={hold.state.phase}
  data-sunk={hold.state.phase !== 'idle' || undefined}
  data-strip={level2 ? (level2On ? 'on' : 'idle') : undefined}
  data-anim="press {level2 ? 'escalate-hold' : 'long-press-confirm'}{level2On && pulse !== null ? ' suspense-hold' : ''}"
  style="--progress: {hold.progress}; --pulse-progress: {pulse ?? 0}"
  aria-pressed={active !== null}
  aria-labelledby={sub ? `${uid}-label ${uid}-sub` : `${uid}-label`}
  aria-describedby={describedBy}
  {disabled}
  {...hold.handlers}
  {@attach hold.attach}
>
  <span class="button__piece ds-piece">
    {#if bodyPattern}<span class="ds-pattern" data-pattern={bodyPattern} aria-hidden="true"></span>{/if}
    {#if !level2}<span class="two-level__fill two-level__fill--body" aria-hidden="true"></span>{/if}
    <span class="button__body">
      <span class="button__head">
        {#if art}
          <span class="button__icon two-level__art" aria-hidden="true">{@render art()}</span>
        {:else if icon}
          <span class="button__icon" aria-hidden="true"><Icon name={icon} outline /></span>
        {/if}
        <span class="two-level__words">
          <span class="button__label" id="{uid}-label">{label}</span>
          {#if sub}<span class="two-level__sub" id="{uid}-sub">{sub}</span>{/if}
        </span>
      </span>
      {#if note}<span class="button__note" id="{uid}-note">{note}</span>{/if}
      {#if meter}
        <span class="two-level__meter" aria-hidden="true">
          {#if meter.icon}<span class="two-level__meter-icon"><Icon name={meter.icon} /></span>{/if}
          <span class="two-level__meter-time">{meter.start}</span>
          <span class="two-level__bar">
            <span class="two-level__bar-fill" style="--at: {meter.fraction}"></span>
            {#if meter.marker}<span class="two-level__mark" style="--mark: {meter.marker.at}"><span>{meter.marker.label}</span></span>{/if}
          </span>
          <span class="two-level__meter-total">{meter.end}</span>
        </span>
      {/if}
      {#if !level2}<span class="two-level__percent" aria-hidden="true">{CA.controls.percent(Math.round(hold.progress * 100))}</span>{/if}
    </span>
    {#if level2}
      <span class="two-level__strip" data-on={level2On || undefined}>
        <span class="two-level__fill" aria-hidden="true">
          {#if level2On && !disabled}<span class="ds-pattern" data-pattern="dots"></span>{/if}
        </span>
        <span class="two-level__strip-words">
          {#if !level2On && lead}<span class="two-level__lead" aria-hidden="true">{lead}</span>{/if}
          {#if level2.icon}<Icon name={level2.icon} />{/if}
          <span class="two-level__strip-label">{level2.label}</span>
          {#if timer}<span class="two-level__timer" role="timer">{timer}</span>{/if}
          <span class="two-level__percent" aria-hidden="true">{CA.controls.percent(Math.round(hold.progress * 100))}</span>
        </span>
        {#if level2.wii && Wii}<span class="two-level__strip-wii" aria-hidden="true"><Wii spec={level2.wii} /></span>{/if}
      </span>
    {/if}
    {#if badge}<span class="two-level__badge ds-corner" data-corner="top-left"><Icon name={badge.icon} alone /></span>{/if}
    {#if wii && Wii}
      <span class="button__wii ds-corner" data-size={wii.size ?? 'md'} data-hold={wii.hold || undefined} aria-hidden="true"><Wii spec={wii} /></span>
    {/if}
  </span>
</button>
{#if howText}<span class="visually-hidden" id="{uid}-how">{howText}</span>{/if}
