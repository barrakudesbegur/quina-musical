<!--
  The sound pad, played by the engine on the PA, laid out like a launchpad (the Consola-Pestanyes board): the
  fanfares (stingers) as gold pads with a trophy in a narrow column, the effects as a grid of pads, each
  with its own coloured LED strip on the left edge so they can be told apart at a glance. The D-pad's four
  effects show their arrow while a Wii remote is connected (WiiBadge).
-->
<script lang="ts">
  import { SFX_NAMES, STINGER_NAMES } from '@quina/protocol';
  import { getConsole } from '../context.ts';
  import { S, soundText } from '../strings.ts';
  import { dpadOf } from '../wii/guide.ts';
  import Icon from './Icon.svelte';
  import WiiBadge from './WiiBadge.svelte';

  const model = getConsole();
  const uid = $props.id();
  const enabled = $derived(model.can('sfx'));
</script>

<div class="sound-pad">
  <section class="sound-pad__group" data-group="stingers" aria-labelledby="{uid}-stingers">
    <h3 class="panel__label" id="{uid}-stingers">{S.sounds.stingers}</h3>
    <div class="sound-pad__stack">
      {#each STINGER_NAMES as name (name)}
        {@const dpad = dpadOf(name)}
        <button type="button" class="pad pad--stinger" data-sound={name} data-anim="press" disabled={!enabled} onclick={() => model.act('sfx', { name })}>
          <Icon name="fanfare" /><span>{soundText(name)}</span>
          {#if dpad}<WiiBadge button={dpad} size="sm" />{/if}
        </button>
      {/each}
    </div>
  </section>
  <section class="sound-pad__group" data-group="effects" aria-labelledby="{uid}-effects">
    <h3 class="panel__label" id="{uid}-effects">{S.sounds.effects}</h3>
    <div class="sound-pad__grid">
      {#each SFX_NAMES as name, i (name)}
        {@const dpad = dpadOf(name)}
        <button type="button" class="pad" data-sound={name} data-led={i % 8} data-anim="press" disabled={!enabled} onclick={() => model.act('sfx', { name })}>
          <span>{soundText(name)}</span>
          <i class="pad__led" aria-hidden="true"></i>
          {#if dpad}<WiiBadge button={dpad} size="sm" />{/if}
        </button>
      {/each}
    </div>
  </section>
</div>
