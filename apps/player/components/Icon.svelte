<script lang="ts" module>
  // The phone's line icons: the shared registry (packages/ui/icons, H1) under the phone's own names, in currentColor
  // with the family's stroke (the ink of the text beside it), so the theme recolours them and nothing is downloaded.
  import type { LineIconName } from '../../../packages/ui/icons/line.ts';

  /** Phone name → the registry's drawing. */
  const PLAYER_ICONS = {
    now: 'music',
    cards: 'grid-rounded',
    history: 'clock',
    prizes: 'gift',
    schedule: 'calendar',
    sound: 'speaker-loud',
    mute: 'speaker-mute',
    menu: 'menu',
    plus: 'plus',
    /** The Especial's star: no outline, rounder points (the user, 25 Nov). */
    star: 'star-solid',
    sad: 'sad-face',
    lock: 'lock',
    edit: 'pencil',
    trash: 'trash',
    offline: 'wifi-off',
    close: 'close',
    back: 'chevron-left',
    chevron: 'chevron-right',
    /** A plain cog (the user, 25 Nov: the old one was too busy). */
    settings: 'cog',
    grip: 'grip',
    /** Last year's card: a clock with a circular arrow going back (the user, 25 Nov). */
    clockBack: 'clock-back',
    /** The finish flag: no pole, square checks, paper and ink (the user, 25 Nov). */
    flag: 'flag-finish',
    tick: 'check',
    /** The pad's «Desar»: the tick in the outline look. */
    tickOutlined: 'check',
    /** The pad's delete key. */
    backspace: 'backspace',
    /** The orange buttons' plus («+ Cartró»): the outline look. */
    plusOutlined: 'plus',
    /** Horari's «Venda de cartrons». */
    ticket: 'ticket',
    /** Horari's descans. */
    cup: 'cup',
    /** The QR reader: the camera, and the camera refused. */
    camera: 'camera',
    cameraOff: 'camera-off',
    /** Ajustos's «Instal·la l'app» (D221), and «Ja tens l'app». */
    install: 'phone-arrow-down',
    installed: 'check',
  } as const satisfies Record<string, LineIconName>;

  export type IconName = keyof typeof PLAYER_ICONS;
  const OUTLINED: ReadonlySet<IconName> = new Set(['plusOutlined', 'tickOutlined']);
</script>

<script lang="ts">
  import LineIcon from '../../../packages/ui/icons/Icon.svelte';

  /** `alone`: no text beside it (a cover's placeholder, an icon-only button), so its ink comes from its own box. */
  let { name, alone = false }: { name: IconName; alone?: boolean } = $props();
</script>

<LineIcon name={PLAYER_ICONS[name]} outline={OUTLINED.has(name)} {alone} class="icon--{name}" />
