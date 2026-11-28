<!-- Admin: the organizers' setup and fixes page. One view per hash (#preparacio, #json, #nit, #eines,
     #xuleta); the plan, the show connection and the command log come in from main.ts. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { ShowStore } from '../../packages/ui/client/show.svelte.ts';
  import { loadCardTypes, loadCatalog, type Catalog } from '../../packages/ui/data/catalog.ts';
  import { knownCardTypes, type PrintedCardType } from '../../packages/ui/data/card-types.ts';
  import type { PlanSession } from './state/plan-session.svelte.ts';
  import type { CommandTracker } from './state/commands.svelte.ts';
  import { ROUTES, routeFromHash, type Route } from './logic/route.ts';
  import type { CardTypes } from './logic/cards-preview.ts';
  import { MANAGE_CONFIG } from './config.ts';
  import { S } from './strings.ts';
  import { headerTitle, loadFailureText } from './logic/status.ts';
  import Notice from '../../packages/ui/components/Notice.svelte';
  import StatusBar from './components/StatusBar.svelte';
  import PlanErrors from './components/PlanErrors.svelte';
  import PlanMeta from './components/PlanMeta.svelte';
  import CardsInPlay from './components/CardsInPlay.svelte';
  import RoundsEditor from './components/RoundsEditor.svelte';
  import SponsorsEditor from './components/SponsorsEditor.svelte';
  import SponsorImport from './components/SponsorImport.svelte';
  import LogoBulkUpload from './components/LogoBulkUpload.svelte';
  import ScheduleEditor from './components/ScheduleEditor.svelte';
  import RulesEditor from './components/RulesEditor.svelte';
  import JsonImport from './components/JsonImport.svelte';
  import JsonExport from './components/JsonExport.svelte';
  import GameControls from './components/GameControls.svelte';
  import ManualResume from './components/ManualResume.svelte';
  import WinnersList from './components/WinnersList.svelte';
  import PhoneCards from './components/PhoneCards.svelte';
  import PlayerSettings from './components/PlayerSettings.svelte';
  import ToolsPanel from './components/ToolsPanel.svelte';
  import CheatSheet from './components/CheatSheet.svelte';

  let { show, session, commands }: { show: ShowStore; session: PlanSession; commands: CommandTracker } = $props();

  let route = $state<Route>(routeFromHash(location.hash));
  let catalog = $state.raw<Catalog | null>(null);
  let catalogFailed = $state(false);
  /** card-types.json (null when missing or broken): the rounds' card type pickers and the read-only list. */
  let printedTypes = $state.raw<PrintedCardType[] | null>(null);
  /** The types' names for the cards-in-play counts: card-types.json, else the plan's old copy. */
  const knownTypes = $derived(knownCardTypes(printedTypes ?? catalog?.cardTypes));
  const cardTypes = $derived<CardTypes | null>(catalog ? new Map([...catalog.cards].map(([id, card]) => [id, card.type])) : null);

  onMount(() => {
    const onHash = () => (route = routeFromHash(location.hash));
    window.addEventListener('hashchange', onHash);
    loadCatalog(MANAGE_CONFIG.cardsUrl).then(
      (c) => (catalog = c),
      () => (catalogFailed = true),
    );
    // On its own, not through the catalog: the pickers work even when cards.json fails.
    loadCardTypes(MANAGE_CONFIG.cardTypesUrl, { cache: 'no-store' }).then((types) => (printedTypes = types));
    return () => window.removeEventListener('hashchange', onHash);
  });
</script>

<svelte:head>
  <title>{route === 'xuleta' ? `${S.cheat.title} · ${session.current?.title ?? S.pageTitle}` : S.pageTitle}</title>
</svelte:head>

<div class="manage" data-route={route} data-density="console" data-ground="night">
  <header class="manage__header">
    <h1 class="manage__title">{headerTitle(session.current?.title, session.status.kind === 'failed')}</h1>
    <StatusBar {show} {session} />
  </header>

  <nav class="manage__nav" aria-label={S.nav.label}>
    <ul class="manage__tabs">
      {#each ROUTES as r (r)}
        <li><a class="manage__tab" href="#{r}" aria-current={route === r ? 'page' : undefined}>{S.nav[r]}</a></li>
      {/each}
    </ul>
  </nav>

  {#if session.external}
    <div class="manage__conflict notice notice--warn no-print" role="alert">
      <p>{S.save.conflict}</p>
      <div class="panel__actions">
        <button type="button" onclick={() => session.resolveConflict('theirs')}>{S.save.conflictLoad}</button>
        <button type="button" onclick={() => session.resolveConflict('mine')}>{S.save.conflictKeep}</button>
      </div>
    </div>
  {/if}

  <!-- Refused as stale: reload. Once the newer plan has arrived, the choice above replaces this. -->
  {#if session.stale && !session.external}
    <div class="manage__conflict notice notice--error no-print" role="alert">
      <p><strong>{S.save.stale}.</strong> {S.save.staleHelp}</p>
      <div class="panel__actions">
        <button type="button" onclick={() => location.reload()}>{S.save.reload}</button>
      </div>
    </div>
  {/if}

  <main class="manage__main">
    {#if session.phase.kind === 'loading'}
      <!-- Nothing editable until the plan is here (whats-left 7.1). The badge above says it in words. -->
      <!-- The design system's waiting note (Notice, its stepping dots), not read aloud: the header's badge says it. -->
      <Notice layout="note" color="navy" fill="solid" progress="dots" live="off" text={S.save.loading(session.store.kind)} />
    {:else if session.phase.kind === 'failed'}
      <section class="manage__loading notice notice--error" role="alert">
        <p><strong>{S.save.loadFailed}.</strong> {loadFailureText(session.phase.failure, session.store.kind)} {S.save.loadFailedHelp}</p>
        <div class="panel__actions">
          <button type="button" onclick={() => void session.load()}>{S.save.retry}</button>
        </div>
      </section>
    {:else if route === 'preparacio'}
      <PlanErrors errors={session.errors} />
      <PlanMeta {session} printed={printedTypes} />
      <CardsInPlay {show} {commands} {cardTypes} {catalogFailed} types={knownTypes} />
      <RoundsEditor {session} {show} {commands} printed={printedTypes} />
      <SponsorsEditor {session} />
      <SponsorImport {session} />
      {#if session.store.kind === 'cloud'}<LogoBulkUpload store={session.store} />{/if}
      <ScheduleEditor {session} />
      <RulesEditor {session} />
    {:else if route === 'json'}
      <JsonImport {session} />
      <JsonExport {session} />
    {:else if route === 'nit'}
      <GameControls {show} {commands} plan={session.current} />
      <WinnersList {show} {commands} plan={session.current} {catalog} />
      <ManualResume {show} {commands} {catalog} plan={session.current} cloud={session.store.kind === 'cloud'} />
      <PhoneCards />
      <PlayerSettings cloud={session.store.kind === 'cloud'} />
    {:else if route === 'eines'}
      <ToolsPanel {show} {session} />
    {:else}
      <CheatSheet plan={session.current} />
    {/if}
  </main>
</div>

<style>
  @layer app {
  .manage__conflict {
    margin: var(--space-3) var(--space-4) 0;
    display: grid;
    gap: var(--space-2);
  }
  .manage__loading {
    display: grid;
    gap: var(--space-2);
  }
  }
</style>
