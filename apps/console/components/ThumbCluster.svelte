<!--
  The presenters' actions, in one cluster that keeps its arrangement in landscape and portrait (the
  Consola-Joc board):
    [ Enrere ][ Comprovar                       ]
    [ Parlem             ][ Aguanta             ]
    [   mantén ‖ Pausa   ][   mantén ◉ Suspens  ]
    [ Següent (full width, the biggest)         ]
  Enrere, a long press, is narrow (a third of its row) with a small "mantén" under its name; Comprovar
  takes the rest. Parlem and Aguanta are one pair (logic/hold-modes.ts): a tap on the active one releases
  it, a tap on the other switches (`hold { on, duck }`). Each has a second level on a strip along its
  bottom, reached by holding it (TwoLevelButton): Parlem → Pausa (`pause`), Aguanta → Suspens (`suspense`,
  landing when let go). Següent stays at the bottom, under the thumbs.
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { activeHoldMode } from '../logic/hold-modes.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import LongPressButton from './LongPressButton.svelte';
  import TwoLevelButton from './TwoLevelButton.svelte';

  let { onclaim }: { onclaim: () => void } = $props();

  const model = getConsole();
  const c = $derived(model.controls);
  const active = $derived(activeHoldMode(model.show.state));
</script>

<section class="thumb-cluster" aria-label={S.cluster.label} data-live={c.live}>
  <span hidden data-testid="hold" data-mode={active ?? 'none'}></span>
  <div class="thumb-cluster__slot thumb-cluster__slot--back">
    <LongPressButton big action="back" label={S.cluster.back} note={S.cluster.backHint} icon="back" tone="danger" disabled={!c.back.enabled} onconfirm={() => model.act('back')} />
  </div>

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

  <div class="thumb-cluster__slot thumb-cluster__slot--next">
    <button type="button" class="big-button" data-action="next" data-anim="press" disabled={!c.next.enabled} onclick={() => model.act('next')}>
      <Icon name="next" outline />
      <span class="big-button__text"><span class="big-button__label">{S.cluster.next}</span></span>
    </button>
  </div>
</section>
