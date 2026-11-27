<!-- After the night: thanks, and every round's winners (names and notes still editable). -->
<script lang="ts">
  import Panel from '../../../packages/ui/components/Panel.svelte';
  import { S } from '../strings.ts';
  import WinnersList from './WinnersList.svelte';
</script>

<Panel class="after-panel" title={S.after.title}>
  <p>{S.after.note}</p>
  <WinnersList />
</Panel>
