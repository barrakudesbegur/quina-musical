<script lang="ts">
  // Ara's Historial | Cartrons switch under the drum: the generic SegmentedControl (B2) as tabs over the view below
  // it (its panel is labelled by `ara-view-<view>`). The words and icons are this app's. `progress` (0 Historial,
  // 1 Cartrons) drives the thumb, so it follows the home's swipe (ANIMATIONS.md › home-swipe).
  import SegmentedControl from '../../../packages/ui/components/SegmentedControl.svelte';
  import type { SegmentOption } from '../../../packages/ui/components/control-types.ts';
  import { ARA_VIEWS, type AraView } from '../logic/tabs.ts';
  import { S } from '../strings.ts';

  let { value, progress = null, onselect }: { value: AraView; progress?: number | null; onselect: (view: AraView) => void } = $props();
  const ICONS = { historial: 'clock', cartrons: 'grid-rounded' } as const;
  const options: SegmentOption<AraView>[] = ARA_VIEWS.map((view) => ({ id: view, label: S.araViews[view], icon: ICONS[view] }));
</script>

<SegmentedControl {options} {value} semantics="tabs" idPrefix="ara-view" label={S.araSwitch} class="view-switch" {progress} onchange={onselect} />
