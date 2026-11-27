<!--
  B4 · Chip: a status label, never tappable (components-v2.md § 3 › B4; comments-27nov.md D-d, #45).

  Props say what it draws: `color` (a palette, through `data-color`) × `variant` (`subtle`: the palette's pale fill;
  `solid`: its fill, in its contrast colour); `glow`, a separate boolean (D-d, #45: a glow is not a fill colour);
  `border` (`ink`, or the palette's `edge`: the warning chip); `size` (`m` | `s`); `customColor`, a fill from data
  (the card type's pastel); and its slots: `dot` (on | off | live | alert) or `icon`, `label`, `value` («312», «+2 min»).
  A dot never says anything alone: the parent adds the state in words (visually hidden) where the dot carries it.
  A tappable chip is a MiniButton or an IconButton (D189), not this.
-->
<script lang="ts">
  import Icon from '../icons/Icon.svelte';
  import type { ChipColor, ChipDot, ChipSize, ChipVariant } from './control-types.ts';
  import type { IconName } from './types.ts';
  import './chip.css';

  interface Props {
    label: string;
    color?: ChipColor;
    variant?: ChipVariant;
    glow?: boolean;
    border?: 'ink' | 'edge';
    size?: ChipSize;
    customColor?: string | null;
    dot?: ChipDot | null;
    icon?: IconName | null;
    value?: string | number | null;
    class?: string;
    [key: `data-${string}`]: unknown;
  }

  let {
    label,
    color = 'grey',
    variant = 'subtle',
    glow = false,
    border = 'ink',
    size = 'm',
    customColor = null,
    dot = null,
    icon = null,
    value = null,
    class: className = '',
    ...rest
  }: Props = $props();
</script>

<span
  {...rest}
  class="chip {className}"
  data-color={color}
  data-variant={variant}
  data-size={size}
  data-border={border}
  data-glow={glow || undefined}
  style:--chip-custom={customColor}
>
  {#if dot}<span class="chip__dot" data-dot={dot} aria-hidden="true"></span>{:else if icon}<span class="chip__icon" aria-hidden="true"><Icon name={icon} /></span>{/if}
  <span class="chip__label">{label}</span>
  {#if value !== null && value !== undefined}<span class="chip__value">{value}</span>{/if}
</span>
