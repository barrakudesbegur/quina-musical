<!-- Admin: the organizers' setup and fixes page. One view per hash (#preparacio, #json, #nit, #eines,
     #xuleta); the plan, the show connection and the command log come in from main.ts. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { ShowStore } from '../../packages/ui/client/show.svelte.ts';
  import { loadCatalog, type Catalog } from '../../packages/ui/data/catalog.ts';
  import { readPrintedCardTypes, withPrintedCardTypes, type PrintedCardType } from '../../packages/ui/data/card-types.ts';
  import type { PlanSession } from './state/plan-session.svelte.ts';
  import type { CommandTracker } from './state/commands.svelte.ts';
  import { ROUTES, routeFromHash, type Route } from './logic/route.ts';
  import type { CardTypes } from './logic/cards-preview.ts';
  import { MANAGE_CONFIG } from './config.ts';
  import { S } from './strings.ts';
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
  let printedTypes = $state.raw<PrintedCardType[] | null>(null);

  // The plan's card types are a copy of the printed cards' (apps/cards): refresh it whenever they differ.
  $effect(() => {
    if (!printedTypes) return;
    const draft = $state.snapshot(session.draft);
    if (withPrintedCardTypes(draft, printedTypes) !== draft) session.update((plan) => withPrintedCardTypes(plan, printedTypes ?? []));
  });
  const cardTypes = $derived<CardTypes | null>(catalog ? new Map([...catalog.cards].map(([id, card]) => [id, card.type])) : null);

  onMount(() => {
    const onHash = () => (route = routeFromHash(location.hash));
    window.addEventListener('hashchange', onHash);
    loadCatalog(MANAGE_CONFIG.cardsUrl).then(
      (c) => (catalog = c),
      () => (catalogFailed = true),
    );
    fetch(MANAGE_CONFIG.cardTypesUrl, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => (printedTypes = readPrintedCardTypes(json)))
      .catch(() => (printedTypes = null));
    return () => window.removeEventListener('hashchange', onHash);
  });
</script>

<svelte:head>
  <title>{route === 'xuleta' ? `${S.cheat.title} · ${session.current?.title ?? S.pageTitle}` : S.pageTitle}</title>
</svelte:head>

<div class="manage" data-route={route}>
  <header class="manage__header">
    <h1 class="manage__title">{S.heading} · {session.current?.title ?? ''}</h1>
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

  <main class="manage__main">
    {#if route === 'preparacio'}
      <PlanErrors errors={session.errors} />
      <PlanMeta {session} printed={printedTypes !== null} />
      <CardsInPlay {show} {commands} {cardTypes} {catalogFailed} />
      <RoundsEditor {session} {show} {commands} />
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
      <ManualResume {show} {commands} {catalog} cloud={session.store.kind === 'cloud'} />
      <PhoneCards />
      <PlayerSettings />
    {:else if route === 'eines'}
      <ToolsPanel {show} {session} />
    {:else}
      <CheatSheet plan={session.current} />
    {/if}
  </main>
</div>

<style>
  .manage__conflict {
    margin: var(--space-3) var(--space-4) 0;
    display: grid;
    gap: var(--space-2);
  }
</style>
