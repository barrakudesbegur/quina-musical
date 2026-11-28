<!--
  The presenters' actions, in one cluster that keeps its arrangement in landscape and portrait (the
  Consola-Joc board):
    [ Enrere ][ Comprovar                       ]
    [ Parlem             ][ Aguanta             ]
    [   mantén ‖ Pausa   ][   mantén ◉ Suspens  ]
    [ Següent (full width, the biggest)         ]
  Enrere, a long press, is narrow (a third of its row) with a small "mantén" under its name; Comprovar
  takes the rest. Where the buttons are changes with the scene (logic/cluster-layout.ts; the Consola-Llancament-Tempesta
  board): in a break (D195) «Comença la quina» is the big button (A's default) and «Llançament» a slim line along the
  top, with no Enrere or Comprovar (neither can act there); on the end screen «Tempesta» alone takes the big place under
  Parlem and Aguanta (D194, D199); before the night «Llançament» takes Següent's place (the doors wait for U173); in
  the night's last round «Tempesta» joins the top row, between Enrere (which doesn't move) and a narrower Comprovar.
  The throw songs' taps are logic/throw-songs.ts. Parlem and Aguanta are one pair (logic/hold-modes.ts): a tap on the active one releases
  it, a tap on the other switches (`hold { on, duck }`). Each has a second level on a strip along its
  bottom, reached by holding it (HoldModeButton, on the generic TwoLevelButton): Parlem → Pausa (`pause`), Aguanta → Suspens (`suspense`,
  landing when let go). Següent stays at the bottom, under the thumbs.
  While a Wii remote is connected each button shows its Wii button (WiiBadge): 1·2 held on Enrere, −+ and B on
  Parlem and Aguanta (their presets), and A on Següent or «Comença la quina» when it's the default action (data-default).
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
  import { clusterLayout } from '../logic/cluster-layout.ts';
  import { roundIntroArgs } from '../logic/show-data.ts';
  import { S } from '../strings.ts';
  import { ACTIONS, asDefault } from '../actions.ts';
  import Button from '../../../packages/ui/components/Button.svelte';
  import LongPressButton from '../../../packages/ui/components/LongPressButton.svelte';
  import PodiumIcon from './PodiumIcon.svelte';
  import ThrowButton from './ThrowButton.svelte';
  import HoldModeButton from './HoldModeButton.svelte';

  let { onclaim }: { onclaim: () => void } = $props();

  const model = getConsole();
  const c = $derived(model.controls);
  const active = $derived(activeHoldMode(model.show.state));
  const nextIsDefault = $derived(model.defaultAction?.control === 'next');
  const layout = $derived(clusterLayout(model.show.flow.scene, model.show.state?.lastRound === true));
  /** The layout's name for console.css: a break's (D195) and the end's (D194, D199) have no Enrere or Comprovar. */
  const shape = $derived(layout.backAndClaim ? undefined : layout.line ? 'break' : 'end');
  const interval = $derived(model.show.flow.interval);
  const introIsDefault = $derived(model.defaultAction?.control === 'roundIntro');
  const snap = $derived(model.show.state);
  const slot = $derived(model.show.flow.scene === 'play' ? finaleSlot(snap, CONSOLE.finale.sizes) : null);
  const finale = $derived(snap?.finale ?? null);
  /** One finalist left and no cue yet: Següent's place is «Celebrem!». */
  const cue = $derived(finale?.winner && !finale.cued ? finale.winner.cardId : null);
  const cueIsDefault = $derived(model.defaultAction?.control === 'finaleCue');
  /** The last landing's fallen finalists are on screen: Enrere brings the whole landing back (D183). */
  const backBrings = $derived(snap && finale ? finaleTabView(finale, snap, null, false).fallenShown : false);
</script>

<section class="thumb-cluster" aria-label={S.cluster.label} data-live={c.live} data-layout={shape} data-top={layout.top ?? undefined} data-finale={slot?.kind === 'start' ? slot.size : undefined}>
  <span hidden data-testid="hold" data-mode={active ?? 'none'}></span>
  {#if layout.line}
    <div class="thumb-cluster__slot thumb-cluster__slot--line">
      <ThrowButton song={layout.line} variant="line" />
    </div>
  {/if}

  {#if layout.backAndClaim}
  <div class="thumb-cluster__slot thumb-cluster__slot--back">
    <LongPressButton {...ACTIONS.back} note={backBrings ? S.finale.backNote : ACTIONS.back.note} disabled={!c.back.enabled} onconfirm={() => model.act('back')} />
  </div>
  {/if}

  {#if layout.top}
    <div class="thumb-cluster__slot thumb-cluster__slot--top">
      <ThrowButton song={layout.top} variant="top" />
    </div>
  {/if}

  {#if layout.backAndClaim}
  <!-- «Final a l'escenari» at its largest is ringed in gold (R1: the ring is the slot's, round the whole button). -->
  <div class="thumb-cluster__slot thumb-cluster__slot--claim" data-ring={slot?.kind === 'start' && slot.size === 'large' ? 'gold' : undefined}>
    {#if slot?.kind === 'start'}
      <button
        type="button"
        class="big-button finale-button"
        data-color={ACTIONS.claim.color}
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
      <Button {...ACTIONS.finaleAdd} data-testid="finale-add" disabled={!slot.enabled || !model.can('finale')} onclick={() => model.openFinalePad()} />
    {:else}
      <Button {...ACTIONS.claim} disabled={!c.claim.enabled} onclick={onclaim} />
    {/if}
  </div>
  {/if}

  {#each ['talk', 'stay'] as const as mode (mode)}
    <div class="thumb-cluster__slot thumb-cluster__slot--{mode}">
      <HoldModeButton {mode} {active} enabled={mode === 'stay' ? c.stay.enabled : c.hold.enabled} />
    </div>
  {/each}

  <div class="thumb-cluster__slot thumb-cluster__slot--next">
    {#if cue !== null && layout.big === 'next'}
      <Button
        {...asDefault(ACTIONS.finaleCue, cueIsDefault)}
        class="finale-cue"
        note={S.finale.celebrateNote(cue)}
        data-anim="finale-win"
        data-testid="finale-cue"
        disabled={!model.can('finaleCue')}
        onclick={() => model.act('finaleCue')}
      />
    {:else if layout.big === 'next'}
      <Button {...asDefault(ACTIONS.next, nextIsDefault)} disabled={!c.next.enabled} onclick={() => model.act('next')} />
    {:else if layout.big === 'roundIntro'}
      <Button
        {...asDefault(ACTIONS.roundIntro, introIsDefault)}
        class="thumb-cluster__intro"
        disabled={!interval || !model.can('roundIntro')}
        onclick={() => interval && model.act('roundIntro', roundIntroArgs(model.plan, interval.nextRound))}
      />
    {:else}
      <ThrowButton song={layout.big} />
    {/if}
  </div>
</section>
