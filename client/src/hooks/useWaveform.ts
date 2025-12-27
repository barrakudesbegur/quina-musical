import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useAudioContext } from './useAudioContext';

type WaveformData = number[];

export const useWaveform = (audioUrl: string | null) => {
  const { getAudioContext } = useAudioContext();
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Record<string, WaveformData>>({});

  const generateWaveform = useCallback(
    async (url: string, samples: number = 200) => {
      if (cacheRef.current[url]) {
        return cacheRef.current[url];
      }

      try {
        const audioContext = getAudioContext();
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const channelData = audioBuffer.getChannelData(0);
        const blockSize = Math.floor(channelData.length / samples);
        const waveform: number[] = [];

        for (let i = 0; i < samples; i++) {
          let sum = 0;
          const start = i * blockSize;
          const end = Math.min(start + blockSize, channelData.length);

          for (let j = start; j < end; j++) {
            sum += Math.abs(channelData[j]);
          }

          const average = sum / (end - start);
          waveform.push(average);
        }

        const max = Math.max(...waveform);
        const normalized = max > 0 ? waveform.map((v) => v / max) : waveform;

        cacheRef.current[url] = normalized;
        return normalized;
      } catch (err) {
        console.error('Failed to generate waveform:', err);
        throw err;
      }
    },
    [getAudioContext]
  );

  useEffect(() => {
    if (!audioUrl) {
      startTransition(() => {
        setIsLoading(false);
        setError(null);
        setWaveformData(null);
      });
      return;
    }

    let cancelled = false;

    startTransition(() => {
      setIsLoading(true);
      setError(null);
    });

    generateWaveform(audioUrl)
      .then((data) => {
        if (!cancelled) {
          setWaveformData(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load waveform'
          );
          setIsLoading(false);
          setWaveformData(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [audioUrl, generateWaveform]);

  return { waveformData, isLoading, error };
};
