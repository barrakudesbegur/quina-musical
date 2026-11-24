<script lang="ts">
  // The player app's shell: header and status strips on every tab, the tab content,
  // the tab bar, and the overlays and sheets. All state lives in PlayerApp; this only lays it out.
  import type { PlayerApp } from './model.svelte.ts';
  import AppHeader from './components/AppHeader.svelte';
  import CardsTab from './components/CardsTab.svelte';
  import Celebration from './components/Celebration.svelte';
  import ConfirmSheet from './components/ConfirmSheet.svelte';
  import HelpSheet from './components/HelpSheet.svelte';
  import HistoryTab from './components/HistoryTab.svelte';
  import LegacyNotice from './components/LegacyNotice.svelte';
  import NowTab from './components/NowTab.svelte';
  import NumberPad from './components/NumberPad.svelte';
  import PrizesTab from './components/PrizesTab.svelte';
  import RenameSheet from './components/RenameSheet.svelte';
  import SceneOverlay from './components/SceneOverlay.svelte';
  import ScheduleTab from './components/ScheduleTab.svelte';
  import StatusStrip from './components/StatusStrip.svelte';
  import TabBar from './components/TabBar.svelte';
  import Toast from './components/Toast.svelte';
  import { prizeRounds } from './logic/view.ts';
  import { S } from './strings.ts';

  let { app }: { app: PlayerApp } = $props();
  const dialog = $derived(app.dialog);
  const named = (id: number) => app.data.cards.find((c) => c.id === id) ?? null;
  const celebrationRound = $derived(app.celebration ? (prizeRounds(app.plan, app.state).find((r) => r.number === app.celebration?.round) ?? null) : null);
</script>

<div
  class="player"
  data-scene={app.scene}
  data-state={app.screenState}
  data-tab={app.tab}
  data-motion={app.reducedMotion ? 'reduced' : 'full'}
  data-hidden={app.hidden ? 'true' : 'false'}
>
  <AppHeader {app} />
  <div class="player__alerts">
    <StatusStrip {app} />
  </div>

  <main class="player__main">
    {#if app.legacy}
      <LegacyNotice
        older={app.legacy.kind === 'legacy' || app.legacy.older}
        onadd={() => {
          app.dismissLegacy();
          app.open({ kind: 'pad' });
        }}
        ondismiss={() => app.dismissLegacy()}
      />
    {/if}
    {#key app.tab}
      <div class="player__tab" data-anim="tab-switch">
        {#if app.tab === 'ara'}
          <NowTab {app} />
        {:else if app.tab === 'cartrons'}
          <CardsTab {app} />
        {:else if app.tab === 'historial'}
          <HistoryTab {app} />
        {:else if app.tab === 'premis'}
          <PrizesTab {app} />
        {:else}
          <ScheduleTab {app} />
        {/if}
      </div>
    {/key}
  </main>

  <TabBar active={app.tab} onselect={(tab) => app.selectTab(tab)} />

  {#if app.overlayOpen && app.overlay}
    <SceneOverlay kind={app.overlay} ondismiss={() => app.dismissOverlay()} />
  {/if}
  {#if app.celebrationOpen && app.celebration}
    {#key app.celebration.key}
      <Celebration celebration={app.celebration} round={celebrationRound} mine={app.views} reduced={app.reducedMotion} onclose={() => app.dismissCelebration()} />
    {/key}
  {/if}

  {#if dialog?.kind === 'pad'}
    <NumberPad cards={app.data.cards} onadd={(id, identity) => app.addCard(id, true, identity)} onclose={() => app.closeDialog()} onkey={() => app.blip('tap')} />
  {:else if dialog?.kind === 'help'}
    <HelpSheet {app} />
  {:else if dialog?.kind === 'rename'}
    {@const card = named(dialog.cardId)}
    {#if card}
      <RenameSheet
        {card}
        others={app.data.cards.filter((c) => c.id !== card.id)}
        onsave={(name, identity) => app.editCard(card.id, name, identity)}
        onclose={() => app.closeDialog()}
      />
    {/if}
  {:else if dialog?.kind === 'remove'}
    {@const card = named(dialog.cardId)}
    <ConfirmSheet
      name="remove"
      title={S.removeTitle(dialog.cardId)}
      text={`${card?.name ? `${card.name}. ` : ''}${S.removeText}`}
      yes={S.removeYes}
      onyes={() => app.removeCard(dialog.cardId)}
      onclose={() => app.closeDialog()}
    />
  {:else if dialog?.kind === 'wipe'}
    <ConfirmSheet name="wipe" title={S.wipeTitle} text={S.wipeText} yes={S.wipeYes} onyes={() => app.wipeData()} onclose={() => app.closeDialog()} />
  {/if}

  <Toast text={app.toast} />
</div>
