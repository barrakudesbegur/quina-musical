<!--
  The helpers under the scene: Futur (the crystal ball, private), Premis (this round's prizes and the claim
  rules) and Efectes (the sound pad). In the Desgraciat round, Dempeus comes first (the cards still standing,
  private), and is selected as the round starts. The selected tab and the Futur's reveal are this device's own,
  kept in the model so they survive a Check. Once the Futur is revealed, "Amagar" sits at the right end of the strip.
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import type { IconName } from '../icons.ts';
  import type { HelperTab } from '../model.svelte.ts';
  import { S } from '../strings.ts';
  import { helperTabsFor } from '../logic/standing.ts';
  import FuturePanel from './FuturePanel.svelte';
  import StandingPanel from './StandingPanel.svelte';
  import PrizesPanel from './PrizesPanel.svelte';
  import SoundPad from './SoundPad.svelte';
  import Icon from './Icon.svelte';
  import Tabs from './Tabs.svelte';

  const model = getConsole();
  const ALL_TABS = {
    standing: { id: 'standing', label: S.tabs.standing, icon: 'standing' },
    future: { id: 'future', label: S.tabs.future, icon: 'crystal' },
    prizes: { id: 'prizes', label: S.tabs.prizes, icon: 'gift' },
    effects: { id: 'effects', label: S.tabs.effects, icon: 'sound' },
  } as const satisfies Record<HelperTab, { id: HelperTab; label: string; icon: IconName }>;
  const tabs = $derived(helperTabsFor(model.show.state?.round.kind).map((id) => ALL_TABS[id]));
</script>

<section class="helpers" aria-label={S.tabs.label}>
  <Tabs {tabs} bind:selected={model.helperTab} label={S.tabs.label} actions={model.helperTab === 'future' && model.futureRevealed ? hideFuture : undefined}>
    {#snippet panel(id: HelperTab)}
      {#if id === 'standing'}<StandingPanel />{:else if id === 'future'}<FuturePanel />{:else if id === 'prizes'}<PrizesPanel />{:else}<SoundPad />{/if}
    {/snippet}
  </Tabs>
</section>

{#snippet hideFuture()}
  <button type="button" class="mini future__hide" data-anim="press" onclick={() => model.revealFuture(false)}>
    <Icon name="eyeOff" /><span>{S.future.hide}</span>
  </button>
{/snippet}
