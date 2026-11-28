<script lang="ts">
  // "m:ss" ticking each second; the last 10 s are marked for the theme (data-state="final"). A clock time in the label
  // keeps its am/pm lowercase under Londrina's capitals (D114: ClockText's `.unit`).
  import { formatCountdown, secondsLeft } from '../../../packages/rules/time.ts';
  import ClockText from './ClockText.svelte';

  let { atMs, nowMs, label, doneLabel }: { atMs: number; nowMs: number; label: (mmss: string) => string; doneLabel: string } = $props();
  const left = $derived(secondsLeft(atMs, nowMs) ?? 0);
</script>

{#key left}
  <span class="countdown" data-anim="countdown" data-state={left === 0 ? 'done' : left <= 10 ? 'final' : 'running'} role="timer">
    <ClockText text={left > 0 ? label(formatCountdown(left)) : doneLabel} />
  </span>
{/key}
