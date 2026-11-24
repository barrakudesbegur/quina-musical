<!-- A ring that empties linearly to a moment (hook countdown-ring), with the seconds as text in the middle. -->
<script lang="ts">
  interface Props {
    /** The share still to go, 1 → 0. */
    remaining: number;
    /** Whole seconds left, or null to show "—". */
    seconds: number | null;
    /** What it counts down to, for assistive technology. */
    label: string;
    /** A unit after the number ("9 s"). */
    unit?: string | null;
  }

  let { remaining, seconds, label, unit = null }: Props = $props();
  const offset = $derived(100 - Math.min(1, Math.max(0, remaining)) * 100);
</script>

<span class="countdown-ring" data-anim="countdown-ring" data-state={seconds === null ? 'idle' : 'running'} role="timer" aria-label={label} title={label}>
  <svg class="countdown-ring__svg" viewBox="0 0 112 112" aria-hidden="true" focusable="false">
    <circle class="countdown-ring__track" cx="56" cy="56" r="46" pathLength="100" />
    <circle class="countdown-ring__fill" cx="56" cy="56" r="46" pathLength="100" stroke-dasharray="100" stroke-dashoffset={offset} transform="rotate(-90 56 56)" />
  </svg>
  <span class="countdown-ring__value">{seconds ?? '—'}{#if seconds !== null && unit}<span class="countdown-ring__unit"> {unit}</span>{/if}</span>
</span>
