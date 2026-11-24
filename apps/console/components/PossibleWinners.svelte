<!--
  Possible winners: PRIVATE and hidden by default, so the presenters stay curious too. Revealing is this
  device's choice only; it hides again for a new round (App keys this component on the round).
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { possibleWinnersView } from '../logic/possible-winners.ts';
  import { songTitleOf } from '../logic/show-data.ts';
  import { CA, S } from '../strings.ts';
  import Icon from './Icon.svelte';

  const model = getConsole();
  const uid = $props.id();
  let revealed = $state(false);
  const snap = $derived(model.show.state);
  const view = $derived(snap ? possibleWinnersView(snap.possibleWinners, model.inPlay) : null);
  const groups = $derived(view ? [{ kind: 'line' as const, items: view.line }, { kind: 'bingo' as const, items: view.bingo }] : []);
  const title = (songId: number | null) => songTitleOf(songId, snap, model.catalog) ?? (songId === null ? '' : String(songId));
</script>

{#if snap && view}
  <section class="panel possible-winners" data-private="true" data-state={revealed ? 'revealed' : 'hidden'} aria-labelledby="{uid}-title">
    <div class="panel__head">
      <h2 class="panel__title" id="{uid}-title">{S.winners.title} <span class="badge badge--private">{S.winners.private}</span></h2>
      <button type="button" class="possible-winners__toggle" data-anim="press" aria-expanded={revealed} aria-controls="{uid}-list" onclick={() => (revealed = !revealed)}>
        <Icon name={revealed ? 'eyeOff' : 'eye'} /><span>{revealed ? S.winners.hide : S.winners.show}</span>
      </button>
    </div>
    <div id="{uid}-list">
      {#if revealed}
        <div class="possible-winners__list" data-anim="reveal">
          {#if model.inPlay.error}<p class="note note--warning">{S.winners.inPlayError}</p>
          {:else if model.inPlay.ids === null}<p class="note">{S.winners.noCardsInPlay}</p>{/if}
          {#each groups as group (group.kind)}
            <h3 class="panel__subtitle">{S.winners.kind[group.kind]}</h3>
            {#if group.items.length === 0}
              <p class="possible-winners__none">{S.winners.none}</p>
            {:else}
              <ul class="candidate-list">
                {#each group.items as c (c.cardId)}
                  <li class="candidate-list__item" data-state={c.notSold ? 'not-sold' : 'sold'}>
                    <strong class="candidate-list__card">{CA.card(c.cardId)}</strong>
                    {#if c.rows.length}<span>{S.winners.rows(c.rows)}</span>{/if}
                    {#if c.completedBy !== null}<span class="candidate-list__song">{S.winners.completedBy(title(c.completedBy))}</span>{/if}
                    {#if c.notSold}<span class="badge badge--warning">{S.winners.notSold}</span>{/if}
                  </li>
                {/each}
              </ul>
            {/if}
          {/each}
        </div>
      {:else}
        <p class="possible-winners__hidden">{S.winners.hiddenNote}</p>
      {/if}
    </div>
  </section>
{/if}
