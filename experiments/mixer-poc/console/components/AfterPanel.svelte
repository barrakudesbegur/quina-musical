<!-- After the night: thanks, and every round's winners (names and notes still editable). -->
<script lang="ts">
  import { S } from '../strings.ts';
  import WinnersList from './WinnersList.svelte';

  const uid = $props.id();
</script>

<section class="panel after-panel" aria-labelledby="{uid}-title">
  <h2 class="panel__title" id="{uid}-title">{S.after.title}</h2>
  <p>{S.after.note}</p>
  <WinnersList />
</section>
