<script lang="ts">
  import Button from '../../../packages/ui/components/Button.svelte';
  import { confirmColors } from '../actions.ts';
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
  const colors = $derived(confirmColors(danger));
</script>

<Drawer {name} {title} {onclose}>
  {#if text}<p class="confirm__text">{text}</p>{/if}
  <div class="confirm__actions">
    <Button color={colors.yes} size="l" class="confirm__yes" label={yes} onclick={onyes} />
    <Button color={colors.no} size="l" class="confirm__no" label={no} onclick={onclose} />
  </div>
</Drawer>
