<!--
  The helpers under the scene (D170, D187; the Consola-Pestanyes-Noves board): Estat (the round's state, always
  visible), Cerca (a song or a card, private), Futur (the crystal ball, private, behind «Mirar el futur»), Premis
  (this round's prizes and the claim rules) and Efectes (the sound pad). In the Desgraciat round Dempeus (the cards
  still standing, private) takes Estat's place, and is selected as the round starts (the Consola-Desgraciat-Final
  board). The selected tab, the Futur's reveal and the search are this device's own, kept in the model so they survive
  a Check. While a tab needs the songs to come (Cerca, the revealed Futur), they are asked for here, again after each
  landing. While Cerca's search box has the focus, the tab grows over the column (`data-typing`; console.css), so the
  tablet's keyboard doesn't cover the results.
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import type { IconName } from '../icons.ts';
  import type { HelperTab } from '../model.svelte.ts';
  import { S } from '../strings.ts';
  import { helperTabsFor } from '../logic/standing.ts';
  import FuturePanel from './FuturePanel.svelte';
  import PrizesPanel from './PrizesPanel.svelte';
  import SearchPanel from './SearchPanel.svelte';
  import SoundPad from './SoundPad.svelte';
  import StandingPanel from './StandingPanel.svelte';
  import StatePanel from './StatePanel.svelte';
  import Tabs from './Tabs.svelte';

  const model = getConsole();
  const ALL_TABS = {
    state: { id: 'state', label: S.tabs.state, icon: 'chart' },
    standing: { id: 'standing', label: S.tabs.standing, icon: 'standing' },
    search: { id: 'search', label: S.tabs.search, icon: 'search' },
    future: { id: 'future', label: S.tabs.future, icon: 'crystal' },
    prizes: { id: 'prizes', label: S.tabs.prizes, icon: 'gift' },
    effects: { id: 'effects', label: S.tabs.effects, icon: 'sound' },
  } as const satisfies Record<HelperTab, { id: HelperTab; label: string; icon: IconName }>;
  const tabs = $derived(helperTabsFor(model.show.state?.round.kind).map((id) => ALL_TABS[id]));

  // The songs to come: asked for while the open tab needs them, and again as the round moves on.
  $effect(() => model.askUpcoming());
</script>

<section class="helpers" aria-label={S.tabs.label} data-typing={(model.helperTab === 'search' && model.search.typing) || undefined}>
  <Tabs {tabs} bind:selected={model.helperTab} label={S.tabs.label}>
    {#snippet panel(id: HelperTab)}
      {#if id === 'state'}<StatePanel />{:else if id === 'standing'}<StandingPanel />{:else if id === 'search'}<SearchPanel />{:else if id === 'future'}<FuturePanel />{:else if id === 'prizes'}<PrizesPanel />{:else}<SoundPad />{/if}
    {/snippet}
  </Tabs>
</section>
