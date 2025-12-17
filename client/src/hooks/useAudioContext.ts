import { useRef } from 'react';

export const useAudioContext = () => {
  const audioContextRef = useRef<AudioContext>(null);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    return audioContextRef.current;
  };

  return {
    getAudioContext,
  };
};
