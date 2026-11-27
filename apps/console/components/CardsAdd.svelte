<!--
  «Cartrons venuts» in the menu (D234, part 1; logic/cards-add.ts): the presenters add the cards sold on the night to
  the cards in play, a range («400-450») or single numbers («452, 460»). The TextField (B9) previews what «Afegeix»
  would add in its hint, or why it can't (a typo, a number that isn't a printed card, all in play already), in red. The
  engine's one command for it replaces the whole list (`setCardsInPlay { ranges }`), so «Afegeix» sends the cards in
  play now with the new ones. Once the engine's `cards.inPlay` holds them, the field empties and a green Notice (E4,
  NOTICES.accepted) confirms it (ANIMATIONS.md › cards-added); a refusal is the console's usual toast, and the typed
  numbers stay. In the menu's second column, under «La nit». Hooks: data-testid="cards-add".
-->
<script lang="ts">
  import MiniButton from '../../../packages/ui/components/MiniButton.svelte';
  import Notice from '../../../packages/ui/components/Notice.svelte';
  import TextField from '../../../packages/ui/components/TextField.svelte';
  import { MINI, NOTICES } from '../actions.ts';
  import { allInPlay, cardsToAdd, type CardsAddError, type CardsAddRules } from '../logic/cards-add.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  interface Props {
    /** The engine's `cards.inPlay` ("1-210, 400-440") and its count. */
    inPlay: string;
    count: number;
    rules: CardsAddRules;
    disabled?: boolean;
    /** Send the cards in play with the new ones; false when the command couldn't leave this device. */
    onadd: (ranges: string) => boolean;
  }

  let { inPlay, count, rules, disabled = false, onadd }: Props = $props();
  const uid = $props.id();

  let text = $state('');
  /** Sent, until the engine's list holds them. */
  let sent = $state.raw<{ added: number[]; addedRanges: string } | null>(null);
  /** The engine took them: the Notice's words. */
  let done = $state<string | null>(null);

  const preview = $derived(cardsToAdd(inPlay, text, rules));
  const hint = $derived(
    preview.empty
      ? S.cardsAdd.hint
      : preview.error
        ? errorText(preview.error)
        : S.cardsAdd.preview(preview.added.length, preview.addedRanges, preview.already),
  );

  // The engine's echo: every sent card is in play now.
  $effect(() => {
    if (!sent || !allInPlay(inPlay, sent.added)) return;
    done = S.cardsAdd.done(sent.added.length, sent.addedRanges, count);
    sent = null;
    text = '';
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
      case 'inPlay':
        return S.cardsAdd.error.inPlay;
    }
  }

  function submit(e: SubmitEvent): void {
    e.preventDefault();
    const { ranges, added, addedRanges } = preview;
    if (disabled || !ranges) return;
    // Taken before sending: an echo that arrives at once would change the preview.
    if (onadd(ranges)) sent = { added, addedRanges };
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
      invalid={!preview.empty && preview.error !== null}
      bind:value={text}
      oninput={() => (done = null)}
    />
    <MiniButton {...MINI.cardsAdd} type="submit" disabled={disabled || !preview.ranges} />
  </form>
  {#if done}<Notice {...NOTICES.accepted} class="cards-add__done" text={done} />{/if}
</section>

<style>
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
</style>
