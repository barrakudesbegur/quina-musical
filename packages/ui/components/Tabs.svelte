<!--
  B3 · Tabs: folder tabs over one panel (components-v2.md § 3 › B3; comments-27nov.md D-g, #39, #40, #41, #44).

  The ARIA tabs pattern (modern-web-guidance `tabs`): a tablist of <button role="tab">, one tabpanel each, labelled by
  its tab; one Tab stop (a roving tabindex), selection follows focus with the arrows, Home and End (roving.ts). Only
  the selected panel renders (`panel` is a snippet called with its id).
  - **The extra control** (`extras`: a snippet per tab id, D-g, #41): a tab's own control («Cançons / Cartró» on
    Cerca, the Futur's switch) is drawn on the selected tab, never outside the tab bar. It isn't inside the tab button
    (no control inside a control, and a tablist holds only tabs): it follows the tablist in the DOM and is tethered
    to the selected tab by anchor positioning, which keeps room for it at its end.
  - **Narrow** (#44, the user's pick): a container query on the tabs collapses the tabs that aren't selected to their
    icon (the label stays as the accessible name); the selected one shows its icon, label and extra control.
  - **The panel is in front** (#39): the tabs, their focus ring included, sit behind the panel, and the selected one
    joins it through a bridge (the tabs' ::after, tethered to the selected tab) that hides the panel's top line under
    it. The bar's insets are the same at both ends (#40).
  Motion: ANIMATIONS.md › tab-switch.
-->
<script lang="ts" generics="T extends string">
  import type { Snippet } from 'svelte';
  import Icon from '../icons/Icon.svelte';
  import type { TabSpec } from './control-types.ts';
  import type { UiSound } from './types.ts';
  import { nextEnabled } from './roving.ts';
  import './tabs.css';

  interface Props {
    tabs: readonly TabSpec<T>[];
    selected: T;
    /** The tablist's name for assistive technology. */
    label: string;
    panel: Snippet<[T]>;
    /** A tab's own control, drawn on that tab while it's selected. */
    extras?: Partial<Record<T, Snippet>>;
    sound?: UiSound | null;
    onselect?: (id: T) => void;
    class?: string;
  }

  let { tabs, selected = $bindable(), label, panel, extras = {}, sound = 'tab', onselect, class: className = '' }: Props = $props();

  const uid = $props.id();
  const buttons: HTMLButtonElement[] = $state([]);
  const extra = $derived(extras[selected] ?? null);
  /** The extra control's width: the selected tab keeps that much room at its end. */
  let extraWidth = $state(0);

  function select(id: T): void {
    selected = id;
    onselect?.(id);
  }

  function onkeydown(e: KeyboardEvent, index: number): void {
    const next = nextEnabled(tabs, index, e.key);
    if (next === null) return;
    e.preventDefault();
    select(tabs[next].id);
    buttons[next]?.focus();
  }
</script>

<div class="tabs {className}" data-count={tabs.length} data-extra={extra ? '' : undefined} style:--tabs-anchor="--tabs-{uid}">
  <div class="tabs__bar">
    <div class="tabs__list" role="tablist" aria-label={label}>
      {#each tabs as tab, i (tab.id)}
        {@const on = selected === tab.id}
        <button
          bind:this={buttons[i]}
          type="button"
          role="tab"
          class="tabs__tab"
          id="{uid}-tab-{tab.id}"
          data-anim="tab-switch"
          data-testid="tab-{tab.id}"
          data-touch={sound ?? 'none'}
          aria-selected={on}
          tabindex={on ? 0 : -1}
          onclick={() => select(tab.id)}
          onkeydown={(e) => onkeydown(e, i)}
        >
          <span class="tabs__icon" aria-hidden="true"><Icon name={tab.icon} /></span>
          <span class="tabs__label">{tab.label}</span>
          {#if tab.badge !== undefined && tab.badge !== null}<span class="tabs__badge">{tab.badge}</span>{/if}
          {#if on && extra}<span class="tabs__room" aria-hidden="true" style:width="{extraWidth}px"></span>{/if}
        </button>
      {/each}
    </div>
    {#if extra}
      <div class="tabs__extra" bind:offsetWidth={extraWidth}>{@render extra()}</div>
    {/if}
  </div>
  {#each tabs as tab (tab.id)}
    <div class="tabs__panel" role="tabpanel" id="{uid}-panel-{tab.id}" aria-labelledby="{uid}-tab-{tab.id}" hidden={selected !== tab.id} tabindex="0">
      {#if selected === tab.id}
        <div class="tabs__content" data-anim="tab-switch">{@render panel(tab.id)}</div>
      {/if}
    </div>
  {/each}
</div>
