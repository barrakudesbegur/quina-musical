<script lang="ts">
  // A card's optional name ("Àvia") and its icon.
  import { PLAYER_CONFIG } from '../config.ts';
  import type { SavedCard } from '../logic/storage.ts';
  import { S } from '../strings.ts';
  import IconPicker from './IconPicker.svelte';
  import Drawer from './Drawer.svelte';

  let {
    card,
    others,
    onsave,
    onclose,
  }: {
    card: SavedCard;
    others: readonly SavedCard[];
    onsave: (name: string, identity: number) => void;
    onclose: () => void;
  } = $props();
  // The sheet edits a copy of the name and icon it opened with.
  // svelte-ignore state_referenced_locally
  let value = $state(card.name ?? '');
  // svelte-ignore state_referenced_locally
  let identity = $state(card.color);
</script>

<Drawer name="rename" title={S.renameTitle(card.id)} {onclose}>
  <form
    class="rename"
    onsubmit={(e) => {
      e.preventDefault();
      onsave(value, identity);
    }}
  >
    <label class="rename__label" for="card-name">{S.nameLabel}</label>
    <input id="card-name" class="rename__input" bind:value maxlength={PLAYER_CONFIG.maxNameLength} placeholder={S.namePlaceholder} autocomplete="off" enterkeyhint="done" />
    <IconPicker
      {others}
      selected={identity}
      onselect={(n) => (identity = n)}
    />
    <div class="rename__actions">
      <button type="submit" class="big-button tone-primary">{S.save}</button>
      <button type="button" class="big-button" onclick={onclose}>{S.renameDiscard}</button>
    </div>
  </form>
</Drawer>
