import { useCallback, useEffect, useRef } from 'react';
import { EffectId, Resource } from '../engine';
import { useAudioContext } from './AudioProvider';

export const useSoundEffects = (effects: Resource<EffectId>[]) => {
  const { effectsPlayer, init, isInitialized } = useAudioContext();
  const preloaded = useRef(false);

  useEffect(() => {
    effectsPlayer.setEffects(effects);
    if (isInitialized && !preloaded.current) {
      preloaded.current = true;
      effectsPlayer.preloadAll();
    }
  }, [effectsPlayer, effects, isInitialized]);

  const playFx = useCallback(
    async (id: EffectId) => {
      if (!isInitialized) await init();
      await effectsPlayer.play(id);
    },
    [effectsPlayer, init, isInitialized]
  );

  return { playFx };
};
