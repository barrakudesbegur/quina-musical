<!--
  The Desgraciat round's Dempeus tab (the Consola-Dempeus board; ANIMATIONS.md › The Desgraciat round › Console).
  PRIVATE, like the Futur: the cards still standing never reach the projector or phones. It isn't behind a reveal:
  the presenters need it to call the winner.
  - The count, "23 dempeus de 180 cartrons" (hook standing-count: the old number slides down and fades as the new
    one drops in; gold from 3 down).
  - Above 60 standing: a standing/seated bar and how many sat down. From 60 down: every standing card as a chip,
    sorted ("#57"). Cards that just fell turn red with a ✗, stay 600 ms so the presenters can read them out, then
    shrink away while the rest close up (hook standing-fall; at most 20 animate).
  - One left: its big gold-ringed number and "Comprovar #57", the default action (hook standing-last), which sends
    `claim {cardId, kind: 'standing'}`.
-->
<script lang="ts">
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import { fly, scale } from 'svelte/transition';
  import { CONSOLE } from '../config.ts';
  import { getConsole } from '../context.ts';
  import { songTitleOf } from '../logic/show-data.ts';
  import { standingChips, standingSummary } from '../logic/standing.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import WiiBadge from './WiiBadge.svelte';

  const model = getConsole();
  const uid = $props.id();
  const T = CONSOLE.standing;
  const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const snap = $derived(model.show.state);
  const summary = $derived(snap ? standingSummary(snap.standing, snap.cards.validCount) : null);
  const fall = $derived(model.standingFall);
  /** The fallen chips still held red (cleared after `holdMs`; never with reduced motion). */
  let held = $state<readonly number[]>([]);
  const chips = $derived(summary?.ids ? standingChips(summary.ids, held, T.maxAnimated) : []);
  const drop = $derived(fall && summary && fall.countAfter === summary.count ? S.standing.drop(fall.cardIds.length, songTitleOf(fall.songId, snap, model.catalog)) : null);
  const isDefault = $derived(model.defaultAction?.control === 'claimLast');

  // standing-fall: a new fall holds its chips red, then lets them go (a tab opened later shows what's left of the hold).
  $effect(() => {
    const f = fall;
    const left = f ? f.atMs + T.holdMs - Date.now() : 0;
    if (!f || left <= 0 || reduced()) {
      held = [];
      return;
    }
    held = f.cardIds;
    const timer = setTimeout(() => (held = []), left);
    return () => clearTimeout(timer);
  });

  const ms = (n: number) => (reduced() ? 0 : n);
  const countIn = (node: Element) => fly(node, { y: -T.countShiftPx, duration: ms(T.countMs), easing: cubicOut });
  const countOut = (node: Element) => fly(node, { y: T.countShiftPx, duration: ms(T.countMs), easing: cubicOut });

  function claimLast(cardId: number): void {
    model.act('claim', { cardId, kind: 'standing' });
  }
</script>

<section class="standing" data-testid="standing" data-private="true" aria-labelledby="{uid}-count">
  {#if !summary}
    <p class="note">{S.standing.noCards}</p>
  {:else}
    <div class="standing__head">
      <p class="standing__count" id="{uid}-count" aria-label={S.standing.countLabel(summary.count, summary.total)} aria-live="polite">
        <span class="standing__number" data-gold={summary.gold || undefined} aria-hidden="true">
          {#key summary.count}<span class="standing__digits" in:countIn out:countOut>{summary.count}</span>{/key}
        </span>
        <span class="standing__word" aria-hidden="true">{S.standing.word}</span>
        {#if summary.total !== null}<span class="standing__of" aria-hidden="true">{S.standing.of(summary.total)}</span>{/if}
      </p>
      {#if drop}<p class="standing__drop" role="status">{drop}</p>{/if}
    </div>

    {#if summary.last !== null}
      {@const last = summary.last}
      <div class="standing__last" data-anim="standing-last">
        <p class="standing__last-card" data-testid="standing-last" data-card-id={last}>
          <span class="standing__last-label">{S.standing.last}</span>
          <span class="standing__last-number">#{last}</span>
        </p>
        <div class="standing__last-side">
          <button type="button" class="action action--big tone-primary standing__claim" data-testid="claim-last" data-anim="press" data-default={isDefault || undefined} disabled={!model.can('claim')} onclick={() => claimLast(last)}>
            <Icon name="claim" /><span>{S.standing.claimLast(last)}</span>
            {#if isDefault}<WiiBadge button="a" />{/if}
          </button>
          <p class="note">{S.standing.lastNote(last)}</p>
        </div>
      </div>
    {:else if summary.count === 0}
      <p class="note note--warning">{S.standing.none}</p>
    {:else if summary.ids}
      <ul class="standing__chips" data-testid="standing-chips" aria-label={S.standing.list}>
        {#each chips as chip (chip.cardId)}
          <li
            class="standing__chip"
            data-card-id={chip.cardId}
            data-fallen={chip.fallen || undefined}
            aria-label={chip.fallen ? S.standing.fallen(chip.cardId) : undefined}
            animate:flip={{ duration: ms(T.flipMs), easing: cubicOut }}
            out:scale={{ start: T.outScale, duration: chip.fallen ? ms(T.outMs) : 0, delay: chip.fallen ? ms(chip.order * T.staggerMs) : 0, easing: cubicOut }}
          >
            {S.standing.chip(chip.cardId)}{#if chip.fallen}<Icon name="cross" />{/if}
          </li>
        {/each}
      </ul>
    {:else}
      {#if summary.share !== null && summary.total !== null}
        <div class="standing__bar" role="img" aria-label={S.standing.bar(summary.count, summary.total)}>
          <span class="standing__bar-fill" style:--share={summary.share}></span>
        </div>
      {/if}
      {#if summary.seated !== null}<p class="standing__seated"><Icon name="seated" />{S.standing.seated(summary.seated)}</p>{/if}
      <p class="note standing__later">{S.standing.listLater}</p>
    {/if}
  {/if}
</section>
