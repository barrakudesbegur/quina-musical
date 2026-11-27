<!--
  F1 · Nino: one of Barrakudes' figures as a sticker (components-v2.md § 7, the user's canvas comment #86). Props say
  what it draws: `pose` (packages/ui/ninos.ts; which moment shows which is NINO_FOR in concepts.ts), `size` (its
  height in px; none fills the parent's height), `tilt`, `hue` (the finalists' tint), `motion` ('sway' | 'breathe' |
  'none'; reduced motion keeps it still), `faded` and `flip`. Decorative: `alt=""`, the words beside it say it.
-->
<script lang="ts">
  import type { HTMLImgAttributes } from 'svelte/elements';
  import { ninoUrl, type NinoPose } from '../ninos.ts';
  import './nino.css';

  type Props = Omit<HTMLImgAttributes, 'src' | 'alt' | 'class'> & {
    pose: NinoPose;
    size?: number | null;
    tilt?: number;
    hue?: number | null;
    motion?: 'sway' | 'breathe' | 'none';
    faded?: boolean;
    flip?: boolean;
    class?: string;
  };

  let { pose, size = null, tilt = 0, hue = null, motion = 'sway', faded = false, flip = false, class: className = '', ...rest }: Props = $props();
</script>

<img
  {...rest}
  class="nino {className}"
  src={ninoUrl(pose)}
  alt=""
  draggable="false"
  decoding="async"
  data-pose={pose}
  data-motion={motion}
  data-faded={faded || undefined}
  data-flip={flip || undefined}
  style:--nino-size={size === null ? undefined : `${size}px`}
  style:--nino-tilt={tilt ? `${tilt}deg` : undefined}
  style:--nino-hue={hue ? `${hue}deg` : undefined}
/>
