<script lang="ts">
  // The thin strip under the header, on the home screen: Admin's notice. (The connection strip is ConnectionStrip, at
  // the very top; the Check is CheckStrip, under the drum.)
  import type { PlayerApp } from '../model.svelte.ts';
  import { S } from '../strings.ts';

  let { app }: { app: PlayerApp } = $props();
</script>

{#if app.state?.notice}
  <p class="notice" role="note"><strong class="notice__label">{S.noticeLabel}:</strong> {app.state.notice}</p>
{/if}
