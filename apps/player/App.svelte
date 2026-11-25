<script lang="ts">
  // The player app's shell: the connection strip, header and status strips on every tab, the section (Ara, Premis
  // or Horari), the tab bar, the Celebration and the sheets. All state lives in PlayerApp; this only lays it out.
  // The sections are self-contained views, so drawers could replace the tab bar by swapping this container only.
  import type { PlayerApp } from './model.svelte.ts';
  import AppHeader from './components/AppHeader.svelte';
  import AraHome from './components/AraHome.svelte';
  import Celebration from './components/Celebration.svelte';
  import ConfirmSheet from './components/ConfirmSheet.svelte';
  import ConnectionStrip from './components/ConnectionStrip.svelte';
  import Heat from './components/Heat.svelte';
  import LegacyNotice from './components/LegacyNotice.svelte';
  import MenuView from './components/MenuView.svelte';
  import NumberPad from './components/NumberPad.svelte';
  import PrizesView from './components/PrizesView.svelte';
  import RenameSheet from './components/RenameSheet.svelte';
  import ScheduleView from './components/ScheduleView.svelte';
  import Sheet from './components/Sheet.svelte';
  import StatusStrip from './components/StatusStrip.svelte';
  import TabBar from './components/TabBar.svelte';
  import Toast from './components/Toast.svelte';
  import YourSong from './components/YourSong.svelte';
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
  data-your-song={app.yourSong ? 'on' : 'off'}
>
  <!-- The landed song is on one of the player's cards: gold behind everything until the next Spin (`your-song`). -->
  {#if app.yourSong}
    {#key app.yourSong.key}
      <YourSong song={app.yourSong} nowMs={app.cloudNow} reduced={app.reducedMotion} />
    {/key}
  {/if}
  <!-- Test hook: the latest landing, whatever the tab. -->
  <span hidden data-testid="now" data-song-id={app.latest?.songId ?? ''}></span>
  <Heat value={app.heat} off={app.offline} />
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
          <AraHome {app} />
        {:else if app.tab === 'premis'}
          <PrizesView {app} />
        {:else}
          <ScheduleView {app} />
        {/if}
      </div>
    {/key}
  </main>

  <TabBar active={app.tab} onselect={(tab) => app.selectTab(tab)} />

  {#if app.celebrationOpen && app.celebration}
    {#key app.celebration.key}
      <Celebration
        celebration={app.celebration}
        round={celebrationRound}
        views={app.views}
        catalog={app.catalog}
        reduced={app.reducedMotion}
        onclose={() => app.dismissCelebration()}
      />
    {/key}
  {/if}

  <!-- Offline, the screen greys under the strip: a veil's opacity (never a filter on phones), and it takes no taps. -->
  <div class="offline-veil" data-anim="offline" aria-hidden="true"></div>
  <ConnectionStrip banner={app.banner.banner} />

  {#if dialog?.kind === 'pad'}
    <NumberPad cards={app.data.cards} onadd={(id, identity) => app.addCard(id, true, identity)} onclose={() => app.closeDialog()} onkey={() => app.blip('tap')} />
  {:else if dialog?.kind === 'menu'}
    <Sheet name="menu" title={S.menu} onclose={() => app.closeDialog()}>
      <MenuView {app} />
    </Sheet>
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
