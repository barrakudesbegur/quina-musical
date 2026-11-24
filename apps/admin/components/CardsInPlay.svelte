<!-- Cards in play as ranges, with a live preview, sent to the engine with `setCardsInPlay`. They live in the
     engine's Game journal, not in the plan. -->
<script lang="ts">
  import type { ShowStore } from '../../../packages/ui/client/show.svelte.ts';
  import type { CommandTracker } from '../state/commands.svelte.ts';
  import { RANGES_MAX_LENGTH, previewCardRanges, sameCards, type CardTypes, type RangesError } from '../logic/cards-preview.ts';
  import { S } from '../strings.ts';
  import CommandStatus from './CommandStatus.svelte';

  let { show, commands, cardTypes, catalogFailed }: { show: ShowStore; commands: CommandTracker; cardTypes: CardTypes | null; catalogFailed: boolean } = $props();

  const engine = $derived(show.state?.cards ?? null);
  let text = $state('');
  let touched = $state(false);
  // Start from what the engine has, until the admin types.
  $effect(() => {
    if (!touched && engine) text = engine.inPlay;
  });

  const preview = $derived(previewCardRanges(text, cardTypes));
  const matchesEngine = $derived(engine !== null && sameCards(preview.ranges, engine.inPlay));

  function errorText(error: RangesError): string {
    switch (error.kind) {
      case 'token':
        return S.cards.error.token(error.token);
      case 'tooLarge':
        return S.cards.error.tooLarge(error.token);
      case 'tooLong':
        return S.cards.error.tooLong(error.length, RANGES_MAX_LENGTH);
      case 'other':
        return error.message;
    }
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!preview.ok) return;
    commands.send('setCardsInPlay', null, { ranges: preview.ranges });
  }
</script>

<section class="panel surface cards-in-play" aria-labelledby="cards-title">
  <h2 class="panel__title" id="cards-title">{S.cards.title}</h2>
  <p class="panel__help">{S.cards.help}</p>

  <form class="cards-in-play__form" onsubmit={submit}>
    <label class="field">
      <span class="field__label">{S.cards.label}</span>
      <textarea
        rows="2"
        bind:value={text}
        oninput={() => (touched = true)}
        placeholder="1-180, 200-215, 400-460"
        spellcheck="false"
        autocomplete="off"
        aria-describedby="cards-preview"
        aria-invalid={!preview.ok}
      ></textarea>
    </label>

    <div class="cards-in-play__preview" id="cards-preview" aria-live="polite">
      {#if preview.error}
        <p class="notice notice--error">{errorText(preview.error)}</p>
      {:else}
        <p class="cards-in-play__counts">
          <strong>{S.cards.count(preview.count)}</strong>
          {#if preview.types}
            · {S.cards.normal(preview.types.normal)} · {S.cards.special(preview.types.special)}
          {/if}
        </p>
        {#if preview.types && preview.types.unknownCount}
          <p class="notice notice--warn">{S.cards.unknown(preview.types.unknownCount, preview.types.unknownRanges)}</p>
        {/if}
        {#if catalogFailed}<p class="panel__help">{S.cards.typesUnknown}</p>{/if}
        <p class="cards-in-play__send">
          {S.cards.willSend}: <code>{preview.ranges || '—'}</code>
          {#if !preview.count}<span class="panel__help">{S.cards.empty}</span>{/if}
        </p>
      {/if}
    </div>

    <div class="panel__actions">
      <button type="submit" class="tone-primary" disabled={!preview.ok || !commands.canSend}>{S.cards.send}</button>
      <CommandStatus record={commands.last('setCardsInPlay')} />
    </div>
  </form>

  <p class="cards-in-play__engine">
    {S.cards.engine}:
    {#if engine && engine.inPlayCount}
      <code>{engine.inPlay}</code> — {S.cards.engineCounts(engine.inPlayCount, engine.validCount)}.
      {matchesEngine ? S.cards.matches : S.cards.differs}
    {:else}
      {S.cards.engineNone}.
    {/if}
  </p>
</section>

<style>
  .cards-in-play__form {
    display: grid;
    gap: var(--space-3);
  }
  .cards-in-play__preview {
    display: grid;
    gap: var(--space-2);
  }
  .cards-in-play__counts {
    font-size: var(--text-lg);
  }
  .cards-in-play__send,
  .cards-in-play__engine {
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }
</style>
