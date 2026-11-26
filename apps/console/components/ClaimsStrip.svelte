<!--
  «Cartrons cantats» (board Consola-Comprovacio-Casos): the claimed cards in the order they're checked (the first to
  claim first), each a chip with its status: the one on screen ringed, «A la cua», «Vàlid», «Fallat», «En revisió»,
  «Descartat», and a warning sign for a card not registered as sold. It shows with 2 cards or more (D110), or when
  no Check is on screen (after a Back during a Check): a queued card's chip then starts its Check (`checkStart`).
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import type { ClaimView } from '../logic/claims.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  /** `startable`: no Check is revealing, so a queued card can be started by hand. */
  let { items, startable }: { items: readonly ClaimView[]; startable: boolean } = $props();

  const model = getConsole();
  const uid = $props.id();
</script>

<section class="panel claims-strip" aria-labelledby="{uid}-label">
  <h2 class="panel__label" id="{uid}-label">{S.check.claims}</h2>
  <ol class="claims-strip__list">
    {#each items as claim (claim.claimId)}
      <li
        class="claim-status"
        data-testid="claim-row"
        data-claim-id={claim.claimId}
        data-card-id={claim.cardId}
        data-status={claim.status}
        data-current={claim.current || undefined}
      >
        {#if startable && claim.canCheck}
          <button type="button" class="claim-status__start" data-anim="press" disabled={!model.can('checkStart')} onclick={() => model.act('checkStart', { claimId: claim.claimId })}>
            <span class="claim-status__card">#{claim.cardId}</span><span class="claim-status__text">{S.check.checkNow(claim.cardId)}</span>
          </button>
        {:else}
          <span class="claim-status__card">#{claim.cardId}</span><span class="claim-status__text">{S.check.status[claim.status]}</span>
        {/if}
        {#if claim.notSold}<Icon name="alert" /><span class="visually-hidden">{S.check.warnings.notSold}</span>{/if}
      </li>
    {/each}
  </ol>
</section>
