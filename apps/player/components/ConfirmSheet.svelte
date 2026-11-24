<script lang="ts">
  // A confirmation for something that can't be undone with one tap (removing a card, wiping the data).
  import { S } from '../strings.ts';
  import Sheet from './Sheet.svelte';

  let { name, title, text, yes, onyes, onclose }: { name: string; title: string; text: string; yes: string; onyes: () => void; onclose: () => void } = $props();
</script>

<Sheet {name} {title} {onclose}>
  <p class="confirm__text">{text}</p>
  <div class="confirm__actions">
    <button type="button" class="big-button tone-danger confirm__yes" onclick={onyes}>{yes}</button>
    <button type="button" class="big-button confirm__no" onclick={onclose}>{S.cancel}</button>
  </div>
</Sheet>
