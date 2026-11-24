<script lang="ts">
  // Ara, the home: the drum on top (or what the scene shows there, or the pause's nino), then the Historial |
  // Cartrons switch and that view. The switch is remembered on the device; Cartrons shrinks the drum to a strip.
  // Self-contained: it doesn't know whether it sits in a tab or under drawers.
  import type { PlayerApp } from '../model.svelte.ts';
  import CardsList from './CardsList.svelte';
  import HistoryList from './HistoryList.svelte';
  import NowPanel from './NowPanel.svelte';
  import PauseNotice from './PauseNotice.svelte';
  import ViewSwitch from './ViewSwitch.svelte';

  let { app }: { app: PlayerApp } = $props();
  const compact = $derived(app.araView === 'cartrons');
</script>

<div class="ara" data-view={app.araView}>
  <!-- The pause swaps in for the drum with a crossfade (ANIMATIONS.md `pause`, 300 ms). -->
  {#key app.paused}
    <div class="ara__top" data-anim="pause">
      {#if app.paused}
        <PauseNotice {compact} />
      {:else}
        <NowPanel {app} {compact} stopped={app.offline} />
      {/if}
    </div>
  {/key}
  <ViewSwitch value={app.araView} panel="ara-view" onselect={(view) => app.selectAraView(view)} />
  {#key app.araView}
    <div class="ara__view" id="ara-view" role="tabpanel" aria-labelledby="ara-view-{app.araView}" data-anim="tab-switch">
      {#if app.araView === 'cartrons'}
        <CardsList {app} />
      {:else}
        <HistoryList {app} />
      {/if}
    </div>
  {/key}
</div>
