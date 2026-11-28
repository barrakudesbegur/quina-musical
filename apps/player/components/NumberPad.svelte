<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '../../../packages/ui/components/Button.svelte';
  import TextField from '../../../packages/ui/components/TextField.svelte';
  import TextLink from '../../../packages/ui/components/TextLink.svelte';
  import { PLAYER, PLAYER_LINKS } from '../actions.ts';
  // "Afegir cartró" (boards "App · calaix per afegir un cartró" and "afegir cartró: casos especials"): the card's
  // number on a paper field, an optional name, its icon (the first free one preselected), the smart keypad and one
  // "Desar". A digit key works only while the number can still become a printed card's (logic/pad.ts); "Desar" lights
  // up once it is one the player doesn't have (ANIMATIONS.md `pad-keys`); it stays pinned to the drawer's bottom while
  // the rest scrolls above it, so a small phone still shows it (D188). A number the player already has says whose
  // it is, with "Veure'l". It holds a form, so it drags stiff (§8 Y3, `drawer-drag`), and leaving with a number typed
  // asks first (PadLeave, `pad-leave`). The QR button opens the camera (D141, QrScan) as its own drawer stacked over
  // this one (`qr-scan`): a card's QR closes it and fills the number in here, keeping the name and icon picked
  // (`qr-found`); every other way of closing the camera only closes the camera (§8 Y3).
  // «Desar» (§8 Y3, `pad-saved`; replaces D200's banner): the card is saved and the drawer itself confirms it, with the
  // card's mark, and asks whether to add another: «+ Un altre» brings a fresh form (`pad-again`); «Fet», or closing it
  // any other way, closes the drawers and shows the new card on the home.
  import { PLAYER_CONFIG } from '../config.ts';
  import { leaveNeedsConfirm, padCatalog, padRules, padValue } from '../logic/pad.ts';
  import { nextColor, type SavedCard } from '../logic/storage.ts';
  import { S } from '../strings.ts';
  import CardMark from './CardMark.svelte';
  import Drawer from './Drawer.svelte';
  import Icon from '../../../packages/ui/icons/Icon.svelte';
  import IconPicker from './IconPicker.svelte';
  import QrButton from './QrButton.svelte';
  import NumberField from '../../../packages/ui/components/NumberField.svelte';
  import NumberKeys from '../../../packages/ui/components/NumberPad.svelte';
  import PadLeave from './PadLeave.svelte';
  import QrScan from './QrScan.svelte';
  import '../pad.css';

  let {
    cards,
    printed,
    scan = false,
    onadd,
    onsee,
    onclose,
    ontyping,
  }: {
    cards: readonly SavedCard[];
    /** The printed cards by number (the catalogue), or null while it loads (then any possible number is typed). */
    printed: ReadonlyMap<number, unknown> | null;
    /** Open with the camera already over the pad (the empty state's «Escanejar el QR», D290; `qr-scan`). */
    scan?: boolean;
    /** Saves the card and leaves the drawer open (`pad-saved`); returns the error to show, or null. */
    onadd: (id: number, identity: number, name: string) => string | null;
    /** "Veure'l", «Fet»: every drawer closes and that card shows on the home screen. */
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
  // Opened from the empty state's «Escanejar el QR» (D290): the camera stacks over the pad in the next frame, once the
  // pad's own dialog is in the top layer (opened in the same frame, the camera's dialog would end up under it).
  onMount(() => {
    if (!scan) return;
    const raf = requestAnimationFrame(() => {
      scanning = true;
      scanOpen = true;
    });
    return () => cancelAnimationFrame(raf);
  });
  /** A QR has just filled the number in: the field's green ring (`qr-found`). */
  let found = $state(0);
  /** The leave question is open; `proceed` closes the drawer the way the player asked ("‹" or ✕). */
  let leaving = $state<{ proceed: () => void } | null>(null);
  /** The card just saved: the drawer confirms it and asks for another (`pad-saved`). */
  let saved = $state<{ id: number; identity: number; name: string } | null>(null);
  /** Its two buttons take taps only once they're in, so a double tap on «Desar» never lands on them. */
  let armed = $state(false);
  /** A fresh form after «+ Un altre» (`pad-again`): it comes in again from the right. */
  let round = $state(0);
  let drawer: Drawer | undefined = $state();

  const catalog = $derived(printed ? padCatalog(printed.keys()) : null);
  const rules = $derived(padRules(value, cards.map((c) => c.id), catalog));
  const owned = $derived(rules.owned === null ? null : (cards.find((c) => c.id === rules.owned) ?? null));
  const full = $derived(cards.length >= PLAYER_CONFIG.maxCards);

  /** The drawer may close at once with nothing typed, or once the card is saved; otherwise the player confirms first. */
  function canClose(proceed: () => void): boolean {
    if (saved || !leaveNeedsConfirm(value)) return true;
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
    ontyping?.(value !== '' && saved === null);
  });
  $effect(() => () => ontyping?.(false));

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
    // Saved: the drawer confirms and asks (pad-saved); an error (the phone is full) stays on the form.
    const id = Number(value);
    error = onadd(id, identity, name);
    if (error !== null) return;
    saved = { id, identity, name: name.trim() };
    armed = false;
    setTimeout(() => (armed = true), PLAYER_CONFIG.padSavedArmMs);
  }

  /** «+ Un altre» (`pad-again`): a fresh form, the next free icon picked. */
  function again(): void {
    value = '';
    name = '';
    error = null;
    found = 0;
    identity = nextColor(cards);
    saved = null;
    round += 1;
  }

  /** «Fet»: the drawers close with their motion and sound (`drawer-close`), as the ✕ would. */
  function done(): void {
    drawer?.dismiss();
  }

  /** Every close ends here: on the success it shows the new card on the home, else the drawer just goes. */
  function closed(): void {
    if (saved) onsee(saved.id);
    else onclose();
  }

  /** `pad-again`: the success leaves to the left, fading (only fading with reduced motion or Data Saver, D209). */
  function leaveLeft(node: Element) {
    const move = node.closest('[data-motion="full"]') !== null && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    return { duration: 160, css: (t: number) => `opacity: ${t};${move ? ` translate: ${(1 - t) * -24}px 0;` : ''}` };
  }
  /** Focus goes to «Fet» once the success is in (the form under it is inert), without scrolling. */
  let then: HTMLDivElement | undefined = $state();
  $effect(() => {
    if (armed && then) then.querySelector<HTMLButtonElement>('.number-pad__done')?.focus({ preventScroll: true });
  });
</script>

<Drawer bind:this={drawer} name="pad" title={S.padTitle} drag={saved ? 'free' : 'stiff'} onclose={closed} {canClose}>
  <div class="number-pad" data-step={saved ? 'saved' : 'form'}>
    <div class="number-pad__stage">
      {#key round}
        <div class="number-pad__form" data-anim={round ? 'pad-again' : undefined} inert={saved !== null}>
          {#key found}
            <NumberField class="number-pad__field" label={S.padNumber} value={value} data-anim={found ? 'qr-found' : undefined}>
              {#snippet trailing()}
                <QrButton
                  onclick={() => {
                    scanning = true;
                    scanOpen = true;
                  }}
                />
              {/snippet}
            </NumberField>
          {/key}
          {#if owned}
            <p class="number-pad__note" role="status">
              <span class="number-pad__note-mark" aria-hidden="true"><CardMark identity={owned.color} decorative /></span>
              <span class="number-pad__note-text">{S.alreadyYours(owned.name)}</span>
              <TextLink {...PLAYER_LINKS.seeOwned} class="number-pad__see" onclick={() => onsee(owned.id)} />
            </p>
          {:else if error}
            <p class="number-pad__note" role="alert"><span class="number-pad__note-text">{error}</span></p>
          {/if}
          <TextField
            class="number-pad__name"
            label={S.nameLabel}
            bind:value={name}
            maxlength={PLAYER_CONFIG.maxNameLength}
            placeholder={S.namePlaceholder}
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
          <NumberKeys class="number-pad__keys" label={S.padKeys} backLabel={S.padDelete} enabled={rules.digits} canDelete={rules.canDelete} onkey={press} />
        </div>
      {/key}
      {#if saved}
        <div class="pad-saved" role="status" data-anim="pad-saved" style:--card-color="var(--card-color-{saved.identity})" out:leaveLeft>
          <span class="pad-saved__disc" aria-hidden="true">
            <span class="pad-saved__mark"><CardMark identity={saved.identity} decorative /></span>
            <span class="pad-saved__tick"><Icon name="check" alone /></span>
          </span>
          <p class="pad-saved__title">{S.savedTitle(saved.id)}</p>
          {#if saved.name}<p class="pad-saved__name">{saved.name}</p>{/if}
          <div class="pad-saved__yours">
            <p class="pad-saved__yours-label">{S.savedYours(cards.length)}</p>
            <ul class="pad-saved__marks">
              {#each cards as card (card.id)}
                <li class="pad-saved__mark-item" data-new={card.id === saved.id ? 'true' : undefined}>
                  <CardMark identity={card.color} decorative />
                  <span class="visually-hidden">{card.name ?? S.cardNumber(card.id)}</span>
                </li>
              {/each}
            </ul>
          </div>
          <p class="pad-saved__ask">{full ? S.savedFull(PLAYER_CONFIG.maxCards) : S.addAnotherAsk}</p>
          {#if !full && cards.length === 1}<p class="pad-saved__hint">{S.addAnotherHint}</p>{/if}
        </div>
      {/if}
    </div>
    <div class="number-pad__footer">
      {#if saved}
        <div class="number-pad__then" data-anim="pad-saved" inert={!armed} bind:this={then}>
          {#if !full}<Button {...PLAYER.addAnother} class="number-pad__again" onclick={again} />{/if}
          <Button {...PLAYER.padDone} class="number-pad__done" onclick={done} />
        </div>
      {:else}
        <Button {...PLAYER.save} class="number-pad__save" disabled={!rules.canSave} onclick={save} />
      {/if}
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
