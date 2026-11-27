<!--
  «Llançament» or «Tempesta» (logic/throw-songs.ts; the Consola-Llancament-Tempesta board). A tap starts the song,
  stops it while it plays and resumes it; holding it past CONSOLE.escalateHoldMs plays it again from its hook, with the
  same gesture as Parlem's and Aguanta's second level (logic/two-level.ts): the «Des del principi» strip along its
  bottom fills while the finger is down (hook throw-hold). While its song plays the button shows pressed and its
  stripes drift (hook throw-on). While it's on, the big one shows its time from the hook: ♪ bars or ‖, the time, a bar
  with the drop's mark («Llançament» only: «Tempesta» starts at the drop) and its length (logic/throw-songs.ts
  throwProgress); idle, no song name (the user: the banner was unnecessary).
  `variant`: big (the big bottom place), line (a break's slim line along the top, D195: the name and its note on the
  left, the time on the right, the strip under them) or top (the last round's top row, between «Enrere» and
  «Comprovar»: no strip, the fill sweeps the whole button, as on «Enrere»).
  Only on the tablet: no Wii badge, and A never plays it. Hooks: data-testid="throw-button" or "storm-button".
-->
<script lang="ts">
  import type { ThrowSong } from '@quina/protocol';
  import { onDestroy } from 'svelte';
  import { CONSOLE } from '../config.ts';
  import { getConsole } from '../context.ts';
  import { throwButtonState, throwClock, throwCommand, throwProgress } from '../logic/throw-songs.ts';
  import { TWO_LEVEL_IDLE, twoLevel, twoLevelProgress, type TwoLevelEvent, type TwoLevelState } from '../logic/two-level.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import ThrowIcon from './ThrowIcon.svelte';
  import { holdSounds } from '../../../packages/ui/sounds/touch.ts';

  interface Props {
    song: ThrowSong;
    variant?: 'big' | 'line' | 'top';
  }

  let { song, variant = 'big' }: Props = $props();

  const model = getConsole();
  const uid = $props.id();
  const t = $derived(S.throws.names[song]);
  const info = $derived(model.show.state?.throwSong ?? null);
  const songState = $derived(throwButtonState(info, song));
  const enabled = $derived(model.can(song));
  const note = $derived(songState === 'playing' ? S.throws.stop : songState === 'stopped' ? S.throws.resume : songState === 'other' ? t.replace : t.start);
  // Its time while it's on (the bar), on the show's clock.
  const time = $derived(info && info.song === song ? throwProgress(info, model.show.now) : null);
  const clock = $derived(time ? S.throws.time(throwClock(time.atSec), throwClock(Math.round(time.totalSec))) : null);

  let press = $state<TwoLevelState>(TWO_LEVEL_IDLE);
  let progress = $state(0);
  let frame = 0;

  const config = () => ({ holdMs: CONSOLE.escalateHoldMs, canEscalate: enabled });

  // Its sounds (ANIMATIONS.md › Console sounds): the press, `holdDone` as the song restarts, the matching release.
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
      const command = throwCommand(song, action);
      if (!command || !enabled) continue;
      if (command.cmd === 'throw') model.act('throw', command.args);
      else model.act('storm', command.args);
    }
    cancelAnimationFrame(frame);
    if (press.phase === 'pressing') frame = requestAnimationFrame(() => feed({ type: 'tick', atMs: performance.now() }));
  }

  const at = () => performance.now();
  const isPressKey = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' ';

  function onpointerdown(e: PointerEvent): void {
    if (e.button !== 0 || !enabled) return;
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
    if (!e.repeat && enabled) feed({ type: 'down', atMs: at() });
  }

  function onkeyup(e: KeyboardEvent): void {
    if (!isPressKey(e)) return;
    e.preventDefault();
    feed({ type: 'up', atMs: at() });
  }

  // Assistive technology may activate the button with a bare click (no pointer or key events): a tap.
  function onclick(e: MouseEvent): void {
    if (e.detail !== 0 || press.phase !== 'idle' || !enabled) return;
    feed({ type: 'down', atMs: at() });
    feed({ type: 'up', atMs: at() });
  }

  // Disabled mid-press (the scene changed, Pausa came on): drop the press.
  $effect(() => {
    if (!enabled && press.phase === 'pressing') feed({ type: 'cancel', atMs: at() });
  });

  onDestroy(() => cancelAnimationFrame(frame));
</script>

<button
  type="button"
  class="big-button throw-button"
  data-testid="{song}-button"
  data-action={song}
  data-variant={variant}
  data-anim="press throw-hold{songState === 'playing' ? ' throw-on' : ''}"
  data-state={press.phase}
  data-song-state={songState}
  style:--progress={progress}
  aria-pressed={songState === 'playing'}
  aria-describedby="{uid}-how"
  disabled={!enabled}
  {onpointerdown}
  onpointerup={() => feed({ type: 'up', atMs: at() })}
  onpointercancel={() => feed({ type: 'cancel', atMs: at() })}
  {onkeydown}
  {onkeyup}
  {onclick}
  onblur={() => feed({ type: 'cancel', atMs: at() })}
  oncontextmenu={(e) => e.preventDefault()}
>
  {#if variant === 'top'}<span class="throw-button__fill" aria-hidden="true"></span>{/if}
  <span class="throw-button__main">
    <span class="throw-button__name">
      <ThrowIcon {song} />
      <span class="throw-button__words">
        <span class="big-button__label">{t.label}</span>
        {#if t.sub}<span class="throw-button__sub">{t.sub}</span>{/if}
      </span>
    </span>
    {#if variant !== 'top'}<span class="big-button__note">{note}</span>{/if}
    {#if time && variant !== 'top'}
      <span class="throw-button__time" aria-hidden="true">
        {#if songState === 'playing'}
          <svg class="throw-button__eq" viewBox="0 0 24 24"><rect x="3" y="11" width="4" height="10" rx="1.5" /><rect x="10" y="4" width="4" height="17" rx="1.5" /><rect x="17" y="14" width="4" height="7" rx="1.5" /></svg>
        {:else}
          <svg class="throw-button__paused" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1.5" /><rect x="14" y="5" width="4" height="14" rx="1.5" /></svg>
        {/if}
        <span class="throw-button__clock">{throwClock(time.atSec)}</span>
        <span class="throw-button__bar" data-anim="throw-on">
          <span class="throw-button__bar-fill" style:--at={time.fraction}></span>
          {#if time.dropAt !== null}<span class="throw-button__drop" style:--drop={time.dropAt}><span>{S.throws.drop}</span></span>{/if}
        </span>
        <span class="throw-button__total">{throwClock(Math.round(time.totalSec))}</span>
      </span>
    {/if}
    {#if variant === 'top'}<span class="throw-button__percent" aria-hidden="true">{Math.round(progress * 100)} %</span>{/if}
  </span>
  {#if variant !== 'top'}
    <span class="throw-button__strip">
      <span class="two-level__fill" aria-hidden="true"></span>
      <span class="two-level__second-content">
        <Icon name="restart" />
        <span>{S.throws.restart}</span>
        <span class="two-level__percent" aria-hidden="true">{Math.round(progress * 100)} %</span>
      </span>
    </span>
  {/if}
</button>
<span class="visually-hidden" id="{uid}-how">{#if clock}{clock}. {/if}{S.throws.howTo(note)}</span>
