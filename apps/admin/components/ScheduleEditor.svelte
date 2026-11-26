<!-- The Schedule: when the doors open and the cards go on sale (D150, D152: the phones' Horari starts with it; never
     after the start), when the first round starts (this device's local time), how long rounds and Intervals should
     last, and the planned Throws (D136, about 5 minutes on top of the Interval after some rounds; docs/event.md), which
     the show's expected end and the Interval's countdown allow for. -->
<script lang="ts">
  import { formatClock } from '../../../packages/rules/time.ts';
  import type { PlanSession } from '../state/plan-session.svelte.ts';
  import { errorsAt } from '../logic/plan-check.ts';
  import { doorsAfterStart, fromLocalInput, plannedEndMs, throwSlots, toLocalInput, withThrow, withoutThrow } from '../logic/plan-edit.ts';
  import { S } from '../strings.ts';

  let { session }: { session: PlanSession } = $props();
  const schedule = $derived(session.draft.schedule);
  const end = $derived(session.check.ok ? plannedEndMs(session.check.plan) : null);
  const doorsLate = $derived(doorsAfterStart(schedule));
  /** The plan check's errors, but the doors' own one only once: the field says it in Catalan. */
  const errors = $derived(errorsAt(session.errors, 'plan.schedule').filter((e) => !(doorsLate && e.startsWith('plan.schedule.doorsAtMs:'))));
  const throws = $derived(schedule.throws ?? []);
  const slots = $derived(throwSlots(session.draft));
  let addAfter = $state<number | null>(null);
  const addable = $derived(addAfter !== null && slots.includes(addAfter) ? addAfter : (slots[0] ?? null));

  /** An empty or junk doors' time leaves the field out, as a plan without it reads (the protocol's `doorsAtMs?`). */
  function setDoors(value: string): void {
    const ms = fromLocalInput(value);
    if (ms === null) delete session.draft.schedule.doorsAtMs;
    else session.draft.schedule.doorsAtMs = ms;
  }
  function addThrow(): void {
    if (addable === null) return;
    session.draft.schedule.throws = withThrow(session.draft.schedule.throws, addable);
    addAfter = null;
  }
  function setMinutes(i: number, minutes: number): void {
    const list = session.draft.schedule.throws;
    if (list?.[i] && Number.isFinite(minutes)) list[i].minutes = minutes;
  }
  function removeThrow(afterRound: number): void {
    session.draft.schedule.throws = withoutThrow(session.draft.schedule.throws, afterRound);
  }
</script>

<section class="panel surface schedule" aria-labelledby="schedule-title">
  <h2 class="panel__title" id="schedule-title">{S.schedule.title}</h2>
  <div class="field-row schedule__times">
    <div class="field">
      <label class="field__label" for="schedule-doors">{S.schedule.doors}</label>
      <input
        id="schedule-doors"
        type="datetime-local"
        value={toLocalInput(schedule.doorsAtMs ?? null)}
        max={toLocalInput(schedule.startAtMs) || undefined}
        aria-invalid={doorsLate}
        aria-describedby={doorsLate ? 'schedule-doors-late' : undefined}
        onchange={(e) => setDoors(e.currentTarget.value)}
      />
      {#if doorsLate}<p class="notice notice--error" id="schedule-doors-late">{S.schedule.doorsAfterStart}</p>{/if}
      {#if schedule.doorsAtMs != null}
        <button type="button" class="schedule__clear" onclick={() => setDoors('')}>{S.schedule.clearDoors}</button>
      {/if}
    </div>
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
  <fieldset class="schedule__throws" data-testid="schedule-throws">
    <legend class="field__label">{S.schedule.throws}</legend>
    <p class="panel__help">{S.schedule.throwsHelp}</p>
    {#if throws.length}
      <ul class="schedule__throw-list">
        {#each throws as t, i (t.afterRound)}
          <li class="schedule__throw">
            <span>{S.schedule.throwAfter(t.afterRound)}</span>
            <label class="field field--inline">
              <span class="visually-hidden">{S.schedule.throwMinutes(t.afterRound)}</span>
              <input type="number" min="1" max="60" step="1" value={t.minutes} oninput={(e) => setMinutes(i, e.currentTarget.valueAsNumber)} />
              <span aria-hidden="true">min</span>
            </label>
            <button type="button" onclick={() => removeThrow(t.afterRound)}>{S.schedule.removeThrow}</button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="panel__help">{S.schedule.noThrows}</p>
    {/if}
    {#if slots.length}
      <div class="field-row">
        <label class="field">
          <span class="field__label">{S.schedule.addThrowAfter}</span>
          <select value={addable} onchange={(e) => (addAfter = Number(e.currentTarget.value))}>
            {#each slots as n (n)}<option value={n}>{S.schedule.roundOption(n)}</option>{/each}
          </select>
        </label>
        <button type="button" class="schedule__add" onclick={addThrow}>{S.schedule.addThrow}</button>
      </div>
    {/if}
  </fieldset>
  <!-- No line while the plan doesn't check with a start set: the errors say why there's no planned end. -->
  <p class="panel__help" aria-live="polite">{end !== null ? S.schedule.plannedEnd(formatClock(end)) : schedule.startAtMs === null ? S.schedule.noStart : ''}</p>
  <ul class="error-list">
    {#each errors as error, i (i)}<li>{error}</li>{/each}
  </ul>
</section>

<style>
  /* A time's clear button or its error doesn't stretch the fields beside it. */
  .schedule__times {
    align-items: start;
  }
  .schedule__clear,
  .schedule__add {
    justify-self: start;
    align-self: end;
  }
  .schedule__throws {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: 0;
  }
  .schedule__throw-list {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .schedule__throw {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }
  .schedule__throw input {
    width: 5rem;
  }
</style>
