<!--
  The Check board, over the whole body under the header (boards Consola-Comprovacio-Ritme, -Casos, -Desgraciat; the
  Review is ReviewPanel, -Revisio). The presenters pace it (D107):
  - left: «Ara sona» in one line (NowLine: the music from before the Check, far down; D196, D199), «Cartrons cantats»
    with 2 cards or more, then the claimed card, marked in private from the start (CheckCard);
  - right, where the game screen's cluster is, in three rows: «Enrere» (one mark off, D127/D134; 1 or 2 pressed once)
    and «Revisió manual» (−/+ held); «+ Candidat» (the claim pad) and «Seguides» (reveal in a row, D117); and the big
    button: «Destapa» with the next song inside it, «Destapant…», then the cue «Celebrem!», «Vàlid · següent» or
    «Fallada», or the shared Celebration's «Celebrem!» (`celebrationNext`). The big button is the default action (A, →
    or PageDown; hook check-pace). Its strip says that holding A reveals in a row. In the night's last round «Tempesta»
    (the corn-seed storm, D155) sits in the top row between «Enrere» and «Revisió manual», far from the big button.
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
    stepBackOnScreen,
  } from '../logic/check.ts';
  import { summarizeClaims } from '../logic/claims.ts';
  import { songTitleOf } from '../logic/show-data.ts';
  import { S } from '../strings.ts';
  import CheckCard from './CheckCard.svelte';
  import ClaimsStrip from './ClaimsStrip.svelte';
  import Cover from './Cover.svelte';
  import Icon from './Icon.svelte';
  import Button from '../../../packages/ui/components/Button.svelte';
  import Switch from '../../../packages/ui/components/Switch.svelte';
  import { ACTIONS, asDefault } from '../actions.ts';
  import NowLine from './NowLine.svelte';
  import ReviewPanel from './ReviewPanel.svelte';
  import ThrowButton from './ThrowButton.svelte';
  import WiiBadge from './WiiBadge.svelte';
  import { clusterLayout } from '../logic/cluster-layout.ts';

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
  const storm = $derived(clusterLayout(flow.scene, snap?.lastRound === true).top);
  const song = (songId: number) => ({ title: songTitleOf(songId, snap, model.catalog) ?? `Cançó ${songId}`, artist: model.catalog?.songs.get(songId)?.artist ?? '' });
  const title = (songId: number) => song(songId).title;
  const winners = $derived(batchWinners(flow));
  /** «Enrere: torna a sonar…», right after a step back on this card (until the next reveal). */
  const backNotice = $derived.by(() => {
    const b = model.stepBack;
    if (!check || !b || !stepBackOnScreen(check, b)) return null;
    const replayed = replayedAfterBack(check, claim, b.index);
    return S.check.backDone(replayed === null ? null : title(replayed), b.autoWasOn);
  });

  /** The big button's preset (actions.ts) and words, from the Check's stage. */
  const big = $derived.by(() => {
    const B = S.check.big;
    switch (state?.stage) {
      case 'reveal':
        return { ...ACTIONS.checkReveal, strip: true, busy: false } as const;
      case 'auto':
        return { ...ACTIONS.checkRevealing, note: wii.badges ? B.revealingHeld : B.revealingNote, strip: true, busy: true } as const;
      case 'cue':
        if (!state.pass) return { ...ACTIONS.checkFail, strip: false, busy: false } as const;
        return state.more ? ({ ...ACTIONS.checkValid, strip: false, busy: false } as const) : ({ ...ACTIONS.checkCelebrate, strip: false, busy: false } as const);
      case 'celebrateNext':
        return { ...ACTIONS.checkCelebrate, note: B.celebrateFor(winners), strip: false, busy: false } as const;
      case 'cued':
        return state.pass
          ? ({ ...ACTIONS.checkValid, label: B.cuedPass, note: B.cuedNote, strip: false, busy: false } as const)
          : ({ ...ACTIONS.checkFail, label: B.cuedFail, note: B.cuedNote, strip: false, busy: false } as const);
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
    <NowLine />
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
    <div class="check-board__right" data-stage={state?.stage ?? 'none'} data-top={storm ?? undefined}>
      <Button {...ACTIONS.checkBack} class="check-board__back" disabled={!back || !model.can('checkBack')} onclick={() => back && model.act('checkBack', back)} />
      {#if storm}<div class="check-board__storm"><ThrowButton song={storm} variant="top" /></div>{/if}
      <Button {...ACTIONS.checkReview} class="check-board__review" disabled={!review || !model.can('checkReview')} onclick={() => review && model.act('checkReview', review)} />
      <Button {...ACTIONS.addCandidate} class="check-board__add" disabled={!model.can('claim')} onclick={onclaim} />
      <Button
        {...ACTIONS.checkAuto}
        class="check-board__auto"
        note={autoNote}
        pressed={autoOn}
        disabled={!canToggleAuto(check) || !model.can('checkAuto')}
        onclick={() => model.act('checkAuto', { on: !autoOn })}
      >
        <span class="check-board__switch"><Switch layout="embedded" checked={autoOn} label={S.check.auto.label} onText={S.check.auto.yes} offText={S.check.auto.no} /></span>
      </Button>

      {#if big}
        {@const look = asDefault(big, isDefault)}
        <Button
          {...look}
          class="check-board__go"
          note={big.strip && next ? null : big.note}
          busy={big.busy}
          data-anim="check-pace"
          data-strip={big.strip || undefined}
          disabled={!press || !model.can(press.cmd)}
          onclick={go}
        >
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
          {/if}
          {#if backNotice}<span class="check-board__notice" role="status">{backNotice}</span>{/if}
          {#if big.strip}
            <span class="check-board__strip"><Icon name="seguides" /><span>{S.check.big.strip}</span><WiiBadge button="a" hold place="strip" size="sm" /></span>
          {/if}
        </Button>
      {/if}
    </div>
  {/if}
</div>
