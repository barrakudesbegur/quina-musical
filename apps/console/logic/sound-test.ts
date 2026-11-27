// The PA's sound test (D229): in the menu, before the night's first round, the engine plays one kind of sound on a loop
// at its slider's level (`soundTest { kind }`, state `soundTest`), so whoever sets up the PA steps through them with
// «Anterior» and «Següent» and moves each one's slider beside it. The kinds come in the menu's slider order
// (VOLUME_GROUPS), so the test walks the sliders as they're drawn. A kind whose automatic sound (D237) is switched off
// still plays in the test (the engine lifts the mutes while it runs), so its step says it's off. Pure.
import { SOUND_TEST_KINDS, type AutoSound, type AutoSounds, type SoundTestKind, type VolumeKey } from '@quina/protocol';
import { VOLUME_GROUPS } from './volumes.ts';

const isKind = (key: VolumeKey): key is SoundTestKind => (SOUND_TEST_KINDS as readonly string[]).includes(key);

/** Every kind once, in the sliders' order (tests/ui/console/sound-test.test.ts). */
export const SOUND_TEST_ORDER: readonly SoundTestKind[] = VOLUME_GROUPS.flatMap((g) => g.keys).filter(isKind);

export interface SoundTestPlace {
  /** 1-based, for «3 de 16». */
  number: number;
  count: number;
  prev: SoundTestKind | null;
  next: SoundTestKind | null;
}

/** Where a kind sits in the test, and its neighbours (none past either end: the test doesn't wrap). */
export function soundTestPlace(kind: SoundTestKind): SoundTestPlace {
  const i = SOUND_TEST_ORDER.indexOf(kind);
  return {
    number: i + 1,
    count: SOUND_TEST_ORDER.length,
    prev: i > 0 ? SOUND_TEST_ORDER[i - 1] : null,
    next: i >= 0 && i < SOUND_TEST_ORDER.length - 1 ? SOUND_TEST_ORDER[i + 1] : null,
  };
}

/**
 * The automatic sound (D237) that silences a kind at night when switched off: the drum's ticks, the DJ effects, the
 * final-lap fanfare, the voices, and the fanfares of «Victòria» and «Fallada» (the test plays them over their music since
 * 75fcead1, at the start and every 12 s).
 */
export const SOUND_TEST_AUTO: Readonly<Partial<Record<SoundTestKind, AutoSound>>> = Object.freeze({
  ticks: 'drumTicks',
  djFx: 'djFx',
  finalLap: 'finalLap',
  win: 'winFanfare',
  fail: 'failFanfare',
  voices: 'voices',
});

/** The kind plays in the test although its automatic sound is off (the step's «apagat a Sons automàtics»). */
export function soundTestAutoOff(kind: SoundTestKind, autoSounds: Readonly<AutoSounds>): boolean {
  const key = SOUND_TEST_AUTO[kind];
  return key !== undefined && autoSounds[key] === false;
}
