<!-- Upload a folder of cleaned logos to the cloud's library (cloud only), as the signed-in organizer: pick the
     files (the logo tool's PNG + JXL pairs, or plain PNGs), and each `<slug>.png` goes up with `?name=<slug>`,
     then its `<slug>.jxl` (or one encoded here when there is none). Names already in the library are skipped.
     Then the library picker (LogoLibrary) finds them by name. -->
<script lang="ts">
  import type { AdminPlanStore } from '../data/admin-plan-store.ts';
  import { pairLogoFiles, type LogoPair } from '../logic/logo-files.ts';
  import { S } from '../strings.ts';

  let { store }: { store: AdminPlanStore } = $props();

  type Row = { slug: string; state: 'waiting' | 'uploading' | 'done' | 'exists' | 'failed'; detail?: string };
  let pairs = $state.raw<LogoPair<File>[]>([]);
  let skipped = $state.raw<string[]>([]);
  let rows = $state<Row[]>([]);
  let running = $state(false);
  const done = $derived(rows.filter((r) => r.state === 'done').length);

  function pick(files: FileList | null) {
    const result = pairLogoFiles([...(files ?? [])]);
    pairs = result.pairs;
    skipped = result.skipped;
    rows = result.pairs.map((p) => ({ slug: p.slug, state: 'waiting' }));
  }

  async function upload() {
    running = true;
    const library = await store.mediaLibrary();
    const known = new Set(library.ok ? library.media.flatMap((m) => (m.name ? [m.name] : [])) : []);
    for (const [i, pair] of pairs.entries()) {
      if (known.has(pair.slug)) {
        rows[i].state = 'exists';
        continue;
      }
      rows[i].state = 'uploading';
      const result = await store.uploadLogo(pair.fallback, pair.jxl, pair.slug);
      rows[i].state = result.ok ? 'done' : 'failed';
      if (!result.ok) rows[i].detail = result.reason;
    }
    running = false;
  }
</script>

<section class="panel surface logo-bulk" aria-labelledby="logo-bulk-title">
  <h2 class="panel__title" id="logo-bulk-title">{S.bulk.title}</h2>
  <p class="panel__help">{S.bulk.help}</p>
  <label class="field">
    <span class="field__label">{S.bulk.files}</span>
    <input type="file" multiple accept=".png,.jpg,.jpeg,.jxl,image/png,image/jpeg,image/jxl" disabled={running} onchange={(e) => pick(e.currentTarget.files)} />
  </label>
  {#if skipped.length}<p class="panel__help">{S.bulk.skipped(skipped)}</p>{/if}
  {#if rows.length}
    <div class="panel__actions">
      <button type="button" data-color="orange" onclick={upload} disabled={running || rows.every((r) => r.state !== 'waiting')}>{S.bulk.upload(pairs.length)}</button>
      <span class="panel__help" role="status">{S.bulk.progress(done, pairs.length)}</span>
    </div>
    <ul class="logo-bulk__list">
      {#each rows as row (row.slug)}
        <li data-state={row.state}><span>{row.slug}</span> <span class="logo-bulk__state">{S.bulk.state[row.state]}{row.detail ? ` (${row.detail})` : ''}</span></li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  @layer app {
  .logo-bulk {
    display: grid;
    gap: var(--space-3);
  }
  .logo-bulk__list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: var(--space-1) var(--space-4);
    font-size: var(--text-sm);
  }
  .logo-bulk__state {
    color: var(--color-text-muted);
  }
  .logo-bulk__list li[data-state='failed'] .logo-bulk__state {
    color: var(--color-danger);
  }
  }
</style>
