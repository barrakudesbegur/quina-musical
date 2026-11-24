<!-- The claimed cards, oldest first: status, finding, warnings, "complete since song N", and Check. -->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import type { ClaimView } from '../logic/claims.ts';
  import { CA, S } from '../strings.ts';

  /** `hideCurrent`: the Check on screen hasn't reached its result yet, so its finding stays hidden. */
  let { items, hideCurrent }: { items: readonly ClaimView[]; hideCurrent: boolean } = $props();

  const model = getConsole();
  const uid = $props.id();
</script>

<section class="claims" aria-labelledby="{uid}-title">
  <h3 class="panel__subtitle" id="{uid}-title">{S.check.claims}</h3>
  <ol class="claims__list">
    {#each items as claim (claim.claimId)}
      <li class="claims__item" data-status={claim.status} data-current={claim.current || undefined}>
        <span class="claims__card">{CA.card(claim.cardId)}</span>
        <span class="claims__kind">{S.check.kind[claim.kind]}</span>
        <span class="badge" data-status={claim.status}>{S.check.status[claim.status]}</span>
        {#if !(claim.current && hideCurrent)}
          {#if claim.outcome}<span class="claims__outcome">{S.check.outcome[claim.outcome]}</span>{/if}
          {#if claim.completeSinceSong !== null}<span class="claims__since">{S.check.completeSince(claim.completeSinceSong)}</span>{/if}
        {/if}
        {#if claim.notSold}<span class="badge badge--warning">{S.check.notSold}</span>{/if}
        {#if claim.canCheck && !claim.current}
          <button type="button" class="claims__check" data-anim="press" disabled={!model.can('checkStart')} onclick={() => model.act('checkStart', { claimId: claim.claimId })}>
            {S.check.checkNow}
          </button>
        {/if}
      </li>
    {/each}
  </ol>
</section>
