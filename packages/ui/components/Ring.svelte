<!--
  E1 · Ring (components-v2.md § 6): a circular countdown that also shows a state. Props say what it draws (RingLook in
  types.ts): `arc` (progress | full | segments | none) in `color`, `progress` (0–1, the share left: it empties as time
  passes), `pattern='hazard'`, `halo`, the `face` (number | icon | disc | record | bars) with its `icon`, `value` and
  `unit` (the unit keeps its case, D114), `pulse` (breathes), `tick` (a new value ticks in), `bold`, a corner `badge`,
  and `label`, its spoken name (role timer). Which state looks like what is the app's looks table (the console's
  ring-looks.ts). Motion: ANIMATIONS.md › countdown-ring, ring-last, ring-spin, ring-manual, ring-state.
-->
<script lang="ts">
  import Icon from '../icons/Icon.svelte';
  import type { RingBadgeLook, RingLook } from './types.ts';
  import './ring.css';

  type Props = RingLook & {
    progress?: number | null;
    value?: string | null;
    unit?: string | null;
    badge?: RingBadgeLook | null;
    label: string;
    /** Its width and height in px; none fills its box. */
    size?: number | null;
    /** Changes when the face should fade in again (a new state). */
    faceKey?: string;
    class?: string;
  };

  let {
    arc,
    color,
    pattern = null,
    halo = false,
    face,
    icon = null,
    pulse = false,
    tick = false,
    bold = false,
    iconLarge = false,
    progress = null,
    value = null,
    unit = null,
    badge = null,
    label,
    size = null,
    faceKey = '',
    class: className = '',
  }: Props = $props();

  const uid = $props.id();
  const offset = $derived(progress === null ? 0 : 100 - Math.min(1, Math.max(0, progress)) * 100);
  const disc = $derived(face === 'disc');
</script>

<span
  class="ring {className}"
  data-color={color}
  data-arc={arc}
  data-face={face}
  data-pulse={pulse || undefined}
  data-tick={tick || undefined}
  data-bold={bold || undefined}
  data-icon-large={iconLarge || undefined}
  role="timer"
  aria-label={label}
  title={label}
  style:width={size ? `${size}px` : undefined}
  style:height={size ? `${size}px` : undefined}
>
  <svg class="ring__svg" viewBox="0 0 112 112" aria-hidden="true" focusable="false">
    {#if pattern === 'hazard'}
      <defs>
        <pattern id="{uid}-hazard" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="12" height="12" class="ring__hazard-a" />
          <rect width="6" height="12" class="ring__hazard-b" />
        </pattern>
      </defs>
    {/if}
    {#if halo}<circle class="ring__halo" cx="56" cy="56" r="55" />{/if}
    <circle class="ring__track" cx="56" cy="56" r="46" />
    {#if arc === 'progress'}
      <circle class="ring__fill" cx="56" cy="56" r="46" pathLength="100" stroke-dasharray="100" stroke-dashoffset={offset} transform="rotate(-90 56 56)" />
    {:else if arc === 'segments'}
      <g class="ring__spin"><circle class="ring__segments" cx="56" cy="56" r="46" pathLength="120" stroke-dasharray="6.2 3.8" /></g>
    {:else if arc === 'full'}
      <circle class="ring__full" cx="56" cy="56" r="46" style:stroke={pattern === 'hazard' ? `url(#${uid}-hazard)` : undefined} />
    {/if}
    {#if face === 'record'}
      <g class="ring__record">
        <circle class="ring__record-disc" cx="56" cy="56" r="24" />
        <circle class="ring__record-groove" cx="56" cy="56" r="17" />
        <circle class="ring__record-label" cx="56" cy="56" r="8" />
        <circle class="ring__record-hole" cx="56" cy="56" r="2.5" />
        <path class="ring__record-shine" d="M41 47a17 17 0 0 1 8-8" />
      </g>
    {:else if face === 'bars'}
      <rect class="ring__bar" x="38" y="36" width="13" height="40" rx="4" />
      <rect class="ring__bar" x="61" y="36" width="13" height="40" rx="4" />
    {:else if disc}
      <circle class="ring__disc" cx="56" cy="56" r="31" />
    {/if}
  </svg>

  {#key faceKey}
    <span class="ring__centre">
      {#if face === 'number'}
        {#key value}
          <span class="ring__value" data-tick={tick || undefined}>{value ?? '—'}{#if unit && value !== null}<span class="ring__unit">{unit}</span>{/if}</span>
        {/key}
      {:else if face === 'icon' && icon}
        <span class="ring__pulse"><Icon name={icon} alone class="icon--{icon}" /></span>
        {#if value !== null}<span class="ring__value ring__value--small">{value}{#if unit}<span class="ring__unit">{unit}</span>{/if}</span>{/if}
      {:else if disc && icon}
        <span class="ring__pulse"><Icon name={icon} outline alone class="icon--{icon}" /></span>
      {/if}
    </span>
  {/key}

  {#if badge}
    <span class="ring__badge" data-color={badge.color} title={badge.label}>
      <Icon name={badge.icon} alone /><span class="visually-hidden">{badge.label}</span>
    </span>
  {/if}
</span>
