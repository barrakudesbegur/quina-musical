<!-- Sponsors: name, id (prizes follow a renamed id) and logo, with the logo clean-up step. -->
<script lang="ts">
  import type { PlanSession } from '../state/plan-session.svelte.ts';
  import { errorsAt } from '../logic/plan-check.ts';
  import { sponsorIdFor, sponsorUsage } from '../logic/plan-edit.ts';
  import { S } from '../strings.ts';
  import LogoCleaner from './LogoCleaner.svelte';
  import LogoLibrary from './LogoLibrary.svelte';

  let { session }: { session: PlanSession } = $props();

  /** Ids created by "Afegir" on this page: they follow the name until the admin edits the id. */
  const autoIds = new Set<string>();
  let confirming = $state<string | null>(null);
  /** The sponsor whose logo is being cleaned up. */
  let cleaning = $state<string | null>(null);
  /** The sponsor whose logo is being picked from the cloud's library (cloud only). */
  let browsing = $state<string | null>(null);
  const hasLibrary = $derived(session.store.kind === 'cloud');
  const listErrors = $derived(session.errors.filter((e) => e.startsWith('plan.sponsors:')));

  const otherIds = (id: string) => session.draft.sponsors.map((s) => s.id).filter((other) => other !== id);

  function add() {
    const id = sponsorIdFor(S.sponsors.newName, otherIds(''));
    autoIds.add(id);
    session.update((p) => ({ ...p, sponsors: [...p.sponsors, { id, name: S.sponsors.newName, logo: null }] }));
  }

  /** Once a new sponsor's name is committed, its id follows it. */
  function nameCommitted(id: string, name: string) {
    if (!autoIds.has(id)) return;
    const next = sponsorIdFor(name, otherIds(id));
    if (next === id) return;
    autoIds.delete(id);
    autoIds.add(next);
    session.renameSponsor(id, next);
  }

  function idEdited(id: string, value: string) {
    autoIds.delete(id);
    session.renameSponsor(id, value.trim());
  }

  function remove(id: string) {
    if (confirming !== id) {
      confirming = id;
      return;
    }
    confirming = null;
    if (cleaning === id) cleaning = null;
    session.removeSponsor(id);
  }

  function useLogo(id: string, dataUrl: string) {
    const sponsor = session.draft.sponsors.find((s) => s.id === id);
    if (sponsor) sponsor.logo = dataUrl;
    cleaning = null;
  }
</script>

<section class="panel surface sponsors" aria-labelledby="sponsors-title">
  <h2 class="panel__title" id="sponsors-title">{S.sponsors.title}</h2>
  <p class="panel__help">{S.sponsors.help}</p>

  <ul class="sponsors__list">
    {#each session.draft.sponsors as sponsor, i (i)}
      {@const usage = sponsorUsage(session.draft, sponsor.id)}
      <li class="sponsor">
        <fieldset class="sponsor__fields">
          <legend>{sponsor.name || sponsor.id}</legend>
          <div class="field-row">
            <label class="field">
              <span class="field__label">{S.sponsors.name}</span>
              <input type="text" bind:value={sponsor.name} onchange={(e) => nameCommitted(sponsor.id, e.currentTarget.value)} maxlength="200" />
            </label>
            <label class="field">
              <span class="field__label">{S.sponsors.id}</span>
              <input type="text" value={sponsor.id} onchange={(e) => idEdited(sponsor.id, e.currentTarget.value)} maxlength="64" spellcheck="false" autocapitalize="off" />
            </label>
          </div>
          <div class="sponsor__logo">
            <span class="field__label">{S.sponsors.logo}</span>
            {#if sponsor.logo}
              <div class="sponsor__logo-previews">
                <img class="sponsor__logo-img checkerboard" src={sponsor.logo} alt={S.sponsors.logoAlt(sponsor.name)} />
                <img class="sponsor__logo-img show-background" src={sponsor.logo} alt="" />
              </div>
            {:else}
              <span class="panel__help">{S.sponsors.noLogo}</span>
            {/if}
            <div class="panel__actions">
              <button type="button" onclick={() => (cleaning = cleaning === sponsor.id ? null : sponsor.id)} aria-expanded={cleaning === sponsor.id}>{S.sponsors.editLogo}</button>
              {#if hasLibrary}
                <button type="button" onclick={() => (browsing = browsing === sponsor.id ? null : sponsor.id)} aria-expanded={browsing === sponsor.id}>{S.library.open}</button>
              {/if}
              {#if sponsor.logo}
                <button type="button" onclick={() => (sponsor.logo = null)}>{S.sponsors.removeLogo}</button>
              {/if}
            </div>
          </div>
          {#if browsing === sponsor.id}
            <LogoLibrary
              load={() => session.store.mediaLibrary()}
              sponsorName={sponsor.name || sponsor.id}
              onpick={(path) => {
                sponsor.logo = path;
                browsing = null;
              }}
              onclose={() => (browsing = null)}
            />
          {/if}
          {#if cleaning === sponsor.id}
            <LogoCleaner sponsorName={sponsor.name || sponsor.id} onuse={(url) => useLogo(sponsor.id, url)} onclose={() => (cleaning = null)} />
          {/if}
          <div class="panel__actions">
            <span class="panel__help">{S.sponsors.usage(usage)}</span>
            <button
              type="button"
              data-color={confirming === sponsor.id ? 'red' : undefined}
              onclick={() => remove(sponsor.id)}
              onblur={() => confirming === sponsor.id && (confirming = null)}
              aria-label={confirming === sponsor.id ? S.sponsors.confirmRemove(usage) : S.sponsors.removeLabel(sponsor.name || sponsor.id)}
            >
              {confirming === sponsor.id ? S.sponsors.confirmRemove(usage) : S.sponsors.remove}
            </button>
          </div>
          <ul class="error-list">
            {#each errorsAt(session.errors, `plan.sponsors[${i}]`) as error, j (j)}<li>{error}</li>{/each}
          </ul>
        </fieldset>
      </li>
    {/each}
  </ul>

  <ul class="error-list">
    {#each listErrors as error, i (i)}<li>{error}</li>{/each}
  </ul>

  <div class="panel__actions">
    <button type="button" onclick={add}>+ {S.sponsors.add}</button>
  </div>
</section>

<style>
  .sponsors__list {
    display: grid;
    gap: var(--space-4);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .sponsor__fields,
  .sponsor__logo {
    display: grid;
    gap: var(--space-3);
  }
  .sponsor__logo-previews {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .sponsor__logo-img {
    max-height: var(--space-7);
    width: auto;
    padding: var(--space-2);
    border-radius: var(--radius-sm);
  }
</style>
