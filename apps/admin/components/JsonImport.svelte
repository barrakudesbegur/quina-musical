<!-- Bulk import: paste or upload a plan as JSON (the shape in apps/admin/README.md, so an AI agent can produce it
     from the organizers' spreadsheet). Every error is listed with its path; a valid plan shows what would
     change, and only "Substituir" replaces the current plan. -->
<script lang="ts">
  import { CA } from '../../../packages/ui/i18n/ca.ts';
  import { roundAt, type GamePlan } from '../../../packages/ui/plan.ts';
  import type { PlanSession } from '../state/plan-session.svelte.ts';
  import { checkPlanText, type PlanTextCheck } from '../logic/plan-check.ts';
  import { diffPlans } from '../logic/plan-diff.ts';
  import { readFileText } from '../data/files.ts';
  import { S } from '../strings.ts';
  import PlanErrors from './PlanErrors.svelte';

  let { session }: { session: PlanSession } = $props();

  let text = $state('');
  let result = $state.raw<PlanTextCheck | null>(null);
  let fileError = $state(false);
  let replaced = $state(false);

  const imported = $derived(result?.ok ? result.plan : null);
  const diff = $derived(imported ? diffPlans(session.current, imported) : null);
  const list = (numbers: readonly (number | string)[]) => numbers.join(', ');

  function check() {
    replaced = false;
    result = checkPlanText(text);
  }

  async function pick(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const content = await readFileText(file);
    fileError = content === null;
    if (content !== null) {
      text = content;
      check();
    }
    input.value = '';
  }

  function replace(plan: GamePlan) {
    session.replace(plan);
    result = null;
    text = '';
    replaced = true;
  }
</script>

<section class="panel surface json-import" aria-labelledby="import-title">
  <h2 class="panel__title" id="import-title">{S.json.importTitle}</h2>
  <p class="panel__help">{S.json.importHelp}</p>

  <label class="field">
    <span class="field__label">{S.json.paste}</span>
    <textarea rows="10" bind:value={text} oninput={() => (result = null)} spellcheck="false" autocomplete="off" class="json-import__text"></textarea>
  </label>
  <div class="panel__actions">
    <button type="button" data-color="orange" onclick={check}>{S.json.check}</button>
    <label class="field field--inline">
      <span class="field__label">{S.json.file}</span>
      <input type="file" accept="application/json,.json" onchange={pick} />
    </label>
  </div>
  {#if fileError}<p class="notice notice--error">{S.json.fileError}</p>{/if}

  <div aria-live="polite" class="json-import__result">
    {#if replaced}<p class="notice notice--ok">{S.json.replaced}</p>{/if}
    {#if result && !result.ok}
      {#if result.kind === 'empty'}
        <p class="notice notice--warn">{S.json.empty}</p>
      {:else if result.kind === 'syntax'}
        <p class="notice notice--error">{S.json.syntax(result.message)}</p>
      {:else}
        <PlanErrors errors={result.errors} title={S.json.invalid(result.errors.length)} />
      {/if}
    {/if}

    {#if result?.ok && diff}
      {@const plan = result.plan}
      {#if diff.same}
        <p class="notice">{S.json.same}</p>
      {:else}
        <div class="notice json-import__diff">
          <p><strong>{S.json.ok}</strong></p>
          <ul>
            {#if diff.title}<li>{S.json.title}</li>{/if}
            {#if diff.edition}<li>{S.json.edition}</li>{/if}
            <li>
              {S.json.rounds(diff.rounds.before, diff.rounds.after)}
              {#if diff.rounds.added.length}· {S.json.roundsAdded(list(diff.rounds.added))}{/if}
              {#if diff.rounds.removed.length}· {S.json.roundsRemoved(list(diff.rounds.removed))}{/if}
              {#if diff.rounds.kindChanged.length}· {S.json.roundsKind(list(diff.rounds.kindChanged))}{/if}
              {#if diff.rounds.cardTypeChanged.length}· {S.json.roundsCardType(list(diff.rounds.cardTypeChanged))}{/if}
              {#if diff.rounds.sideChanged.length}· {S.json.roundsSide(list(diff.rounds.sideChanged))}{/if}
            </li>
            {#if diff.prizes.length}
              <li>
                {S.json.prizes(diff.prizes.length)}
                <ul>
                  {#each diff.prizes as change (`${change.round}-${change.kind}`)}
                    <li>{S.json.prizeLine(S.round(roundAt(imported, change.round), imported), CA.prize[change.kind], change.before, change.after)}</li>
                  {/each}
                </ul>
              </li>
            {/if}
            {#if diff.sponsors.added.length}<li>{S.json.sponsorsAdded(list(diff.sponsors.added))}</li>{/if}
            {#if diff.sponsors.removed.length}<li>{S.json.sponsorsRemoved(list(diff.sponsors.removed))}</li>{/if}
            {#if diff.sponsors.changed.length}<li>{S.json.sponsorsChanged(list(diff.sponsors.changed))}</li>{/if}
            {#if diff.schedule}<li>{S.json.schedule}</li>{/if}
            {#if diff.cheatSheet}<li>{S.json.cheatSheet}</li>{/if}
            {#if diff.prizeReveal}<li>{S.json.prizeReveal}</li>{/if}
          </ul>
        </div>
        <div class="panel__actions">
          <button type="button" data-color="red" onclick={() => replace(plan)}>{S.json.replace}</button>
          <button type="button" onclick={() => (result = null)}>{S.json.discard}</button>
        </div>
      {/if}
    {/if}
  </div>
</section>

<style>
  @layer app {
  .json-import__text {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
  }
  .json-import__result,
  .json-import__diff {
    display: grid;
    gap: var(--space-3);
  }
  .json-import__diff ul {
    margin: 0;
    padding-left: var(--space-5);
  }
  }
</style>
