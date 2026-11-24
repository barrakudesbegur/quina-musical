<!--
  Accessible tabs (WAI-ARIA tabs pattern): a tablist of tabs and one tabpanel each, a roving tabindex (only the
  selected tab is in the Tab order) and the arrow keys, Home and End to move, selecting as they go. The
  content is a snippet called with the selected tab's id, so only the visible panel is rendered.
  The look (console.css › tabs): one panel rounded on every corner; the tabs start inside its corner radius,
  drawn with the panel's own line; the selected tab is 6 px taller and drops 4 px over the panel's top line,
  so it joins the panel (hook tab-switch: it rises as the old one sinks, the content cross-fades).
  `actions`, if given, sits at the right end of the tab strip, outside the tablist (Futur's "Amagar").
-->
<script lang="ts" generics="T extends string">
  import type { Snippet } from 'svelte';
  import type { IconName } from '../icons.ts';
  import { tabIndexForKey } from '../logic/show-data.ts';
  import Icon from './Icon.svelte';

  interface Tab {
    id: T;
    label: string;
    icon?: IconName;
  }

  interface Props {
    tabs: readonly Tab[];
    selected: T;
    /** The tablist's name for assistive technology. */
    label: string;
    panel: Snippet<[T]>;
    /** Buttons at the right end of the tab strip (not tabs). */
    actions?: Snippet;
    onselect?: (id: T) => void;
  }

  let { tabs, selected = $bindable(), label, panel, actions, onselect }: Props = $props();

  const uid = $props.id();
  const buttons: HTMLButtonElement[] = $state([]);

  function select(id: T): void {
    selected = id;
    onselect?.(id);
  }

  function onkeydown(e: KeyboardEvent): void {
    const current = tabs.findIndex((t) => t.id === selected);
    const next = tabIndexForKey(Math.max(0, current), e.key, tabs.length);
    if (next === null) return;
    e.preventDefault();
    select(tabs[next].id);
    buttons[next]?.focus();
  }
</script>

<div class="tabs">
  <div class="tabs__bar">
  <div class="tabs__list" role="tablist" aria-label={label}>
    {#each tabs as tab, i (tab.id)}
      <button
        bind:this={buttons[i]}
        type="button"
        role="tab"
        class="tabs__tab"
        id="{uid}-tab-{tab.id}"
        data-anim="tab-switch"
        aria-selected={selected === tab.id}
        aria-controls="{uid}-panel-{tab.id}"
        tabindex={selected === tab.id ? 0 : -1}
        onclick={() => select(tab.id)}
        {onkeydown}
      >
        {#if tab.icon}<Icon name={tab.icon} />{/if}<span>{tab.label}</span>
      </button>
    {/each}
  </div>
  {#if actions}<div class="tabs__actions">{@render actions()}</div>{/if}
  </div>
  {#each tabs as tab (tab.id)}
    <div class="tabs__panel" role="tabpanel" id="{uid}-panel-{tab.id}" aria-labelledby="{uid}-tab-{tab.id}" hidden={selected !== tab.id} tabindex="0">
      {#if selected === tab.id}
        <div class="tabs__content" data-anim="tab-switch">{@render panel(tab.id)}</div>
      {/if}
    </div>
  {/each}
</div>
