<!-- One prize of a round (Line or Quina): whether there is one, its title, detail, sponsor and picture. -->
<script lang="ts">
  import type { Prize, Sponsor } from '../../../packages/ui/plan.ts';
  import type { WinKind } from '../../../packages/ui/flow.ts';
  import { CA } from '../../../packages/ui/i18n/ca.ts';
  import { blankPrize } from '../logic/plan-edit.ts';
  import { offers } from '../state/offers.svelte.ts';
  import { S } from '../strings.ts';

  let {
    prize = $bindable(),
    kind,
    sponsors,
    idPrefix,
    errors = [],
  }: { prize: Prize | null; kind: WinKind; sponsors: readonly Sponsor[]; idPrefix: string; errors?: readonly string[] } = $props();

  const label = $derived(CA.prize[kind]);
  /** What the chosen sponsor gives, from the imported sheet (Admin-only memory), when it isn't the title yet. */
  const offer = $derived(prize ? offers.get(prize.sponsorId) : null);
</script>

<fieldset class="prize" data-kind={kind}>
  <legend>{label}</legend>
  <label class="field field--inline">
    <input type="checkbox" checked={prize !== null} onchange={(e) => (prize = e.currentTarget.checked ? blankPrize() : null)} />
    <span>{S.prize.has(label)}</span>
  </label>
  {#if prize}
    <div class="field-row">
      <label class="field">
        <span class="field__label">{S.prize.title}</span>
        <input type="text" id="{idPrefix}-title" bind:value={prize.title} maxlength="200" required />
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
        <button type="button" onclick={() => prize && (prize.title = offer)}>{S.prize.useOffer}</button>
      </p>
    {/if}
    <label class="field">
      <span class="field__label">{S.prize.detail}</span>
      <input type="text" value={prize.detail ?? ''} oninput={(e) => prize && (prize.detail = e.currentTarget.value || null)} maxlength="1000" />
    </label>
    <label class="field">
      <span class="field__label">{S.prize.image}</span>
      <input type="text" value={prize.image ?? ''} oninput={(e) => prize && (prize.image = e.currentTarget.value.trim() || null)} maxlength="500" spellcheck="false" />
    </label>
  {/if}
  <ul class="error-list">
    {#each errors as error, i (i)}<li>{error}</li>{/each}
  </ul>
</fieldset>

<style>
  .prize {
    display: grid;
    gap: var(--space-3);
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
