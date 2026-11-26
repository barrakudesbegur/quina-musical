<!--
  The claimed card on the Check board (boards Consola-Comprovacio-Ritme, -Casos, -Desgraciada): «Cartró #57» with its
  chips (what it claims, its printed type: D163's side isn't in the protocol yet, so the type alone), the warnings,
  then the card's 12 songs. Each song the Check plays carries its mark from the start (D108), dotted while only the
  presenters know it and full once the room has seen it (hook check-step); the next one says «Següent»; the songs after
  the reveals stop say «no es destaparà». A Line's other rows fade. A card of another type has no songs to reveal: its
  type shows big instead. Under the card, the private verdict: on a pass one centred line; on a fail a big ✗
  «Fallada» beside the song that failed it.
-->
<script lang="ts">
  import { knownCardTypes } from '../../../packages/ui/data/card-types.ts';
  import type { CheckInfo, ClaimInfo } from '../../../packages/ui/flow.ts';
  import { getConsole } from '../context.ts';
  import { checkCells, checkVerdict, typeChip } from '../logic/check.ts';
  import { songTitleOf } from '../logic/show-data.ts';
  import { S } from '../strings.ts';
  import Cover from './Cover.svelte';
  import Icon from './Icon.svelte';

  /** `of`: this card's place among the claimed ones ("1 de 2"), when there are several. */
  let { check, claim, of = null }: { check: CheckInfo; claim: ClaimInfo | null; of?: { n: number; total: number } | null } = $props();

  const model = getConsole();
  const snap = $derived(model.show.state);
  const types = $derived(knownCardTypes(model.catalog?.cardTypes));
  const type = $derived(typeChip(check.cardType, types, model.plan));
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
  /** The song that failed the card (its first ✗, or the one that sank a standing card). */
  const failedSong = $derived(!pass && (verdict.kind === 'missing' || verdict.kind === 'fallen') ? verdict.songId : null);
</script>

<section class="panel check-card" aria-label={S.check.cardLabel(check.cardId)} data-kind={check.kind} data-testid="check-card" data-card-id={check.cardId}>
  <header class="check-card__head">
    <h2 class="check-card__title">{S.check.card(check.cardId)}</h2>
    <span class="chip chip--ink">{S.check.kind[check.kind]}</span>
    {#if type}<span class="chip chip--type" style:--chip-bg={type.color}>{#if type.special}<Icon name="star" />{/if}{type.name}</span>{/if}
    {#if of}<span class="check-card__of">{S.check.ofCards(of.n, of.total)}</span>{/if}
  </header>

  {#if notSold || completeSince !== null}
    <ul class="check-card__warnings">
      {#if notSold}<li class="warning-chip"><Icon name="alert" />{S.check.warnings.notSold}</li>{/if}
      {#if completeSince !== null}<li class="warning-chip"><Icon name="alert" />{S.check.warnings.completeSince(completeSince, check.kind)}</li>{/if}
    </ul>
  {/if}

  {#if cells.length}
    <ol class="check-grid" data-kind={check.kind}>
      {#each cells as cell, i (i)}
        <li
          class="check-cell"
          data-in={cell.inCheck || undefined}
          data-mark={cell.mark ?? undefined}
          data-revealed={cell.revealed || undefined}
          data-playing={cell.playing || undefined}
          data-next={cell.next || undefined}
          data-skipped={cell.skipped || undefined}
          data-anim="check-step"
          aria-label={S.check.cellLabel(title(cell.songId), cell.mark, cell.revealed, check.kind)}
        >
          <span class="check-cell__art">
            <Cover songId={cell.songId} size="md" />
            {#if cell.mark}
              <span class="check-cell__mark" aria-hidden="true"><Icon name={cell.mark === 'bad' ? 'cross' : 'check'} /></span>
            {/if}
            {#if cell.next}<span class="check-cell__next" aria-hidden="true">{S.check.nextTag}</span>{/if}
          </span>
          <span class="check-cell__title" aria-hidden="true">{cell.skipped ? S.check.skipped : title(cell.songId)}</span>
        </li>
      {/each}
    </ol>
  {:else if verdict.kind === 'wrongType' && type}
    <div class="check-card__type" style:--chip-bg={type.color} aria-hidden="true">
      {#if type.special}<Icon name="star" />{/if}<span>{type.name}</span>
    </div>
  {/if}

  <span class="check-card__spacer"></span>
  <div class="check-verdict" data-pass={pass} data-testid="check-result" data-outcome={check.outcome} aria-label={text}>
    {#if pass}
      <p class="check-verdict__line"><Icon name="check" /><span>{text}</span></p>
    {:else}
      <p class="check-verdict__fail" aria-hidden="true"><span class="check-verdict__cross"><Icon name="cross" /></span><span class="check-verdict__word">{S.check.failed}</span></p>
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
