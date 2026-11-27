<!--
  A risky action (Back, End the night, Panic, a verdict against the Check's result): it fires only after a
  press of --dur-hold-confirm. A short tap shows "Mantén premut per confirmar" (hook hold-hint). The fill
  sweeps the whole button (hook long-press-confirm) and drains back when released early; with reduced
  motion a percentage shows instead. `badge`: a decoration inside the button (a WiiBadge). The timing is logic/long-press.ts; this component only feeds it.
  Its look is visual props (D205): `color`, a palette through `data-color`, and `variant` ('solid', or 'plain': the
  surface's fill with the palette's text colour), from the presets in actions.ts. `big`: the cluster's sticker button.
-->
<script lang="ts">
  import { onDestroy, type Snippet } from 'svelte';
  import { CONSOLE } from '../config.ts';
  import type { LineIconName } from '../../../packages/ui/icons/line.ts';
  import { LONG_PRESS_IDLE, longPress, longPressProgress, parseCssDurationMs, type LongPressEvent, type LongPressState } from '../logic/long-press.ts';
  import { S } from '../strings.ts';
  import LineIcon from '../../../packages/ui/icons/Icon.svelte';
  import { holdSounds } from '../../../packages/ui/sounds/touch.ts';
  import type { ButtonColor } from '../../../packages/ui/components/types.ts';

  interface Props {
    label: string;
    /** A smaller explanation line inside the button. */
    note?: string | null;
    /** A drawing of the one icon family (packages/ui/icons). */
    icon?: LineIconName | null;
    color?: ButtonColor;
    variant?: 'solid' | 'plain';
    big?: boolean;
    disabled?: boolean;
    onconfirm: () => void;
    badge?: Snippet;
  }

  let { label, note = null, icon = null, color = 'red', variant = 'solid', big = false, disabled = false, onconfirm, badge }: Props = $props();

  const uid = $props.id();
  let button: HTMLButtonElement | undefined = $state();
  let press = $state<LongPressState>(LONG_PRESS_IDLE);
  let progress = $state(0);
  let frame = 0;
  let hintTimer: ReturnType<typeof setTimeout> | undefined;

  const config = () => ({
    holdMs: parseCssDurationMs(button ? getComputedStyle(button).getPropertyValue('--dur-hold-confirm') : null, CONSOLE.holdConfirmFallbackMs),
    hintMs: CONSOLE.holdHintMs,
  });

  // Its sounds (ANIMATIONS.md › Console sounds): the press, `holdDone` as it fires, and the matching release.
  const hold = holdSounds(() => (big ? 'big' : 'small'));

  function feed(event: LongPressEvent): void {
    const cfg = config();
    const step = longPress(press, event, cfg);
    press = step.state;
    progress = longPressProgress(press, event.atMs, cfg);
    if (event.type === 'down') hold.down();
    if (step.fire) hold.done();
    if (event.type === 'up') hold.up();
    if (event.type === 'cancel') hold.cancel();
    if (step.fire) onconfirm();
    cancelAnimationFrame(frame);
    clearTimeout(hintTimer);
    if (press.phase === 'pressing') frame = requestAnimationFrame(() => feed({ type: 'tick', atMs: performance.now() }));
    if (press.phase === 'hint' && press.hintUntilMs !== null) hintTimer = setTimeout(() => feed({ type: 'tick', atMs: performance.now() }), press.hintUntilMs - event.atMs);
  }

  const at = () => performance.now();
  const isPressKey = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' ';

  /** Keep getting this finger's events when it slides off the button. Never blocks the press itself. */
  function capture(e: PointerEvent): void {
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // No such active pointer (synthetic events): the press still counts.
    }
  }

  function onpointerdown(e: PointerEvent): void {
    if (disabled || e.button !== 0) return;
    capture(e);
    feed({ type: 'down', atMs: at() });
  }
  function onkeydown(e: KeyboardEvent): void {
    if (!isPressKey(e)) return;
    e.preventDefault();
    if (!disabled && !e.repeat) feed({ type: 'down', atMs: at() });
  }
  function onkeyup(e: KeyboardEvent): void {
    if (!isPressKey(e)) return;
    e.preventDefault();
    feed({ type: 'up', atMs: at() });
  }

  // Disabled mid-press (the scene changed): drop the press.
  $effect(() => {
    if (disabled && press.phase === 'pressing') feed({ type: 'cancel', atMs: at() });
  });

  onDestroy(() => {
    cancelAnimationFrame(frame);
    clearTimeout(hintTimer);
  });
</script>

<span class="long-press-wrap">
  <button
    bind:this={button}
    type="button"
    class="long-press"
    class:big-button={big}
    data-color={color}
    data-variant={variant}
    data-anim="press long-press-confirm"
    data-state={press.phase}
    style:--progress={progress}
    {disabled}
    aria-describedby="{uid}-how"
    {onpointerdown}
    onpointerup={() => feed({ type: 'up', atMs: at() })}
    onpointercancel={() => feed({ type: 'cancel', atMs: at() })}
    {onkeydown}
    {onkeyup}
    onblur={() => feed({ type: 'cancel', atMs: at() })}
    oncontextmenu={(e) => e.preventDefault()}
  >
    <span class="long-press__fill" aria-hidden="true"></span>
    <span class="long-press__content">
      {#if icon}<LineIcon name={icon} outline={big} />{/if}
      <span class="long-press__text">
        <span class="long-press__label">{label}</span>
        {#if note}<span class="long-press__note">{note}</span>{/if}
      </span>
      <span class="long-press__percent" aria-hidden="true">{S.longPress.percent(Math.round(progress * 100))}</span>
    </span>
    {@render badge?.()}
  </button>
  <span class="visually-hidden" id="{uid}-how">{S.longPress.hint}</span>
  <span class="hold-hint" role="status" data-anim="hold-hint" data-state={press.phase === 'hint' ? 'shown' : 'hidden'}>
    {press.phase === 'hint' ? S.longPress.hint : ''}
  </span>
</span>
