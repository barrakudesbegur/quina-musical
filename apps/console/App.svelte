<!--
  The console: the presenters' control page. Layout (console.css):
  - landscape: the header across the top; the scene on the left; the helpers (tabs) and the thumb cluster
    on the right, the cluster in the bottom-right corner;
  - portrait: the header, then one scrolling column (scene, helpers), and the cluster fixed at the bottom.
  Everything shown comes from the engine through the ConsoleModel; the root carries data-theme, data-scene
  and data-status hooks for themes.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { setConsole } from './context.ts';
  import { ConsoleModel } from './model.svelte.ts';
  import { S } from './strings.ts';
  import AfterPanel from './components/AfterPanel.svelte';
  import BeforePanel from './components/BeforePanel.svelte';
  import CelebrationPanel from './components/CelebrationPanel.svelte';
  import CheckPanel from './components/CheckPanel.svelte';
  import Header from './components/Header.svelte';
  import HoldPanel from './components/HoldPanel.svelte';
  import IntervalPanel from './components/IntervalPanel.svelte';
  import IntervalMusic from './components/IntervalMusic.svelte';
  import Menu from './components/Menu.svelte';
  import NextSong from './components/NextSong.svelte';
  import NowPlaying from './components/NowPlaying.svelte';
  import NumberPad from './components/NumberPad.svelte';
  import PacePanel from './components/PacePanel.svelte';
  import PausePanel from './components/PausePanel.svelte';
  import PossibleWinners from './components/PossibleWinners.svelte';
  import RoundStartPanel from './components/RoundStartPanel.svelte';
  import SideTabs from './components/SideTabs.svelte';
  import ThumbCluster from './components/ThumbCluster.svelte';
  import Toasts from './components/Toasts.svelte';

  const model = setConsole(new ConsoleModel());
  const snap = $derived(model.show.state);
  const flow = $derived(model.show.flow);
  let padOpen = $state(false);
  let menuOpen = $state(false);

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
  data-status={snap?.status ?? 'none'}
  data-online={model.online}
  data-paused={flow.pause !== null || undefined}
  data-alert={model.alert ?? undefined}
>
  <div class="console__top">
    <Header onmenu={() => (menuOpen = true)} />
    {#if model.alert}
      <p class="alert-banner" role="alert" data-state={model.alert}>{S.alerts[model.alert]}</p>
    {/if}
  </div>

  <div class="console__body">
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
        <div class="console__pair">
          <NowPlaying />
          <NextSong />
        </div>
        {#key snap.round.number}<PossibleWinners />{/key}
        <PacePanel />
      {:else if flow.scene === 'check'}
        <CheckPanel onclaim={() => (padOpen = true)} />
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
    </main>

    <aside class="console__side">
      <SideTabs />
    </aside>
  </div>

  <ThumbCluster onclaim={() => (padOpen = true)} />
  <NumberPad bind:open={padOpen} />
  <Menu bind:open={menuOpen} />
  <Toasts />
</div>
