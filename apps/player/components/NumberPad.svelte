<script lang="ts">
  import Button from '../../../packages/ui/components/Button.svelte';
  import { PLAYER } from '../actions.ts';
  // "Afegir cartró" (boards "App · calaix per afegir un cartró" and "afegir cartró: casos especials"): the card's
  // number on a paper field, an optional name, its icon (the first free one preselected), the smart keypad and one
  // "Desar". A digit key works only while the number can still become a printed card's (logic/pad.ts); "Desar" lights
  // up once it is one the player doesn't have (ANIMATIONS.md `pad-keys`); it stays pinned to the drawer's bottom while
  // the rest scrolls above it, so a small phone still shows it (D188). A number the player already has says whose
  // it is, with "Veure'l". Leaving with a number typed asks first (PadLeave, `pad-leave`). The QR button opens the
  // camera (D141, QrScan) as its own drawer stacked over this one (`qr-scan`, the user's phone test of 27 Nov): a
  // card's QR closes it and fills the number in here, keeping the name and icon picked (`qr-found`); ‹ goes back here.
  import { PLAYER_CONFIG } from '../config.ts';
  import { leaveNeedsConfirm, padCatalog, padRules, padValue } from '../logic/pad.ts';
  import { nextColor, type SavedCard } from '../logic/storage.ts';
  import { S } from '../strings.ts';
  import CardMark from './CardMark.svelte';
  import Drawer from './Drawer.svelte';
  import Icon from './Icon.svelte';
  import IconPicker from './IconPicker.svelte';
  import PadLeave from './PadLeave.svelte';
  import QrScan from './QrScan.svelte';

  let {
    cards,
    printed,
    onadd,
    onsee,
    onclose,
    ontyping,
  }: {
    cards: readonly SavedCard[];
    /** The printed cards by number (the catalogue), or null while it loads (then any possible number is typed). */
    printed: ReadonlyMap<number, unknown> | null;
    onadd: (id: number, identity: number, name: string) => string | null;
    /** "Veure'l": show that card on the home screen. */
    onsee: (id: number) => void;
    onclose: () => void;
    /** Whether a number is typed (a Celebration leaves the pad open then: D90). */
    ontyping?: (typing: boolean) => void;
  } = $props();
  // The pick starts at the first free icon of the cards the sheet opened with.
  // svelte-ignore state_referenced_locally
  let identity = $state(nextColor(cards));
  let value = $state('');
  let name = $state('');
  let error = $state<string | null>(null);
  /** The camera's drawer is over the pad (D141): mounted while `scanning`, closing (silently) once `scanOpen` goes. */
  let scanning = $state(false);
  let scanOpen = $state(false);
  /** A QR has just filled the number in: the field's green ring (`qr-found`). */
  let found = $state(0);
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
  const QR_DOTS = [
    [12.1, 2.4, 2, 3.4], [12.1, 8, 2, 3.6], [2.4, 12.1, 3.4, 2], [8, 12.1, 2, 2], [14.2, 12.1, 3.6, 2], [19.8, 12.1, 2, 3.6],
    [12.1, 14.2, 2, 2], [16.2, 16.2, 2, 2], [12.1, 18.2, 3.6, 2], [18.2, 18.2, 3.6, 2], [14.2, 20, 2, 2], [19.8, 20, 2, 2],
  ] as const;

  function press(key: string): void {
    value = padValue(value, key);
    error = null;
  }

  function scanned(cardId: number): void {
    value = String(cardId);
    error = null;
    scanOpen = false;
    found += 1;
  }

  function save(): void {
    if (!rules.canSave) return;
    // Saved: the app closes every drawer and shows the new card; an error (the phone is full) stays here.
    error = onadd(Number(value), identity, name);
  }
</script>

<Drawer name="pad" title={S.padTitle} {onclose} {canClose}>
  <div class="number-pad">
    {#key found}
      <div class="number-pad__field" data-state={value ? 'typed' : 'empty'} data-anim={found ? 'qr-found' : undefined}>
        <span class="number-pad__hash" aria-hidden="true">#</span>
        <output class="number-pad__digits" aria-label={S.padNumber} aria-live="polite">{value}</output>
        <span class="number-pad__caret" aria-hidden="true"></span>
        <button
          type="button"
          class="number-pad__qr"
          aria-label={S.qrButton}
          onclick={() => {
            scanning = true;
            scanOpen = true;
          }}
        >
          <!-- The softened QR (the user, 26 Nov): rounded finders and dots, no frame. -->
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {#each [[2, 2], [14, 2], [2, 14]] as [x, y] (`${x},${y}`)}
              <rect x={x + 1} y={y + 1} width="6" height="6" rx="1.9" fill="none" stroke="currentColor" stroke-width="2" /><rect x={x + 2.9} y={y + 2.9} width="2.2" height="2.2" rx=".8" />
            {/each}
            {#each QR_DOTS as [x, y, w, h] (`${x},${y}`)}<rect {x} {y} width={w} height={h} rx="1" />{/each}
          </svg>
        </button>
      </div>
    {/key}
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
      onselect={(n) => (identity = n)}
    />
    <div class="number-pad__keys" data-anim="pad-keys">
      {#each KEYS as key, i (i)}
        {#if key === ''}
          <span aria-hidden="true"></span>
        {:else if key === 'back'}
          <button type="button" class="number-pad__key number-pad__key--delete" aria-label={S.padDelete} disabled={!rules.canDelete} onclick={() => press(key)}>
            <Icon name="backspace" alone />
          </button>
        {:else}
          <button type="button" class="number-pad__key" data-key={key} disabled={!rules.digits.has(key)} onclick={() => press(key)}>{key}</button>
        {/if}
      {/each}
    </div>
    <div class="number-pad__footer">
      <Button {...PLAYER.save} class="number-pad__save" disabled={!rules.canSave} onclick={save} />
    </div>
  </div>
  {#if scanning}
    <Drawer name="qr" title={S.qrTitle} bind:open={scanOpen} onclose={() => (scanning = false)}>
      <QrScan onfound={scanned} onwrite={() => (scanOpen = false)} />
    </Drawer>
  {/if}
</Drawer>
{#if leaving}
  <PadLeave id={Number(value)} oncontinue={() => (leaving = null)} ondiscard={discard} />
{/if}
