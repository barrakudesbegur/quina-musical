import { useRef } from 'react';

export const useAudioContext = () => {
  const audioCtx = useRef<AudioContext>(null);

  const getAudioContext = () => {
    if (!audioCtx.current) {
      audioCtx.current = new AudioContext();
    }

    if (audioCtx.current.state === 'suspended') {
      audioCtx.current.resume();
    }

    return audioCtx.current;
  };

  const gainNodeSongs = useRef<GainNode>(null);

  const getGainNodeSongs = () => {
    if (!gainNodeSongs.current) {
      const audioCtx = getAudioContext();
      gainNodeSongs.current = new GainNode(audioCtx);
    }

    return gainNodeSongs.current;
  };
  const gainNodeFx = useRef<GainNode>(null);

  const getGainNodeFx = () => {
    if (!gainNodeFx.current) {
      const audioCtx = getAudioContext();
      gainNodeFx.current = new GainNode(audioCtx);
    }

    return gainNodeFx.current;
  };

  return {
    getAudioContext,
    getGainNodeSongs,
    getGainNodeFx,
  };
};
