<!--
  A Check under review («Revisió manual», D119–D125), the right side of the Check board (board
  Consola-Comprovacio-Revisio, a draft: U77). The card stays on the left with its marks. Here: what keeps playing
  (D118) with «En revisió · #88»; Parlem and Pausa as on the game screen (−/+ held is Pausa, D135; Parlem in a Check is
  still refused by the engine, U78); «Continua la comprovació»; and the three decisions by hand (D121): «Dona-la per
  bona», «Dona-la per dolenta», «Descarta el cartró». A decision against the card has a triangle, and asks first
  (hook check-review: the dialog scales in). A does nothing here: the decisions are the tablet's only.
-->
<script lang="ts">
  import type { CheckInfo, ClaimInfo } from '../../../packages/ui/flow.ts';
  import { getConsole } from '../context.ts';
  import { checkPasses, checkVerdict, nextReveal, reviewNeedsConfirm } from '../logic/check.ts';
  import { songTitleOf } from '../logic/show-data.ts';
  import { S } from '../strings.ts';
  import Cover from './Cover.svelte';
  import Button from '../../../packages/ui/components/Button.svelte';
  import { ACTIONS } from '../actions.ts';
  import Icon from './Icon.svelte';
  import TwoLevelButton from './TwoLevelButton.svelte';

  let { check, claim }: { check: CheckInfo; claim: ClaimInfo | null } = $props();

  const model = getConsole();
  const uid = $props.id();
  const snap = $derived(model.show.state);
  const title = (songId: number) => songTitleOf(songId, snap, model.catalog) ?? `Cançó ${songId}`;
  const next = $derived(nextReveal(check, claim));
  const verdict = $derived(checkVerdict(check, claim));
  const passes = $derived(checkPasses(check));
  const canEnd = $derived(model.can('reviewEnd'));
  let dialog: HTMLDialogElement | undefined = $state();
  /** The decision against the card waiting for its confirmation. */
  let asking = $state<'win' | 'lose' | null>(null);

  function decide(outcome: 'continue' | 'win' | 'lose' | 'discard'): void {
    if ((outcome === 'win' || outcome === 'lose') && reviewNeedsConfirm(outcome, check)) {
      asking = outcome;
      dialog?.showModal();
      return;
    }
    model.act('reviewEnd', { claimId: check.claimId, outcome });
  }

  function confirm(): void {
    const outcome = asking;
    dialog?.close();
    if (outcome) model.act('reviewEnd', { claimId: check.claimId, outcome });
  }

  const warning = $derived(
    asking === 'win' ? S.review.confirm.warnWin(verdict.kind === 'missing' ? title(verdict.songId) : null) : asking === 'lose' ? S.review.confirm.warnLose(check.kind) : '',
  );
</script>

<div class="review-panel" data-testid="review-panel" data-anim="check-review">
  <section class="panel review-panel__now" aria-labelledby="{uid}-now">
    <Cover songId={snap?.current?.songId ?? null} size="sm" />
    <div class="review-panel__song">
      <h2 class="panel__label" id="{uid}-now">{S.review.nowPlaying}</h2>
      {#if snap?.current}
        <p class="review-panel__title">{snap.current.title} <span class="review-panel__artist">{snap.current.artist}</span></p>
      {/if}
    </div>
    <span class="review-panel__chip"><Icon name="search" />{S.review.chip(check.cardId)}</span>
  </section>

  <div class="review-panel__talk">
    <!-- Parlem's own level in a review is U78 (the engine refuses `hold` in a Check, so a tap does nothing); holding
         it is Pausa, as on the game screen (D135). Drawn unpressed, as on the board. -->
    <TwoLevelButton mode="talk" active={null} enabled={model.controls.hold.enabled} />
  </div>

  <Button {...ACTIONS.reviewContinue} class="review-panel__continue" note={S.review.continueNote(next ? title(next.songId) : null)} disabled={!canEnd} onclick={() => decide('continue')} />

  {#each [{ outcome: 'win', preset: ACTIONS.reviewWin, against: !passes }, { outcome: 'lose', preset: ACTIONS.reviewLose, against: passes }, { outcome: 'discard', preset: ACTIONS.reviewDiscard, against: false }] as const as d (d.outcome)}
    <Button {...d.preset} class="review-panel__decision" data-against={d.against || undefined} disabled={!canEnd} onclick={() => decide(d.outcome)}>
      {#if d.against}<span class="review-panel__against" title={S.review.against}><Icon name="alert" /><span class="visually-hidden">{S.review.against}</span></span>{/if}
    </Button>
  {/each}
</div>

<dialog bind:this={dialog} class="dialog review-confirm" aria-labelledby="{uid}-confirm" onclose={() => (asking = null)}>
  {#if asking}
    <h2 class="review-confirm__title" id="{uid}-confirm">{S.review.confirm.title[asking]}</h2>
    <p class="warning-box"><Icon name="alert" /><span class="warning-box__text">{warning}</span></p>
    <p class="review-confirm__text">{S.review.confirm.text[asking]}</p>
    <div class="review-confirm__actions">
      <Button {...ACTIONS.reviewConfirmBack} onclick={() => dialog?.close()} />
      <Button {...(asking === 'win' ? ACTIONS.reviewConfirmWin : ACTIONS.reviewConfirmLose)} onclick={confirm} />
    </div>
  {/if}
</dialog>
