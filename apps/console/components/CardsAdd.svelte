<!--
  «Cartrons venuts» in the menu (D234, part 1; logic/cards-add.ts): the presenters add the cards sold on the night to
  the cards in play, a range («400-450») or single numbers («452, 460»). The TextField (B9) previews what «Afegeix»
  would add in its hint; why it can't (a typo, a number that isn't a printed card, all in play already) shows in red
  once the typing is over (the field left, or «Afegeix» pressed), never while a range is half typed. «Afegeix» sends
  the typed cards (`addCardsInPlay { ranges }`); the engine merges them, so two consoles adding at once keep both.
  Its answer (`outcome`, the model's: `cards.lastAdd` for this console's reqId) empties the field and shows a green
  Notice (E4, NOTICES.accepted) with what joined and what was in already (ANIMATIONS.md › cards-added); a refusal of
  numbers that aren't printed (`invalid`, the numbers in its detail) leaves the typed numbers and names them in the
  hint, in red. Either stays until the field is typed in again. Any other refusal is the console's usual toast. In the
  menu's second column, under «La nit». Hooks: data-testid="cards-add".
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import MiniButton from '../../../packages/ui/components/MiniButton.svelte';
  import Notice from '../../../packages/ui/components/Notice.svelte';
  import TextField from '../../../packages/ui/components/TextField.svelte';
  import { MINI, NOTICES } from '../actions.ts';
  import { cardsToAdd, type CardsAddError, type CardsAddOutcome, type CardsAddRules } from '../logic/cards-add.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  interface Props {
    /** The engine's `cards.inPlay` ("1-210, 400-440") and its count. */
    inPlay: string;
    count: number;
    rules: CardsAddRules;
    disabled?: boolean;
    /** The engine's answer to this console's last add (ConsoleModel.cardsAddOutcome), or null. */
    outcome?: CardsAddOutcome | null;
    /** What's typed (bindable: a parent may start it). */
    value?: string;
    /** Send the typed cards (as ranges); false when the command couldn't leave this device. */
    onadd: (ranges: string) => boolean;
  }

  let { inPlay, count, rules, disabled = false, outcome = null, value = $bindable(''), onadd }: Props = $props();
  const uid = $props.id();

  /** The typing is over (the field left, or «Afegeix» pressed): only then a problem shows, in red (modern-web-guidance
   *  validate-input-after-interaction: «400-» is on its way to a range, not a mistake). */
  let committed = $state(false);
  /** The answer the field was typed in again after (it no longer shows). */
  let dismissed = $state.raw<CardsAddOutcome | null>(null);

  const shown = $derived(outcome !== dismissed ? outcome : null);
  const preview = $derived(cardsToAdd(inPlay, value, rules));
  const shownError = $derived(shown?.kind === 'refused' ? shown.error : committed && !preview.empty ? preview.error : null);
  const hint = $derived(
    shownError
      ? errorText(shownError)
      : preview.empty || preview.error
        ? S.cardsAdd.hint
        : S.cardsAdd.preview(preview.added.length, preview.addedRanges, preview.already),
  );
  const done = $derived(
    shown?.kind === 'added'
      ? S.cardsAdd.done({ count: shown.addedCount, ranges: shown.added }, { count: shown.alreadyCount, ranges: shown.alreadyIn }, count)
      : null,
  );

  // The engine took them: the field empties.
  $effect(() => {
    if (shown?.kind !== 'added') return;
    untrack(() => {
      value = '';
      committed = false;
    });
  });

  function errorText(error: CardsAddError): string {
    switch (error.kind) {
      case 'token':
        return S.cardsAdd.error.token(error.token);
      case 'tooLarge':
        return S.cardsAdd.error.tooLarge(error.token);
      case 'unknown':
        return S.cardsAdd.error.unknown(error.ranges, error.count);
      case 'already':
        return S.cardsAdd.error.already;
      case 'tooLong':
        return S.cardsAdd.error.tooLong;
      case 'refused':
        return S.cardsAdd.error.refused;
    }
  }

  function submit(e: SubmitEvent): void {
    e.preventDefault();
    committed = true;
    // A new try: the last answer gives way to this one's.
    dismissed = outcome;
    if (disabled || !preview.ranges) return;
    onadd(preview.ranges);
  }
</script>

<section class="menu-group cards-add" aria-labelledby="{uid}-title" data-testid="cards-add">
  <h3 class="menu-group__title" id="{uid}-title"><Icon name="cards" />{S.cardsAdd.title}</h3>
  <p class="cards-add__now">
    {#if count > 0}
      <strong>{S.cardsAdd.inPlay(count)}</strong><span class="cards-add__ranges">{inPlay}</span>
    {:else}
      {S.cardsAdd.none}
    {/if}
  </p>
  <form class="cards-add__form" onsubmit={submit}>
    <TextField
      label={S.cardsAdd.field}
      placeholder={S.cardsAdd.placeholder}
      autocomplete="off"
      spellcheck={false}
      enterkeyhint="done"
      {hint}
      invalid={shownError !== null}
      bind:value
      oninput={() => ((dismissed = outcome), (committed = false))}
      onblur={() => (committed = value.trim() !== '')}
    />
    <MiniButton {...MINI.cardsAdd} type="submit" disabled={disabled || preview.empty} />
  </form>
  {#if done}<Notice {...NOTICES.accepted} class="cards-add__done" text={done} />{/if}
</section>

<style>
  @layer app {
  .cards-add__now {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px var(--space-2);
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text);
  }

  .cards-add__ranges {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
  }

  /* The field across the card (the column is narrow), «Afegeix» under its hint. */
  .cards-add__form {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .cards-add__form > :global(.text-field) {
    align-self: stretch;
  }

  /* cards-added: the Notice fades in (opacity, so either way). */
  .cards-add :global(.cards-add__done) {
    animation: cards-added 200ms var(--ease-out) both;
  }

  @keyframes cards-added {
    from {
      opacity: 0;
    }
  }
  }
</style>
