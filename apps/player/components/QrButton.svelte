<script lang="ts">
  // The QR button at a card number field's end (D141; NumberField's `trailing`): just the softened QR code, no frame
  // (the user, 26 Nov: rounded finders and dots). The parent opens the camera; a found number goes into the field.
  // The dots (§8 Y3, «put its dots in better places»): one lattice for everything, 2-unit modules 1 unit apart (rows and
  // columns at 2, 5, 8, 11, 14, 17, 20 of the 24 grid), so every dot keeps the same 1-unit gap from the finders and
  // from its neighbours; the finders fill the three 3 × 3 corners, and the dots the band between them and the fourth
  // corner. A run of modules is one pill [x, y, w, h].
  import { S } from '../strings.ts';

  let { onclick }: { onclick: () => void } = $props();
  const QR_DOTS = [
    [11, 2, 2, 5], [2, 11, 2, 2], [8, 11, 2, 2], [14, 11, 5, 2],
    [14, 14, 2, 2], [20, 14, 2, 2], [11, 17, 2, 2], [17, 17, 2, 2], [11, 20, 8, 2],
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
