<!--
  During a Claim and its Check, the whole body (Consola-Comprovacio board), in three columns that stack on a
  phone:
  - the claimed cards, "Un altre cartró", and Back (long press, still allowed in a Check);
  - the Check song by song (hook check-step), the result once it is due, and the re-check;
  - the verdict: the one that agrees with the Check is a tap, the one against it a long press; then the
    Celebration music and the winner's name and notes. Once the result is due, the tap is the default action
    (data-default, and the Wii's A while a remote is connected).
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { checkProgress, missingSongs, suggestedVerdict } from '../logic/check.ts';
  import { summarizeClaims } from '../logic/claims.ts';
  import { defaultClaimKind, songTitleOf } from '../logic/show-data.ts';
  import { CA, S } from '../strings.ts';
  import CelebrationMusic from './CelebrationMusic.svelte';
  import ClaimsQueue from './ClaimsQueue.svelte';
  import Cover from './Cover.svelte';
  import Icon from './Icon.svelte';
  import LongPressButton from './LongPressButton.svelte';
  import WiiBadge from './WiiBadge.svelte';
  import WinnerForm from './WinnerForm.svelte';

  let { onclaim }: { onclaim: () => void } = $props();

  const model = getConsole();
  const uid = $props.id();
  const snap = $derived(model.show.state);
  const flow = $derived(model.show.flow);
  const check = $derived(flow.check);
  const progress = $derived(check ? checkProgress(check, model.show.now) : null);
  const claims = $derived(summarizeClaims(flow.claims, check));
  const current = $derived(claims.items.find((c) => c.current) ?? null);
  const kind = $derived(check?.kind ?? current?.kind ?? defaultClaimKind(snap));
  const valid = $derived(check ? suggestedVerdict(check.outcome) : false);
  const canDecide = $derived(progress?.stage === 'result' && current !== null && !current.decided && model.can('decide'));
  const defaultControl = $derived(model.defaultAction?.control ?? null);
  const winner = $derived(check ? (flow.winners.find((w) => w.claimId === check.claimId) ?? null) : null);
  const title = (songId: number) => songTitleOf(songId, snap, model.catalog) ?? String(songId);
  const result = $derived.by(() => {
    if (!check) return '';
    if (check.outcome === 'complete') return S.check.resultComplete(check.kind);
    if (check.outcome === 'incomplete') return S.check.resultMissing(missingSongs(check).map(title), check.kind);
    return S.check.outcome[check.outcome];
  });
  const VERDICTS = [
    { valid: false, label: S.check.reject, note: S.check.rejectNote, icon: 'cross' },
    { valid: true, label: S.check.confirm, note: S.check.confirmNote, icon: 'check' },
  ] as const;

  function decide(verdict: boolean): void {
    if (check) model.act('decide', { claimId: check.claimId, valid: verdict });
  }
</script>

<div class="check-board" data-stage={progress?.stage ?? 'none'}>
  <section class="panel check-board__claims" aria-labelledby="{uid}-claims">
    <h2 class="panel__label" id="{uid}-claims">{S.check.claimsOf(kind)}</h2>
    {#if claims.items.length}<ClaimsQueue items={claims.items} hideCurrent={progress?.stage !== 'result'} />{/if}
    <span class="check-board__spacer"></span>
    <button type="button" class="mini check-board__add" data-anim="press" disabled={!model.can('claim')} onclick={onclaim}>
      <Icon name="plus" /><span>{S.check.addClaim}</span>
    </button>
    <LongPressButton label={S.cluster.back} note={S.cluster.backHint} icon="back" tone="danger" disabled={!model.controls.back.enabled} onconfirm={() => model.act('back')}>
      {#snippet badge()}<WiiBadge button="back" hold size="sm" />{/snippet}
    </LongPressButton>
  </section>

  <section class="panel check-board__steps" aria-labelledby="{uid}-steps">
    <h2 class="panel__label" id="{uid}-steps">
      {#if check}
        <span class="visually-hidden">{S.check.title(check.cardId)} </span>{S.check.steps(check.cardId, check.row === null ? S.check.allSongsShort : S.check.rowShort(check.row))}
      {:else}
        {S.check.none}
      {/if}
    </h2>

    {#if check && progress}
      {#if progress.total}
        <ol class="check-steps" aria-label={S.check.progress(progress.doneCount, progress.total)}>
          {#each progress.steps as step (step.index)}
            <li class="check-steps__item" data-state={step.state} data-landed={step.landed === null ? undefined : String(step.landed)} data-anim="check-step" aria-current={step.state === 'playing' ? 'step' : undefined}>
              <Cover songId={step.songId} size="sm" />
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
        <div class="check-result" data-testid="check-result" data-outcome={check.outcome} role="status">
          <p class="check-result__title">{result}</p>
          {#if check.otherRows.length}<p>{S.check.otherRows(check.otherRows)}</p>{/if}
          {#if current?.completeSinceSong}<p>{S.check.completeSince(current.completeSinceSong)}</p>{/if}
          {#if current?.notSold}<p class="check-result__warning"><Icon name="alert" />{S.check.notSold}</p>{/if}
        </div>
      {/if}

      <span class="check-board__spacer"></span>
      <button type="button" class="mini check-board__recheck" data-anim="press" disabled={!model.can('checkStart') || current?.decided !== false} onclick={() => model.act('checkStart', { claimId: check.claimId })}>
        <Icon name="reload" /><span>{S.check.recheck}</span>
      </button>
    {/if}
  </section>

  <section class="check-board__decide" aria-label={S.check.decide}>
    {#if check}
      {#each VERDICTS as v (v.valid)}
        {#if v.valid === valid}
          {@const isDefault = defaultControl === (v.valid ? 'confirm' : 'reject')}
          <button type="button" class="big-button" data-action={v.valid ? 'confirm' : 'reject'} data-anim="press" data-default={isDefault || undefined} disabled={!canDecide} onclick={() => decide(v.valid)}>
            <Icon name={v.icon} outline />
            <span class="big-button__text">
              <span class="big-button__label">{v.label}</span>
              <span class="big-button__note">{v.note}</span>
            </span>
            {#if isDefault}<WiiBadge button="a" />{/if}
          </button>
        {:else}
          <LongPressButton big action={v.valid ? 'confirm' : 'reject'} label={v.label} note={S.check.againstResult} icon={v.icon} disabled={!canDecide} onconfirm={() => decide(v.valid)} />
        {/if}
      {/each}
      {#if progress?.stage !== 'result'}<p class="note">{S.check.decideAfterResult}</p>{/if}
    {/if}

    <div class="panel check-board__after">
      <CelebrationMusic {kind} current={snap?.celebrationChoice ?? null} />
      {#if check}
        <WinnerForm claimId={check.claimId} name={winner?.name ?? null} notes={winner?.notes ?? null} title={CA.card(check.cardId)} />
      {/if}
    </div>
  </section>
</div>
