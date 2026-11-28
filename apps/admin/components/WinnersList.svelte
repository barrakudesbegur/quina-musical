<!-- The night's Winners: round, Line or Quina, card, Winning song, and the PRIVATE name and notes, edited
     with `winnerInfo`. An edit stays here until the engine's state shows it, so a rejected or unsent one is
     never lost. -->
<script lang="ts">
  import type { ShowStore } from '../../../packages/ui/client/show.svelte.ts';
  import { CA } from '../../../packages/ui/i18n/ca.ts';
  import { songTitle, type Catalog } from '../../../packages/ui/data/catalog.ts';
  import { roundAt, type GamePlan } from '../../../packages/ui/plan.ts';
  import type { CommandTracker } from '../state/commands.svelte.ts';
  import { editDiffers, editOf, winnerInfoFields, winnerRows, type WinnerEdit } from '../logic/winners.ts';
  import { S } from '../strings.ts';
  import CommandStatus from './CommandStatus.svelte';

  let { show, commands, plan, catalog }: { show: ShowStore; commands: CommandTracker; plan: GamePlan | null; catalog: Catalog | null } = $props();

  const rows = $derived(winnerRows(show.flow.winners, plan));
  /** Edits being typed, by claimId. */
  let edits = $state<Record<string, WinnerEdit>>({});

  /** A Winning song's title: from the cards, else from the round's recent landings, else "Cançó N". */
  function songOf(songId: number | null): string {
    if (songId === null) return '—';
    const landed = show.state?.landings.find((l) => l.songId === songId);
    return catalog?.songs.get(songId)?.title ?? landed?.title ?? songTitle(catalog, songId);
  }

  function edit(claimId: string, base: WinnerEdit, field: keyof WinnerEdit, value: string) {
    edits[claimId] = { ...(edits[claimId] ?? base), [field]: value };
  }

  function save(claimId: string) {
    const e = edits[claimId];
    if (e) commands.send('winnerInfo', claimId, winnerInfoFields(claimId, e));
  }

  // Drop edits the engine now has.
  $effect(() => {
    for (const { winner } of rows) {
      const e = edits[winner.claimId];
      if (e && !editDiffers(winner, e)) delete edits[winner.claimId];
    }
  });
</script>

<section class="panel surface winners" aria-labelledby="winners-title">
  <h2 class="panel__title" id="winners-title">{S.night.winnersTitle}</h2>
  <p class="notice notice--private">{S.night.privacy}</p>

  {#if !rows.length}
    <p class="panel__help">{S.night.noWinners}</p>
  {:else}
    <div class="winners__scroll">
      <table class="winners__table">
        <thead>
          <tr>
            <th scope="col">{S.night.col.round}</th>
            <th scope="col">{S.night.col.kind}</th>
            <th scope="col">{S.night.col.card}</th>
            <th scope="col">{S.night.col.song}</th>
            <th scope="col">{S.night.col.prize}</th>
            <th scope="col">{S.night.col.name}</th>
            <th scope="col">{S.night.col.notes}</th>
            <th scope="col">{S.night.col.action}</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as { winner, prize } (winner.claimId)}
            {@const base = editOf(winner)}
            {@const current = edits[winner.claimId] ?? base}
            {@const dirty = editDiffers(winner, current)}
            {@const card = CA.card(winner.cardId)}
            <tr class="winners__row" data-kind={winner.kind} class:is-dirty={dirty}>
              <td>{S.round(roundAt(plan, winner.round), plan)}</td>
              <td>{S.night.kind[winner.kind]}</td>
              <td class="winners__card">{S.night.cardCell(winner.cardId)}</td>
              <td>{songOf(winner.winningSongId)}</td>
              <td>{prize ?? '—'}</td>
              <td>
                <label class="visually-hidden" for="winner-{winner.claimId}-name">{S.night.nameLabel(card)}</label>
                <input id="winner-{winner.claimId}-name" type="text" maxlength="80" autocomplete="off" value={current.name} oninput={(e) => edit(winner.claimId, base, 'name', e.currentTarget.value)} />
              </td>
              <td>
                <label class="visually-hidden" for="winner-{winner.claimId}-notes">{S.night.notesLabel(card)}</label>
                <textarea id="winner-{winner.claimId}-notes" rows="1" maxlength="500" value={current.notes} oninput={(e) => edit(winner.claimId, base, 'notes', e.currentTarget.value)}></textarea>
              </td>
              <td class="winners__action">
                <button type="button" onclick={() => save(winner.claimId)} disabled={!dirty || !commands.canSend}>{S.night.saveWinner}</button>
                <span class="panel__help">{dirty ? S.night.winnerDirty : S.night.winnerSynced}</span>
                <CommandStatus record={commands.last('winnerInfo', winner.claimId)} />
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<style>
  @layer app {
  .winners__scroll {
    overflow-x: auto;
  }
  .winners__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }
  .winners__table th,
  .winners__table td {
    padding: var(--space-2);
    border-bottom: var(--line-width) solid var(--color-line);
    text-align: left;
    vertical-align: top;
  }
  .winners__card {
    font-size: var(--text-lg);
    font-weight: var(--font-weight-strong);
  }
  .winners__row.is-dirty {
    background: var(--color-bg-deep);
  }
  .winners__action {
    display: grid;
    gap: var(--space-1);
  }
  }
</style>
