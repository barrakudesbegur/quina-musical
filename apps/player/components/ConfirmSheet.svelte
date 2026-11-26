<script lang="ts">
  // A confirmation for something that can't be undone with one tap (removing a card, wiping the data). `danger`
  // paints the yes in red; `no` names what it keeps («Mantén el cartró»: D201, never «Cancel·lar»).
  import Drawer from './Drawer.svelte';

  let {
    name,
    title,
    text,
    yes,
    no,
    danger = true,
    onyes,
    onclose,
  }: { name: string; title: string; text?: string; yes: string; no: string; danger?: boolean; onyes: () => void; onclose: () => void } = $props();
</script>

<Drawer {name} {title} {onclose}>
  {#if text}<p class="confirm__text">{text}</p>{/if}
  <div class="confirm__actions">
    <button type="button" class="big-button confirm__yes" class:tone-danger={danger} onclick={onyes}>{yes}</button>
    <button type="button" class="big-button confirm__no" class:tone-primary={!danger} onclick={onclose}>{no}</button>
  </div>
</Drawer>
