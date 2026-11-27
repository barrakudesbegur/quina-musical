<!--
  Which Wii button triggers this control, shown only while a remote is connected (hook wii-badge): the console's
  placement of the generic WiiKey (B5, packages/ui/components/WiiKey.svelte), which draws the keys: white, as on the
  boards; «− +» and «1 2» as two keys (D91). A key that must be held has a three-quarter ring round it. `plus`: a
  second key held with it (Suspens: B + A, D144). `shake`: the remote shaken 3 times (Suspens, while the shake is
  switched on, D148). Decorative: the control's own label says what it does. `place`: in a corner of its control, or
  at the right (or left: `strip-start`) end of a two-level button's strip. A's badge glides to its new place when
  Pausa starts or ends (hook a-glide, a-glide.ts). The callers name the remote's groups ('talk' is − and +, 'back' is
  1 and 2); the keys come from keysOf.
-->
<script lang="ts">
  import WiiKey from '../../../packages/ui/components/WiiKey.svelte';
  import type { WiiKey as Key } from '../../../packages/ui/components/types.ts';
  import type { WiiDpad, WiiGroup } from '../../../packages/ui/wii/legend.ts';
  import { glideA } from '../a-glide.ts';
  import { getWii } from '../context.ts';

  type WiiBadgeButton = Exclude<WiiGroup, 'dpad'> | WiiDpad;
  interface Props {
    button: WiiBadgeButton | 'shake';
    /** The Wii button must be held for this. */
    hold?: boolean;
    /** Held together with this one. */
    plus?: 'a' | null;
    size?: 'md' | 'sm';
    place?: 'corner' | 'strip' | 'strip-start';
  }

  let { button, hold = false, plus = null, size = 'md', place = 'corner' }: Props = $props();

  const wii = getWii();
  /** The remote's keys a group names. */
  const KEYS: Record<WiiBadgeButton | 'shake', readonly Key[]> = {
    talk: ['minus', 'plus'],
    back: ['one', 'two'],
    a: ['a'],
    b: ['b'],
    home: ['home'],
    up: ['up'],
    right: ['right'],
    down: ['down'],
    left: ['left'],
    shake: ['shake'],
  };

  /** The default action's A (not a hold's): it may glide in from where Pausa took it. */
  function glide(el: HTMLElement): void {
    if (button === 'a' && !hold) glideA(el);
  }
</script>

{#if wii.badges}
  <span
    class="wii-badge"
    data-wii={button}
    data-size={size}
    data-place={place}
    data-hold={hold || undefined}
    data-anim="wii-badge{button === 'a' && !hold ? ' a-glide' : ''}"
    aria-hidden="true"
    {@attach glide}
  >
    <WiiKey spec={{ keys: KEYS[button], hold, withA: plus === 'a', size }} />
  </span>
{/if}
