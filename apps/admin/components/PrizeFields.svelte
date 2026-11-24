<!-- A round's Line or Quina prize bundle: its prizes in screen order, each with its title, sponsor, detail and
     picture. Prizes are added, removed and moved here; "Destacat" (headline) ones are shown first and bigger,
     so marking one moves it up with the others (the plan requires headline prizes first). -->
<script lang="ts">
  import type { Prize, Sponsor } from '../../../packages/ui/plan.ts';
  import type { WinKind } from '../../../packages/ui/flow.ts';
  import { CA } from '../../../packages/ui/i18n/ca.ts';
  import { addPrize, movePrize, prizeMoveRange, removePrize, setHeadline } from '../logic/plan-edit.ts';
  import { offers } from '../state/offers.svelte.ts';
  import { S } from '../strings.ts';

  let {
    bundle = $bindable(),
    kind,
    sponsors,
    idPrefix,
    errors = [],
  }: { bundle: Prize[]; kind: WinKind; sponsors: readonly Sponsor[]; idPrefix: string; errors?: readonly string[] } = $props();

  const label = $derived(CA.prize[kind]);
  /** The prize whose "Treure" was pressed once, awaiting the second press. */
  let confirming = $state<number | null>(null);

  /** Apply a pure bundle edit to a plain copy (the draft is reactive state). */
  const edit = (fn: (b: Prize[]) => Prize[]) => {
    confirming = null;
    bundle = fn($state.snapshot(bundle));
  };
  function remove(index: number) {
    if (confirming !== index) {
      confirming = index;
      return;
    }
    edit((b) => removePrize(b, index));
  }
</script>

<fieldset class="prize" data-kind={kind}>
  <legend>{label}</legend>
  {#if !bundle.length}<p class="panel__help">{S.prize.empty}</p>{/if}
  <ol class="prize__list">
    {#each bundle as prize, j (j)}
      {@const range = prizeMoveRange(bundle, j)}
      {@const offer = offers.get(prize.sponsorId)}
      <li class="prize__item" data-headline={prize.headline}>
        <div class="prize__head">
          <label class="field field--inline">
            <input type="checkbox" checked={prize.headline} onchange={(e) => edit((b) => setHeadline(b, j, e.currentTarget.checked))} />
            <span>{S.prize.headline}</span>
          </label>
          <div class="prize__tools">
            <button type="button" onclick={() => edit((b) => movePrize(b, j, j - 1))} disabled={j <= range.min} aria-label={S.prize.upLabel(j + 1)}>↑</button>
            <button type="button" onclick={() => edit((b) => movePrize(b, j, j + 1))} disabled={j >= range.max} aria-label={S.prize.downLabel(j + 1)}>↓</button>
            <button type="button" class={confirming === j ? 'tone-danger' : ''} onclick={() => remove(j)} onblur={() => confirming === j && (confirming = null)} aria-label={confirming === j ? S.prize.confirmRemove : S.prize.removeLabel(j + 1)}>
              {confirming === j ? S.prize.confirmRemove : S.prize.remove}
            </button>
          </div>
        </div>
        <div class="field-row">
          <label class="field">
            <span class="field__label">{S.prize.title}</span>
            <input type="text" id="{idPrefix}-{j}-title" bind:value={prize.title} maxlength="200" required />
          </label>
          <label class="field">
            <span class="field__label">{S.prize.sponsor}</span>
            <select bind:value={prize.sponsorId}>
              <option value={null}>{S.prize.noSponsor}</option>
              {#each sponsors as sponsor (sponsor.id)}
                <option value={sponsor.id}>{sponsor.name || sponsor.id}</option>
              {/each}
            </select>
          </label>
        </div>
        {#if offer && prize.title.trim() !== offer}
          <p class="prize__offer">
            <span>{S.prize.offer(offer)}</span>
            <button type="button" onclick={() => (prize.title = offer)}>{S.prize.useOffer}</button>
          </p>
        {/if}
        <div class="field-row">
          <label class="field">
            <span class="field__label">{S.prize.detail}</span>
            <input type="text" value={prize.detail ?? ''} oninput={(e) => (prize.detail = e.currentTarget.value || null)} maxlength="1000" />
          </label>
          <label class="field">
            <span class="field__label">{S.prize.image}</span>
            <input type="text" value={prize.image ?? ''} oninput={(e) => (prize.image = e.currentTarget.value.trim() || null)} maxlength="500" spellcheck="false" />
          </label>
        </div>
      </li>
    {/each}
  </ol>
  <div class="panel__actions">
    <button type="button" onclick={() => edit((b) => addPrize(b, b.length === 0))}>+ {S.prize.add}</button>
  </div>
  <ul class="error-list">
    {#each errors as error, i (i)}<li>{error}</li>{/each}
  </ul>
</fieldset>

<style>
  .prize {
    display: grid;
    gap: var(--space-3);
  }
  .prize__list {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .prize__item {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: var(--line-width) solid var(--color-line);
    border-radius: var(--radius-md, 0.5rem);
  }
  .prize__item[data-headline='true'] {
    border-color: var(--color-accent);
    border-width: var(--line-width-bold, 2px);
  }
  .prize__head {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    justify-content: space-between;
  }
  .prize__tools {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  .prize__offer {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }
</style>
