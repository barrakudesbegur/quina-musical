<!--
  «Llançament» or «Tempesta» (logic/throw-songs.ts; the Consola-Llancament-Tempesta board). A tap starts the song,
  stops it while it plays and resumes it; holding it past CONSOLE.escalateHoldMs plays it again from its hook, with the
  same gesture as Parlem's and Aguanta's second level (logic/two-level.ts): the «Des del principi» strip along its
  bottom fills while the finger is down (hook throw-hold). While its song plays the button shows pressed and its
  stripes drift (hook throw-on); the song's name shows inside the big one.
  `variant`: big (Següent's place), side (the end screen's smaller «Llançament» beside «Tempesta»), top (the last
  round's top row, between «Enrere» and «Comprovar»: no strip, the fill sweeps the whole button, as on «Enrere»).
  Only on the tablet: no Wii badge, and A never plays it. Hooks: data-testid="throw-button" or "storm-button".
-->
<script lang="ts">
  import type { ThrowSong } from '@quina/protocol';
  import { onDestroy } from 'svelte';
  import { CONSOLE } from '../config.ts';
  import { getConsole } from '../context.ts';
  import { throwButtonState, throwCommand } from '../logic/throw-songs.ts';
  import { TWO_LEVEL_IDLE, twoLevel, twoLevelProgress, type TwoLevelEvent, type TwoLevelState } from '../logic/two-level.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import ThrowIcon from './ThrowIcon.svelte';

  interface Props {
    song: ThrowSong;
    variant?: 'big' | 'side' | 'top';
  }

  let { song, variant = 'big' }: Props = $props();

  const model = getConsole();
  const uid = $props.id();
  const t = $derived(S.throws.names[song]);
  const info = $derived(model.show.state?.throwSong ?? null);
  const songState = $derived(throwButtonState(info, song));
  const enabled = $derived(model.can(song));
  const note = $derived(songState === 'playing' ? S.throws.stop : songState === 'stopped' ? S.throws.resume : songState === 'other' ? t.replace : t.start);

  let press = $state<TwoLevelState>(TWO_LEVEL_IDLE);
  let progress = $state(0);
  let frame = 0;

  const config = () => ({ holdMs: CONSOLE.escalateHoldMs, canEscalate: enabled });

  function feed(event: TwoLevelEvent): void {
    const cfg = config();
    const result = twoLevel(press, event, cfg);
    press = result.state;
    progress = twoLevelProgress(press, event.atMs, cfg);
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
    {#if variant === 'big' && info?.song === song}
      <span class="throw-button__song"><Icon name="music" /><span>{S.throws.song(info.title, info.artist)}</span></span>
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
<span class="visually-hidden" id="{uid}-how">{S.throws.howTo(note)}</span>
