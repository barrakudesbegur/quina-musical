<!--
  Which Wii button triggers this control: a small sticker in the button group's colour (the Comandament
  drawing's), shown only while a remote is connected (hook wii-badge). A badge whose button must be held
  has a three-quarter ring around it (a "ring that fills"): 1 or 2 for Enrere, − or + for Pausa, B for
  Aguanta. `plus`: a second button held with it (Suspens: B + A, D144). `shake`: the remote shaken 3 times instead
  of a button (Suspens, while the shake is switched on, D148). Decorative: the control's own label says what it does.
  `place`: in a corner of its control, or at the right (or left: `strip-start`) end of a two-level button's strip.
  A's badge glides to its new place when Pausa starts or ends (hook a-glide, a-glide.ts).
-->
<script lang="ts">
  import { WII_COLOURS, type WiiDpad, type WiiGroup } from '../../../packages/ui/wii/legend.ts';
  import { glideA } from '../a-glide.ts';
  import { getWii } from '../context.ts';
  import { CA } from '../strings.ts';

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
  const ROTATION: Record<WiiDpad, number> = { up: 0, right: 90, down: 180, left: 270 };
  const group = $derived<WiiGroup>(button === 'shake' ? 'b' : button in ROTATION ? 'dpad' : (button as WiiGroup));
  const LABEL: Partial<Record<WiiBadgeButton, string>> = { a: CA.wii.keys.a, b: CA.wii.keys.b, talk: '−+', back: '1·2' };
  const REMOTES = [
    { opacity: 0.3, angle: -24 },
    { opacity: 0.55, angle: -12 },
    { opacity: 1, angle: 6 },
  ];

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
    style:--wii-colour={WII_COLOURS[group]}
    aria-hidden="true"
    {@attach glide}
  >
    {#if button === 'shake'}
      <svg class="wii-badge__shake" viewBox="0 0 37.2 24" focusable="false">
        {#each REMOTES as r (r.angle)}
          <g opacity={r.opacity} transform="rotate({r.angle} 9 21)">
            <rect x="6" y="3" width="6" height="17" rx="1.6" class="wii-badge__remote" />
            <circle cx="9" cy="7.6" r="1.3" class="wii-badge__remote-a" />
          </g>
        {/each}
        <text x="16.5" y="18.1" class="wii-badge__times">×3</text>
      </svg>
    {:else}
      <span class="wii-badge__key">
        {#if button === 'home'}
          <svg viewBox="0 0 24 24" focusable="false"><path d="M4 20v-8l8-7 8 7v8z" /></svg>
        {:else if group === 'dpad'}
          <svg viewBox="0 0 24 24" focusable="false"><path d="M12 4l8 14H4z" transform="rotate({ROTATION[button as WiiDpad]} 12 12)" /></svg>
        {:else}
          {LABEL[button]}
        {/if}
      </span>
      {#if plus}
        <span class="wii-badge__plus">+</span>
        <span class="wii-badge__key" style:--wii-colour={WII_COLOURS[plus]}>{LABEL[plus]}</span>
      {/if}
    {/if}
  </span>
{/if}
