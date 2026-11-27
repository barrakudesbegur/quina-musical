// The console's icon names, over the one registry of line icons (packages/ui/icons/line.ts, H1). The registry names
// each icon after its drawing; the console keeps its own names (the concept that shows it), mapped here, so its
// components and the board generator keep working. Every icon sits next to a text label, or carries one.
import { LINE_ICONS, partClass, pathOf, type IconPart, type IconPath, type LineIconName } from '../../packages/ui/icons/line.ts';

export { partClass, pathOf, type IconPart, type IconPath };

/** Console name → the registry's drawing. */
export const CONSOLE_ICONS = {
  next: 'skip',
  play: 'play',
  /** Parlem (Hold): a microphone. */
  hold: 'mic',
  /** Aguanta (Stay): a raised hand. */
  stay: 'hand',
  /** Suspens: a drum with its sticks. */
  suspense: 'drum',
  back: 'undo',
  /** Comprovar: the verification rosette. */
  claim: 'rosette',
  /** Efectes: a speaker. */
  sound: 'speaker',
  fanfare: 'trophy',
  /** Auto-advance off: the arrows struck through. */
  autoOff: 'cycle-off',
  menu: 'menu',
  close: 'close',
  backspace: 'backspace',
  check: 'check',
  cross: 'close',
  /** «Seguides»: reveal in a row. */
  seguides: 'fast-forward',
  /** «Revisió manual». */
  search: 'magnifier',
  /** «Descarta el cartró». */
  trash: 'trash',
  eye: 'eye',
  eyeOff: 'eye-off',
  lock: 'lock',
  auto: 'cycle',
  /** Ritme. */
  gauge: 'gauge',
  /** Futur. */
  crystal: 'crystal-ball',
  /** Estat. */
  chart: 'chart',
  /** Cerca › Cartró. */
  grid: 'grid',
  enter: 'enter',
  /** Premis. */
  gift: 'gift',
  /** The round's expected end. */
  flag: 'flag',
  /** Schedule recovery. */
  timer: 'stopwatch',
  reload: 'reload',
  /** «Des del principi». */
  restart: 'restart',
  minus: 'minus',
  plus: 'plus',
  sun: 'sun',
  moon: 'moon',
  music: 'music',
  alert: 'warning',
  power: 'power',
  shuffle: 'shuffle',
  pause: 'pause',
  star: 'star',
  clock: 'clock',
  /** The menu's groups: this device, the connections, plan B resume, the cheat sheet. */
  device: 'tablet',
  wifi: 'wifi',
  lifebuoy: 'lifebuoy',
  keyboard: 'keyboard',
  chevron: 'chevron-right',
  /** The Desgraciat round: a card still standing, and one that sat down. */
  standing: 'figure-standing',
  seated: 'figure-seated',
  /** «Editar» and «Al revés» (the finale's Dempeus tab). */
  edit: 'pencil',
  swap: 'swap',
  remote: 'wii-remote',
  /** «Final a l'escenari» (#92: a line icon like the others). */
  podium: 'podium',
} as const satisfies Record<string, LineIconName>;

export type IconName = keyof typeof CONSOLE_ICONS;

/** The console's icons by its own names: the registry's paths (what the board generator draws). */
export const ICONS = Object.fromEntries(Object.entries(CONSOLE_ICONS).map(([k, v]) => [k, LINE_ICONS[v]])) as {
  readonly [K in IconName]: (typeof LINE_ICONS)[(typeof CONSOLE_ICONS)[K]];
};
