<!--
  An on/off setting drawn from the engine's state: it never toggles by itself, so a rejected command can't
  leave it showing the wrong value. The click asks for the opposite.
-->
<script lang="ts">
  interface Props {
    label: string;
    on: boolean;
    note?: string | null;
    disabled?: boolean;
    onchange: (on: boolean) => void;
  }

  let { label, on, note = null, disabled = false, onchange }: Props = $props();
</script>

<button type="button" class="switch" role="switch" aria-checked={on} data-state={on ? 'on' : 'off'} data-anim="press" {disabled} onclick={() => onchange(!on)}>
  <span class="switch__track" aria-hidden="true"><span class="switch__thumb"></span></span>
  <span class="switch__text">
    <span class="switch__label">{label}</span>
    {#if note}<span class="switch__note">{note}</span>{/if}
  </span>
</button>
