<!--
  D8 · Scribble: a hand-drawn note, a few words in marker and an arrow to what they are about (components-v2.md § 5,
  D289: the phone's collapsed cards, T3's «Toca per veure'l!»; board Mobil-Plegats-A-Toc). It is a note, never a
  control: it takes no focus and no taps (the thing it points at says what a tap does).

  Props say what it draws: `words`, `point` (where the arrow goes: `up` from words on its left to a spot three
  quarters across the box's width, `down` the same downwards, `left` from words above it to the box's left edge),
  `color` (`gold` on the night sky, `ink` on the your-song gold). The arrow's tip stays clear of the box's edge it
  points through, so it never touches what it points at. Motion (ANIMATIONS.md `tile-scribble`): the arrow draws
  itself on, then its head, then the words fade in; reduced motion: it all fades in.
-->
<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  import './scribble.css';

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'children'> {
    words: string;
    point: 'up' | 'down' | 'left';
    color?: 'gold' | 'ink';
    class?: string;
  }

  let { words, point, color = 'gold', class: className = '', ...rest }: Props = $props();

  /** Each arrow's box, line and head (the head drawn after the line), in px. */
  const ARROWS = {
    up: { w: 64, h: 84, line: 'M6 72 C 30 74 44 58 44 38 C 44 28 44 20 44 10', head: 'M33 22 L44 8 L55 22' },
    down: { w: 64, h: 64, line: 'M6 20 C 30 13 44 25 44 40 C 44 45 44 49 44 52', head: 'M33 41 L44 55 L55 41' },
    left: { w: 96, h: 56, line: 'M88 4 C 86 30 58 42 12 30', head: 'M23 18 L8 30 L22 43' },
  } as const;
  const arrow = $derived(ARROWS[point]);
</script>

<div {...rest} class="scribble {className}" data-point={point} data-color={color} role="note">
  <span class="scribble__words">{words}</span>
  <svg class="scribble__arrow" width={arrow.w} height={arrow.h} viewBox="0 0 {arrow.w} {arrow.h}" aria-hidden="true" focusable="false">
    <path class="scribble__line" d={arrow.line} pathLength="100" />
    <path class="scribble__head" d={arrow.head} pathLength="100" />
  </svg>
</div>
