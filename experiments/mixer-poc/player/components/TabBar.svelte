<script lang="ts">
  // The bottom tab bar: every screen one tap away, within reach of one thumb.
  import { TAB_IDS, type TabId } from '../logic/tabs.ts';
  import { S } from '../strings.ts';
  import Icon, { type IconName } from './Icon.svelte';

  let { active, onselect }: { active: TabId; onselect: (tab: TabId) => void } = $props();
  const ICONS: Record<TabId, IconName> = { ara: 'now', cartrons: 'cards', historial: 'history', premis: 'prizes', programa: 'schedule' };
</script>

<nav class="tab-bar" aria-label={S.tabBar}>
  {#each TAB_IDS as tab (tab)}
    <button type="button" class="tab-bar__tab" class:is-active={tab === active} aria-current={tab === active ? 'page' : undefined} onclick={() => onselect(tab)}>
      <Icon name={ICONS[tab]} />
      <span class="tab-bar__label">{S.tabs[tab]}</span>
    </button>
  {/each}
</nav>
