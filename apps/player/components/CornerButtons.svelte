<script lang="ts">
  // The two corner discs of the home screen (D73; style B, D87): Premis on the left, Horari on the right, each the
  // generic CornerButton (packages/ui, A5) with its preset (actions.ts). Each opens its drawer, which grows out of that
  // corner (ANIMATIONS.md `corner-press`, `drawer-open`). Drawers cover them while open.
  import CornerButton from '../../../packages/ui/components/CornerButton.svelte';
  import { PLAYER_CORNERS } from '../actions.ts';
  import { S } from '../strings.ts';

  let { onprizes, onschedule }: { onprizes: () => void; onschedule: () => void } = $props();
</script>

<nav class="corners" aria-label={S.cornersLabel}>
  <CornerButton {...PLAYER_CORNERS.prizes} data-testid="corner-premis" onclick={onprizes} />
  <CornerButton {...PLAYER_CORNERS.schedule} data-testid="corner-horari" onclick={onschedule} />
</nav>
