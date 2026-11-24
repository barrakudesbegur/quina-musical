<!--
  Plan B, in the menu: the current round's resume code, and resuming a replacement laptop from a code (this
  device's latest one, or one noted on paper), with a preview of the last counted song and a long press.
  The code holds the Shuffle's seed (with the cards it gives away the whole order), and a tablet may be in
  view of the audience, so every code here stays hidden until revealed: the field starts empty and is masked,
  and the preview shows only what is already public (the round, how many songs, the last landed song).
-->
<script lang="ts">
  import { CA } from '../../ui/i18n/ca.ts';
  import { getConsole } from '../context.ts';
  import { readResume, resumeSummary } from '../../ui/rules/resume.ts';
  import { songTitleOf } from '../logic/show-data.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import LongPressButton from './LongPressButton.svelte';

  const model = getConsole();
  const uid = $props.id();
  let revealed = $state(false);
  let draft = $state('');

  const live = $derived(model.show.state?.resume ?? null);
  const parsed = $derived(readResume(draft));
  const summary = $derived(parsed.point ? resumeSummary(parsed.point) : null);
  const title = $derived(summary ? songTitleOf(summary.lastSongId, model.show.state, model.catalog) : null);
  const roundName = $derived(summary ? `${CA.round(summary.round)}${summary.special ? ` · ${CA.specialRound}` : ''}` : '');
  const allowed = $derived(model.can('resumeAt'));
</script>

<section class="drawer__section resume" aria-labelledby="{uid}-title" data-state={allowed ? 'ready' : 'blocked'}>
  <h3 class="panel__subtitle" id="{uid}-title">{S.resume.title}</h3>

  <!-- One reveal for every code on this panel; it resets when the menu closes (the panel unmounts). -->
  <button type="button" class="action" data-anim="reveal" aria-expanded={revealed} onclick={() => (revealed = !revealed)}>
    <Icon name={revealed ? 'eyeOff' : 'eye'} /><span>{revealed ? S.resume.hide : S.resume.reveal}</span>
  </button>

  <h4 class="panel__subtitle">{S.resume.current}</h4>
  {#if live}
    <p class="note">{S.resume.currentNote}</p>
    {#if revealed}<output class="resume__code" data-anim="reveal">{live.text}</output>{/if}
  {:else}
    <p class="note">{S.resume.none}</p>
  {/if}

  <label class="field" for="{uid}-code">
    <span class="field__label">{S.resume.field}</span>
    <input
      id="{uid}-code"
      class="resume__input"
      type={revealed ? 'text' : 'password'}
      inputmode="text"
      autocomplete="off"
      autocapitalize="characters"
      spellcheck="false"
      placeholder={S.resume.placeholder}
      bind:value={draft}
    />
  </label>
  {#if model.savedResume && readResume(draft).text !== readResume(model.savedResume).text}
    <button type="button" class="choice" data-anim="press" onclick={() => (draft = model.savedResume ?? '')}>{S.resume.useSaved}</button>
  {/if}

  {#if summary}
    <p class="resume__preview" aria-live="polite">{S.resume.preview(roundName, summary.counted, title)}</p>
    {#if summary.lineFromSong !== null}<p class="note">{S.resume.lineFrom(summary.lineFromSong)}</p>{/if}
  {:else if parsed.error === 'invalid'}
    <p class="note note--warning" aria-live="polite">{S.resume.invalid}</p>
  {/if}

  <LongPressButton
    label={S.resume.send}
    note={S.resume.sendNote}
    icon="play"
    tone="accent"
    disabled={!parsed.point || !allowed}
    onconfirm={() => parsed.point && model.resume(parsed.point)}
  />
  {#if !allowed}<p class="note">{S.resume.notNow}</p>{/if}
</section>

<style>
  .resume__code {
    display: block;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: var(--text-xl);
    font-weight: var(--font-weight-strong);
    letter-spacing: 0.06em;
    padding: var(--space-2) var(--space-3);
    border: var(--line-width) dashed var(--color-line);
    border-radius: var(--radius-sm);
    user-select: all;
  }
  .resume__input {
    font-family: var(--font-mono, ui-monospace, monospace);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .resume__preview {
    font-weight: var(--font-weight-strong);
  }
</style>
