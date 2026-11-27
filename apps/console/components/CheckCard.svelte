<!--
  The claimed card on the Check board (boards Consola-Comprovacio-Ritme, -Casos, -Desgraciat): «Cartró #57» with its
  chips (what it claims; the side checked as printed, D163, D266: «Normal 1–5», «Desgraciat»), the warnings,
  then the card's 12 songs as the design system's CardCells (CardGrid's looks table, D2). Each song the Check plays
  carries its mark from the start (D108), centred (#75), dashed while only the presenters know it and full once the
  room has seen it (hook check-step); a song still to reveal is greyed with a dashed ring and counts down («Següent»,
  «+2», #78); the playing one's ring runs round it with a play disc (#74, #76); the songs after the reveals stop say
  «no es destaparà». A Line's other rows fade. A card of another type has no songs to reveal: its
  type shows big instead. Under the card, the private verdict: on a pass one centred line; on a fail a big ✗
  «Fallada» beside the song that failed it.
-->
<script lang="ts">
  import { knownCardTypes } from '../../../packages/ui/data/card-types.ts';
  import type { CheckInfo, ClaimInfo } from '../../../packages/ui/flow.ts';
  import { getConsole } from '../context.ts';
  import { checkCells, checkVerdict, typeChip, type CheckCell } from '../logic/check.ts';
  import { songTitleOf } from '../logic/show-data.ts';
  import { S } from '../strings.ts';
  import { VERDICT_LOOKS } from '../actions.ts';
  import CardCell from '../../../packages/ui/components/CardCell.svelte';
  import { cellLook, type CellState } from '../../../packages/ui/components/card-looks.ts';
  import Chip from '../../../packages/ui/components/Chip.svelte';
  import Cover from './Cover.svelte';
  import Icon from './Icon.svelte';

  /** `of`: this card's place among the claimed ones ("1 de 2"), when there are several. */
  let { check, claim, of = null }: { check: CheckInfo; claim: ClaimInfo | null; of?: { n: number; total: number } | null } = $props();

  const model = getConsole();
  const snap = $derived(model.show.state);
  const types = $derived(knownCardTypes(model.catalog?.cardTypes));
  const type = $derived(typeChip(check.cardType, types, model.plan, check.side));
  const roundType = $derived(typeChip(snap?.round.cardType, types, model.plan));
  const cells = $derived(checkCells(check, claim, model.show.now));
  const verdict = $derived(checkVerdict(check, claim));
  const title = (songId: number) => songTitleOf(songId, snap, model.catalog) ?? `Cançó ${songId}`;
  const pass = $derived(verdict.kind === 'complete');
  const text = $derived.by(() => {
    switch (verdict.kind) {
      case 'complete':
        return S.check.verdict.complete(verdict.win, verdict.row);
      case 'missing':
        return S.check.verdict.missing(verdict.position, title(verdict.songId));
      case 'fallen':
        return S.check.verdict.fallen(verdict.position, title(verdict.songId));
      case 'wrongType':
        return S.check.verdict.wrongType(type?.name.toLowerCase() ?? null, roundType?.name.toLowerCase() ?? '');
      case 'unknownCard':
        return S.check.verdict.unknownCard;
    }
  });
  const notSold = $derived(claim?.warnings.includes('notSold') ?? false);
  const completeSince = $derived(claim?.completeSince != null ? claim.completeSince + 1 : null);
  /** Each Check draws its cells afresh (D121): a review back on screen with its marks shows them at once, with no 150 ms
   * check-step transition from the previous card's cells. */
  const drawn = $derived(`${check.claimId}@${check.startAtMs}`);
  /** The song that failed the card (its first ✗, or the one that sank a standing card). */
  /** A cell's state for CardGrid's looks table: the room's ✓ / ✗ once heard, the private mark before (D108, #78). */
  function cellState(cell: CheckCell): CellState {
    if (!cell.inCheck) return 'idle';
    if (cell.skipped) return 'skipped';
    if (cell.playing) return 'playing';
    if (cell.revealed) return cell.mark === 'bad' ? 'missed' : 'landed';
    return cell.mark === 'bad' ? 'upcomingFail' : 'upcomingOk';
  }
  const failedSong = $derived(!pass && (verdict.kind === 'missing' || verdict.kind === 'fallen') ? verdict.songId : null);
</script>

<section class="panel check-card" aria-label={S.check.cardLabel(check.cardId)} data-kind={check.kind} data-testid="check-card" data-card-id={check.cardId}>
  <header class="check-card__head">
    <h2 class="check-card__title">{S.check.card(check.cardId)}</h2>
    <Chip class="card-type-chip" color="ink" variant="solid" label={S.check.kind[check.kind]} />
    {#if type}<Chip class="card-type-chip" color="snow" icon={type.special ? 'star' : null} label={type.label} />{/if}
    {#if of}<span class="check-card__of">{S.check.ofCards(of.n, of.total)}</span>{/if}
  </header>

  {#if notSold || completeSince !== null}
    <ul class="check-card__warnings">
      {#if notSold}<li><Chip color="orange" border="edge" icon="warning" label={S.check.warnings.notSold} /></li>{/if}
      {#if completeSince !== null}<li><Chip color="orange" border="edge" icon="warning" label={S.check.warnings.completeSince(completeSince, check.kind)} /></li>{/if}
    </ul>
  {/if}

  {#if cells.length}
    <ol class="check-grid" data-kind={check.kind}>
      {#each cells as cell, i (`${drawn}:${i}`)}
        {@const songTitle = cell.skipped ? S.check.skipped : title(cell.songId)}
        <CardCell
          class="check-cell"
          songId={cell.songId}
          title={songTitle}
          label={S.check.cellLabel(title(cell.songId), cell.mark, cell.revealed, check.kind)}
          {...cellLook(cellState(cell), { ahead: cell.ahead, nextTag: S.check.nextTag })}
          data-in={cell.inCheck || undefined}
          data-mark={cell.mark ?? undefined}
          data-revealed={cell.revealed || undefined}
          data-playing={cell.playing || undefined}
          data-next={cell.next || undefined}
          data-skipped={cell.skipped || undefined}
          data-anim="check-step"
        />
      {/each}
    </ol>
  {:else if verdict.kind === 'wrongType' && type}
    <div class="check-card__type" style:--chip-bg={type.color} aria-hidden="true">
      {#if type.special}<Icon name="star" />{/if}<span>{type.name}</span>
    </div>
  {/if}

  <span class="check-card__spacer"></span>
  <div class="check-verdict" data-pass={pass} data-color={VERDICT_LOOKS[pass ? 'pass' : 'fail'].color} data-testid="check-result" data-outcome={check.outcome} aria-label={text}>
    {#if pass}
      <p class="check-verdict__line"><Icon name="check" /><span>{text}</span></p>
    {:else}
      <p class="check-verdict__fail" aria-hidden="true"><span class="check-verdict__cross"><Icon name="cross" outline /></span><span class="check-verdict__word">{S.check.failed}</span></p>
      {#if failedSong !== null}
        <div class="check-verdict__song" aria-hidden="true">
          <Cover songId={failedSong} size="md" />
          <p class="check-verdict__text"><span class="check-verdict__title">{title(failedSong)}</span><span class="check-verdict__detail">{model.catalog?.songs.get(failedSong)?.artist ?? ''}</span><span class="check-verdict__why">{text}</span></p>
        </div>
      {:else}
        <p class="check-verdict__text" aria-hidden="true"><span class="check-verdict__why">{text}</span></p>
      {/if}
    {/if}
  </div>
</section>
