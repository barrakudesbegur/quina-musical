<!--
  The sound pad, played by the engine on the PA, laid out like a launchpad: the fanfares (stingers) as gold pads
  in a narrow column, the effects as a grid of pads, each with its own coloured LED strip on the left edge. Icons
  only, no words (the user's decision on the canvas, 2026-11-24; board "Consola · Efectes amb icones"): each pad's
  name is its accessible name and its tooltip, so a long press or the screen reader still says it. The D-pad's four
  effects show their arrow while a Wii remote is connected (WiiBadge).
-->
<script lang="ts">
  import { SFX_NAMES, STINGER_NAMES } from '@quina/protocol';
  import { getConsole } from '../context.ts';
  import { SOUND_ICONS } from '../sound-icons.ts';
  import { S, soundText } from '../strings.ts';
  import { dpadOf } from '../wii/guide.ts';
  import SoundIcon from './SoundIcon.svelte';
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
        <button
          type="button"
          class="pad pad--stinger"
          data-sound={name}
          data-anim="press"
          aria-label={soundText(name)}
          title={soundText(name)}
          disabled={!enabled}
          onclick={() => model.act('sfx', { name })}
        >
          <SoundIcon {name} />
          {#if dpad}<WiiBadge button={dpad} size="sm" />{/if}
        </button>
      {/each}
    </div>
  </section>
  <section class="sound-pad__group" data-group="effects" aria-labelledby="{uid}-effects">
    <h3 class="panel__label" id="{uid}-effects">{S.sounds.effects}</h3>
    <div class="sound-pad__grid">
      {#each SFX_NAMES as name (name)}
        {@const dpad = dpadOf(name)}
        <button
          type="button"
          class="pad"
          data-sound={name}
          data-led={SOUND_ICONS[name].led}
          data-anim="press"
          aria-label={soundText(name)}
          title={soundText(name)}
          disabled={!enabled}
          onclick={() => model.act('sfx', { name })}
        >
          <SoundIcon {name} />
          <i class="pad__led" aria-hidden="true"></i>
          {#if dpad}<WiiBadge button={dpad} size="sm" />{/if}
        </button>
      {/each}
    </div>
  </section>
</div>
