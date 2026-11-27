<!--
  The Dempeus tab once the Desgraciat's finale is on (D187; the Consola-Desgraciat-Final board ⑥–⑧, ⓐ–ⓒ; ANIMATIONS.md ›
  The finale on stage › Console). The tab becomes the stage, in the same order as the projector:
  - the head: how many stand («8 a l'escenari», then «5 dempeus»), «Salvats!» beside it until the next Spin (D181),
    «+ Afegir» while editing, «Editar» (off by default, D183; both the compact Button size xs, #87) and «Al revés» (this tablet's own order, facing the room);
  - one nino per finalist (the generic Nino, F1) over their number plate (packages/rules/finale.ts): a fallen one faded with a ✗ and a red
    plate until the next Spin (D182); while editing, an × on each standing one removes them at once, no confirmation;
  - one left: the winner in a gold-ringed box with the party nino; the big button is then «Celebrem!» (ThumbCluster).
  Nothing here brings a fallen finalist back: only «Enrere» undoes a landing (D183).
-->
<script lang="ts">
  import IconButton from '../../../packages/ui/components/IconButton.svelte';
  import { ICONS } from '../actions.ts';
  import type { FinaleInfo } from '@quina/protocol';
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import { scale } from 'svelte/transition';
  import { CONSOLE } from '../config.ts';
  import { getConsole } from '../context.ts';
  import { finaleTabView } from '../logic/finale.ts';
  import { S } from '../strings.ts';
  import Button from '../../../packages/ui/components/Button.svelte';
  import Nino from '../../../packages/ui/components/Nino.svelte';
  import { ninoFor } from '../../../packages/ui/concepts.ts';
  import { ACTIONS } from '../actions.ts';
  import Icon from './Icon.svelte';

  let { finale }: { finale: FinaleInfo } = $props();

  const model = getConsole();
  /** The winner wears the party nino (NINO_FOR.finaleWinner). */
  const FINALE_WINNER = ninoFor('finaleWinner', 0);
  const uid = $props.id();
  const F = S.finale;
  const T = CONSOLE.finale;
  const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ms = (n: number) => (reduced() ? 0 : n);
  const snap = $derived(model.show.state);
  const view = $derived(snap ? finaleTabView(finale, snap, model.catalog?.cards ?? null, model.finaleReversed) : null);
  const editing = $derived(model.finaleEditing && finale.winner === null);
  /** The landing «Salvats!» belongs to: the jump replays for a new one. */
  const savedKey = $derived(view?.saved ? `${snap?.queue.position}` : null);
</script>

{#if view}
  <section class="finale-stage" data-testid="finale-stage" data-private="true" data-editing={editing || undefined} data-winner={view.winner ?? undefined} aria-labelledby="{uid}-count">
    <div class="finale-stage__head">
      <p class="finale-stage__count" id="{uid}-count" aria-live="polite">
        <span class="finale-stage__number" data-gold={view.winner !== null || undefined}>{view.count}</span>
        <span class="finale-stage__word">{F.word[view.word]}</span>
      </p>
      {#if view.saved}
        <p class="finale-stage__saved" role="status" aria-label={F.savedLabel} data-anim="finale-safe" in:scale={{ start: 0.6, duration: ms(200) }}>
          <Icon name="star" /><span aria-hidden="true">{F.saved}</span>
        </p>
      {/if}
      <span class="finale-stage__spacer"></span>
      {#if editing}
        <Button {...ACTIONS.finaleAddOne} class="finale-stage__add" data-testid="finale-add-one" disabled={!model.can('finale')} onclick={() => model.openFinalePad()} />
      {/if}
      {#if finale.winner === null}
        <Button
          {...(editing ? ACTIONS.finaleEditOn : ACTIONS.finaleEdit)}
          class="finale-stage__edit"
          data-anim="finale-edit"
          pressed={editing}
          data-testid="finale-edit"
          onclick={() => (model.finaleEditing = !model.finaleEditing)}
        />
      {/if}
      <button type="button" class="finale-stage__switch" role="switch" aria-checked={model.finaleReversed} data-anim="press" data-testid="finale-reversed" onclick={() => model.setFinaleReversed(!model.finaleReversed)}>
        <Icon name="swap" /><span class="finale-stage__switch-label">{F.reversed}</span>
        <span class="switch__track" aria-hidden="true"><span class="switch__thumb"></span></span>
      </button>
    </div>

    <ul class="finale-stage__row" aria-label={F.row} data-count={view.spots.length}>
      {#each view.spots as spot, i (spot.cardId)}
        <li
          class="finale-stage__spot"
          data-card-id={spot.cardId}
          data-fate={spot.fate}
          data-anim={spot.fate === 'fallen' ? 'finale-fall' : spot.fate === 'winner' ? 'finale-win' : undefined}
          aria-label={spot.fate === 'fallen' ? F.fallen(spot.cardId) : spot.fate === 'winner' ? F.winner(spot.cardId) : F.chip(spot.cardId)}
          animate:flip={{ duration: ms(T.flipMs), easing: cubicOut }}
          in:scale={{ start: 0.4, duration: ms(T.popMs), delay: ms(i * T.staggerMs) }}
          out:scale={{ start: 0.6, duration: ms(T.outMs), easing: cubicOut }}
        >
          {#key savedKey}
            <span class="finale-stage__figure" data-anim={savedKey && spot.fate === 'standing' ? 'finale-safe' : undefined} style:--tilt="{i % 2 ? -8 : 8}deg">
              <Nino pose={spot.fate === 'winner' ? FINALE_WINNER : spot.look.pose} hue={spot.fate === 'winner' ? null : spot.look.hue} faded={spot.fate === 'fallen'} motion="none" />
              {#if spot.fate === 'fallen'}<span class="finale-stage__cross" aria-hidden="true"><Icon name="cross" /></span>{/if}
            </span>
          {/key}
          <span class="finale-stage__plate" aria-hidden="true">{F.chip(spot.cardId)}</span>
          {#if editing && spot.fate === 'standing'}
            <span class="finale-stage__remove" in:scale={{ start: 0.4, duration: ms(160) }}>
              <IconButton {...ICONS.removeFinalist} label={F.remove(spot.cardId)} data-testid="finale-remove" disabled={!model.can('finale')} onclick={() => model.removeFinalist(spot.cardId)} />
            </span>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}
