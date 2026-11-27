<!--
  The finalists' pad (D161, D168, D184; the Consola-Desgraciat-Final board ④ ⑤), over the whole body under the header,
  from «Final a l'escenari» (or «+ Finalista» once the finale is on):
  - left: «Finalistes a l'escenari», the number being typed, the finalists so far in card order (the one just added gold
    for a moment, hook finale-pad-card), then the keys with ↵ to enter a number;
  - right: «Torna a la quina» (closes the pad; the finale doesn't start), the card of the last number entered, privately,
    with each song's ✓ (not sounded) or ✗ (sounded) on the round's side, and the big «Començar final» (at least 2), or
    «Afegir a la final» during it: the default action (A).
  A number that has fallen, isn't printed or isn't of this round is refused here with one short reason, stays typed in
  red and shakes once; the room sees nothing. Physical keys: digits, Backspace, Delete, Enter (↵), Escape (back to the
  round). The pad's state is the model's (logic/finale.ts).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { knownCardTypes } from '../../../packages/ui/data/card-types.ts';
  import { CONSOLE } from '../config.ts';
  import { getConsole } from '../context.ts';
  import { typeChip } from '../logic/check.ts';
  import { finalePadSet } from '../logic/finale.ts';
  import { PAD_DIGITS, padKeyFromKeyboard, type PadKey } from '../logic/numpad.ts';
  import { songTitleOf } from '../logic/show-data.ts';
  import { CA, S } from '../strings.ts';
  import Cover from './Cover.svelte';
  import Icon from './Icon.svelte';
  import NowLine from './NowLine.svelte';
  import PodiumIcon from './PodiumIcon.svelte';
  import WiiBadge from './WiiBadge.svelte';
  import { touchPress, touchTap } from '../../../packages/ui/sounds/touch.ts';

  const model = getConsole();
  const uid = $props.id();
  const F = S.finale;
  let root: HTMLElement | undefined = $state();
  /** Bumps on each refusal, so the shake plays again. */
  let shakes = $state(0);
  /** The number just added, gold for a moment (finale-pad-card). */
  let fresh = $state<number | null>(null);
  let freshTimer: ReturnType<typeof setTimeout> | undefined;

  const pad = $derived(model.finalePad);
  const snap = $derived(model.show.state);
  const set = $derived(pad ? finalePadSet(pad) : []);
  const chips = $derived([...set].sort((a, b) => a - b));
  const command = $derived(model.finaleCommand);
  const isDefault = $derived(model.defaultAction?.control === 'finalePad');
  const full = $derived(set.length >= CONSOLE.finale.maxFinalists);
  const shown = $derived(pad?.shown ?? null);
  const shownType = $derived.by(() => {
    const card = shown ? model.catalog?.cards.get(shown.cardId) : null;
    return card ? typeChip(card.type, knownCardTypes(model.catalog?.cardTypes), model.plan, snap?.round.side) : null;
  });
  const title = (songId: number) => songTitleOf(songId, snap, model.catalog) ?? `Cançó ${songId}`;
  /** The line under the card: added, already there, or why not. */
  const outcome = $derived.by((): { ok: boolean; text: string } | null => {
    if (!shown) return null;
    const v = shown.verdict;
    if (v === 'standing' || v === 'unchecked' || v === 'duplicate') return { ok: true, text: F.verdict[v] };
    return { ok: false, text: F.refusal[v] };
  });
  const bigNote = $derived(pad?.mode === 'start' && set.length < CONSOLE.finale.minFinalists ? F.needMore(CONSOLE.finale.minFinalists) : F.count(set.length));

  onMount(() => {
    root?.focus();
    return () => clearTimeout(freshTimer);
  });

  function press(key: PadKey): void {
    model.finalePadPress(key);
  }

  function enter(): void {
    const typed = pad?.digits ?? '';
    const outcome = model.finalePadEnter();
    // The chip's sound (`finale-pad-card`): it pops in, or the number is refused.
    if (outcome === 'refused') {
      shakes++;
      touchPress('refused');
    }
    if (outcome === 'added') {
      touchTap('chipAdd');
      fresh = Number(typed);
      clearTimeout(freshTimer);
      freshTimer = setTimeout(() => (fresh = null), CONSOLE.finale.freshMs);
    }
  }

  function onkeydown(e: KeyboardEvent): void {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      model.closeFinalePad();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      enter();
      return;
    }
    const key = padKeyFromKeyboard(e.key);
    if (key === null) return;
    e.preventDefault();
    // A physical key sounds like the pad's own.
    touchTap(key === 'back' || key === 'clear' ? 'backspace' : 'digit');
    press(key);
  }
</script>

<svelte:window {onkeydown} />

{#if pad}
  <section class="claim-pad finale-pad" bind:this={root} tabindex="-1" aria-label={F.padLabel} data-testid="finale-pad" data-mode={pad.mode}>
    <div class="claim-pad__left">
      <NowLine />
      <div class="panel claim-pad__entry">
        <div class="claim-pad__head">
          <h2 class="panel__label" id="{uid}-title">{F.padTitle}</h2>
          <p class="claim-pad__same">{F.padHint}</p>
        </div>

        {#key shakes}
          <output
            class="claim-pad__display"
            aria-live="polite"
            aria-label={F.display}
            data-state={pad.refused ? 'refused' : pad.digits ? 'typed' : 'empty'}
            data-anim={shakes > 0 && pad.refused ? 'claim-chip-refused' : undefined}
          >
            <span class="claim-pad__hash" aria-hidden="true">#</span>{pad.digits}<span class="claim-pad__caret" aria-hidden="true"></span>
          </output>
        {/key}
        {#if pad.refused}
          <p class="private-strip private-strip--bad" role="alert"><Icon name="cross" /><span class="private-strip__text">{F.refusal[pad.refused]}</span></p>
        {:else if full}
          <p class="note">{F.full(CONSOLE.finale.maxFinalists)}</p>
        {/if}

        <ul class="finale-pad__chips" aria-label={F.row}>
          {#each chips as id (id)}
            {@const mine = pad.added.includes(id)}
            <li class="finale-pad__chip" data-fresh={fresh === id || undefined} data-anim={fresh === id ? 'finale-pad-card' : undefined}>
              <span class="finale-pad__number">{F.chip(id)}</span>
              {#if mine}
                <button type="button" class="claim-chip__remove" aria-label={F.removeChip(id)} onclick={() => model.finalePadRemove(id)}><Icon name="close" /></button>
              {/if}
            </li>
          {/each}
        </ul>

        <span class="claim-pad__spacer"></span>
        <div class="claim-pad__keys">
          {#each PAD_DIGITS.slice(0, 9) as d (d)}
            <button type="button" class="pad-key" data-anim="press" onclick={() => press(d)}>{d}</button>
          {/each}
          <button type="button" class="pad-key pad-key--back" data-anim="press" onclick={() => press('back')}>
            <Icon name="backspace" /><span class="visually-hidden">{S.numpad.back}</span>
          </button>
          <button type="button" class="pad-key" data-anim="press" onclick={() => press('0')}>0</button>
          <button type="button" class="pad-key pad-key--enter" data-anim="press" data-testid="finale-enter" disabled={!pad.digits || full} onclick={enter}>
            <Icon name="enter" />
            <span class="visually-hidden">{F.enter}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="claim-pad__actions finale-pad__actions">
      <button type="button" class="big-button claim-pad__cancel finale-pad__close" data-action="cancel" data-anim="press" onclick={() => model.closeFinalePad()}>
        <span class="big-button__row"><Icon name="play" outline /><span class="big-button__label">{F.close}</span></span>
        <span class="big-button__note">{F.closeNote[pad.mode]}</span>
      </button>

      <section class="panel check-card finale-pad__card" aria-live="polite" data-testid="finale-card" data-card-id={shown?.cardId ?? ''} data-verdict={shown?.verdict ?? ''}>
        {#if shown}
          <header class="check-card__head">
            <h2 class="check-card__title">{F.card(shown.cardId)}</h2>
            {#if shownType}<span class="chip chip--type">{#if shownType.special}<Icon name="star" />{/if}{shownType.label}</span>{/if}
            <span class="finale-pad__legend">{F.legend}</span>
          </header>
          {#if shown.songs}
            <ol class="check-grid finale-pad__grid">
              {#each shown.songs as song, i (i)}
                <li class="check-cell" data-in data-revealed data-mark={song.landed ? 'bad' : 'good'} aria-label={`${title(song.songId)}: ${song.landed ? CA.landed : CA.notLanded}`}>
                  <span class="check-cell__art">
                    <Cover songId={song.songId} size="md" />
                    <span class="check-cell__mark" aria-hidden="true"><Icon name={song.landed ? 'cross' : 'check'} alone /></span>
                  </span>
                  <span class="check-cell__title" aria-hidden="true">{title(song.songId)}</span>
                </li>
              {/each}
            </ol>
          {:else}
            <p class="note">{F.noCard}</p>
          {/if}
          <span class="check-card__spacer"></span>
          {#if outcome}
            <p class="private-strip" class:private-strip--bad={!outcome.ok} data-testid="finale-verdict"><Icon name={outcome.ok ? 'check' : 'cross'} /><span class="private-strip__text">{outcome.text}</span></p>
          {/if}
        {:else}
          <p class="note finale-pad__empty">{F.padHint}</p>
        {/if}
      </section>

      <button
        type="button"
        class="big-button claim-pad__submit finale-pad__go"
        data-action="claim"
        data-anim="press"
        data-default={isDefault || undefined}
        data-testid="finale-go"
        disabled={command === null || !model.can('finale')}
        onclick={() => model.finalePadSubmit()}
      >
        <PodiumIcon />
        <span class="big-button__label">{pad.mode === 'start' ? F.begin : F.join}</span>
        <span class="finale-pad__count">{bigNote}</span>
        {#if isDefault}<WiiBadge button="a" />{/if}
      </button>
    </div>
  </section>
{/if}
