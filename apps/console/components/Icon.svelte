<!--
  A console icon: the shared line icon (packages/ui/icons, H1) under the console's own name (icons.ts), in
  currentColor with the family's stroke. Always paired with a visible text label (or one for assistive technology).
  `outline`: the big buttons' sticker look, the same line over a wider ink line (the accent detail stays clean).
  `alone`: no text beside it (a cover's placeholder, a badge), so its ink comes from its own box.
-->
<script lang="ts">
  import LineIcon from '../../../packages/ui/icons/Icon.svelte';
  import { CONSOLE_ICONS, type IconName } from '../icons.ts';

  let { name, outline = false, alone = false }: { name: IconName; outline?: boolean; alone?: boolean } = $props();
</script>

<LineIcon name={CONSOLE_ICONS[name]} {outline} {alone} class="icon--{name}" />
