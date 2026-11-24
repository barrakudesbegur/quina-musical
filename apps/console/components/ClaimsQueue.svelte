<!--
  The claimed cards, oldest first (the first to claim wins): the card number big, its status, when it was
  claimed, the finding once its Check shows it, "complete since song N", the unsold warning, and Check for
  the ones waiting.
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import type { ClaimView } from '../logic/claims.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  /** `hideCurrent`: the Check on screen hasn't reached its result yet, so its finding stays hidden. */
  let { items, hideCurrent }: { items: readonly ClaimView[]; hideCurrent: boolean } = $props();

  const model = getConsole();
</script>

<ol class="claims__list">
  {#each items as claim (claim.claimId)}
    <li class="claims__item" data-testid="claim-row" data-claim-id={claim.claimId} data-card-id={claim.cardId} data-status={claim.status} data-current={claim.current || undefined}>
      <p class="claims__head">
        <span class="claims__card">{claim.cardId}</span>
        <span class="claims__status">{S.check.status[claim.status]}</span>
      </p>
      <p class="claims__meta">{S.check.kind[claim.kind]} · {S.check.claimedAt(claim.claimedAtSong)}</p>
      {#if claim.notSold}<p class="claims__warning"><Icon name="alert" />{S.check.notSold}</p>{/if}
      {#if !(claim.current && hideCurrent)}
        {#if claim.outcome}<p class="claims__meta">{S.check.outcome[claim.outcome]}</p>{/if}
        {#if claim.completeSinceSong !== null}<p class="claims__meta">{S.check.completeSince(claim.completeSinceSong, claim.kind)}</p>{/if}
      {/if}
      {#if claim.canCheck && !claim.current}
        <button type="button" class="mini claims__check" data-anim="press" disabled={!model.can('checkStart')} onclick={() => model.act('checkStart', { claimId: claim.claimId })}>
          {S.check.checkNow}
        </button>
      {/if}
    </li>
  {/each}
</ol>
