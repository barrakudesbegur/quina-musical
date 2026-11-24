<script lang="ts">
  // A card's optional name ("Àvia").
  import { PLAYER_CONFIG } from '../config.ts';
  import { S } from '../strings.ts';
  import Sheet from './Sheet.svelte';

  let { cardId, name, onsave, onclose }: { cardId: number; name: string | null; onsave: (name: string) => void; onclose: () => void } = $props();
  // The sheet edits a copy of the name it opened with.
  // svelte-ignore state_referenced_locally
  let value = $state(name ?? '');
</script>

<Sheet name="rename" title={S.renameTitle(cardId)} {onclose}>
  <form
    class="rename"
    onsubmit={(e) => {
      e.preventDefault();
      onsave(value);
    }}
  >
    <label class="rename__label" for="card-name">{S.nameLabel}</label>
    <input id="card-name" class="rename__input" bind:value maxlength={PLAYER_CONFIG.maxNameLength} placeholder={S.namePlaceholder} autocomplete="off" enterkeyhint="done" />
    <div class="rename__actions">
      <button type="submit" class="big-button tone-primary">{S.save}</button>
      <button type="button" class="big-button" onclick={onclose}>{S.cancel}</button>
    </div>
  </form>
</Sheet>
