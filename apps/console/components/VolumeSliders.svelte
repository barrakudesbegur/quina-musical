<!--
  The volume sliders, in the menu (logic/volumes.ts; D139, D157–D159): every sound the engine mixes, 0–150 %, grouped,
  each a VolumeSlider (a mark at its default, its value; a drag sends `setVolume` on every step, and shows the finger's
  value until it lifts). The throws and the corn-seed storm share one slider (D159). Hooks: data-testid="volume-sliders",
  and "volume-<key>" on each slider.
-->
<script lang="ts">
  import type { VolumeKey } from '@quina/protocol';
  import { getConsole } from '../context.ts';
  import { VOLUME_GROUPS } from '../logic/volumes.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import VolumeSlider from './VolumeSlider.svelte';

  const model = getConsole();
  const uid = $props.id();
  const volumes = $derived(model.show.state?.game.volumes);
  const enabled = $derived(model.can('setVolume'));
  const onvolume = (key: VolumeKey, percent: number) => model.act('setVolume', { key, percent });
</script>

<section class="menu-group menu-volumes" aria-labelledby="{uid}-title" data-testid="volume-sliders">
  <h3 class="menu-group__title" id="{uid}-title"><Icon name="sound" />{S.volumes.title}</h3>
  <p class="note">{S.volumes.note}</p>
  <div class="menu-volumes__groups">
    {#each VOLUME_GROUPS as g (g.group)}
      <div class="menu-volumes__group" role="group" aria-label={S.volumes.groups[g.group]} data-group={g.group}>
        {#if g.keys.length > 1}<h4 class="menu-group__field">{S.volumes.groups[g.group]}</h4>{/if}
        {#each g.keys as key (key)}
          <VolumeSlider {key} {volumes} disabled={!enabled} {onvolume} />
        {/each}
      </div>
    {/each}
  </div>
</section>
