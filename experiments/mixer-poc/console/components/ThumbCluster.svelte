<!--
  The big buttons, in one bottom-right cluster that keeps the same arrangement in landscape and portrait:
    [ Back (long press, full width)  ]
    [ Suspense        ][ Claim       ]
    [ Hold / Resume   ][ Next        ]
  Next sits in the corner under the right thumb; Back, the risky one, is furthest away.
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import LongPressButton from './LongPressButton.svelte';
  import SuspenseButton from './SuspenseButton.svelte';

  let { onclaim }: { onclaim: () => void } = $props();

  const model = getConsole();
  const c = $derived(model.controls);
</script>

<section class="thumb-cluster" aria-label={S.cluster.label} data-live={c.live}>
  <div class="thumb-cluster__slot thumb-cluster__slot--back">
    <LongPressButton big label={S.cluster.back} note={S.cluster.backHint} icon="back" tone="danger" disabled={!c.back.enabled} onconfirm={() => model.act('back')} />
  </div>

  <div class="thumb-cluster__slot thumb-cluster__slot--suspense">
    <SuspenseButton />
  </div>

  <div class="thumb-cluster__slot thumb-cluster__slot--claim">
    <button type="button" class="big-button tone-ok" data-anim="press" disabled={!c.claim.enabled} onclick={onclaim}>
      <span class="big-button__content"><Icon name="claim" /><span class="big-button__label">{S.cluster.claim}</span></span>
    </button>
  </div>

  <div class="thumb-cluster__slot thumb-cluster__slot--hold">
    <button
      type="button"
      class="big-button {c.hold.holding ? 'tone-primary' : 'tone-calm'}"
      data-anim="press"
      data-state={c.hold.holding ? 'holding' : 'idle'}
      disabled={!c.hold.enabled}
      onclick={() => model.act('hold', { on: !c.hold.holding })}
    >
      <span class="big-button__content">
        <Icon name={c.hold.holding ? 'play' : 'hold'} />
        <span class="big-button__label">{c.hold.holding ? S.cluster.resume : S.cluster.hold}</span>
      </span>
    </button>
  </div>

  <div class="thumb-cluster__slot thumb-cluster__slot--next">
    <button type="button" class="big-button big-button--main tone-primary" data-anim="press" disabled={!c.next.enabled} onclick={() => model.act('next')}>
      <span class="big-button__content"><Icon name="next" /><span class="big-button__label">{S.cluster.next}</span></span>
    </button>
  </div>
</section>
