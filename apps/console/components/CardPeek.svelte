<!--
  Cerca › Cartró, a card's private preview (D162, D170; the Consola-Pestanyes-Noves board, frames ③, d and e). On the
  left its side as printed (D163, D266: «Normal 1–5», «Especial»), «No venut» when it isn't sold, then how it stands: «6 de 12
  han sonat» with the songs it misses for a Line and its Quina; with «Mostra el futur», whether it can still win and
  why (green «Pot guanyar» or red «Ja no pot guanyar»). On the right its 12 songs: the played ones with a ✓, the rest
  dotted and faded, each with how far ahead it is (+N) once the future shows. In the Desgraciat round: standing or
  fallen, and when it falls.
-->
<script lang="ts">
  import { songTitle } from '../../../packages/ui/data/catalog.ts';
  import { knownCardTypes } from '../../../packages/ui/data/card-types.ts';
  import { getConsole } from '../context.ts';
  import { typeChip } from '../logic/check.ts';
  import type { CardPeek } from '../logic/lookup.ts';
  import { hasPlayed } from '../logic/upcoming.ts';
  import { S } from '../strings.ts';
  import Chip from '../../../packages/ui/components/Chip.svelte';
  import Cover from './Cover.svelte';
  import Icon from './Icon.svelte';

  type Shown = Extract<CardPeek, { status: 'ok' }>;
  let { peek, side, future }: { peek: Shown; side: number; future: boolean } = $props();

  const model = getConsole();
  const types = $derived(knownCardTypes(model.catalog?.cardTypes));
  const chip = $derived(typeChip(peek.type, types, model.plan, side));
  const title = (songId: number | null) => (songId === null ? '' : (model.songInfo.get(songId)?.title ?? songTitle(null, songId)));
  const chance = $derived(peek.chance);
  const standing = $derived(peek.standing);
  /** The verdict's text: how it wins, or why it can't. */
  const why = $derived.by(() => {
    if (!chance) return null;
    if (chance.canWin) return chance.kind === 'line' ? S.cerca.winLine(S.cerca.rows(chance.at.rows), chance.at.n, title(chance.at.songId)) : S.cerca.winBingo(chance.at.n, title(chance.at.songId));
    return [chance.line ? S.cerca.lostLine(chance.line.missing, chance.line.at, chance.line.first) : null, S.cerca.lostBingo(chance.bingo.at, chance.bingo.first)].filter(Boolean).join(' ');
  });
</script>

<div class="card-peek" data-future={future || undefined} data-testid="card-peek" data-card-id={peek.cardId}>
  <div class="card-peek__side">
    <p class="card-peek__chips">
      {#if chip}<Chip class="card-type-chip" color="cyan" icon={chip.special ? 'star' : null} label={chip.label} />{/if}
      {#if peek.notSold}<span class="candidate-list__warn" title={S.future.notSoldLong}>{S.cerca.notSold}</span>{/if}
    </p>

    {#if standing}
      <p class="card-peek__headline">{standing.fallen ? S.cerca.fallen : S.cerca.standing}</p>
      <p class="card-peek__line">{S.cerca.playedOf(peek.played, peek.cells.length)}</p>
      {#if future && !standing.fallen}
        <p class="card-peek__line">{standing.fallsAt ? S.cerca.fallsAt(standing.fallsAt.n, title(standing.fallsAt.songId)) : model.roundSongs?.upcoming ? S.cerca.neverFalls : S.cerca.waiting}</p>
      {/if}
    {:else if future}
      {#if chance}
        <div class="card-peek__verdict" data-win={chance.canWin} role="status">
          <p class="card-peek__verdict-head"><Icon name={chance.canWin ? 'check' : 'cross'} /><span>{chance.canWin ? S.cerca.canWin : S.cerca.cannotWin}</span></p>
          <p class="card-peek__verdict-text">{why}</p>
        </div>
      {:else}
        <p class="note">{S.cerca.waiting}</p>
      {/if}
    {:else}
      <p class="card-peek__headline">{S.cerca.playedOf(peek.played, peek.cells.length)}</p>
      {#if peek.line}<p class="card-peek__line">{S.cerca.lineMissing(peek.line.missing, S.cerca.rows(peek.line.rows))}</p>{/if}
      <p class="card-peek__line">{S.cerca.bingoMissing(peek.bingo.missing)}</p>
    {/if}
  </div>

  <ol class="card-peek__grid">
    {#each peek.cells as cell, i (i)}
      {@const played = hasPlayed(cell.status)}
      {@const ahead = cell.status.state === 'ahead' ? cell.status.ahead : null}
      <li class="card-peek__cell" data-played={played || undefined} aria-label={S.cerca.cellLabel(title(cell.songId), played, future ? ahead : null)}>
        <span class="card-peek__art" aria-hidden="true">
          <Cover songId={cell.songId} size="sm" />
          {#if played}<span class="card-peek__mark"><Icon name="check" /></span>
          {:else if future && ahead !== null}<span class="card-peek__ahead">{S.future.offset(ahead)}</span>{/if}
        </span>
        <span class="card-peek__title" aria-hidden="true">{title(cell.songId)}</span>
      </li>
    {/each}
  </ol>
</div>
