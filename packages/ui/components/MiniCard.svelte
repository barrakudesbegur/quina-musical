<!--
  D3 · MiniCard: a card type drawn small (components-v2.md § 5, #80 redrawn: square cells, even gaps, rounded, a 3D
  edge in the pastel's own shade). Generic: `customColor` is the type's pastel from card-types.json (data), `star`
  marks the special card, `size` is chip | label | band (the projector's contexts size it themselves), `tilt` in
  degrees. Always decorative: the label beside it names the type. The projector builds the same markup
  (mini-card.ts).
-->
<script lang="ts">
  import { MINI_CARD_STAR } from './mini-card.ts';

  let {
    customColor,
    star = false,
    size = 'label',
    tilt = null,
    class: className = '',
  }: { customColor: string; star?: boolean; size?: 'chip' | 'label' | 'band'; tilt?: number | null; class?: string } = $props();
</script>

<div
  class="mini-card {className}"
  data-size={size}
  data-star={star || undefined}
  style:--type-color={customColor}
  style:--mc-tilt={tilt === null ? undefined : `${tilt}deg`}
  aria-hidden="true"
>
  <div class="mini-card__bar"></div>
  <div class="mini-card__grid">
    {#each { length: 12 }, i (i)}<span class="mini-card__cell"></span>{/each}
  </div>
  <svg class="mini-card__star" viewBox="0 0 24 24" aria-hidden="true"><path d={MINI_CARD_STAR} /></svg>
</div>
