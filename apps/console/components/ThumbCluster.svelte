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
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { activeHoldMode } from '../logic/hold-modes.ts';
  import { throwLayout } from '../logic/throw-songs.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import LongPressButton from './LongPressButton.svelte';
  import ThrowButton from './ThrowButton.svelte';
  import TwoLevelButton from './TwoLevelButton.svelte';
  import WiiBadge from './WiiBadge.svelte';

  let { onclaim }: { onclaim: () => void } = $props();

  const model = getConsole();
  const c = $derived(model.controls);
  const active = $derived(activeHoldMode(model.show.state));
  const nextIsDefault = $derived(model.defaultAction?.control === 'next');
  const layout = $derived(throwLayout(model.show.flow.scene, model.show.state?.lastRound === true));
</script>

<section class="thumb-cluster" aria-label={S.cluster.label} data-live={c.live} data-top={layout.top ?? undefined} data-beside={layout.beside ?? undefined}>
  <span hidden data-testid="hold" data-mode={active ?? 'none'}></span>
  <div class="thumb-cluster__slot thumb-cluster__slot--back">
    <LongPressButton big action="back" label={S.cluster.back} note={S.cluster.backHint} icon="back" tone="danger" disabled={!c.back.enabled} onconfirm={() => model.act('back')}>
      {#snippet badge()}<WiiBadge button="back" hold size="sm" />{/snippet}
    </LongPressButton>
  </div>

  {#if layout.top}
    <div class="thumb-cluster__slot thumb-cluster__slot--top">
      <ThrowButton song={layout.top} variant="top" />
    </div>
  {/if}

  <div class="thumb-cluster__slot thumb-cluster__slot--claim">
    <button type="button" class="big-button" data-action="claim" data-anim="press" disabled={!c.claim.enabled} onclick={onclaim}>
      <Icon name="claim" outline />
      <span class="big-button__text"><span class="big-button__label">{S.cluster.claim}</span></span>
    </button>
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
    {#if layout.big === 'next'}
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
