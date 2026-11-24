<!--
  The helpers under the scene: Futur (the crystal ball, private), Premis (this round's prizes and the claim
  rules) and Efectes (the sound pad). The selected tab and the Futur's reveal are this device's own, kept in
  the model so they survive a Check.
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import type { IconName } from '../icons.ts';
  import type { HelperTab } from '../model.svelte.ts';
  import { S } from '../strings.ts';
  import FuturePanel from './FuturePanel.svelte';
  import PrizesPanel from './PrizesPanel.svelte';
  import SoundPad from './SoundPad.svelte';
  import Tabs from './Tabs.svelte';

  const model = getConsole();
  const TABS = [
    { id: 'future', label: S.tabs.future, icon: 'crystal' },
    { id: 'prizes', label: S.tabs.prizes, icon: 'gift' },
    { id: 'effects', label: S.tabs.effects, icon: 'sound' },
  ] as const satisfies readonly { id: HelperTab; label: string; icon: IconName }[];
</script>

<section class="helpers" aria-label={S.tabs.label}>
  <Tabs tabs={TABS} bind:selected={model.helperTab} label={S.tabs.label}>
    {#snippet panel(id: HelperTab)}
      {#if id === 'future'}<FuturePanel />{:else if id === 'prizes'}<PrizesPanel />{:else}<SoundPad />{/if}
    {/snippet}
  </Tabs>
</section>
