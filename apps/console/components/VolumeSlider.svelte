<!--
  One volume slider (logic/volumes.ts; D139, D157–D159): a sound the engine mixes, 0–150 %, with a mark at its default
  and its value (the Slider, B10: − and + step 1%, Page Up / Down 10). A drag calls `onvolume` on every step, at once
  (the parent sends `setVolume`; the engine journals once the sliders are still); while the finger is down the slider
  shows the finger's value, then the engine's (`volumes`). Used by the menu's volume sliders and the sound test
  (D229). Hook: data-testid="volume-<key>" (and the sound test's own, `testid`).
-->
<script lang="ts">
  import type { VolumeKey } from '@quina/protocol';
  import { sliderPercent, volumeRow } from '../logic/volumes.ts';
  import { S } from '../strings.ts';
  import Slider from '../../../packages/ui/components/Slider.svelte';

  interface Props {
    key: VolumeKey;
    /** The engine's `game.volumes`. */
    volumes: Partial<Record<VolumeKey, number>> | undefined;
    disabled?: boolean;
    /** Without the note under the label (the sound test says what plays instead). */
    bare?: boolean;
    testid?: string;
    onvolume: (key: VolumeKey, percent: number) => void;
  }

  let { key, volumes, disabled = false, bare = false, testid, onvolume }: Props = $props();

  /** The finger's value while it drags (the engine's echo comes a moment later). */
  let draft = $state<number | null>(null);
  const row = $derived(volumeRow(key, volumes, draft));
  const text = $derived(S.volumes.keys[key]);

  function oninput(value: number): void {
    const percent = sliderPercent(key, value);
    if (percent === null) return;
    draft = percent;
    onvolume(key, percent);
  }
</script>

<Slider
  class="volume"
  label={text.label}
  note={bare ? null : text.note}
  value={row.percent}
  max={row.max}
  defaultValue={row.defaultPercent}
  format={S.volumes.value}
  description={S.volumes.defaultValue(row.defaultPercent)}
  lessLabel={S.volumes.less(text.label)}
  moreLabel={S.volumes.more(text.label)}
  {disabled}
  data-testid={testid ?? `volume-${key}`}
  {oninput}
  onchange={() => (draft = null)}
/>
