<!--
  Parlem or Aguanta, with its second level (Pausa, Suspens) on a strip along the button's bottom edge
  ("mantén ‖ Pausa", the Consola-Joc board), so the link between the two reads at a glance. A tap is the first level; holding past CONSOLE.escalateHoldMs is
  the second (logic/two-level.ts decides which, logic/hold-modes.ts what each sends). While pressing, the
  strip fills with light from left to right (hook escalate-hold); when the second level is reached the strip
  turns its colour and stays so while it is on (an open Suspens pulses there with its auto-release countdown: hook
  suspense-hold). With reduced motion the strip shows a percentage instead of the sweep.
  With a Wii remote connected, each level shows its Wii button (WiiBadge): Parlem −+ (a tap) and Pausa −+ held;
  Aguanta B held; Suspens B + A held at the strip's right end (D144, D147), and the shake ×3 at its left end while the
  shake is switched on (D148; the Consola-Joc board), until a Suspens is open.
  During Pausa Parlem shows on and locked (D128): a tap ends Pausa, and Parlem stays on after it.
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { CONSOLE } from '../config.ts';
  import { getConsole, getWii } from '../context.ts';
  import { suspenseCountdown } from '../logic/countdown.ts';
  import { modeCommand, secondLevel, type HoldMode } from '../logic/hold-modes.ts';
  import { TWO_LEVEL_IDLE, twoLevel, twoLevelProgress, type TwoLevelEvent, type TwoLevelState } from '../logic/two-level.ts';
  import { S } from '../strings.ts';
  import { ACTIONS } from '../actions.ts';
  import Icon from './Icon.svelte';
  import LineIcon from '../../../packages/ui/icons/Icon.svelte';
  import WiiBadge from './WiiBadge.svelte';
  import { holdSounds } from '../../../packages/ui/sounds/touch.ts';

  interface Props {
    mode: HoldMode;
    /** The Hold in progress, if any (its mode shows pressed). */
    active: HoldMode | null;
    enabled: boolean;
  }

  let { mode, active, enabled }: Props = $props();

  const model = getConsole();
  const wii = getWii();
  const uid = $props.id();
  // Each mode's look and words: its preset (actions.ts), the level-2 strip in the same palette as the top (D-k).
  const t = $derived(mode === 'talk' ? ACTIONS.hold : ACTIONS.stay);

  let press = $state<TwoLevelState>(TWO_LEVEL_IDLE);
  let progress = $state(0);
  let frame = 0;

  const level2 = $derived(
    secondLevel(mode, {
      paused: model.show.flow.pause !== null,
      suspenseOpen: model.controls.suspense.open,
      canPause: model.can('pause'),
      canSuspense: model.controls.suspense.enabled,
    }),
  );
  const pressed = $derived(active === mode);
  /** Parlem during Pausa: on, and it can't be turned off until Pausa ends (D128). */
  const locked = $derived(mode === 'talk' && level2.on);
  // Usable when either level is: the first one (hold), or leaving the second (a tap while it's on).
  const usable = $derived(enabled || level2.on || level2.canEnter);
  const countdown = $derived(mode === 'stay' && level2.on && model.show.state ? suspenseCountdown(model.show.state, model.show.now) : null);
  const note = $derived.by(() => {
    if (mode === 'talk' && level2.on) return S.cluster.pauseOn;
    if (mode === 'stay' && level2.on) return press.phase === 'escalated' ? S.cluster.suspenseOpen : S.cluster.suspenseTap;
    return pressed ? S.cluster.activeNote : t.note;
  });

  const config = () => ({ holdMs: CONSOLE.escalateHoldMs, canEscalate: level2.canEnter });

  // Its sounds (ANIMATIONS.md › Console sounds): the press, `holdDone` as the second level goes, the matching release.
  const hold = holdSounds('big');

  function feed(event: TwoLevelEvent): void {
    const cfg = config();
    const result = twoLevel(press, event, cfg);
    press = result.state;
    progress = twoLevelProgress(press, event.atMs, cfg);
    if (event.type === 'down') hold.down();
    if (result.actions.includes('escalate')) hold.done();
    if (event.type === 'up') hold.up();
    if (event.type === 'cancel') hold.cancel();
    for (const action of result.actions) {
      // Read the current state for each action: a tap acts on what is on now.
      const command = modeCommand(mode, action, active, level2);
      // No command when its level isn't allowed now (a tap while only the second level could be entered).
      if (!command || (command.cmd === 'hold' && !enabled)) continue;
      if (command.cmd === 'hold') model.act('hold', command.args);
      else if (command.cmd === 'pause') model.act('pause', command.args);
      else model.act('suspense', command.args);
    }
    cancelAnimationFrame(frame);
    if (press.phase === 'pressing') frame = requestAnimationFrame(() => feed({ type: 'tick', atMs: performance.now() }));
  }

  const at = () => performance.now();
  const isPressKey = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' ';

  function onpointerdown(e: PointerEvent): void {
    if (e.button !== 0 || !usable) return;
    try {
      // Keep getting this finger's events when it slides off the button.
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // No such active pointer (synthetic events): the press still counts.
    }
    feed({ type: 'down', atMs: at() });
  }

  function onkeydown(e: KeyboardEvent): void {
    if (!isPressKey(e)) return;
    e.preventDefault();
    if (!e.repeat && usable) feed({ type: 'down', atMs: at() });
  }

  function onkeyup(e: KeyboardEvent): void {
    if (!isPressKey(e)) return;
    e.preventDefault();
    feed({ type: 'up', atMs: at() });
  }

  // Assistive technology may activate the button with a bare click (no pointer or key events): a tap.
  function onclick(e: MouseEvent): void {
    if (e.detail !== 0 || press.phase !== 'idle' || !usable) return;
    feed({ type: 'down', atMs: at() });
    feed({ type: 'up', atMs: at() });
  }

  // Never leave a Suspens held by a finger that is gone: a hidden page lets go.
  function onvisibilitychange(): void {
    if (document.hidden) feed({ type: 'cancel', atMs: at() });
  }

  onDestroy(() => {
    cancelAnimationFrame(frame);
    if (press.phase !== 'idle') feed({ type: 'cancel', atMs: at() });
  });
</script>

<svelte:document {onvisibilitychange} />

<button
  type="button"
  class="big-button two-level"
  data-color={t.color}
  data-anim="press escalate-hold{mode === 'stay' && level2.on ? ' suspense-hold' : ''}"
  data-state={press.phase}
  data-level2={level2.on || undefined}
  data-locked={locked || undefined}
  style:--progress={progress}
  style:--suspense-progress={countdown ? 1 - countdown.remaining : 0}
  aria-pressed={pressed || level2.on}
  aria-describedby="{uid}-how"
  disabled={!usable}
  {onpointerdown}
  onpointerup={() => feed({ type: 'up', atMs: at() })}
  onpointercancel={() => feed({ type: 'cancel', atMs: at() })}
  {onkeydown}
  {onkeyup}
  {onclick}
  onblur={() => feed({ type: 'cancel', atMs: at() })}
  oncontextmenu={(e) => e.preventDefault()}
>
  <span class="two-level__main">
    {#if locked}<span class="two-level__lock"><Icon name="lock" alone /><span class="visually-hidden">{S.cluster.talkLocked}</span></span>{/if}
    <LineIcon name={t.icon} outline />
    <span class="big-button__text">
      <span class="big-button__label">{t.label}</span>
      <span class="big-button__note">{note}</span>
    </span>
  </span>
  <span class="two-level__second" data-on={level2.on || undefined} data-ready={level2.canEnter || undefined}>
    <span class="two-level__fill" aria-hidden="true"></span>
    <span class="two-level__second-content">
      {#if !level2.on}<span class="two-level__how" aria-hidden="true">{S.cluster.holdFor}</span>{/if}
      <LineIcon name={t.level2.icon} />
      <span class="two-level__second-label">{t.level2.label}</span>
      {#if countdown}<span class="two-level__count" role="timer">{S.cluster.suspenseAutoRelease(countdown.secondsLeft)}</span>{/if}
      <span class="two-level__percent" aria-hidden="true">{Math.round(progress * 100)} %</span>
    </span>
    {#if mode === 'talk'}
      <WiiBadge button="talk" hold place="strip" size="sm" />
    {:else if !level2.on}
      <!-- How to enter Suspens; once it's open the strip shows its auto-release countdown instead. -->
      {#if wii.shake}<WiiBadge button="shake" place="strip-start" size="sm" />{/if}
      <WiiBadge button="b" plus="a" hold place="strip" size="sm" />
    {/if}
  </span>
  {#if mode === 'talk'}<WiiBadge button="talk" />{:else}<WiiBadge button="b" hold />{/if}
</button>
<span class="visually-hidden" id="{uid}-how">{S.cluster.holdForLong(t.level2.label)}</span>
