<!--
  D3 · TypeSideLabel: a card type and side as a small card drawing plus one label (D163, D171: «NORMAL 1–5»,
  «NORMAL 6–10», «ESPECIAL»; components-v2.md § 5). A recipe for its words (the app builds `label` from the type and
  side), generic for its look: `customColor` (the type's pastel, data), `star` (the special card), `ring` and `badge`
  (the Check's verdict on the type: green + ✓, red + ✗; none while pending). The projector draws the same in its
  Check (apps/stage/render/check.ts › .check__type). The drawing is decorative; the label is the text.
-->
<script lang="ts">
  import Icon from '../icons/Icon.svelte';
  import MiniCard from './MiniCard.svelte';
  import './mini-card.css';
  import './type-side-label.css';

  let {
    label,
    customColor,
    star = false,
    ring = null,
    badge = null,
  }: { label: string; customColor: string; star?: boolean; ring?: 'green' | 'red' | null; badge?: 'check' | 'close' | null } = $props();
</script>

<div class="type-side-label" data-ring-color={ring ?? undefined}>
  <MiniCard {customColor} {star} size="label" />
  <span class="type-side-label__text">{label}</span>
  {#if badge}
    <span class="type-side-label__badge" data-color={badge === 'check' ? 'green' : 'red'} aria-hidden="true"><Icon name={badge} alone /></span>
  {/if}
</div>
