<script lang="ts">
  // "Afegir cartró" (boards "App · calaix per afegir un cartró" and "afegir cartró: casos especials"): the card's
  // number on a paper field, an optional name, its icon (the first free one preselected), the smart keypad and one
  // "Desar". A digit key works only while the number can still become a printed card's (logic/pad.ts); "Desar" lights
  // up once it is one the player doesn't have (ANIMATIONS.md `pad-keys`). A number the player already has says whose
  // it is, with "Veure'l". Leaving with a number typed asks first (PadLeave, `pad-leave`).
  import { PLAYER_CONFIG } from '../config.ts';
  import { leaveNeedsConfirm, padCatalog, padRules, padValue } from '../logic/pad.ts';
  import { nextColor, type SavedCard } from '../logic/storage.ts';
  import { S } from '../strings.ts';
  import CardMark from './CardMark.svelte';
  import Drawer from './Drawer.svelte';
  import IconPicker from './IconPicker.svelte';
  import PadLeave from './PadLeave.svelte';

  let {
    cards,
    printed,
    onadd,
    onsee,
    onclose,
    onkey,
    ontyping,
  }: {
    cards: readonly SavedCard[];
    /** The printed cards by number (the catalogue), or null while it loads (then any possible number is typed). */
    printed: ReadonlyMap<number, unknown> | null;
    onadd: (id: number, identity: number, name: string) => string | null;
    /** "Veure'l": show that card on the home screen. */
    onsee: (id: number) => void;
    onclose: () => void;
    onkey?: () => void;
    /** Whether a number is typed (a Celebration leaves the pad open then: D90). */
    ontyping?: (typing: boolean) => void;
  } = $props();
  // The pick starts at the first free icon of the cards the sheet opened with.
  // svelte-ignore state_referenced_locally
  let identity = $state(nextColor(cards));
  let value = $state('');
  let name = $state('');
  let error = $state<string | null>(null);
  /** The leave question is open; `proceed` closes the drawer the way the player asked ("‹" or ✕). */
  let leaving = $state<{ proceed: () => void } | null>(null);

  const catalog = $derived(printed ? padCatalog(printed.keys()) : null);
  const rules = $derived(padRules(value, cards.map((c) => c.id), catalog));
  const owned = $derived(rules.owned === null ? null : (cards.find((c) => c.id === rules.owned) ?? null));

  /** The drawer may close at once with nothing typed; otherwise the player confirms first. */
  function canClose(proceed: () => void): boolean {
    if (!leaveNeedsConfirm(value)) return true;
    leaving = { proceed };
    return false;
  }
  /** "Descartar": the question goes, and the drawer closes as the player asked. */
  function discard(): void {
    const proceed = leaving?.proceed;
    leaving = null;
    proceed?.();
  }
  $effect(() => {
    ontyping?.(value !== '');
  });
  $effect(() => () => ontyping?.(false));

  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'] as const;

  function press(key: string): void {
    onkey?.();
    value = padValue(value, key);
    error = null;
  }

  function save(): void {
    if (!rules.canSave) return;
    onkey?.();
    // Saved: the app closes every drawer and shows the new card; an error (the phone is full) stays here.
    error = onadd(Number(value), identity, name);
  }
</script>

<Drawer name="pad" title={S.padTitle} {onclose} {canClose}>
  <div class="number-pad">
    <div class="number-pad__field" data-state={value ? 'typed' : 'empty'}>
      <span class="number-pad__hash" aria-hidden="true">#</span>
      <output class="number-pad__digits" aria-label={S.padNumber} aria-live="polite">{value}</output>
      <span class="number-pad__caret" aria-hidden="true"></span>
    </div>
    {#if owned}
      <p class="number-pad__note" role="status">
        <span class="number-pad__note-mark" aria-hidden="true"><CardMark identity={owned.color} decorative /></span>
        <span class="number-pad__note-text">{S.alreadyYours(owned.name)}</span>
        <button type="button" class="number-pad__see" onclick={() => onsee(owned.id)}>{S.seeCard}</button>
      </p>
    {:else if error}
      <p class="number-pad__note" role="alert"><span class="number-pad__note-text">{error}</span></p>
    {/if}
    <input
      class="number-pad__name"
      bind:value={name}
      maxlength={PLAYER_CONFIG.maxNameLength}
      placeholder={S.padName}
      aria-label={S.nameLabel}
      autocomplete="off"
      enterkeyhint="done"
      onkeydown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
    <IconPicker
      others={cards}
      selected={identity}
      legend={false}
      onselect={(n) => {
        onkey?.();
        identity = n;
      }}
    />
    <div class="number-pad__keys" data-anim="pad-keys">
      {#each KEYS as key, i (i)}
        {#if key === ''}
          <span aria-hidden="true"></span>
        {:else if key === 'back'}
          <button type="button" class="number-pad__key number-pad__key--delete" aria-label={S.padDelete} disabled={!rules.canDelete} onclick={() => press(key)}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 5h11v14H9l-6-7z" /><path d="M12.5 9.5l5 5M17.5 9.5l-5 5" />
            </svg>
          </button>
        {:else}
          <button type="button" class="number-pad__key" data-key={key} disabled={!rules.digits.has(key)} onclick={() => press(key)}>{key}</button>
        {/if}
      {/each}
    </div>
    <button type="button" class="big-button tone-ok number-pad__save" disabled={!rules.canSave} onclick={save}>
      <!-- The board's tick (CHECK_SVG): white over a thick ink stroke, like the outlined words. -->
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" stroke="var(--color-line)" stroke-width="7" /><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" stroke-width="3.2" />
      </svg>
      {S.save}
    </button>
  </div>
</Drawer>
{#if leaving}
  <PadLeave id={Number(value)} oncontinue={() => (leaving = null)} ondiscard={discard} />
{/if}
