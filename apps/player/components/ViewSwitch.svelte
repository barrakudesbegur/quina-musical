<script lang="ts">
  // Ara's Historial | Cartrons switch under the drum: a segmented control, as tabs over the view below it.
  import { ARA_VIEWS, type AraView } from '../logic/tabs.ts';
  import { S } from '../strings.ts';
  import Icon, { type IconName } from './Icon.svelte';

  let { value, panel, onselect }: { value: AraView; /** The id of the view it controls. */ panel: string; onselect: (view: AraView) => void } = $props();
  const ICONS: Record<AraView, IconName> = { historial: 'history', cartrons: 'cards' };
</script>

<div class="view-switch" role="tablist" aria-label={S.araSwitch}>
  {#each ARA_VIEWS as view (view)}
    <button
      type="button"
      class="view-switch__option"
      role="tab"
      id="ara-view-{view}"
      aria-selected={view === value}
      aria-controls={panel}
      data-view={view}
      onclick={() => onselect(view)}
    >
      <Icon name={ICONS[view]} />
      {S.araViews[view]}
    </button>
  {/each}
</div>
