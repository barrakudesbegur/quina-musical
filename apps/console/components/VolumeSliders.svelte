<!--
  The volume sliders, in the menu (logic/volumes.ts; D139, D157–D159): every sound the engine mixes, 0–150 %, grouped,
  each with a mark at its default and its value (the Slider, B10: − and + step 1%, Page Up / Down 10). A drag sends `setVolume` on every step, at once (the engine journals
  once the sliders are still); while the finger is down the slider shows the finger's value, then the engine's
  (`game.volumes`). The throws and the corn-seed storm share one slider (D159). Hooks: data-testid="volume-sliders",
  and "volume-<key>" on each slider.
-->
<script lang="ts">
  import type { VolumeKey } from '@quina/protocol';
  import { getConsole } from '../context.ts';
  import { VOLUME_GROUPS, sliderPercent, volumeRow } from '../logic/volumes.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import Slider from '../../../packages/ui/components/Slider.svelte';

  const model = getConsole();
  const uid = $props.id();
  const volumes = $derived(model.show.state?.game.volumes);
  const enabled = $derived(model.can('setVolume'));
  /** The finger's values while it drags (the engine's echo comes a moment later). */
  let drafts = $state<Partial<Record<VolumeKey, number>>>({});

  function oninput(key: VolumeKey, value: number): void {
    const percent = sliderPercent(key, value);
    if (percent === null) return;
    drafts = { ...drafts, [key]: percent };
    model.act('setVolume', { key, percent });
  }

  /** The finger is off: the engine's value shows again. */
  function onchange(key: VolumeKey): void {
    const rest = { ...drafts };
    delete rest[key];
    drafts = rest;
  }
</script>

<section class="menu-group menu-volumes" aria-labelledby="{uid}-title" data-testid="volume-sliders">
  <h3 class="menu-group__title" id="{uid}-title"><Icon name="sound" />{S.volumes.title}</h3>
  <p class="note">{S.volumes.note}</p>
  <div class="menu-volumes__groups">
    {#each VOLUME_GROUPS as g (g.group)}
      <div class="menu-volumes__group" role="group" aria-label={S.volumes.groups[g.group]} data-group={g.group}>
        {#if g.keys.length > 1}<h4 class="menu-group__field">{S.volumes.groups[g.group]}</h4>{/if}
        {#each g.keys as key (key)}
          {@const row = volumeRow(key, volumes, drafts[key] ?? null)}
          {@const text = S.volumes.keys[key]}
          <Slider
            class="volume"
            label={text.label}
            note={text.note}
            value={row.percent}
            max={row.max}
            defaultValue={row.defaultPercent}
            format={S.volumes.value}
            description={S.volumes.defaultValue(row.defaultPercent)}
            lessLabel={S.volumes.less(text.label)}
            moreLabel={S.volumes.more(text.label)}
            disabled={!enabled}
            data-testid="volume-{key}"
            oninput={(percent) => oninput(key, percent)}
            onchange={() => onchange(key)}
          />
        {/each}
      </div>
    {/each}
  </div>
</section>
