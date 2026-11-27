<!-- The logo library: every image already uploaded to the cloud (GET /api/media), newest first, each on the
     same light plate the projector uses, filtered by name. Picking one puts its path on the sponsor, so a logo
     cleaned once (by the logo tool or by Admin) is never cleaned again. Cloud only. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { MediaItem, MediaList } from '../../../packages/ui/data/cloud-plan.ts';
  import { imageSources } from '../../../packages/ui/data/media.ts';
  import { matchesQuery } from '../logic/logo-library.ts';
  import { S } from '../strings.ts';

  let { load, sponsorName, onpick, onclose }: { load: () => Promise<MediaList>; sponsorName: string; onpick: (path: string) => void; onclose: () => void } = $props();

  let media = $state.raw<MediaItem[] | null>(null);
  let failed = $state(false);
  // The search starts from the sponsor's name: its logo is usually the first match.
  // svelte-ignore state_referenced_locally
  let query = $state(sponsorName);
  const shown = $derived((media ?? []).filter((m) => matchesQuery(m, query)));

  onMount(() => {
    load().then((r) => (r.ok ? (media = r.media) : (failed = true)));
  });
</script>

<section class="logo-library" aria-label={S.library.title(sponsorName)}>
  <div class="logo-library__head">
    <label class="field">
      <span class="field__label">{S.library.search}</span>
      <input type="search" bind:value={query} autocomplete="off" spellcheck="false" />
    </label>
    <button type="button" onclick={onclose}>{S.library.close}</button>
  </div>
  {#if failed}
    <p class="notice notice--warning" role="alert">{S.library.failed}</p>
  {:else if media === null}
    <p class="panel__help" role="status">{S.library.loading}</p>
  {:else if shown.length === 0}
    <p class="panel__help">{query.trim() ? S.library.noMatch : S.library.empty}</p>
  {:else}
    <ul class="logo-library__grid">
      {#each shown as m (m.key)}
        {@const src = imageSources(m.fallback)}
        <li>
          <button type="button" class="logo-library__item" onclick={() => onpick(m.fallback)} aria-label={S.library.pick(m.name ?? m.key)}>
            <picture>
              {#if src.jxl}<source type="image/jxl" srcset={src.jxl} />{/if}
              <img src={src.src} alt="" loading="lazy" decoding="async" />
            </picture>
            <span class="logo-library__name">{m.name ?? m.key}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  @layer app {
  .logo-library {
    display: grid;
    gap: var(--space-3);
  }
  .logo-library__head {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: end;
    justify-content: space-between;
  }
  .logo-library__grid {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    gap: var(--space-3);
  }
  .logo-library__item {
    width: 100%;
    min-height: var(--tap-min);
    display: grid;
    gap: var(--space-2);
    justify-items: center;
    padding: var(--space-3);
    background: var(--color-paper);
    color: var(--color-text-on-paper);
    border: var(--line-width) solid var(--color-line);
    border-radius: var(--radius-md);
    cursor: pointer;
  }
  .logo-library__item img {
    height: 3.5rem;
    width: 100%;
    object-fit: contain;
  }
  .logo-library__name {
    font-size: var(--text-xs);
    overflow-wrap: anywhere;
  }
  }
</style>
