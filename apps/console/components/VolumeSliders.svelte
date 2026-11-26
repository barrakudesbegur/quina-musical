<!--
  The volume sliders, in the menu (logic/volumes.ts; D139, D157–D159): every sound the engine mixes, 0–150 %, grouped,
  each with a mark at its default and its value. A drag sends `setVolume` on every step, at once (the engine journals
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

  const model = getConsole();
  const uid = $props.id();
  const volumes = $derived(model.show.state?.game.volumes);
  const enabled = $derived(model.can('setVolume'));
  /** The finger's values while it drags (the engine's echo comes a moment later). */
  let drafts = $state<Partial<Record<VolumeKey, number>>>({});

  function oninput(key: VolumeKey, e: Event): void {
    const percent = sliderPercent(key, (e.currentTarget as HTMLInputElement).value);
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
          <div class="volume" data-key={key} data-at-default={row.atDefault || undefined} style:--default-at={row.defaultAt}>
            <label class="volume__head" for="{uid}-{key}">
              <span class="volume__label">{text.label}</span>
              <output class="volume__value" for="{uid}-{key}">{S.volumes.value(row.percent)}</output>
            </label>
            {#if text.note}<span class="volume__note">{text.note}</span>{/if}
            <span class="volume__track">
              <span class="volume__mark" aria-hidden="true" title={S.volumes.defaultValue(row.defaultPercent)}></span>
              <input
                id="{uid}-{key}"
                type="range"
                min="0"
                max={row.max}
                step="1"
                value={row.percent}
                disabled={!enabled}
                data-testid="volume-{key}"
                aria-describedby="{uid}-{key}-default"
                oninput={(e) => oninput(key, e)}
                onchange={() => onchange(key)}
              />
            </span>
            <span class="visually-hidden" id="{uid}-{key}-default">{S.volumes.defaultValue(row.defaultPercent)}</span>
          </div>
        {/each}
      </div>
    {/each}
  </div>
</section>
