<!-- The Schedule: when the first round starts (this device's local time), how long rounds and Intervals should last,
     and the planned breaks ("parón", about 5 minutes after some rounds; docs/event.md), which the show's expected end
     and the Interval's countdown allow for. -->
<script lang="ts">
  import { formatClock } from '../../../packages/rules/time.ts';
  import type { PlanSession } from '../state/plan-session.svelte.ts';
  import { errorsAt } from '../logic/plan-check.ts';
  import { breakSlots, fromLocalInput, plannedEndMs, toLocalInput, withBreak, withoutBreak } from '../logic/plan-edit.ts';
  import { S } from '../strings.ts';

  let { session }: { session: PlanSession } = $props();
  const schedule = $derived(session.draft.schedule);
  const end = $derived(session.check.ok ? plannedEndMs(session.check.plan) : null);
  const breaks = $derived(schedule.breaks ?? []);
  const slots = $derived(breakSlots(session.draft));
  let addAfter = $state<number | null>(null);
  const addable = $derived(addAfter !== null && slots.includes(addAfter) ? addAfter : (slots[0] ?? null));

  function addBreak(): void {
    if (addable === null) return;
    session.draft.schedule.breaks = withBreak(session.draft.schedule.breaks, addable);
    addAfter = null;
  }
  function setMinutes(i: number, minutes: number): void {
    const list = session.draft.schedule.breaks;
    if (list?.[i] && Number.isFinite(minutes)) list[i].minutes = minutes;
  }
  function removeBreak(afterRound: number): void {
    session.draft.schedule.breaks = withoutBreak(session.draft.schedule.breaks, afterRound);
  }
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
  <fieldset class="schedule__breaks" data-testid="schedule-breaks">
    <legend class="field__label">{S.schedule.breaks}</legend>
    {#if breaks.length}
      <ul class="schedule__break-list">
        {#each breaks as b, i (b.afterRound)}
          <li class="schedule__break">
            <span>{S.schedule.breakAfter(b.afterRound)}</span>
            <label class="field field--inline">
              <span class="visually-hidden">{S.schedule.breakMinutes(b.afterRound)}</span>
              <input type="number" min="1" max="60" step="1" value={b.minutes} oninput={(e) => setMinutes(i, e.currentTarget.valueAsNumber)} />
              <span aria-hidden="true">min</span>
            </label>
            <button type="button" onclick={() => removeBreak(b.afterRound)}>{S.schedule.removeBreak}</button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="panel__help">{S.schedule.noBreaks}</p>
    {/if}
    {#if slots.length}
      <div class="field-row">
        <label class="field">
          <span class="field__label">{S.schedule.addBreakAfter}</span>
          <select value={addable} onchange={(e) => (addAfter = Number(e.currentTarget.value))}>
            {#each slots as n (n)}<option value={n}>{S.schedule.roundOption(n)}</option>{/each}
          </select>
        </label>
        <button type="button" class="schedule__add" onclick={addBreak}>{S.schedule.addBreak}</button>
      </div>
    {/if}
  </fieldset>
  <p class="panel__help" aria-live="polite">{end !== null ? S.schedule.plannedEnd(formatClock(end)) : S.schedule.noStart}</p>
  <ul class="error-list">
    {#each errorsAt(session.errors, 'plan.schedule') as error, i (i)}<li>{error}</li>{/each}
  </ul>
</section>

<style>
  .schedule__clear,
  .schedule__add {
    justify-self: start;
    align-self: end;
  }
  .schedule__breaks {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: 0;
  }
  .schedule__break-list {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .schedule__break {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }
  .schedule__break input {
    width: 5rem;
  }
</style>
