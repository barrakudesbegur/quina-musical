// The PA's sound test (D229): in the menu, before the night's first round, the engine plays one kind of sound on a loop
// at its slider's level (`soundTest { kind }`, state `soundTest`), so whoever sets up the PA steps through them with
// «Anterior» and «Següent» and moves each one's slider beside it. The kinds come in the menu's slider order
// (VOLUME_GROUPS), so the test walks the sliders as they're drawn. Pure.
import { SOUND_TEST_KINDS, type SoundTestKind, type VolumeKey } from '@quina/protocol';
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
