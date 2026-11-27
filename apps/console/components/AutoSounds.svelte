<!--
  «Sons automàtics» in the menu (D237; logic/auto-sounds.ts): one Switch per sound the engine plays by itself (the
  drum's ticks, the DJ moves' effects, «Última volta», the win and fail fanfares, the voices), each with its one-line
  note. Off is silent whatever its volume slider says. Across the menu's columns, above the volume sliders. The values
  are the engine's (`game.autoSounds`); a press asks for the other one (`setAutoSound`, through `onchange`), so a refused
  command never leaves a switch showing the wrong value. Motion: ANIMATIONS.md › auto-sound-toggle. Hooks:
  data-testid="auto-sounds", "auto-sound-<key>" on each switch.
-->
<script lang="ts">
  import type { AutoSound, AutoSounds } from '@quina/protocol';
  import Switch from '../../../packages/ui/components/Switch.svelte';
  import { AUTO_SOUND_ORDER } from '../logic/auto-sounds.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  interface Props {
    values: AutoSounds;
    disabled?: boolean;
    onchange?: (key: AutoSound, on: boolean) => void;
  }

  let { values, disabled = false, onchange }: Props = $props();
  const uid = $props.id();
</script>

<section class="menu-group auto-sounds" aria-labelledby="{uid}-title" data-testid="auto-sounds">
  <h3 class="menu-group__title" id="{uid}-title"><Icon name="autoSounds" />{S.autoSounds.title}</h3>
  <p class="note">{S.autoSounds.note}</p>
  <div class="auto-sounds__list">
    {#each AUTO_SOUND_ORDER as key (key)}
      <Switch
        label={S.autoSounds.keys[key].label}
        note={S.autoSounds.keys[key].note}
        checked={values[key]}
        {disabled}
        data-testid="auto-sound-{key}"
        onchange={(on) => onchange?.(key, on)}
      />
    {/each}
  </div>
</section>

<style>
  .auto-sounds {
    grid-column: 1 / -1;
  }

  /* As many columns as fit, each at least 15rem: three on the tablet, one on a phone. */
  .auto-sounds__list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
    align-items: start;
    gap: var(--space-3) var(--space-5);
  }
</style>
