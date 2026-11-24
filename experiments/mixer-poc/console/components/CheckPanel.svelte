<!--
  During a Claim and its Check: the Check song by song (hook check-step), the result once it is due, the
  verdict, the queue of claimed cards, the Celebration music and the winner's name and notes.
  The verdict that agrees with the Check is a tap; the one that goes against it needs a long press.
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { checkProgress, suggestedVerdict } from '../logic/check.ts';
  import { summarizeClaims } from '../logic/claims.ts';
  import { defaultClaimKind, songTitleOf } from '../logic/show-data.ts';
  import { CA, S } from '../strings.ts';
  import CelebrationMusic from './CelebrationMusic.svelte';
  import ClaimsQueue from './ClaimsQueue.svelte';
  import Icon from './Icon.svelte';
  import LongPressButton from './LongPressButton.svelte';
  import WinnerForm from './WinnerForm.svelte';

  let { onclaim }: { onclaim: () => void } = $props();

  const model = getConsole();
  const snap = $derived(model.show.state);
  const flow = $derived(model.show.flow);
  const check = $derived(flow.check);
  const progress = $derived(check ? checkProgress(check, model.show.now) : null);
  const claims = $derived(summarizeClaims(flow.claims, check));
  const current = $derived(claims.items.find((c) => c.current) ?? null);
  const valid = $derived(check ? suggestedVerdict(check.outcome) : false);
  const canDecide = $derived(progress?.stage === 'result' && current !== null && !current.decided && model.can('decide'));
  const winner = $derived(check ? (flow.winners.find((w) => w.claimId === check.claimId) ?? null) : null);
  const title = (songId: number) => songTitleOf(songId, snap, model.catalog) ?? String(songId);

  function decide(verdict: boolean): void {
    if (check) model.act('decide', { claimId: check.claimId, valid: verdict });
  }
</script>

<section class="panel check-panel" data-stage={progress?.stage ?? 'none'} aria-labelledby="check-title">
  <h2 class="panel__title" id="check-title">{check ? S.check.title(check.cardId) : S.check.none}</h2>

  {#if check && progress}
    <p class="check-panel__what">
      {S.check.kind[check.kind]} · {check.row === null ? S.check.allSongs : S.check.row(check.row)}
      {#if progress.total}· <span class="check-panel__count">{S.check.progress(progress.doneCount, progress.total)}</span>{/if}
    </p>

    {#if progress.total}
      <ol class="check-steps">
        {#each progress.steps as step (step.index)}
          <li class="check-steps__item" data-state={step.state} data-landed={step.landed === null ? undefined : String(step.landed)} data-anim="check-step" aria-current={step.state === 'playing' ? 'step' : undefined}>
            <span class="check-steps__number">{step.index + 1}.</span>
            <span class="check-steps__song">{title(step.songId)}</span>
            <span class="check-steps__mark">
              {#if step.landed === true}<Icon name="check" /><span>{S.check.landed}</span>
              {:else if step.landed === false}<Icon name="cross" /><span>{S.check.notLanded}</span>
              {:else if step.state === 'playing'}<Icon name="music" /><span>{S.check.playing}</span>
              {:else}<span>{S.check.pending}</span>{/if}
            </span>
          </li>
        {/each}
      </ol>
    {/if}

    {#if progress.stage === 'waiting'}<p class="note">{S.check.waiting}</p>{/if}

    {#if progress.stage === 'result'}
      <div class="check-result" data-outcome={check.outcome} role="status">
        <p class="check-result__title">{valid ? S.check.resultValid : S.check.resultInvalid}</p>
        <p class="check-result__outcome">{S.check.outcome[check.outcome]}</p>
        {#if check.otherRows.length}<p>{S.check.otherRows(check.otherRows)}</p>{/if}
        {#if current?.completeSinceSong}<p>{S.check.completeSince(current.completeSinceSong)}</p>{/if}
        {#if current?.notSold}<p><span class="badge badge--warning">{S.check.notSold}</span></p>{/if}
      </div>
    {:else}
      <p class="note">{S.check.decideAfterResult}</p>
    {/if}

    <div class="check-panel__decide">
      {#if valid}
        <button type="button" class="action action--big tone-ok" data-anim="press" disabled={!canDecide} onclick={() => decide(true)}>
          <Icon name="check" /><span>{S.check.confirm}</span>
        </button>
        <LongPressButton label={S.check.reject} note={S.check.againstResult} icon="cross" tone="danger" disabled={!canDecide} onconfirm={() => decide(false)} />
      {:else}
        <button type="button" class="action action--big tone-danger" data-anim="press" disabled={!canDecide} onclick={() => decide(false)}>
          <Icon name="cross" /><span>{S.check.reject}</span>
        </button>
        <LongPressButton label={S.check.confirm} note={S.check.againstResult} icon="check" tone="ok" disabled={!canDecide} onconfirm={() => decide(true)} />
      {/if}
      <button type="button" class="action" data-anim="press" disabled={!model.can('checkStart') || current?.decided !== false} onclick={() => model.act('checkStart', { claimId: check.claimId })}>
        <Icon name="back" /><span>{S.check.recheck}</span>
      </button>
    </div>
  {/if}

  {#if claims.items.length}<ClaimsQueue items={claims.items} hideCurrent={progress?.stage !== 'result'} />{/if}

  <button type="button" class="action" data-anim="press" disabled={!model.can('claim')} onclick={onclaim}>
    <Icon name="plus" /><span>{S.check.addClaim}</span>
  </button>

  <CelebrationMusic kind={check?.kind ?? current?.kind ?? defaultClaimKind(snap)} current={null} />

  {#if check}
    <WinnerForm claimId={check.claimId} name={winner?.name ?? null} notes={winner?.notes ?? null} title={CA.card(check.cardId)} />
  {/if}
</section>
