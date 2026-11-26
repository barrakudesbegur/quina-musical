<!--
  The Cerca tab (D162, D170, D187; the Consola-Pestanyes-Noves board, frames ②, ③, b–e), PRIVATE: one tab with a
  «Cançons / Cartró» switch.
  - Cançons: with nothing typed, the round's played songs, newest first. Typing filters the round's songs with the
    fuzzy search (logic/fuzzy.ts), the matched letters marked, each saying whether it played («Ha sonat: la 14a, fa
    9», «Encara no ha sonat»), never when it will. While the box has the focus the tab grows over the column, so the
    tablet's keyboard doesn't cover the results (HelperTabs' data-typing).
  - Cartró: the number on the tab's own keypad, in one row (the tablet's keyboard never opens); ↵ shows the card
    (CardPeek). «Mostra el futur» is the card's own, apart from the Futur tab's reveal.
  Its state lives in the model (`search`), so it survives a tab switch or a Check.
-->
<script lang="ts">
  import { roundCardType, roundSide } from '@quina/protocol';
  import { CONSOLE } from '../config.ts';
  import { getConsole } from '../context.ts';
  import { knownCardTypes } from '../../../packages/ui/data/card-types.ts';
  import { typeChip } from '../logic/check.ts';
  import { peekCard, roundSongIds, searchSongs } from '../logic/lookup.ts';
  import { PAD_DIGITS, padKeyFromKeyboard, padPress, padValue, type PadKey } from '../logic/numpad.ts';
  import { hasPlayed, type SongStatus } from '../logic/upcoming.ts';
  import { S } from '../strings.ts';
  import CardPeek from './CardPeek.svelte';
  import Icon from './Icon.svelte';
  import PlayedList from './PlayedList.svelte';
  import SongRow from './SongRow.svelte';

  const model = getConsole();
  const uid = $props.id();
  const search = model.search;
  const snap = $derived(model.show.state);
  const songs = $derived(model.roundSongs);
  const limits = { maxDigits: CONSOLE.cardDigits, max: CONSOLE.cardMax };
  const MODES = ['songs', 'card'] as const;

  // ---- Cançons
  const query = $derived(search.query.trim());
  const ids = $derived(songs ? roundSongIds(songs, model.roundCards) : []);
  const hits = $derived(songs && query ? searchSongs(query, ids, (id) => model.songInfo.get(id) ?? null, songs) : []);
  const statusText = (s: SongStatus) =>
    s.state === 'now' ? S.cerca.status.now : s.state === 'played' ? S.cerca.status.played(s.place, s.ago) : s.state === 'earlier' ? S.cerca.status.earlier : s.state === 'unknown' ? S.cerca.status.unknown : S.cerca.status.notYet;

  // ---- Cartró
  const peek = $derived(
    snap && songs && search.cardId !== null
      ? peekCard({
          printed: model.catalog?.cards ?? null,
          cardId: search.cardId,
          cardType: roundCardType(snap.round),
          side: roundSide(snap.round),
          inPlay: model.inPlay,
          songs,
          lineConfirmed: snap.round.lineConfirmed,
          forecast: snap.round.kind === 'desgraciat' ? null : model.forecast,
          standing: snap.round.kind === 'desgraciat' ? { cardIds: snap.standing?.cardIds ?? null } : null,
        })
      : null,
  );
  const otherType = $derived(peek?.status === 'otherRound' ? (typeChip(peek.type, knownCardTypes(model.catalog?.cardTypes), model.plan)?.name.toLowerCase() ?? peek.type) : '');

  // The box loses its focus without a blur when the tab closes: the column comes back.
  $effect(() => () => {
    search.typing = false;
  });

  function setMode(mode: 'songs' | 'card'): void {
    search.mode = mode;
    search.typing = false;
  }

  function press(key: PadKey | 'enter'): void {
    if (key !== 'enter') {
      search.digits = padPress(search.digits, key, limits);
      return;
    }
    const id = padValue(search.digits, limits);
    if (id === null) return;
    search.cardId = id;
    search.digits = '';
    search.cardFuture = false;
  }

  function clearCard(): void {
    search.cardId = null;
    search.digits = '';
    search.cardFuture = false;
  }

  /** A laptop's keyboard on the card's keypad: digits, ⌫, Delete and ↵. */
  function onkeydown(e: KeyboardEvent): void {
    if (search.mode !== 'card' || search.cardId !== null) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      press('enter');
      return;
    }
    const key = padKeyFromKeyboard(e.key);
    if (key === null) return;
    e.preventDefault();
    press(key);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions: the keys reach it from the keypad's buttons -->
<div class="search-tab" data-mode={search.mode} data-private="true" {onkeydown}>
  <div class="search-tab__bar">
    {#if search.mode === 'songs'}
      <label class="search-box">
        <Icon name="search" />
        <input
          type="search"
          class="search-box__input"
          placeholder={S.cerca.placeholder}
          aria-label={S.cerca.searchLabel}
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          enterkeyhint="search"
          bind:value={search.query}
          onfocus={() => (search.typing = true)}
          onblur={() => (search.typing = false)}
          onkeydown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
        />
        {#if search.query}
          <button type="button" class="search-box__clear" aria-label={S.cerca.clear} onclick={() => (search.query = '')}><Icon name="close" /></button>
        {/if}
      </label>
    {:else}
      <div class="search-box search-box--card">
        <span class="search-box__hash" aria-hidden="true">#</span>
        <output class="search-box__number" aria-label={S.cerca.number} aria-live="polite" data-state={search.cardId !== null ? 'shown' : 'typing'}>
          {search.cardId ?? search.digits}
        </output>
        {#if search.cardId !== null}
          <button type="button" class="search-box__clear" aria-label={S.cerca.clearCard} onclick={clearCard}><Icon name="close" /></button>
        {/if}
      </div>
      {#if peek?.status === 'ok'}
        <button type="button" class="mini search-tab__future" data-anim="press" aria-pressed={search.cardFuture} onclick={() => (search.cardFuture = !search.cardFuture)}>
          <Icon name={search.cardFuture ? 'eyeOff' : 'eye'} /><span>{search.cardFuture ? S.cerca.hideFuture : S.cerca.showFuture}</span>
        </button>
      {/if}
    {/if}
    <div class="segmented search-tab__modes" role="radiogroup" aria-label={S.cerca.modeLabel}>
      {#each MODES as mode (mode)}
        <button type="button" class="segmented__option" role="radio" aria-checked={search.mode === mode} data-anim="press" onclick={() => setMode(mode)}>
          <Icon name={mode === 'songs' ? 'music' : 'grid'} /><span>{S.cerca.modes[mode]}</span>
        </button>
      {/each}
    </div>
  </div>

  {#if search.mode === 'songs'}
    {#if !query}
      <PlayedList sub={S.played.newestInOrder} scrollKey="search" />
    {:else}
      <section class="search-tab__results" aria-labelledby="{uid}-count">
        <p class="search-tab__count" id="{uid}-count" aria-live="polite">
          <span class="panel__label">{S.cerca.count(hits.length)}</span> <span class="played__sub">{S.cerca.ofRound(ids.length)}</span>
        </p>
        {#if hits.length === 0}
          <p class="note">{S.cerca.noMatch(query)}</p>
        {:else}
          <ul class="song-list">
            {#each hits as hit (hit.song.songId)}
              {@const played = hasPlayed(hit.status)}
              <SongRow songId={hit.song.songId} title={hit.song.title} artist={hit.song.artist} match={hit} state={hit.status.state === 'now' ? 'now' : null}>
                {#snippet aside()}
                  <span class="song-status" data-played={played || undefined}>{#if played}<Icon name="check" />{/if}{statusText(hit.status)}</span>
                {/snippet}
              </SongRow>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
  {:else if search.cardId === null}
    <div class="card-keys" role="group" aria-label={S.cerca.keypad}>
      {#each PAD_DIGITS as digit (digit)}
        <button type="button" class="pad-key" data-anim="press" onclick={() => press(digit)}>{digit}</button>
      {/each}
      <button type="button" class="pad-key pad-key--back" data-anim="press" aria-label={S.cerca.erase} onclick={() => press('back')}><Icon name="backspace" /></button>
      <button type="button" class="pad-key pad-key--enter" data-anim="press" aria-label={S.cerca.enter} disabled={padValue(search.digits, limits) === null} onclick={() => press('enter')}><Icon name="enter" /></button>
    </div>
    <p class="note">{S.cerca.hint}</p>
  {:else if peek?.status === 'ok' && snap}
    <CardPeek {peek} side={roundSide(snap.round)} future={search.cardFuture} />
  {:else if peek?.status === 'unknown'}
    <p class="note note--warning">{S.cerca.unknownCard(peek.cardId)}</p>
  {:else if peek?.status === 'otherRound'}
    <p class="note note--warning">{S.cerca.otherRound(peek.cardId, otherType)}</p>
  {:else if peek?.status === 'noCards'}
    <p class="note note--warning">{S.cerca.noCards}</p>
  {/if}
</div>
