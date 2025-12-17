import { Dispatch, SetStateAction, useCallback, useState } from 'react';
import { useSessionStorage } from 'usehooks-ts';
import { IconGridAction } from '../components/IconButtonGrid';
import { useAudioContext } from './useAudioContext';
import { useMediaSession } from './useMediaSession';
import { useSongPlayerLoading } from './useSongPlayerLoading';

export type SongTimestampCategory = 'main' | 'secondary' | 'any' | 'constant';

type PlayerHandlers = {
  onNext?: () => void;
  onPrevious?: () => void;
};

export const fxOptions: IconGridAction[] = [
  {
    id: 'anime-wow',
    label: 'Anime wow',
    icon: 'noto:smiling-cat-with-heart-eyes',
    url: '/fx/anime-wow.mp3',
  },
  {
    id: 'correct',
    label: 'Correct',
    icon: 'noto:check-mark-button',
    url: '/fx/correct.mp3',
  },
  {
    id: 'tada',
    label: 'Tada',
    icon: 'noto:party-popper',
    url: '/fx/tada.mp3',
  },
  {
    id: 'heaven',
    label: 'Heaven',
    icon: 'noto:wing',
    url: '/fx/heaven.mp3',
  },
  {
    id: 'among-us',
    label: 'Among Us',
    icon: 'noto:alien-monster',
    url: '/fx/among-us.mp3',
  },
  {
    id: 'spongebob-boowomp',
    label: 'Spongebob Boowomp',
    icon: 'noto:balloon',
    url: '/fx/spongebob-boowomp.mp3',
  },
  {
    id: 'boom',
    label: 'Boom',
    icon: 'twemoji:collision',
    url: '/fx/boom.mp3',
  },
  {
    id: 'horn',
    label: 'Horn',
    icon: 'noto:police-car-light',
    url: '/fx/horn.mp3',
  },
  {
    id: 'buzzer',
    label: 'Buzzer',
    icon: 'noto:cross-mark',
    url: '/fx/buzzer.mp3',
  },
  {
    id: 'sad-trombone',
    label: 'Sad Trombone',
    icon: 'noto:trumpet',
    url: '/fx/sad-trombone.mp3',
  },
  {
    id: 'spongebob-fail',
    label: 'Spongebob Fail',
    icon: 'noto:crying-face',
    url: '/fx/spongebob-fail.mp3',
  },
];

export const useSongPlayer = (options?: PlayerHandlers) => {
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
