<!-- Command rejections and notices (hook toast-in); each hides by itself after a few seconds. -->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  const model = getConsole();
</script>

<div class="toasts" role="region" aria-label={S.toast.region}>
  {#each model.toasts as toast (toast.id)}
    <div class="toast" data-tone={toast.tone} data-anim="toast-in" role={toast.tone === 'error' ? 'alert' : 'status'}>
      <Icon name={toast.tone === 'error' ? 'alert' : 'check'} />
      <div class="toast__text">
        <p>{toast.text}</p>
        {#if toast.detail}<p class="toast__detail">{toast.detail}</p>{/if}
      </div>
      <button type="button" class="toast__close" onclick={() => model.dismiss(toast.id)}><Icon name="close" /><span class="visually-hidden">{S.toast.close}</span></button>
    </div>
  {/each}
</div>
