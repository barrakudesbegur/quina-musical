<script lang="ts">
  // The QR button at a card number field's end (D141; NumberField's `trailing`): just the softened QR code, no frame
  // (the user, 26 Nov: rounded finders and dots). The parent opens the camera; a found number goes into the field.
  import { S } from '../strings.ts';

  let { onclick }: { onclick: () => void } = $props();
  const QR_DOTS = [
    [12.1, 2.4, 2, 3.4], [12.1, 8, 2, 3.6], [2.4, 12.1, 3.4, 2], [8, 12.1, 2, 2], [14.2, 12.1, 3.6, 2], [19.8, 12.1, 2, 3.6],
    [12.1, 14.2, 2, 2], [16.2, 16.2, 2, 2], [12.1, 18.2, 3.6, 2], [18.2, 18.2, 3.6, 2], [14.2, 20, 2, 2], [19.8, 20, 2, 2],
  ] as const;
</script>

<button type="button" class="number-pad__qr" aria-label={S.qrButton} {onclick}>
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {#each [[2, 2], [14, 2], [2, 14]] as [x, y] (`${x},${y}`)}
      <rect x={x + 1} y={y + 1} width="6" height="6" rx="1.9" fill="none" stroke="currentColor" stroke-width="2" /><rect x={x + 2.9} y={y + 2.9} width="2.2" height="2.2" rx=".8" />
    {/each}
    {#each QR_DOTS as [x, y, w, h] (`${x},${y}`)}<rect {x} {y} width={w} height={h} rx="1" />{/each}
  </svg>
</button>
