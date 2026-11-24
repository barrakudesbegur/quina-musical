<!-- The Schedule: when the first round starts (this device's local time), and how long rounds and Intervals
     should last. -->
<script lang="ts">
  import { formatClock } from '../../ui/rules/time.ts';
  import type { PlanSession } from '../state/plan-session.svelte.ts';
  import { errorsAt } from '../logic/plan-check.ts';
  import { fromLocalInput, plannedEndMs, toLocalInput } from '../logic/plan-edit.ts';
  import { S } from '../strings.ts';

  let { session }: { session: PlanSession } = $props();
  const schedule = $derived(session.draft.schedule);
  const end = $derived(session.check.ok ? plannedEndMs(session.check.plan) : null);
</script>

<section class="panel surface schedule" aria-labelledby="schedule-title">
  <h2 class="panel__title" id="schedule-title">{S.schedule.title}</h2>
  <div class="field-row">
    <div class="field">
      <label class="field__label" for="schedule-start">{S.schedule.start}</label>
      <input id="schedule-start" type="datetime-local" value={toLocalInput(schedule.startAtMs)} onchange={(e) => (session.draft.schedule.startAtMs = fromLocalInput(e.currentTarget.value))} />
      {#if schedule.startAtMs !== null}
        <button type="button" class="schedule__clear" onclick={() => (session.draft.schedule.startAtMs = null)}>{S.schedule.clearStart}</button>
      {/if}
    </div>
    <label class="field">
      <span class="field__label">{S.schedule.roundMinutes}</span>
      <input type="number" min="1" max="240" step="1" bind:value={session.draft.schedule.roundMinutes} />
    </label>
    <label class="field">
      <span class="field__label">{S.schedule.intervalMinutes}</span>
      <input type="number" min="0" max="120" step="1" bind:value={session.draft.schedule.intervalMinutes} />
    </label>
  </div>
  <p class="panel__help" aria-live="polite">{end !== null ? S.schedule.plannedEnd(formatClock(end)) : S.schedule.noStart}</p>
  <ul class="error-list">
    {#each errorsAt(session.errors, 'plan.schedule') as error, i (i)}<li>{error}</li>{/each}
  </ul>
</section>

<style>
  .schedule__clear {
    justify-self: start;
  }
</style>
