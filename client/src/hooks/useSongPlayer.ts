import { useCallback, useState } from 'react';
import { useSessionStorage } from 'usehooks-ts';
import { useAudioContext } from './useAudioContext';
import { useMediaSession } from './useMediaSession';
import { useSongPlayerLoading } from './useSongPlayerLoading';

export type SongTimestampCategory = 'main' | 'secondary' | 'any' | 'constant';

export const useSongPlayer = (options?: {
  onNext?: () => void;
  onPrevious?: () => void;
}) => {
  const { getAudioContext } = useAudioContext();

  const [songId, setSongId] = useState<number | null>(null);
  const [volume, setVolumeState] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number | null>(null);

  const { isSongReady, preloadStatus, getAudioBuffer } = useSongPlayerLoading(
    songId,
    getAudioContext
  );

  const setSong = async (
    songId: number | null,
    timestampSelection?: number | SongTimestampCategory
  ) => {
    setSongId(songId);
    // TODO: implement timestampSelection functionality
  };

  const play = async () => {
    setIsPlaying(true);
  };

  const pause = async () => {
    setIsPlaying(false);
  };

  const togglePlay = useCallback(async () => {
    setIsPlaying((prev) => !prev);
  }, []);

  const seek = async (nextTime: number) => {
    // TODO: implement seek functionality
  };

  const setVolume = (newVolume: number) => {
    setVolumeState(newVolume);
  };

  const playFx = async (fxId: Parameters<typeof getAudioBuffer<'fx'>>[1]) => {
    const buffer = await getAudioBuffer('fx', fxId);
    if (!buffer) throw new Error(`Sound effect ${fxId} not found`);

    const audioContext = getAudioContext();

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
  };

  const [isLowVolumeMode, setIsLowVolumeMode] = useSessionStorage<boolean>(
    'admin-low-volume-mode',
    false
  );
  const toggleLowVolume = useCallback(() => {
    setIsLowVolumeMode((prev) => !prev);
  }, [setIsLowVolumeMode]);

  useMediaSession({
    songId,
    playbackState: {
      isPlaying,
      currentTime,
      duration,
    },
    onNext: options?.onNext,
    onPrevious: options?.onPrevious,
    onPlay: play,
    onPause: pause,
    onToggleLowVolume: toggleLowVolume,
  });

  return {
    setSong,
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    playFx,
    volume,
    isPlaying,
    currentTime,
    duration,
    isSongReady,
    preloadStatus,
    isLowVolumeMode,
    setIsLowVolumeMode,
  };
};
