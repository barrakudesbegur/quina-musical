import { useCallback, useEffect, useRef } from 'react';

export const useSoundEffects = <T extends string>(
  effects: { id: T; src: string }[],
  options?: { volume?: number }
) => {
  const cacheRef = useRef<Map<T, HTMLAudioElement>>(new Map());
  const volume = Math.min(1, Math.max(0, options?.volume ?? 1));

  const cacheAudio = useCallback(
    (id: T) => {
      const match = cacheRef.current.get(id);
      if (match) return match;

      const src = effects.find((fx) => fx.id === id)?.src;
      if (!src) throw new Error(`Sound effect ${id} not found`);
      const audio = new Audio(src);
      audio.preload = 'auto';
      audio.load();
      cacheRef.current.set(id, audio);
      return audio;
    },
    [effects]
  );

  useEffect(() => {
    effects.forEach(({ id }) => cacheAudio(id));

    const cache = cacheRef.current;
    return () => {
      cache.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
    };
  }, [cacheAudio, effects]);

  const getAudioInstance = useCallback(
    (id: T) => {
      return cacheAudio(id).cloneNode(true) as HTMLAudioElement;
    },
    [cacheAudio]
  );

  const playFx = useCallback(
    async (id: T) => {
      const audio = getAudioInstance(id);
      audio.volume = volume;
      audio.currentTime = 0;
      try {
        await audio.play();
      } catch (err) {
        console.error(err);
      }
    },
    [getAudioInstance, volume]
  );

  return {
    playFx,
  };
};
