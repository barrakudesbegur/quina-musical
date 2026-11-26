<!--
  The claim pad (D110, D126; boards Consola-Comprovacio-Ritme ①, -Casos ⑤), over the whole body under the header,
  from «Comprovar cartró» or a Check's «+ Candidat»:
  - left: «Qui ha cantat?», Línia or Quina (no choice in the Desgraciat round), the numbers so far as chips and the
    one being typed, then the keys;
  - right: «Torna a la quina» (D164: back to the round's screen) and «+ Candidat» (the typed number becomes a chip,
    hook claim-chip-add), «Algú més?», and the big «Comprovar» (the default action: A, → or PageDown).
  A number that isn't a printed card is refused here, in private: it stays typed, in red, and shakes once; a chip the
  engine refused (its `unknownCard` rejection) comes back marked. Physical keys: digits, Backspace, Delete, + (Un
  Candidat), Enter (Comprovar), Escape (Torna a la quina). The pad's state is the model's (logic/claim-pad.ts).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { getConsole } from '../context.ts';
  import { claimedCards } from '../logic/claim-pad.ts';
  import { PAD_DIGITS, padKeyFromKeyboard, type PadKey } from '../logic/numpad.ts';
  import { claimKindsOf } from '../logic/show-data.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import NowLine from './NowLine.svelte';
  import WiiBadge from './WiiBadge.svelte';

  const model = getConsole();
  const uid = $props.id();
  let root: HTMLElement | undefined = $state();
  /** Bumps on each refusal, so the shake plays again. */
  let shakes = $state(0);
  /** The chip that just popped in (claim-chip-add). */
  let added = $state<number | null>(null);

  const pad = $derived(model.pad);
  const kinds = $derived(claimKindsOf(model.show.state));
  const claim = $derived(model.padClaim);
  const ids = $derived(claim ? claimedCards(claim) : (pad?.chips.map((c) => c.cardId) ?? []));
  const isDefault = $derived(model.defaultAction?.control === 'claimPad');
  const full = $derived(pad !== null && pad.chips.length >= model.padRules.maxCards);

  onMount(() => root?.focus());

  function press(key: PadKey): void {
    model.padPress(key);
  }

  function add(): void {
    const before = pad?.digits ?? '';
    const outcome = model.padAdd();
    if (outcome === 'unknown') shakes++;
    if (outcome === 'added') added = Number(before);
  }

  function submit(): void {
    const before = pad?.refused;
    model.padSubmit();
    if (model.pad?.refused && !before) shakes++;
  }

  function onkeydown(e: KeyboardEvent): void {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      model.closePad();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === '+') {
      e.preventDefault();
      add();
      return;
    }
    const key = padKeyFromKeyboard(e.key);
    if (key === null) return;
    e.preventDefault();
    press(key);
  }
</script>

<svelte:window {onkeydown} />

{#if pad}
  <section class="claim-pad" bind:this={root} tabindex="-1" aria-label={S.numpad.label} data-testid="claim-pad">
    <div class="claim-pad__left">
      <NowLine />
      <div class="panel claim-pad__entry">
        <div class="claim-pad__head">
          <h2 class="panel__label" id="{uid}-title">{S.numpad.title}</h2>
          <p class="claim-pad__same">{S.numpad.same}</p>
        </div>

        {#if kinds.length > 1}
          <div class="segmented claim-pad__kind" role="radiogroup" aria-label={S.numpad.kind}>
            {#each kinds as k (k)}
              <button type="button" class="segmented__option" role="radio" aria-checked={pad.kind === k} data-anim="press" onclick={() => model.padKind(k)}>{S.numpad.kinds[k]}</button>
            {/each}
          </div>
        {/if}

        <div class="claim-pad__numbers">
          <ul class="claim-pad__chips" aria-label={S.check.claims}>
            {#each pad.chips as chip (chip.cardId)}
              <li class="claim-chip" data-unknown={chip.unknown || undefined} data-anim={added === chip.cardId ? 'claim-chip-add' : undefined}>
                <span class="claim-chip__number">{S.numpad.chip(chip.cardId)}</span>
                {#if chip.unknown}<span class="claim-chip__note">{S.numpad.unknownChip}</span>{/if}
                <button type="button" class="claim-chip__remove" aria-label={S.numpad.removeChip(chip.cardId)} onclick={() => model.padRemove(chip.cardId)}><Icon name="close" /></button>
              </li>
            {/each}
          </ul>
          {#key shakes}
            <output
              class="claim-pad__display"
              aria-live="polite"
              aria-label={S.numpad.display}
              data-state={pad.refused ? 'refused' : pad.digits ? 'typed' : 'empty'}
              data-anim={shakes > 0 && pad.refused ? 'claim-chip-refused' : undefined}
            >
              <span class="claim-pad__hash" aria-hidden="true">#</span>{pad.digits}<span class="claim-pad__caret" aria-hidden="true"></span>
            </output>
          {/key}
        </div>

        {#if pad.refused || pad.chips.some((c) => c.unknown)}
          <p class="private-strip private-strip--bad" role="alert">
            <Icon name="cross" /><span class="private-strip__text">{S.numpad.unknown}</span>
          </p>
        {:else if full}
          <p class="note">{S.numpad.full(model.padRules.maxCards)}</p>
        {/if}

        <span class="claim-pad__spacer"></span>
        <div class="claim-pad__keys">
          {#each PAD_DIGITS.slice(0, 9) as d (d)}
            <button type="button" class="pad-key" data-anim="press" onclick={() => press(d)}>{d}</button>
          {/each}
          <button type="button" class="pad-key pad-key--back" data-anim="press" onclick={() => press('back')}>
            <Icon name="backspace" /><span class="visually-hidden">{S.numpad.back}</span>
          </button>
          <button type="button" class="pad-key" data-anim="press" onclick={() => press('0')}>0</button>
        </div>
      </div>
    </div>

    <div class="claim-pad__actions">
      <button type="button" class="big-button claim-pad__cancel" data-action="cancel" data-anim="press" onclick={() => model.closePad()}>
        <span class="big-button__label">{S.numpad.cancel}</span>
      </button>
      <button type="button" class="big-button claim-pad__add" data-action="add" data-anim="press" disabled={!pad.digits || full} onclick={add}>
        <span class="big-button__row"><Icon name="plus" outline /><span class="big-button__label">{S.numpad.add}</span></span>
      </button>
      <section class="panel claim-pad__more" aria-labelledby="{uid}-more">
        <h2 class="claim-pad__more-title" id="{uid}-more">{S.numpad.moreTitle}</h2>
        <p class="claim-pad__more-text">{S.numpad.moreText}</p>
      </section>
      <button
        type="button"
        class="big-button claim-pad__submit"
        data-action="pad-submit"
        data-anim="press"
        data-default={isDefault || undefined}
        disabled={claim === null || !model.can('claim')}
        onclick={submit}
      >
        <span class="big-button__row"><Icon name="check" outline /><span class="big-button__label">{S.numpad.submit(ids)}</span></span>
        <span class="big-button__note">{S.numpad.submitNote(pad.kind, ids)}</span>
        {#if isDefault}<WiiBadge button="a" />{/if}
      </button>
    </div>
  </section>
{/if}
