<!--
  "Comandament" (the Consola-Comandament board): the Wii remote drawn with each button's action, and whether
  one is connected. It opens by itself when a remote connects (WiiController.justConnected), and from the
  menu. Without a remote it offers "Connectar" (WebHID needs the presenter's click); where the browser can't
  talk to a remote at all (a tablet) it says where it connects instead. The drawing and legend are shared with
  Admin's printed cheat sheet (packages/ui/wii). It opens with the hook wii-dialog.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import WiiGuide from '../../../packages/ui/wii/WiiGuide.svelte';
  import { getWii } from '../context.ts';
  import { S, CA } from '../strings.ts';
  import { consoleWiiLegend } from '../wii/guide.ts';
  import Icon from './Icon.svelte';

  let { open = $bindable(false) }: { open: boolean } = $props();

  const wii = getWii();
  const uid = $props.id();
  const items = consoleWiiLegend();
  let dialog: HTMLDialogElement | undefined = $state();

  // A remote just connected: show what each button does.
  $effect(() => {
    if (!wii.justConnected) return;
    untrack(() => {
      wii.justConnected = false;
      open = true;
    });
  });

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });
</script>

<dialog bind:this={dialog} class="dialog wii-dialog" data-anim="wii-dialog" aria-labelledby="{uid}-title" onclose={() => (open = false)}>
  <header class="dialog__head wii-dialog__head">
    <h2 class="wii-dialog__title" id="{uid}-title"><Icon name="remote" />{S.wii.title}</h2>
    <span class="wii-status" data-state={wii.status} role="status">{S.wii.status[wii.status]}</span>
    <span class="wii-dialog__spacer"></span>
    {#if wii.status === 'disconnected' || wii.status === 'lost'}
      <button type="button" class="mini tone-primary" data-anim="press" onclick={() => void wii.connect()}>{S.wii.connect}</button>
    {/if}
    <button type="button" class="mini dialog__close" data-anim="press" onclick={() => (open = false)}><Icon name="close" /><span>{S.wii.close}</span></button>
  </header>

  {#if wii.demo}<p class="note">{S.wii.demo}</p>{/if}
  {#if wii.status === 'unsupported'}<p class="note">{S.wii.unsupportedNote}</p>{:else if wii.status !== 'connected'}<p class="note">{S.wii.connectNote}</p>{/if}

  <div class="wii-dialog__guide">
    <WiiGuide {items} footer={CA.wii.footer} sideLabel={CA.wii.side} />
  </div>
</dialog>
