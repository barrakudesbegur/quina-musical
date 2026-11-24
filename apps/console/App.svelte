<!--
  The console: the presenters' control page (the Consola-Joc and Consola-Comprovacio boards). Layout
  (console.css):
  - landscape: the header's three panels across the top; the scene's panels in a column on the left, the
    helpers' tabs filling the rest of it; the action cluster on the right. In a Check, the Check board takes
    the whole body;
  - portrait (a phone): the header, then one scrolling column, and the cluster fixed at the bottom.
  Everything shown comes from the engine through the ConsoleModel; the root carries data-theme, data-scene
  and data-status hooks for themes, and data-wii while a Wii remote is connected (its badges show).
  The Wii remote's controller is made here, once, and shared through context (context.ts › getWii).
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { setConsole, setWii } from './context.ts';
  import { ConsoleModel } from './model.svelte.ts';
  import { WiiController } from './wii/controller.svelte.ts';
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
  import NowPlaying from './components/NowPlaying.svelte';
  import NumberPad from './components/NumberPad.svelte';
  import PacePanel from './components/PacePanel.svelte';
  import PausePanel from './components/PausePanel.svelte';
  import RoundStartPanel from './components/RoundStartPanel.svelte';
  import ThumbCluster from './components/ThumbCluster.svelte';
  import Toasts from './components/Toasts.svelte';
  import WiiDialog from './components/WiiDialog.svelte';

  const model = setConsole(new ConsoleModel());
  const wii = setWii(new WiiController(model));
  onMount(() => wii.start());
  const snap = $derived(model.show.state);
  const flow = $derived(model.show.flow);
  const board = $derived(snap !== null && flow.scene === 'check' ? 'check' : 'play');
  let padOpen = $state(false);
  let menuOpen = $state(false);
  let wiiOpen = $state(false);

  // A rejection of one of this console's commands becomes a toast (untracked: toasting writes state).
  $effect(() => {
    const rejection = model.show.lastRejection;
    if (rejection) untrack(() => model.rejected(rejection));
  });
</script>

<div
  class="console"
  data-theme={model.theme}
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

  {#if board === 'check'}
    <main class="console__board">
      <PausePanel />
      <CheckPanel onclaim={() => (padOpen = true)} />
    </main>
  {:else}
    <main class="console__main" data-scene={flow.scene}>
      <PausePanel />
      {#if !snap}
        <p class="console__waiting">{S.alerts.waiting}</p>
      {:else if flow.scene === 'before'}
        <BeforePanel />
        <NowPlaying />
        <NextSong />
        <PacePanel />
      {:else if flow.scene === 'roundStart'}
        <RoundStartPanel />
        <NextSong />
      {:else if flow.scene === 'play'}
        {#if snap.status === 'hold'}<HoldPanel />{/if}
        <NowPlaying />
        <NextSong />
        <PacePanel />
      {:else if flow.scene === 'celebration'}
        <CelebrationPanel />
        <NowPlaying />
        <NextSong />
      {:else if flow.scene === 'interval'}
        <IntervalPanel />
      {:else if flow.scene === 'after'}
        <AfterPanel />
      {/if}
      {#if snap?.intervalMusic}<IntervalMusic />{/if}
      {#if snap}<HelperTabs />{/if}
    </main>

    <ThumbCluster onclaim={() => (padOpen = true)} />
  {/if}

  <NumberPad bind:open={padOpen} />
  <Menu bind:open={menuOpen} onwii={() => ((menuOpen = false), (wiiOpen = true))} />
  <WiiDialog bind:open={wiiOpen} />
  <Toasts />
</div>
