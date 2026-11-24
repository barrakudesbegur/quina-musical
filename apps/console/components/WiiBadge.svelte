<!--
  Which Wii button triggers this control: a small sticker in the button group's colour (the Comandament
  drawing's), shown only while a remote is connected (hook wii-badge). A badge whose button must be held
  has a three-quarter ring around it (a "ring that fills"): 1 or 2 for Enrere, − or + for Pausa, B for
  Aguanta. Suspens adds a shake wave with "×3". Decorative: the control's own label says what it does.
  `place`: in a corner of its control, or at the right end of a two-level button's strip.
-->
<script lang="ts">
  import { WII_COLOURS, type WiiDpad, type WiiGroup } from '../../../packages/ui/wii/legend.ts';
  import { getWii } from '../context.ts';
  import { CA } from '../strings.ts';

  type WiiBadgeButton = Exclude<WiiGroup, 'dpad'> | WiiDpad;
  interface Props {
    button: WiiBadgeButton;
    /** The Wii button must be held for this. */
    hold?: boolean;
    /** Held plus the deliberate shake (Suspens). */
    shake?: boolean;
    size?: 'md' | 'sm';
    place?: 'corner' | 'strip';
  }

  let { button, hold = false, shake = false, size = 'md', place = 'corner' }: Props = $props();

  const wii = getWii();
  const ROTATION: Record<WiiDpad, number> = { up: 0, right: 90, down: 180, left: 270 };
  const group = $derived<WiiGroup>(button in ROTATION ? 'dpad' : (button as WiiGroup));
  const LABEL: Partial<Record<WiiBadgeButton, string>> = { a: CA.wii.keys.a, b: CA.wii.keys.b, talk: '−+', back: '1·2' };
</script>

{#if wii.badges}
  <span
    class="wii-badge"
    data-wii={button}
    data-size={size}
    data-place={place}
    data-hold={hold || undefined}
    data-anim="wii-badge"
    style:--wii-colour={WII_COLOURS[group]}
    aria-hidden="true"
  >
    <span class="wii-badge__key">
      {#if button === 'home'}
        <svg viewBox="0 0 24 24" focusable="false"><path d="M4 20v-8l8-7 8 7v8z" /></svg>
      {:else if group === 'dpad'}
        <svg viewBox="0 0 24 24" focusable="false"><path d="M12 4l8 14H4z" transform="rotate({ROTATION[button as WiiDpad]} 12 12)" /></svg>
      {:else}
        {LABEL[button]}
      {/if}
    </span>
    {#if shake}
      <span class="wii-badge__shake">
        <svg viewBox="0 0 28 20" focusable="false"><path d="M2 10c3-6 5-6 8 0s5 6 8 0 5-6 8 0" /></svg>×3
      </span>
    {/if}
  </span>
{/if}
