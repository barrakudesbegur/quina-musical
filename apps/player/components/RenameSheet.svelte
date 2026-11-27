<script lang="ts">
  // «Editar», a card's edit drawer (from Ajustos): its number, its optional name ("Àvia") and its icon. The number is
  // the same NumberField as «Afegir cartró», typed on the phone's own number keyboard, with the QR button at its end:
  // the camera opens as its own drawer stacked over this one (as the pad's, D141) and writes the number it finds.
  // A number that isn't a card, or is another of the player's cards, turns the field red with the reason under it.
  // It holds a form, so it drags stiff (§8 Y3, `drawer-drag`), and closing it with an edit not saved (✕, ‹, a drag, the
  // back gesture) asks first, as the pad does (PadLeave, `pad-leave`); its own «Descartar» doesn't ask.
  import Button from '../../../packages/ui/components/Button.svelte';
  import NumberField from '../../../packages/ui/components/NumberField.svelte';
  import TextField from '../../../packages/ui/components/TextField.svelte';
  import { PLAYER } from '../actions.ts';
  import { PLAYER_CONFIG } from '../config.ts';
  import type { SavedCard } from '../logic/storage.ts';
  import { S } from '../strings.ts';
  import IconPicker from './IconPicker.svelte';
  import Drawer from './Drawer.svelte';
  import PadLeave from './PadLeave.svelte';
  import QrButton from './QrButton.svelte';
  import QrScan from './QrScan.svelte';

  let {
    card,
    others,
    number = $bindable(),
    onsave,
    onclose,
  }: {
    card: SavedCard;
    others: readonly SavedCard[];
    /** The number typed (or a scanned QR's); starts at the card's. */
    number?: string;
    /** Saves the edit; returns the error to show (the number isn't a card…), or null. */
    onsave: (to: number, name: string, identity: number) => string | null;
    onclose: () => void;
  } = $props();
  // The drawer edits a copy of what it opened with.
  // svelte-ignore state_referenced_locally
  if (number === undefined) number = String(card.id);
  // svelte-ignore state_referenced_locally
  let value = $state(card.name ?? '');
  // svelte-ignore state_referenced_locally
  let identity = $state(card.color);
  let error = $state<string | null>(null);
  const uid = $props.id();
  /** The camera's drawer over this one: mounted while `scanning`, closing once `scanOpen` goes. */
  let scanning = $state(false);
  let scanOpen = $state(false);
  /** A QR has just filled the number in: the field's green ring (`qr-found`). */
  let found = $state(0);

  /** The leave question is open; `proceed` closes the drawer the way the player asked. */
  let leaving = $state<{ proceed: () => void } | null>(null);
  const edited = $derived(number !== String(card.id) || value !== (card.name ?? '') || identity !== card.color);

  function canClose(proceed: () => void): boolean {
    if (!edited) return true;
    leaving = { proceed };
    return false;
  }

  function scanned(cardId: number): void {
    number = String(cardId);
    scanOpen = false;
    found += 1;
  }

  // A new number clears the old refusal.
  $effect(() => {
    void number;
    error = null;
  });
</script>

<Drawer name="rename" title={S.editTitle} drag="stiff" {onclose} {canClose}>
  <form
    class="rename"
    onsubmit={(e) => {
      e.preventDefault();
      error = number ? onsave(Number(number), value, identity) : S.addError.invalid;
    }}
  >
    {#key found}
      <NumberField
        class="rename__number number-pad__field"
        keyboard="system"
        label={S.padNumber}
        bind:value={number}
        invalid={error !== null}
        maxlength={String(PLAYER_CONFIG.cardIdMax).length}
        enterkeyhint="done"
        aria-describedby={error ? `${uid}-error` : undefined}
        data-anim={found ? 'qr-found' : undefined}
      >
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
    {#if error}<p class="number-pad__note" id="{uid}-error" role="alert"><span class="number-pad__note-text">{error}</span></p>{/if}
    <TextField class="rename__name" label={S.nameLabel} bind:value maxlength={PLAYER_CONFIG.maxNameLength} placeholder={S.namePlaceholder} autocomplete="off" enterkeyhint="done" />
    <IconPicker
      {others}
      selected={identity}
      onselect={(n) => (identity = n)}
    />
    <div class="rename__actions">
      <Button {...PLAYER.renameSave} type="submit" />
      <Button {...PLAYER.renameDiscard} onclick={onclose} />
    </div>
  </form>
  {#if scanning}
    <Drawer name="qr" title={S.qrTitle} bind:open={scanOpen} onclose={() => (scanning = false)}>
      <QrScan onfound={scanned} onwrite={() => (scanOpen = false)} />
    </Drawer>
  {/if}
</Drawer>
{#if leaving}
  <PadLeave
    id={Number(number) || card.id}
    title={S.discardEditTitle}
    oncontinue={() => (leaving = null)}
    ondiscard={() => {
      const proceed = leaving?.proceed;
      leaving = null;
      proceed?.();
    }}
  />
{/if}
