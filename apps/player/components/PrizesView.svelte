<script lang="ts">
  // Premis: every round's Line and Quina prizes from the plan, and which were already won (never by which card).
  // Self-contained, so it can sit in a tab or a drawer.
  import type { PlayerApp } from '../model.svelte.ts';
  import { prizeRounds } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import PrizeLines from './PrizeLines.svelte';

  let { app }: { app: PlayerApp } = $props();
  const rounds = $derived(prizeRounds(app.plan, app.state, app.data.cards.map((c) => c.id)));
</script>

<section class="prizes">
  <h2 class="prizes__heading">{S.prizesTitle}</h2>
  {#if !rounds.length}
    <p class="prizes__empty">{S.noPlan}</p>
  {/if}
  <ol class="prizes__list">
    {#each rounds as round (round.number)}
      <li class="prize-round" data-state={round.state} data-kind={round.kind}>
        <h3 class="prize-round__title">
          {S.round(round.number)}
          {#if round.kind === 'special'}<span class="prize-round__badge">{S.specialRound}</span>{/if}
          {#if S.roundState[round.state]}<span class="prize-round__state">{S.roundState[round.state]}</span>{/if}
        </h3>
        <PrizeLines {round} mine={app.data.cards} />
      </li>
    {/each}
  </ol>
</section>
