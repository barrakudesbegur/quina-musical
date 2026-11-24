<script lang="ts">
  // "m:ss" ticking each second; the last 10 s are marked for the theme (data-state="final").
  import { formatCountdown, secondsLeft } from '../../ui/rules/time.ts';

  let { atMs, nowMs, label, doneLabel }: { atMs: number; nowMs: number; label: (mmss: string) => string; doneLabel: string } = $props();
  const left = $derived(secondsLeft(atMs, nowMs) ?? 0);
</script>

{#key left}
  <span class="countdown" data-anim="countdown" data-state={left === 0 ? 'done' : left <= 10 ? 'final' : 'running'} role="timer">
    {left > 0 ? label(formatCountdown(left)) : doneLabel}
  </span>
{/key}
