<!--
  The Check board, over the whole body under the header (boards Consola-Comprovacio-Ritme, -Casos, -Desgraciada; the
  Review is ReviewPanel, -Revisio). The presenters pace it (D107):
  - left: «Cartrons cantats» with 2 cards or more, then the claimed card, marked in private from the start (CheckCard);
  - right, where the game screen's cluster is, in three rows: «Enrere» (one mark off, D127/D134; 1 or 2 pressed once)
    and «Revisió manual» (−/+ held); «+ Candidat» (the claim pad) and «Seguides» (reveal in a row, D117); and the big
    button: «Destapa» with the next song inside it, «Destapant…», then the cue «Celebrem!», «Vàlid · següent» or
    «Fallada», or the shared Celebration's «Celebrem!» (`celebrationNext`). The big button is the default action (A, →
    or PageDown; hook check-pace). Its strip says that holding A reveals in a row.
  Hooks for the end-to-end tests: data-testid="check-board" with data-stage, data-revealed and data-cue.
-->
<script lang="ts">
  import { getConsole, getWii } from '../context.ts';
  import {
    batchWinners,
    canToggleAuto,
    checkBackCommand,
    checkPress,
    checkReviewCommand,
    checkState,
    claimOf,
    nextReveal,
    replayedAfterBack,
  } from '../logic/check.ts';
  import { summarizeClaims } from '../logic/claims.ts';
  import { songTitleOf } from '../logic/show-data.ts';
  import { S } from '../strings.ts';
  import CheckCard from './CheckCard.svelte';
  import ClaimsStrip from './ClaimsStrip.svelte';
  import Cover from './Cover.svelte';
  import Icon from './Icon.svelte';
  import ReviewPanel from './ReviewPanel.svelte';
  import WiiBadge from './WiiBadge.svelte';

  let { onclaim }: { onclaim: () => void } = $props();

  const model = getConsole();
  const wii = getWii();
  const snap = $derived(model.show.state);
  const flow = $derived(model.show.flow);
  const check = $derived(flow.check);
  const claim = $derived(claimOf(flow, check));
  const state = $derived(checkState(flow));
  const press = $derived(checkPress(flow));
  const back = $derived(checkBackCommand(check));
  const review = $derived(checkReviewCommand(check));
  const claims = $derived(summarizeClaims(flow.claims, check));
  const showClaims = $derived(claims.items.length >= 2 || (check === null && claims.items.length > 0));
  const startable = $derived(check === null || check.cue !== null);
  const of = $derived.by(() => {
    const at = claims.items.findIndex((c) => c.current);
    return claims.items.length >= 2 && at >= 0 ? { n: at + 1, total: claims.items.length } : null;
  });
  const next = $derived(check ? nextReveal(check, claim) : null);
  const isDefault = $derived(model.defaultAction?.control === 'check');
  const song = (songId: number) => ({ title: songTitleOf(songId, snap, model.catalog) ?? `Cançó ${songId}`, artist: model.catalog?.songs.get(songId)?.artist ?? '' });
  const title = (songId: number) => song(songId).title;
  const winners = $derived(batchWinners(flow));
  /** «Enrere: torna a sonar…», right after a step back on this card (until the next reveal). */
  const backNotice = $derived.by(() => {
    const b = model.stepBack;
    if (!check || !b || b.claimId !== check.claimId || check.revealed.length !== b.index) return null;
    const replayed = replayedAfterBack(check, claim, b.index);
    return S.check.backDone(replayed === null ? null : title(replayed), b.autoWasOn);
  });

  /** The big button's look and words, from the Check's stage. */
  const big = $derived.by(() => {
    const B = S.check.big;
    switch (state?.stage) {
      case 'reveal':
        return { tone: 'reveal', icon: 'eye', label: B.reveal, note: B.revealNote, strip: true } as const;
      case 'auto':
        return { tone: 'revealing', icon: 'seguides', label: B.revealing, note: wii.badges ? B.revealingHeld : B.revealingNote, strip: true } as const;
      case 'cue':
        if (!state.pass) return { tone: 'fail', icon: 'cross', label: B.fail, note: B.failNote, strip: false } as const;
        return state.more
          ? ({ tone: 'valid', icon: 'check', label: B.validNext, note: B.validNextNote, strip: false } as const)
          : ({ tone: 'celebrate', icon: 'star', label: B.celebrate, note: B.celebrateNote, strip: false } as const);
      case 'celebrateNext':
        return { tone: 'celebrate', icon: 'star', label: B.celebrate, note: B.celebrateFor(winners), strip: false } as const;
      case 'cued':
        return { tone: state.pass ? 'valid' : 'fail', icon: state.pass ? 'check' : 'cross', label: state.pass ? B.cuedPass : B.cuedFail, note: B.cuedNote, strip: false } as const;
      default:
        return null;
    }
  });

  const autoOn = $derived(check?.auto ?? false);
  const autoNote = $derived(
    !check || check.total === 0 ? S.check.auto.none : state?.stage === 'cue' ? S.check.auto.cue : autoOn ? S.check.auto.on : S.check.auto.off,
  );

  function go(): void {
    const p = press;
    if (!p) return;
    if (p.cmd === 'checkNext') model.act('checkNext', p.args);
    else model.act('checkAuto', p.args);
  }
</script>

<div
  class="check-board"
  data-testid="check-board"
  data-stage={state?.stage ?? 'none'}
  data-revealed={check?.revealed.length ?? 0}
  data-cue={check?.cue ?? undefined}
  data-card-id={check?.cardId ?? undefined}
>
  <div class="check-board__left">
    {#if showClaims}<ClaimsStrip items={claims.items} {startable} />{/if}
    {#if check}
      <CheckCard {check} {claim} {of} />
    {:else}
      <section class="panel check-card check-card--none"><p class="note">{S.check.none}</p></section>
    {/if}
  </div>

  {#if check && state?.stage === 'review'}
    <ReviewPanel {check} {claim} />
  {:else}
    <div class="check-board__right" data-stage={state?.stage ?? 'none'}>
      <button type="button" class="big-button check-board__back" data-action="check-back" data-anim="press" disabled={!back || !model.can('checkBack')} onclick={() => back && model.act('checkBack', back)}>
        <span class="big-button__row"><Icon name="back" outline /><span class="big-button__label">{S.check.back}</span></span>
        <span class="big-button__note">{S.check.backNote}</span>
        <WiiBadge button="back" size="sm" />
      </button>
      <button type="button" class="big-button check-board__review" data-action="review" data-anim="press" disabled={!review || !model.can('checkReview')} onclick={() => review && model.act('checkReview', review)}>
        <span class="big-button__label">{S.check.review}</span>
        <span class="big-button__note">{S.check.reviewNote}</span>
        <WiiBadge button="talk" hold size="sm" />
      </button>
      <button type="button" class="big-button check-board__add" data-action="add" data-anim="press" disabled={!model.can('claim')} onclick={onclaim}>
        <span class="big-button__row"><Icon name="plus" outline /><span class="big-button__label">{S.check.add}</span></span>
      </button>
      <button
        type="button"
        class="big-button check-board__auto"
        data-action="auto"
        data-anim="press"
        aria-pressed={autoOn}
        disabled={!canToggleAuto(check) || !model.can('checkAuto')}
        onclick={() => model.act('checkAuto', { on: !autoOn })}
      >
        <Icon name="seguides" outline />
        <span class="big-button__label">{S.check.auto.label}</span>
        <span class="big-button__note">{autoNote}</span>
        <span class="check-board__switch" aria-hidden="true"><span class="check-board__track"><span class="check-board__thumb"></span></span>{autoOn ? S.check.auto.yes : S.check.auto.no}</span>
      </button>

      {#if big}
        <button
          type="button"
          class="big-button check-board__go"
          data-action="check-{big.tone}"
          data-anim="press check-pace"
          data-default={isDefault || undefined}
          disabled={!press || !model.can(press.cmd)}
          onclick={go}
        >
          <span class="big-button__row"><Icon name={big.icon} outline /><span class="big-button__label">{big.label}</span></span>
          {#if big.strip && next}
            {#key next.songId}
              <span class="check-board__song" data-anim="check-pace" aria-label={S.check.nextLabel(song(next.songId).title, next.at, next.of)}>
                <Cover songId={next.songId} size="md" />
                <span class="check-board__song-text" aria-hidden="true">
                  <span class="check-board__song-title">{song(next.songId).title}</span>
                  <span class="check-board__song-artist">{S.check.nextLine(song(next.songId).artist, next.at, next.of)}</span>
                </span>
              </span>
            {/key}
          {:else}
            <span class="big-button__note">{big.note}</span>
          {/if}
          {#if backNotice}<span class="check-board__notice" role="status">{backNotice}</span>{/if}
          {#if isDefault}<WiiBadge button="a" />{/if}
          {#if big.strip}
            <span class="check-board__strip"><Icon name="seguides" /><span>{S.check.big.strip}</span><WiiBadge button="a" hold place="strip" size="sm" /></span>
          {/if}
        </button>
      {/if}
    </div>
  {/if}
</div>
