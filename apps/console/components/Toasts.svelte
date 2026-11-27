<!--
  Command rejections and notices (hook toast-in), each the generic Toast (E3) with its preset (actions.ts › TOASTS); each hides by itself after a few seconds. While a modal dialog is
  open the page under it is inert, so a toast would go unseen: the model holds new ones until the dialog closes (the
  dialogs are native <dialog>s, so their `open` attribute says when).
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { S } from '../strings.ts';
  import Toast from '../../../packages/ui/components/Toast.svelte';
  import { TOASTS } from '../actions.ts';

  const model = getConsole();

  $effect(() => {
    const update = () => model.setDialogOpen(document.querySelector('dialog[open]') !== null);
    const watch = new MutationObserver(update);
    watch.observe(document.body, { subtree: true, attributeFilter: ['open'] });
    update();
    return () => watch.disconnect();
  });
</script>

<div class="toasts" role="region" aria-label={S.toast.region}>
  {#each model.visibleToasts as toast (toast.id)}
    <Toast {...TOASTS[toast.tone]} data-anim="toast-in" data-tone={toast.tone} text={toast.text} detail={toast.detail} closeLabel={S.toast.close} onclose={() => model.dismiss(toast.id)} />
  {/each}
</div>
