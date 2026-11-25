<!--
  The Celebration: what was won and by which cards, the music override, the winners' names and notes, and
  the way on (Next for a Line; the Interval for a Bingo).
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { celebrationWinners, songTitleOf } from '../logic/show-data.ts';
  import { CA, S } from '../strings.ts';
  import CelebrationMusic from './CelebrationMusic.svelte';
  import Icon from './Icon.svelte';
  import WiiBadge from './WiiBadge.svelte';
  import WinnerForm from './WinnerForm.svelte';

  const model = getConsole();
  const snap = $derived(model.show.state);
  const flow = $derived(model.show.flow);
  const celebration = $derived(flow.celebration);
  const winners = $derived(celebrationWinners(flow.winners, celebration));
  const song = $derived(celebration ? songTitleOf(celebration.winningSongId, snap, model.catalog) : null);
  const isDefault = $derived(model.defaultAction?.control === 'interval');
  const lastRound = $derived(snap !== null && celebration !== null && celebration.round >= snap.game.roundsTotal);
</script>

{#if celebration}
  <section class="panel celebration-panel" data-kind={celebration.kind} aria-labelledby="celebration-title">
    <h2 class="panel__title celebration-panel__shout" id="celebration-title"><Icon name="star" /> {S.celebration.title[celebration.kind]}</h2>
    <p class="celebration-panel__cards">{S.celebration.cards(celebration.cardIds)}</p>
    {#if song}<p class="celebration-panel__song">{S.celebration.winningSong(song)}</p>{/if}

    <CelebrationMusic kind={celebration.kind} current={celebration.music} />

    {#if winners.length}
      <section class="celebration-panel__winners">
        <h3 class="panel__subtitle">{S.celebration.winnersTitle}</h3>
        {#each winners as w (w.claimId)}
          <WinnerForm claimId={w.claimId} name={w.name} slip={w.slip ?? null} notes={w.notes} title={CA.card(w.cardId)} />
        {/each}
      </section>
    {/if}

    {#if celebration.kind === 'line'}
      <p class="note">{S.celebration.continueLine}</p>
    {:else}
      <button type="button" class="action action--big tone-primary" data-anim="press" data-default={isDefault || undefined} disabled={!model.can('interval')} onclick={() => model.act('interval')}>
        <Icon name="next" /><span>{S.celebration.toInterval}</span>
        {#if isDefault}<WiiBadge button="a" />{/if}
      </button>
      <p class="note">{lastRound ? S.celebration.lastRound : S.celebration.toIntervalNote}</p>
    {/if}
  </section>
{/if}
