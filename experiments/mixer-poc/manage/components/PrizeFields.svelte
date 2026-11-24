<!-- One prize of a round (Line or Quina): whether there is one, its title, detail, sponsor and picture. -->
<script lang="ts">
  import type { Prize, Sponsor } from '../../ui/plan.ts';
  import type { WinKind } from '../../ui/flow.ts';
  import { CA } from '../../ui/i18n/ca.ts';
  import { blankPrize } from '../logic/plan-edit.ts';
  import { S } from '../strings.ts';

  let {
    prize = $bindable(),
    kind,
    sponsors,
    idPrefix,
    errors = [],
  }: { prize: Prize | null; kind: WinKind; sponsors: readonly Sponsor[]; idPrefix: string; errors?: readonly string[] } = $props();

  const label = $derived(CA.prize[kind]);
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
</style>
