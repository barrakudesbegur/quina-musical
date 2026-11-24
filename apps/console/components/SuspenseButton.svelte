<!--
  Suspense: press and hold to build the tension (`suspense {on:true}`), let go to land (`suspense {on:false}`).
  Pressing an open Suspense (opened on another console) and letting go releases it. While open it shows the
  auto-release countdown (hook suspense-hold: the fill builds, a glow pulses faster towards the release).
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { getConsole } from '../context.ts';
  import { suspenseCountdown } from '../logic/countdown.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  const model = getConsole();
  let pressed = $state(false);

  const open = $derived(model.controls.suspense.open);
  const enabled = $derived(model.controls.suspense.enabled);
  const countdown = $derived(model.show.state ? suspenseCountdown(model.show.state, model.show.now) : null);
  const built = $derived(countdown ? 1 - countdown.remaining : 0);

  function start(): void {
    if (!enabled || pressed) return;
    pressed = true;
    if (!open) model.act('suspense', { on: true });
  }

  function release(): void {
    if (!pressed) return;
    pressed = false;
    model.act('suspense', { on: false });
  }

  function onpointerdown(e: PointerEvent): void {
    if (e.button !== 0) return;
    capture(e);
    start();
  }
  const isPressKey = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' ';

  /** Keep getting this finger's events when it slides off the button. Never blocks the press itself. */
  function capture(e: PointerEvent): void {
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // No such active pointer (synthetic events): the press still counts.
    }
  }
  function onkeydown(e: KeyboardEvent): void {
    if (!isPressKey(e)) return;
    e.preventDefault();
    if (!e.repeat) start();
  }
  function onkeyup(e: KeyboardEvent): void {
    if (!isPressKey(e)) return;
    e.preventDefault();
    release();
  }

  // Never leave a Suspense held by a finger that is gone: a hidden page lets go (the engine also releases
  // it by itself after about 30 s).
  function onvisibilitychange(): void {
    if (document.hidden) release();
  }

  onDestroy(() => release());
</script>

<svelte:document {onvisibilitychange} />

<button
  type="button"
  class="big-button suspense-button"
  data-action="suspense"
  data-anim="press suspense-hold"
  data-state={open ? 'open' : pressed ? 'pressing' : 'idle'}
  style:--suspense-progress={built}
  disabled={!enabled}
  aria-pressed={open}
  {onpointerdown}
  onpointerup={release}
  onpointercancel={release}
  {onkeydown}
  {onkeyup}
  onblur={release}
  oncontextmenu={(e) => e.preventDefault()}
>
  <span class="suspense-button__fill" aria-hidden="true"></span>
  <Icon name="suspense" outline />
  <span class="big-button__text">
    <span class="big-button__label">{S.cluster.suspense}</span>
    <span class="big-button__note">
      {#if open && countdown}
        {pressed ? S.cluster.suspenseOpen : S.cluster.suspenseAutoRelease}
      {:else}
        {S.cluster.suspenseIdle}
      {/if}
    </span>
  </span>
  {#if open && countdown}<span class="suspense-button__count" role="timer">{countdown.secondsLeft}</span>{/if}
</button>
