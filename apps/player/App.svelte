<script lang="ts">
  // The player app's shell (D73, D87): one home screen (the garland, the header, the status strips, the drum and
  // Historial | Cartrons), the two corner buttons (Premis, Horari), the Celebration, and the drawers stacked over it
  // all (logic/drawers.ts). All state lives in PlayerApp; this only lays it out.
  import { provideDs } from '../../packages/ui/components/providers.ts';
  import { isLocalHost } from '../../packages/ui/client/endpoints.ts';
  import { PLAYER_CONFIG } from './config.ts';
  import type { PlayerApp } from './model.svelte.ts';
  import { depthOf, drawerOrigin } from './logic/drawers.ts';
  import AppHeader from './components/AppHeader.svelte';
  import AraHome from './components/AraHome.svelte';
  import Celebration from './components/Celebration.svelte';
  import ConfirmSheet from './components/ConfirmSheet.svelte';
  import ConnectionStrip from './components/ConnectionStrip.svelte';
  import CornerButtons from './components/CornerButtons.svelte';
  import Drawer from './components/Drawer.svelte';
  import DrawerFrame from './components/DrawerFrame.svelte';
  import Heat from './components/Heat.svelte';
  import HomeFloats from './components/HomeFloats.svelte';
  import InstallSteps from './components/InstallSteps.svelte';
  import LegacyNotice from './components/LegacyNotice.svelte';
  import MenuView from './components/MenuView.svelte';
  import NumberPad from './components/NumberPad.svelte';
  import PrizesView from './components/PrizesView.svelte';
  import RenameSheet from './components/RenameSheet.svelte';
  import ScheduleView from './components/ScheduleView.svelte';
  import StatusStrip from './components/StatusStrip.svelte';
  import Toast from './components/Toast.svelte';
  import YourSong from './components/YourSong.svelte';
  import { markedIdentities, prizeRounds, roundNameOf } from './logic/view.ts';
  import { S } from './strings.ts';

  let { app }: { app: PlayerApp } = $props();
  // The generic components' covers (D4): production serves a JPEG XL of each; the laptop's dev relay only the JPEGs.
  provideDs({ covers: { base: PLAYER_CONFIG.coverBase, jxl: PLAYER_CONFIG.coverJxl && !isLocalHost(location.hostname) } });
  const named = (id: number) => app.data.cards.find((c) => c.id === id) ?? null;
  const celebrationRound = $derived(app.celebration ? (prizeRounds(app.plan, app.state).find((r) => r.number === app.celebration?.round) ?? null) : null);
  const closeTop = () => app.closeTop();
  const closeAll = () => app.closeAll();
</script>

<div
  class="player"
  data-density="phone"
  data-ground="night"
  data-scene={app.scene}
  data-state={app.screenState}
  data-booting={app.booting ? 'true' : undefined}
  data-drawers={app.drawers.length}
  data-motion={app.reducedMotion ? 'reduced' : 'full'}
  data-hidden={app.hidden ? 'true' : 'false'}
  data-your-song={app.yourSong ? 'on' : 'off'}
>
  <!-- The landed song is on one of the player's cards: gold behind everything until the next Spin (`your-song`). -->
  {#if app.yourSong}
    {#key app.yourSong.key}
      <YourSong song={app.yourSong} nowMs={app.cloudNow} reduced={app.reducedMotion} layer={app.drawers.length} marks={markedIdentities(app.views).get(app.yourSong.songId) ?? []} />
    {/key}
  {/if}
  <!-- Test hook: the latest landing, whatever drawer is open. -->
  <span hidden data-testid="now" data-song-id={app.latest?.songId ?? ''}></span>
  <Heat value={app.heat} off={app.offline} party={app.yourSong !== null} win={app.scene === 'celebration'} covered={app.celebrationOpen} />
  <!-- The home scrolls in its own box under the garland, masked at the top and bottom so the content fades to
       see-through there (the night, the gold or the beams show behind, never a painted gradient: §8 Y1, Y2). -->
  <div class="player__scroll">
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
    <!-- No state yet (a first open; a reload has this tab's last one): an empty sky until the feed's first snapshot,
         never the before-the-night screen by default. -->
    {#if app.state}<AraHome {app} />{/if}
  </main>
  </div>
  <!-- Over the masked home: «+ Cartró» and the hint to the card holding the song (AraHome drives them). -->
  {#if app.state}<HomeFloats {app} />{/if}

  <!-- The corners leave during a Celebration (U175 item 16), and come back when it's closed. -->
  {#if !app.celebrationOpen}
    <CornerButtons onprizes={() => app.open({ kind: 'premis' })} onschedule={() => app.open({ kind: 'horari' })} />
  {/if}

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

  <!-- The drawers, bottom first: each one knows its depth, whether one lies under it, and its corner. -->
  {#each app.drawers as drawer, i (`${i}:${drawer.kind}`)}
    <DrawerFrame depth={depthOf(app.drawers, i)} stacked={i > 0} origin={drawerOrigin(drawer, i > 0)} {closeAll}>
      {#if drawer.kind === 'premis'}
        <Drawer name="premis" title={drawer.round === undefined ? S.prizesTitle : roundNameOf(drawer.round, app.state, app.plan)} onclose={closeTop}>
          <PrizesView {app} round={drawer.round} />
        </Drawer>
      {:else if drawer.kind === 'horari'}
        <Drawer name="horari" title={S.scheduleTitle} onclose={closeTop}>
          <ScheduleView {app} onround={(round) => app.open({ kind: 'premis', round })} />
        </Drawer>
      {:else if drawer.kind === 'ajustos'}
        <Drawer name="ajustos" title={S.settings} onclose={closeTop}>
          <MenuView {app} />
        </Drawer>
      {:else if drawer.kind === 'anyPassat'}
        <Drawer name="any-passat" title={S.legacyMenuTitle} onclose={closeTop}>
          <p class="drawer__note">{S.legacyMenuText}</p>
        </Drawer>
      {:else if drawer.kind === 'install'}
        <Drawer name="install" title={S.installTitle} onclose={closeTop}>
          <InstallSteps browser={app.install.browser} />
        </Drawer>
      {:else if drawer.kind === 'pad'}
        <NumberPad
          cards={app.data.cards}
          printed={app.catalog?.cards ?? null}
          onadd={(id, identity, name) => app.addCard(id, true, identity, name, true)}
          onsee={(id) => app.seeCard(id)}
          onclose={closeTop}
          ontyping={(typing) => app.setPadTyping(typing)}
        />
      {:else if drawer.kind === 'rename'}
        {@const card = named(drawer.cardId)}
        {#if card}
          <RenameSheet
            {card}
            others={app.data.cards.filter((c) => c.id !== card.id)}
            onsave={(to, name, identity) => app.editCard(card.id, to, name, identity)}
            onclose={closeTop}
          />
        {/if}
      {:else if drawer.kind === 'remove'}
        {@const card = named(drawer.cardId)}
        {@const cardId = drawer.cardId}
        <ConfirmSheet
          name="remove"
          title={S.removeTitle(cardId)}
          text={`${card?.name ? `${card.name}. ` : ''}${S.removeText}`}
          yes={S.removeYes}
          no={S.removeNo}
          onyes={() => app.removeCard(cardId)}
          onclose={closeTop}
        />
      {:else if drawer.kind === 'wipe'}
        <ConfirmSheet name="wipe" title={S.wipeTitle} text={S.wipeText} yes={S.wipeYes} no={S.wipeNo} onyes={() => app.wipeData()} onclose={closeTop} />
      {/if}
    </DrawerFrame>
  {/each}

  <Toast toast={app.toast} />
</div>
