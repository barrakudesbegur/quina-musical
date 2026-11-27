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
  import IconButton from '../../../packages/ui/components/IconButton.svelte';
  import { onMount } from 'svelte';
  import { knownCardTypes } from '../../../packages/ui/data/card-types.ts';
  import { CONSOLE } from '../config.ts';
  import { getConsole } from '../context.ts';
  import { typeChip } from '../logic/check.ts';
  import { finalePadSet } from '../logic/finale.ts';
  import { padKeyFromKeyboard, type PadKey } from '../logic/numpad.ts';
  import { songTitleOf } from '../logic/show-data.ts';
  import { CA, S } from '../strings.ts';
  import CardCell from '../../../packages/ui/components/CardCell.svelte';
  import { cellLook } from '../../../packages/ui/components/card-looks.ts';
  import Button from '../../../packages/ui/components/Button.svelte';
  import { ACTIONS, ICONS, NOTICES, asDefault } from '../actions.ts';
  import Notice from '../../../packages/ui/components/Notice.svelte';
  import Chip from '../../../packages/ui/components/Chip.svelte';
  import NumberField from '../../../packages/ui/components/NumberField.svelte';
  import NumberPad from '../../../packages/ui/components/NumberPad.svelte';
  import NowLine from './NowLine.svelte';
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
          <NumberField class="claim-pad__display" label={F.display} value={pad.digits} invalid={Boolean(pad.refused)} data-anim={shakes > 0 && pad.refused ? 'claim-chip-refused' : undefined} />
        {/key}
        {#if pad.refused}
          <Notice {...NOTICES.refused} class="private-strip" text={F.refusal[pad.refused]} />
        {:else if full}
          <p class="note">{F.full(CONSOLE.finale.maxFinalists)}</p>
        {/if}

        <ul class="finale-pad__chips" aria-label={F.row}>
          {#each chips as id (id)}
            {@const mine = pad.added.includes(id)}
            <li class="finale-pad__chip" data-fresh={fresh === id || undefined} data-anim={fresh === id ? 'finale-pad-card' : undefined}>
              <span class="finale-pad__number">{F.chip(id)}</span>
              {#if mine}
                <IconButton {...ICONS.removeChip} label={F.removeChip(id)} class="claim-chip__remove" onclick={() => model.finalePadRemove(id)} />
              {/if}
            </li>
          {/each}
        </ul>

        <span class="claim-pad__spacer"></span>
        <NumberPad
          class="claim-pad__keys"
          label={S.numpad.keypad}
          backLabel={S.numpad.back}
          enter
          enterLabel={F.enter}
          canEnter={Boolean(pad.digits) && !full}
          enterTestid="finale-enter"
          onkey={(key) => (key === 'enter' ? enter() : press(key))}
        />
      </div>
    </div>

    <div class="claim-pad__actions finale-pad__actions">
      <Button {...ACTIONS.finaleClose} class="claim-pad__cancel finale-pad__close" note={F.closeNote[pad.mode]} onclick={() => model.closeFinalePad()} />

      <section class="panel check-card finale-pad__card" aria-live="polite" data-testid="finale-card" data-card-id={shown?.cardId ?? ''} data-verdict={shown?.verdict ?? ''}>
        {#if shown}
          <header class="check-card__head">
            <h2 class="check-card__title">{F.card(shown.cardId)}</h2>
            {#if shownType}<Chip class="card-type-chip" color="snow" icon={shownType.special ? 'star' : null} label={shownType.label} />{/if}
            <span class="finale-pad__legend">{F.legend}</span>
          </header>
          {#if shown.songs}
            <ol class="check-grid finale-pad__grid">
              {#each shown.songs as song, i (i)}
                <CardCell
                  class="check-cell"
                  songId={song.songId}
                  title={title(song.songId)}
                  label={`${title(song.songId)}: ${song.landed ? CA.landed : CA.notLanded}`}
                  {...cellLook(song.landed ? 'missed' : 'landed')}
                  ring={song.landed ? 'red' : null}
                  data-in
                  data-revealed
                  data-mark={song.landed ? 'bad' : 'good'}
                />
              {/each}
            </ol>
          {:else}
            <p class="note">{F.noCard}</p>
          {/if}
          <span class="check-card__spacer"></span>
          {#if outcome}
            <Notice {...outcome.ok ? NOTICES.accepted : NOTICES.refused} live="off" class="private-strip" data-testid="finale-verdict" text={outcome.text} />
          {/if}
        {:else}
          <p class="note finale-pad__empty">{F.padHint}</p>
        {/if}
      </section>

      <Button
        {...asDefault(ACTIONS.finaleGo, isDefault)}
        class="claim-pad__submit finale-pad__go"
        label={pad.mode === 'start' ? F.begin : F.join}
        data-testid="finale-go"
        disabled={command === null || !model.can('finale')}
        onclick={() => model.finalePadSubmit()}
      >
        <span class="finale-pad__count">{bigNote}</span>
      </Button>
    </div>
  </section>
{/if}
