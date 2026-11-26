<!--
  The presenters' actions, in one cluster that keeps its arrangement in landscape and portrait (the
  Consola-Joc board):
    [ Enrere ][ Comprovar                       ]
    [ Parlem             ][ Aguanta             ]
    [   mantén ‖ Pausa   ][   mantén ◉ Suspens  ]
    [ Següent (full width, the biggest)         ]
  Enrere, a long press, is narrow (a third of its row) with a small "mantén" under its name; Comprovar
  takes the rest. The throw songs (logic/throw-songs.ts; the Consola-Llancament-Tempesta board): «Llançament» takes
  Següent's place before the night and in a break, where Següent isn't used; on the end screen «Tempesta» takes it,
  with a smaller «Llançament» beside it; in the night's last round «Tempesta» joins the top row, between Enrere (which
  doesn't move) and a narrower Comprovar. Parlem and Aguanta are one pair (logic/hold-modes.ts): a tap on the active one releases
  it, a tap on the other switches (`hold { on, duck }`). Each has a second level on a strip along its
  bottom, reached by holding it (TwoLevelButton): Parlem → Pausa (`pause`), Aguanta → Suspens (`suspense`,
  landing when let go). Següent stays at the bottom, under the thumbs.
  While a Wii remote is connected each button shows its Wii button (WiiBadge): 1·2 held on Enrere, −+ and B on
  Parlem and Aguanta (TwoLevelButton), and A on Següent when Següent is the default action (data-default).
  The Desgraciat's finale (logic/finale.ts; the Consola-Desgraciat-Final board): in that round the claim slot is «Final
  a l'escenari» (podium icon), which grows as fewer stand (`data-finale`: the top row widens, Enrere stays small at its
  top) and opens the finalists' pad; once the finale is on it is «+ Finalista». With one finalist left, Següent's place
  is «Celebrem!» (the cue, the default action) until the presenters give it. A stays «Següent» otherwise (D187).
-->
<script lang="ts">
  import { CONSOLE } from '../config.ts';
  import { getConsole } from '../context.ts';
  import { finaleSlot, finaleTabView } from '../logic/finale.ts';
  import { activeHoldMode } from '../logic/hold-modes.ts';
  import { throwLayout } from '../logic/throw-songs.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import LongPressButton from './LongPressButton.svelte';
  import PodiumIcon from './PodiumIcon.svelte';
  import ThrowButton from './ThrowButton.svelte';
  import TwoLevelButton from './TwoLevelButton.svelte';
  import WiiBadge from './WiiBadge.svelte';

  let { onclaim }: { onclaim: () => void } = $props();

  const model = getConsole();
  const c = $derived(model.controls);
  const active = $derived(activeHoldMode(model.show.state));
  const nextIsDefault = $derived(model.defaultAction?.control === 'next');
  const layout = $derived(throwLayout(model.show.flow.scene, model.show.state?.lastRound === true));
  const snap = $derived(model.show.state);
  const slot = $derived(model.show.flow.scene === 'play' ? finaleSlot(snap, CONSOLE.finale.sizes) : null);
  const finale = $derived(snap?.finale ?? null);
  /** One finalist left and no cue yet: Següent's place is «Celebrem!». */
  const cue = $derived(finale?.winner && !finale.cued ? finale.winner.cardId : null);
  const cueIsDefault = $derived(model.defaultAction?.control === 'finaleCue');
  /** The last landing's fallen finalists are on screen: Enrere brings the whole landing back (D183). */
  const backBrings = $derived(snap && finale ? finaleTabView(finale, snap, null, false).fallenShown : false);
</script>

<section class="thumb-cluster" aria-label={S.cluster.label} data-live={c.live} data-top={layout.top ?? undefined} data-beside={layout.beside ?? undefined} data-finale={slot?.kind === 'start' ? slot.size : undefined}>
  <span hidden data-testid="hold" data-mode={active ?? 'none'}></span>
  <div class="thumb-cluster__slot thumb-cluster__slot--back">
    <LongPressButton big action="back" label={S.cluster.back} note={backBrings ? S.finale.backNote : S.cluster.backHint} icon="back" tone="danger" disabled={!c.back.enabled} onconfirm={() => model.act('back')}>
      {#snippet badge()}<WiiBadge button="back" hold size="sm" />{/snippet}
    </LongPressButton>
  </div>

  {#if layout.top}
    <div class="thumb-cluster__slot thumb-cluster__slot--top">
      <ThrowButton song={layout.top} variant="top" />
    </div>
  {/if}

  <div class="thumb-cluster__slot thumb-cluster__slot--claim">
    {#if slot?.kind === 'start'}
      <button
        type="button"
        class="big-button finale-button"
        data-action="claim"
        data-anim="press finale-button"
        data-size={slot.size}
        data-testid="finale-start"
        disabled={!model.can('finale')}
        onclick={() => model.openFinalePad()}
      >
        {#if slot.size === 'large'}<span class="finale-button__tag">{S.finale.recommended}</span>{/if}
        <span class="finale-button__row"><PodiumIcon /><span class="big-button__label">{S.finale.start}</span></span>
        <span class="big-button__note">{slot.size === 'normal' ? S.finale.startNote.normal : S.finale.startNote[slot.size](slot.standing)}</span>
      </button>
    {:else if slot?.kind === 'add'}
      <button type="button" class="big-button finale-button" data-action="claim" data-anim="press" data-size="normal" data-testid="finale-add" disabled={!slot.enabled || !model.can('finale')} onclick={() => model.openFinalePad()}>
        <span class="finale-button__row"><Icon name="plus" outline /><span class="big-button__label">{S.finale.add}</span></span>
        <span class="big-button__note">{S.finale.addNote}</span>
      </button>
    {:else}
      <button type="button" class="big-button" data-action="claim" data-anim="press" disabled={!c.claim.enabled} onclick={onclaim}>
        <Icon name="claim" outline />
        <span class="big-button__text"><span class="big-button__label">{S.cluster.claim}</span></span>
      </button>
    {/if}
  </div>

  {#each ['talk', 'stay'] as const as mode (mode)}
    <div class="thumb-cluster__slot thumb-cluster__slot--{mode}">
      <TwoLevelButton {mode} {active} enabled={c.hold.enabled} />
    </div>
  {/each}

  {#if layout.beside}
    <div class="thumb-cluster__slot thumb-cluster__slot--beside">
      <ThrowButton song={layout.beside} variant="side" />
    </div>
  {/if}

  <div class="thumb-cluster__slot thumb-cluster__slot--next">
    {#if cue !== null && layout.big === 'next'}
      <button type="button" class="big-button finale-cue" data-action="finale-cue" data-anim="press finale-win" data-default={cueIsDefault || undefined} data-testid="finale-cue" disabled={!model.can('finaleCue')} onclick={() => model.act('finaleCue')}>
        <span class="big-button__row"><Icon name="star" outline /><span class="big-button__label">{S.finale.celebrate}</span></span>
        <span class="big-button__note">{S.finale.celebrateNote(cue)}</span>
        {#if cueIsDefault}<WiiBadge button="a" />{/if}
      </button>
    {:else if layout.big === 'next'}
      <button type="button" class="big-button" data-action="next" data-anim="press" data-default={nextIsDefault || undefined} disabled={!c.next.enabled} onclick={() => model.act('next')}>
        <Icon name="next" outline />
        <span class="big-button__text"><span class="big-button__label">{S.cluster.next}</span></span>
        {#if nextIsDefault}<WiiBadge button="a" />{/if}
      </button>
    {:else}
      <ThrowButton song={layout.big} wide={layout.beside === null} />
    {/if}
  </div>
</section>
