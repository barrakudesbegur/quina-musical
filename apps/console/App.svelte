<!--
  The console: the presenters' control page (the Consola-Joc and Consola-Comprovacio boards). Layout
  (console.css):
  - landscape: the header's three panels across the top; the scene's panels in a column on the left, the
    helpers' tabs filling the rest of it; the action cluster on the right. The playback opens the column on every
    screen (D196): «Ara sona» (IntervalMusic while the breaks', Pausa's or the end's playlist plays, then NowPlaying),
    and in one line (NowLine) where the full panel has no room: over Cerca while its box has the focus, and at the top
    of the Check board and the pads (D199). In a Check, the Check board takes the whole body, and so do the claim pad
    and the finalists' pad (the Desgraciat's finale) while they're open;
  - portrait (a phone): the header, then one scrolling column, and the cluster fixed at the bottom.
  Everything shown comes from the engine through the ConsoleModel; the root carries data-theme, data-scene
  and data-status hooks for themes, and data-wii while a Wii remote is connected (its badges show).
  The Wii remote's controller is made here, once, and shared through context (context.ts › getWii). The keyboard's
  fallback (→ or PageDown: the default action, as the remote's A; logic/keys.ts) and the screen wake lock (the
  tablet mustn't dim mid-show; only where the browser allows it) are set up here too.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { setConsole, setConsoleSounds, setWii } from './context.ts';
  import { provideDs } from '../../packages/ui/components/providers.ts';
  import DsWii from './components/DsWii.svelte';
  import { CONSOLE_TOUCH } from './touch-rules.ts';
  import { ConsoleSounds } from './ui-sounds.ts';
  import { wireTouchSounds } from '../../packages/ui/sounds/delegate.ts';
  import { registerTouchSounds } from '../../packages/ui/sounds/touch.ts';
  import { ConsoleModel } from './model.svelte.ts';
  import { WiiController } from './wii/controller.svelte.ts';
  import { keyCommand } from './logic/keys.ts';
  import { sendDefault } from './logic/default-action.ts';
  import { keepScreenOn } from '../../packages/ui/client/wake-lock.ts';
  import { S } from './strings.ts';
  import AfterPanel from './components/AfterPanel.svelte';
  import BeforePanel from './components/BeforePanel.svelte';
  import CelebrationPanel from './components/CelebrationPanel.svelte';
  import CheckPanel from './components/CheckPanel.svelte';
  import Header from './components/Header.svelte';
  import HelperTabs from './components/HelperTabs.svelte';
  import HoldPanel from './components/HoldPanel.svelte';
  import IntervalPanel from './components/IntervalPanel.svelte';
  import IntervalMusic from './components/IntervalMusic.svelte';
  import Menu from './components/Menu.svelte';
  import NextSong from './components/NextSong.svelte';
  import NowLine from './components/NowLine.svelte';
  import NowPlaying from './components/NowPlaying.svelte';
  import ClaimPad from './components/ClaimPad.svelte';
  import FinalePad from './components/FinalePad.svelte';
  import PacePanel from './components/PacePanel.svelte';
  import PausePanel from './components/PausePanel.svelte';
  import RoundStartPanel from './components/RoundStartPanel.svelte';
  import ThumbCluster from './components/ThumbCluster.svelte';
  import Toasts from './components/Toasts.svelte';
  import WiiDialog from './components/WiiDialog.svelte';

  const model = setConsole(new ConsoleModel());
  // The generic components (packages/ui/components) draw the console's Wii keys.
  provideDs({ wii: DsWii });
  const wii = setWii(new WiiController(model));
  // The tablet's touch sounds (U182): this device's taps only, never on the show laptop.
  const sounds = setConsoleSounds(new ConsoleSounds(() => model.uiSounds));
  onMount(() => {
    registerTouchSounds(sounds);
    const unwire = wireTouchSounds(document, CONSOLE_TOUCH);
    const stop = sounds.start();
    return () => {
      stop();
      unwire();
      registerTouchSounds(null);
    };
  });
  onMount(() => wii.start());
  onMount(() => keepScreenOn());

  function onKey(e: KeyboardEvent): void {
    const target = e.target instanceof HTMLElement ? e.target : null;
    const command = keyCommand({
      key: e.key,
      repeat: e.repeat,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
      targetTag: target && target !== document.body ? target.tagName.toLowerCase() : null,
      targetEditable: target?.isContentEditable ?? false,
      dialogOpen: document.querySelector('dialog[open]') !== null,
    });
    if (command !== 'default') return;
    e.preventDefault();
    sendDefault(model.act, model.defaultAction);
  }
  const snap = $derived(model.show.state);
  const flow = $derived(model.show.flow);
  const board = $derived(model.pad ? 'pad' : model.finalePad ? 'finalePad' : snap !== null && flow.scene === 'check' ? 'check' : 'play');
  const openPad = () => model.openPad();
  let menuOpen = $state(false);
  let wiiOpen = $state(false);

  // A rejection of one of this console's commands becomes a toast (untracked: toasting writes state).
  $effect(() => {
    const rejection = model.show.lastRejection;
    if (rejection) untrack(() => model.rejected(rejection));
  });
</script>

<svelte:window onkeydown={onKey} />

<div
  class="console"
  data-density="console"
  data-theme={model.theme}
  data-ground={model.theme === 'dark' ? 'night' : 'paper'}
  data-scene={flow.scene}
  data-board={board}
  data-status={snap?.status ?? 'none'}
  data-online={model.online}
  data-paused={flow.pause !== null || undefined}
  data-alert={model.alert ?? undefined}
  data-wii={wii.badges || undefined}
>
  <div class="console__top">
    <Header onmenu={() => (menuOpen = true)} />
    {#if model.alert}
      <p class="alert-banner" role="alert" data-state={model.alert}>{S.alerts[model.alert]}</p>
    {/if}
  </div>

  {#if board === 'pad'}
    <main class="console__board">
      <ClaimPad />
    </main>
  {:else if board === 'finalePad'}
    <main class="console__board">
      <FinalePad />
    </main>
  {:else if board === 'check'}
    <main class="console__board">
      <PausePanel />
      <CheckPanel onclaim={openPad} />
    </main>
  {:else}
    <main class="console__main" data-scene={flow.scene}>
      {#if snap?.intervalMusic}<IntervalMusic />{/if}
      {#if snap && (flow.scene === 'before' || flow.scene === 'play' || flow.scene === 'celebration')}<NowPlaying />{/if}
      <PausePanel />
      {#if !snap}
        <p class="console__waiting">{S.alerts.waiting}</p>
      {:else if flow.scene === 'before'}
        <BeforePanel />
        <NextSong />
        <PacePanel />
      {:else if flow.scene === 'roundStart'}
        <RoundStartPanel />
        <NextSong />
      {:else if flow.scene === 'play'}
        {#if snap.status === 'hold'}<HoldPanel />{/if}
        <NextSong />
        <PacePanel />
      {:else if flow.scene === 'celebration'}
        <CelebrationPanel />
        <NextSong />
      {:else if flow.scene === 'interval'}
        <IntervalPanel />
      {:else if flow.scene === 'after'}
        <AfterPanel />
      {/if}
      {#if snap}
        <NowLine />
        <HelperTabs />
      {/if}
    </main>

    <ThumbCluster onclaim={openPad} />
  {/if}

  <Menu bind:open={menuOpen} onwii={() => ((menuOpen = false), (wiiOpen = true))} />
  <WiiDialog bind:open={wiiOpen} />
  <Toasts />
</div>
