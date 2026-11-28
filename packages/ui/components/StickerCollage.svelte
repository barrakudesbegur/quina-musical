<!--
  G4 · StickerCollage (D285, D287): a Celebration's sponsors as die-cut stickers, packed together in its box by
  sticker-collage.ts around what the box holds (`obstacles`, in the box's px), within the look's size and tilt
  thresholds; the same `seed` (the Celebration's key) draws the same collage. Each logo becomes its sticker in the
  browser (logo-sticker.ts: the logo untouched, a white die-cut under it); a sponsor with no logo gets its name on a
  white sticker. The box is the space it may fill: it measures itself and packs again when its size changes. With
  `grow` it may grow downward to that height when even the floor needs more room (the phone's screen scrolls); without
  it, only the first page shows (the projector turns the pages itself). Entry: sticker-collage.css.
-->
<script lang="ts">
  import { COLLAGE_LOOKS, stickerCollage, type Collage, type CollageObstacle, type Point } from './sticker-collage.ts';
  import { logoSticker, type LogoSticker } from './logo-sticker.ts';
  import type { SponsorLogo } from './sponsor-types.ts';
  import './sticker-collage.css';

  let {
    sponsors,
    seed,
    look = 'phone',
    obstacles = [],
    focus = null,
    grow = null,
    label,
  }: {
    sponsors: readonly SponsorLogo[];
    /** The Celebration's key: the same key, the same collage. */
    seed: string;
    look?: keyof typeof COLLAGE_LOOKS;
    /** What the stickers keep off, in the box's px (a title's corners, a nino's outline). */
    obstacles?: readonly CollageObstacle[];
    /** Where the collage grows from, in the box's px (default: the box's middle). */
    focus?: Point | null;
    /** The tallest the box may grow to (px) when the floor needs it. */
    grow?: number | null;
    /** The group's accessible name («Patrocinadors del premi»). */
    label: string;
  } = $props();

  /** A name sticker's shape: the projector's tile, 240 × 150. */
  const NAME_ASPECT = 1.6;

  let width = $state(0);
  let height = $state(0);
  /** The box's height before it grew, so growing never feeds back into the packing. */
  let base = $state(0);
  let made: (LogoSticker | null)[] | null = $state(null);

  $effect(() => {
    const list = sponsors;
    let live = true;
    made = null;
    void Promise.all(list.map((s) => (s.logo ? logoSticker(s.logo) : Promise.resolve(null)))).then((all) => {
      if (live) made = all;
    });
    return () => {
      live = false;
    };
  });

  const collage: Collage | null = $derived.by(() => {
    if (!made || !width || !base) return null;
    const items = sponsors.map((s, i) => ({ id: String(i), aspect: made?.[i]?.aspect ?? NAME_ASPECT, hull: made?.[i]?.hull ?? null }));
    return stickerCollage(items, {
      ...COLLAGE_LOOKS[look],
      region: { x: 0, y: 0, width, height: base },
      obstacles,
      focus: focus ?? undefined,
      seed,
      ...(grow ? { grow } : {}),
    });
  });
  const grew = $derived(!!collage && collage.height > base + 0.5);
  $effect(() => {
    if (!grew) base = height;
  });
  const gap = $derived(collage && collage.placed.length > 1 ? `${Math.min(look === 'projector' ? 110 : 80, (look === 'projector' ? 1000 : 700) / (collage.placed.length - 1))}ms` : undefined);
</script>

<div
  class="sticker-collage"
  role="group"
  aria-label={label}
  bind:clientWidth={width}
  bind:clientHeight={height}
  style:min-height={grew && collage ? `${collage.height}px` : undefined}
  style:--collage-gap={gap}
>
  {#if collage}
    {#each collage.placed as p (p.id)}
      {@const sponsor = sponsors[p.index]}
      {@const sticker = made?.[p.index] ?? null}
      {@const style = `left:${p.x - p.width / 2}px;top:${p.y - p.height / 2}px;width:${p.width}px;height:${p.height}px;--h:${p.height}px;--tilt:${p.rotation}deg;--turn:${p.rotation < 0 ? -8 : 8}deg;--order:${p.order};z-index:${p.order + 1}`}
      {#if sticker}
        <img class="sticker-collage__sticker" src={sticker.url} alt={sponsor.name} {style} draggable="false" />
      {:else}
        <span class="sticker-collage__sticker sticker-collage__name" role="img" aria-label={sponsor.name} {style}><span aria-hidden="true">{sponsor.name}</span></span>
      {/if}
    {/each}
  {/if}
</div>
