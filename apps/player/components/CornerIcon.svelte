<script lang="ts">
  // The corner buttons' icons in style B (the user's pick, D87): flat shapes with a white sticker border, like the
  // card marks and the ninos, a little tilted. The gift (option C: an ice-blue box, a pink ribbon, a tall lid) and an
  // alarm clock drawn the same way. Board "Component · botons de cantonada: estils". The art's ink lines are the icon
  // family's (H1: the stem of the label beside it, player.css › .corner-icon__art).
  let { name }: { name: 'premis' | 'horari' } = $props();
  // A bell: a dome on its flat base, tilted off the clock's shoulder. The sticker border follows the dome itself, so
  // its gap is even all round (#28).
  const BELL = 'M-6.2 1.5A6.2 6.2 0 0 1 6.2 1.5Z';
  const BELLS = ['translate(12.5 14.5) rotate(-38)', 'translate(35.5 14.5) rotate(38)'];
  const LEGS = 'M15 39l-3.5 5M33 39l3.5 5';
  const BOX = 'M9 22h30v17.5a2.5 2.5 0 0 1-2.5 2.5h-25A2.5 2.5 0 0 1 9 39.5Z';
</script>

<svg class="corner-icon corner-icon--{name}" viewBox="-2 -2 52 52" aria-hidden="true" focusable="false">
  {#if name === 'premis'}
    {#snippet gift()}
      <rect x="9" y="22" width="30" height="20" rx="2.5" /><rect x="6.5" y="14" width="35" height="9.5" rx="2.5" />
      <path d="M24 14c-4-7.5-11.5-6.5-10.4-2.2c.9 3.2 6.2 3.3 10.4 2.2zM24 14c4-7.5 11.5-6.5 10.4-2.2c-.9 3.2-6.2 3.3-10.4 2.2z" />
    {/snippet}
    <!-- The sticker's border: the silhouette in thick ink, then in white over it. -->
    <g class="corner-icon__outline">{@render gift()}</g>
    <g class="corner-icon__sticker">{@render gift()}</g>
    <g class="corner-icon__art">
      <!-- The box's fill, its shaded top band, then its outline over both: the band stays inside the ink (#26). -->
      <path class="corner-icon__box" d={BOX} />
      <path class="corner-icon__shade" d="M9 22h30v5H9Z" />
      <path class="corner-icon__edge" d={BOX} />
      <path class="corner-icon__ribbon" d="M21.5 22h5v20h-5Z" />
      <path class="corner-icon__lid" d="M6.5 16.5a2.5 2.5 0 0 1 2.5-2.5h30a2.5 2.5 0 0 1 2.5 2.5v4.5a2.5 2.5 0 0 1-2.5 2.5H9a2.5 2.5 0 0 1-2.5-2.5Z" />
      <path class="corner-icon__ribbon" d="M21.2 14h5.6v9.5h-5.6Z" />
      <path class="corner-icon__ribbon" d="M24 14c-4-7.5-11.5-6.5-10.4-2.2c.9 3.2 6.2 3.3 10.4 2.2zM24 14c4-7.5 11.5-6.5 10.4-2.2c-.9 3.2-6.2 3.3-10.4 2.2z" />
      <path class="corner-icon__shine" d="M12.5 29v8M10 17.4h6" />
    </g>
  {:else}
    {#snippet clock()}
      <circle cx="24" cy="27" r="14" />
      {#each BELLS as transform (transform)}<path {transform} d={BELL} />{/each}
      <!-- The legs are lines: their border is drawn wider, so it clears them as far as it clears the body (#28). -->
      <path class="corner-icon__legs" d={LEGS} />
    {/snippet}
    <g class="corner-icon__outline">{@render clock()}</g>
    <g class="corner-icon__sticker">{@render clock()}</g>
    <g class="corner-icon__art">
      <path class="corner-icon__leg" d={LEGS} />
      {#each BELLS as transform (transform)}<path class="corner-icon__bell" {transform} d={BELL} />{/each}
      <circle class="corner-icon__body" cx="24" cy="27" r="14" />
      <circle class="corner-icon__face" cx="24" cy="27" r="10.2" />
      <path class="corner-icon__hand" d="M24 19v1.9M32 27h-1.9M24 35v-1.9M16 27h1.9M24 27l-4.7-2.7M24 27l6.6-3.8" />
      <circle class="corner-icon__pin" cx="24" cy="27" r="1.4" />
      <path class="corner-icon__shine" d="M13.4 21.6a11.6 11.6 0 0 1 4.4-5" />
    </g>
  {/if}
</svg>
