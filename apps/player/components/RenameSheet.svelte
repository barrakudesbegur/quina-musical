<script lang="ts">
  import Button from '../../../packages/ui/components/Button.svelte';
  import TextField from '../../../packages/ui/components/TextField.svelte';
  import { PLAYER } from '../actions.ts';
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
