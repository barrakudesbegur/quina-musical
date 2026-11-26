// The volume sliders in the menu (D139, D157–D159): every key in VOLUME_KEYS, 0 to VOLUME_MAX (150 %), each with its
// default marked on the track. The engine owns the values (`game.volumes`, every key) and applies each `setVolume` at
// once; it journals them once the sliders have been still for a second, so the menu sends freely while a finger
// drags. The throws and the corn-seed storm share one slider, `throws` (D159). Pure.
import { VOLUME_DEFAULTS, VOLUME_MAX, type VolumeKey } from '@quina/protocol';

export type VolumeGroup = 'general' | 'songs' | 'music' | 'moments' | 'effects';

/** The sliders in the menu's order, grouped by what they cover. Every key once (tests/ui/console/volumes.test.ts). */
export const VOLUME_GROUPS: readonly { group: VolumeGroup; keys: readonly VolumeKey[] }[] = [
  { group: 'general', keys: ['master'] },
  { group: 'songs', keys: ['songs', 'songsParlem', 'check'] },
  { group: 'music', keys: ['doors', 'intros', 'breaks', 'pausa', 'holdMusic', 'end', 'voices'] },
  { group: 'moments', keys: ['throws', 'win', 'fail', 'finalLap'] },
  { group: 'effects', keys: ['djFx', 'padFx', 'ticks'] },
];

export interface VolumeRow {
  key: VolumeKey;
  /** What the slider shows: the finger's value while it drags, else the engine's. */
  percent: number;
  defaultPercent: number;
  max: number;
  /** The slider is at its default. */
  atDefault: boolean;
  /** Where the default's mark sits along the track, 0..1. */
  defaultAt: number;
}

/** One slider: the engine's value (its default until the Game has one), or the finger's while it drags. */
export function volumeRow(key: VolumeKey, volumes: Partial<Record<VolumeKey, number>> | undefined, draft: number | null = null): VolumeRow {
  const max = VOLUME_MAX[key];
  const defaultPercent = VOLUME_DEFAULTS[key];
  const stored = volumes?.[key];
  const percent = draft ?? (typeof stored === 'number' && Number.isFinite(stored) ? clamp(stored, max) : defaultPercent);
  return { key, percent, defaultPercent, max, atDefault: Math.round(percent) === defaultPercent, defaultAt: max > 0 ? defaultPercent / max : 0 };
}

/** A slider's raw value as the percent to send: a whole number from 0 to the key's max, or null when it isn't a number. */
export function sliderPercent(key: VolumeKey, raw: string | number): number | null {
  const n = typeof raw === 'number' ? raw : raw.trim() === '' ? Number.NaN : Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(clamp(n, VOLUME_MAX[key]));
}

const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n));

