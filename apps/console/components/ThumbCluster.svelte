<!--
  The presenters' actions, in one cluster that keeps its arrangement in landscape and portrait:
    [ Enrere (long press, full width)        ]
    [ Parlem (Hold)    ][ Aguanta (Stay)     ]
    [ Comprovar cartró ][ Suspens            ]
    [ Següent (full width, the biggest)      ]
  Següent sits at the bottom under the thumbs; Enrere, the risky one, is furthest away. Parlem and Aguanta
  are one pair (logic/hold-modes.ts): the active one shows pressed, pressing it again releases, pressing the
  other switches (`hold { on, duck }`).
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { activeHoldMode, holdPress, type HoldMode } from '../logic/hold-modes.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import LongPressButton from './LongPressButton.svelte';
  import SuspenseButton from './SuspenseButton.svelte';

  let { onclaim }: { onclaim: () => void } = $props();

  const model = getConsole();
  const c = $derived(model.controls);
  const active = $derived(activeHoldMode(model.show.state));
  const modes = $derived(
    (['talk', 'stay'] as const).map((mode) => {
      const fields = holdPress(mode, active);
      return { mode, fields, pressed: active === mode, enabled: c.hold.enabled };
    }),
  );
  const TEXT: Record<HoldMode, { label: string; note: string; icon: 'hold' | 'stay' }> = {
    talk: { label: S.cluster.talk, note: S.cluster.talkNote, icon: 'hold' },
    stay: { label: S.cluster.stay, note: S.cluster.stayNote, icon: 'stay' },
  };
</script>

<section class="thumb-cluster" aria-label={S.cluster.label} data-live={c.live}>
  <span hidden data-testid="hold" data-mode={active ?? 'none'}></span>
  <div class="thumb-cluster__slot thumb-cluster__slot--back">
    <LongPressButton big action="back" label={S.cluster.back} note={S.cluster.backHint} icon="back" tone="danger" disabled={!c.back.enabled} onconfirm={() => model.act('back')} />
  </div>

  {#each modes as m (m.mode)}
    <div class="thumb-cluster__slot thumb-cluster__slot--{m.mode}">
      <button
        type="button"
        class="big-button"
        data-action={m.mode}
        data-anim="press"
        aria-pressed={m.pressed}
        disabled={!m.enabled}
        onclick={() => model.act('hold', m.fields)}
      >
        <Icon name={TEXT[m.mode].icon} outline />
        <span class="big-button__text">
          <span class="big-button__label">{TEXT[m.mode].label}</span>
          <span class="big-button__note">{m.pressed ? S.cluster.activeNote : TEXT[m.mode].note}</span>
        </span>
      </button>
    </div>
  {/each}

  <div class="thumb-cluster__slot thumb-cluster__slot--claim">
    <button type="button" class="big-button" data-action="claim" data-anim="press" disabled={!c.claim.enabled} onclick={onclaim}>
      <Icon name="claim" outline />
      <span class="big-button__text"><span class="big-button__label">{S.cluster.claim}</span></span>
    </button>
  </div>

  <div class="thumb-cluster__slot thumb-cluster__slot--suspense">
    <SuspenseButton />
  </div>

  <div class="thumb-cluster__slot thumb-cluster__slot--next">
    <button type="button" class="big-button" data-action="next" data-anim="press" disabled={!c.next.enabled} onclick={() => model.act('next')}>
      <Icon name="next" outline />
      <span class="big-button__text"><span class="big-button__label">{S.cluster.next}</span></span>
    </button>
  </div>
</section>
