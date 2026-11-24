<!-- Import sponsors from the organisers' sheet: a CSV export of their spreadsheet. Only each business's name,
     category, whether it takes part, what it gives and whether a logo exists are read; the private columns
     (who holds each prize, deliveries, to-dos) never are, because the plan reaches every phone. Businesses that
     take part are ticked; "Esperant" ones can be ticked by hand. -->
<script lang="ts">
  import type { PlanSession } from '../state/plan-session.svelte.ts';
  import { offers } from '../state/offers.svelte.ts';
  import { alreadySponsor, parseCsv, readSponsorSheet, sponsorsFromSheet, type SheetEntry } from '../logic/sponsor-sheet.ts';
  import { S } from '../strings.ts';

  let { session }: { session: PlanSession } = $props();

  let entries = $state.raw<SheetEntry[] | null>(null);
  let chosen = $state<Record<number, boolean>>({});
  let error = $state<string | null>(null);
  let done = $state<string | null>(null);
  const shown = $derived((entries ?? []).map((e, i) => ({ e, i, known: alreadySponsor(e, session.draft.sponsors) })).filter((x) => x.e.status !== 'no'));
  const count = $derived(shown.filter((x) => chosen[x.i] && !x.known).length);

  async function read(file: File | undefined) {
    error = done = null;
    if (!file) return;
    const result = readSponsorSheet(parseCsv(await file.text()));
    if (!result.ok) {
      entries = null;
      error = S.sponsorImport.noHeader;
      return;
    }
    entries = result.entries;
    chosen = Object.fromEntries(result.entries.map((e, i) => [i, e.status === 'yes']));
  }

  function add() {
    if (!entries) return;
    const picked = entries.filter((_, i) => chosen[i]);
    const { sponsors, offers: found } = sponsorsFromSheet(picked, session.draft.sponsors);
    session.update((p) => ({ ...p, sponsors: [...p.sponsors, ...sponsors] }));
    offers.merge(found);
    done = S.sponsorImport.added(sponsors.length);
    entries = null;
  }
</script>

<section class="panel surface sponsor-import" aria-labelledby="sponsor-import-title">
  <h2 class="panel__title" id="sponsor-import-title">{S.sponsorImport.title}</h2>
  <p class="panel__help">{S.sponsorImport.help}</p>
  <label class="field">
    <span class="field__label">{S.sponsorImport.file}</span>
    <input type="file" accept=".csv,text/csv" onchange={(e) => read(e.currentTarget.files?.[0])} />
  </label>
  {#if error}<p class="notice notice--warning" role="alert">{error}</p>{/if}
  {#if done}<p class="notice" role="status">{done}</p>{/if}

  {#if entries}
    <table class="sponsor-import__table">
      <thead>
        <tr><th scope="col">{S.sponsorImport.add}</th><th scope="col">{S.sponsorImport.name}</th><th scope="col">{S.sponsorImport.offer}</th><th scope="col">{S.sponsorImport.logo}</th></tr>
      </thead>
      <tbody>
        {#each shown as { e, i, known } (i)}
          <tr data-status={e.status}>
            <td><input type="checkbox" bind:checked={chosen[i]} disabled={known} aria-label={S.sponsorImport.pick(e.name)} /></td>
            <td>
              <span class="sponsor-import__name">{e.name}</span>
              <span class="sponsor-import__meta">{e.category ?? ''}{known ? ` · ${S.sponsorImport.known}` : e.status === 'waiting' ? ` · ${S.sponsorImport.waiting}` : e.status === 'unknown' ? ` · ${S.sponsorImport.unknown}` : ''}</span>
            </td>
            <td>{e.offer ?? '—'}</td>
            <td>{e.hasLogo ? S.sponsorImport.hasLogo : '—'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <div class="panel__actions">
      <button type="button" class="tone-primary" onclick={add} disabled={count === 0}>{S.sponsorImport.addCount(count)}</button>
      <button type="button" onclick={() => (entries = null)}>{S.sponsorImport.cancel}</button>
    </div>
  {/if}
</section>

<style>
  .sponsor-import {
    display: grid;
    gap: var(--space-3);
  }
  .sponsor-import__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }
  .sponsor-import__table th,
  .sponsor-import__table td {
    padding: var(--space-2);
    text-align: left;
    vertical-align: top;
    border-bottom: 1px solid color-mix(in srgb, var(--color-line) 40%, transparent);
  }
  .sponsor-import__table tr[data-status='waiting'],
  .sponsor-import__table tr[data-status='unknown'] {
    color: var(--color-text-muted);
  }
  .sponsor-import__name {
    display: block;
    font-weight: var(--font-weight-strong);
  }
  .sponsor-import__meta {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }
</style>
