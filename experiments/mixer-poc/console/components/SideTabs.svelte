<!-- The helpers beside the scene: cheat sheet, sound pad and winners, as accessible tabs. -->
<script lang="ts">
  import { tabIndexForKey } from '../logic/show-data.ts';
  import { S } from '../strings.ts';
  import CheatSheet from './CheatSheet.svelte';
  import SoundPad from './SoundPad.svelte';
  import WinnersList from './WinnersList.svelte';

  const TABS = [
    { id: 'cheat-sheet', label: S.tabs.cheatSheet },
    { id: 'sounds', label: S.tabs.sounds },
    { id: 'winners', label: S.tabs.winners },
  ] as const;
  type TabId = (typeof TABS)[number]['id'];

  const uid = $props.id();
  let selected = $state<TabId>('cheat-sheet');
  const tabButtons: HTMLButtonElement[] = [];

  function onkeydown(e: KeyboardEvent): void {
    const current = TABS.findIndex((t) => t.id === selected);
    const next = tabIndexForKey(current, e.key, TABS.length);
    if (next === null) return;
    e.preventDefault();
    selected = TABS[next].id;
    tabButtons[next]?.focus();
  }
</script>

<div class="side-tabs">
  <div class="side-tabs__list" role="tablist" aria-label={S.tabs.label}>
    {#each TABS as tab, i (tab.id)}
      <button
        bind:this={tabButtons[i]}
        type="button"
        role="tab"
        class="side-tabs__tab"
        id="{uid}-tab-{tab.id}"
        aria-selected={selected === tab.id}
        aria-controls="{uid}-panel-{tab.id}"
        tabindex={selected === tab.id ? 0 : -1}
        onclick={() => (selected = tab.id)}
        {onkeydown}
      >
        {tab.label}
      </button>
    {/each}
  </div>
  {#each TABS as tab (tab.id)}
    <div class="side-tabs__panel" role="tabpanel" id="{uid}-panel-{tab.id}" aria-labelledby="{uid}-tab-{tab.id}" hidden={selected !== tab.id} tabindex="0">
      {#if selected === tab.id}
        {#if tab.id === 'cheat-sheet'}<CheatSheet />{:else if tab.id === 'sounds'}<SoundPad />{:else}<WinnersList />{/if}
      {/if}
    </div>
  {/each}
</div>
