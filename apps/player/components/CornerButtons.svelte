<script lang="ts">
  // The two round buttons centred on the bottom corners of the home screen (D73; style B, D87): Premis on the left,
  // Horari on the right. Each opens its drawer, which grows out of that corner (ANIMATIONS.md `corner-press`,
  // `drawer-open`). Drawers cover them while open.
  import { S } from '../strings.ts';
  import CornerIcon from './CornerIcon.svelte';

  let { onprizes, onschedule }: { onprizes: () => void; onschedule: () => void } = $props();
</script>

<nav class="corners" aria-label={S.cornersLabel}>
  <button type="button" class="corner corner--left" data-testid="corner-premis" data-anim="corner-press" aria-haspopup="dialog" onclick={onprizes}>
    <span class="corner__in"><CornerIcon name="premis" /><span class="corner__label">{S.prizesTitle}</span></span>
  </button>
  <button type="button" class="corner corner--right" data-testid="corner-horari" data-anim="corner-press" aria-haspopup="dialog" onclick={onschedule}>
    <span class="corner__in"><CornerIcon name="horari" /><span class="corner__label">{S.scheduleTitle}</span></span>
  </button>
</nav>
