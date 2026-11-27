<script lang="ts">
  // «Editar», a card's edit drawer (from Ajustos): its number, its optional name ("Àvia") and its icon. The number is
  // the same NumberField as «Afegir cartró», typed on the phone's own number keyboard, with the QR button at its end
  // when the app can scan (`onscan`: the camera opens as its own drawer and writes the number it finds into `number`).
  // A number that isn't a card, or is another of the player's cards, turns the field red with the reason under it.
  import Button from '../../../packages/ui/components/Button.svelte';
  import NumberField from '../../../packages/ui/components/NumberField.svelte';
  import TextField from '../../../packages/ui/components/TextField.svelte';
  import { PLAYER } from '../actions.ts';
  import { PLAYER_CONFIG } from '../config.ts';
  import type { SavedCard } from '../logic/storage.ts';
  import { S } from '../strings.ts';
  import IconPicker from './IconPicker.svelte';
  import Drawer from './Drawer.svelte';
  import QrButton from './QrButton.svelte';

  let {
    card,
    others,
    number = $bindable(),
    onsave,
    onscan,
    onclose,
  }: {
    card: SavedCard;
    others: readonly SavedCard[];
    /** The number typed (or a scanned QR's); starts at the card's. */
    number?: string;
    /** Saves the edit; returns the error to show (the number isn't a card…), or null. */
    onsave: (to: number, name: string, identity: number) => string | null;
    /** Opens the camera for the card's QR. */
    onscan?: () => void;
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

  // A new number clears the old refusal.
  $effect(() => {
    void number;
    error = null;
  });
</script>

<Drawer name="rename" title={S.editTitle} {onclose}>
  <form
    class="rename"
    onsubmit={(e) => {
      e.preventDefault();
      error = number ? onsave(Number(number), value, identity) : S.addError.invalid;
    }}
  >
    <NumberField
      class="rename__number"
      keyboard="system"
      label={S.padNumber}
      bind:value={number}
      invalid={error !== null}
      maxlength={String(PLAYER_CONFIG.cardIdMax).length}
      enterkeyhint="done"
      aria-describedby={error ? `${uid}-error` : undefined}
    >
      {#snippet trailing()}{#if onscan}<QrButton onclick={onscan} />{/if}{/snippet}
    </NumberField>
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
</Drawer>
