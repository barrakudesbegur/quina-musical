<!--
  "Comandament" (the Consola-Comandament board): the Wii remote drawn with each button's action, and whether
  one is connected. It opens by itself when a remote connects (WiiController.justConnected), and from the
  menu. Without a remote it offers "Connectar" (WebHID needs the presenter's click); where the browser can't
  talk to a remote at all (a tablet) it says where it connects instead. The drawing and legend are shared with
  Admin's printed cheat sheet (packages/ui/wii). The shake's row carries its switch (D144, D148; the
  Consola-Comandament board), the same setting as the menu's. It opens with the hook wii-dialog.
-->
<script lang="ts">
  import { WII } from '../config.ts';
  import { untrack } from 'svelte';
  import WiiGuide from '../../../packages/ui/wii/WiiGuide.svelte';
  import { getWii } from '../context.ts';
  import { S, CA } from '../strings.ts';
  import { consoleWiiLegend } from '../wii/guide.ts';
  import Icon from './Icon.svelte';
  import Switch from './Switch.svelte';

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
    <span class="wii-status" data-state={wii.linkStatus} role="status">{S.wii.status[wii.linkStatus]}</span>
    {#if wii.batteryLevel !== null}<span class="wii-battery" data-low={wii.batteryLevel < WII.batteryLow || undefined}>{S.wii.battery(wii.batteryLevel)}</span>{/if}
    <span class="wii-dialog__spacer"></span>
    {#if (wii.status === 'disconnected' || wii.status === 'lost') && !wii.anyConnected}
      <button type="button" class="mini tone-primary" data-anim="press" onclick={() => void wii.connect()}>{S.wii.connect}</button>
    {/if}
    <button type="button" class="mini dialog__close" data-anim="press" onclick={() => (open = false)}><Icon name="close" /><span>{S.wii.close}</span></button>
  </header>

  {#if wii.demo}<p class="note">{S.wii.demo}</p>{/if}
  {#if wii.status !== 'connected' && wii.anyConnected}<p class="note">{S.wii.elsewhere}</p>{:else if wii.status === 'unsupported'}<p class="note">{S.wii.unsupportedNote}</p>{:else if wii.status !== 'connected'}<p class="note">{S.wii.connectNote}</p>{/if}
  {#if wii.batteryLevel !== null && wii.batteryLevel < WII.batteryLow}<p class="note note--warning" role="alert">{S.wii.batteryLow}</p>{/if}
  {#if wii.drops > 0}
    <p class="note" class:note--warning={wii.drops >= WII.dropWarnAt} data-testid="wii-drops">{S.wii.drops(wii.drops)}{#if wii.drops >= WII.dropWarnAt}. {S.wii.dropsWarn}{/if}</p>
  {/if}

  <div class="wii-dialog__guide">
    <WiiGuide {items} footer={CA.wii.footer} sideLabel={CA.wii.side}>
      {#snippet extra(item)}
        {#if item.id === 'shake'}
          <span class="wii-dialog__switch"><Switch label={S.wii.shake} note={S.wii.shakeDefault} on={wii.shake} onchange={(on) => wii.setShake(on)} /></span>
        {/if}
      {/snippet}
    </WiiGuide>
  </div>
</dialog>
