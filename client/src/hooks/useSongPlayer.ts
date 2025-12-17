import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { trpc } from '../utils/trpc';
import { IconGridAction } from '../components/IconButtonGrid';

export type SongTimestampCategory = 'main' | 'secondary' | 'any' | 'constant';

type PlayerHandlers = {
  onNext?: () => void;
  onPrevious?: () => void;
  onToggleLowVolume?: () => void;
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

type ResourcesShape = {
  song: { id: number };
  fx: { id: (typeof fxOptions)[number]['id'] };
};

type BufferCache<T extends Record<string, { id: string | number }>> = {
  [K in keyof T]: {
    [key in T[K]['id']]: AudioBuffer;
  };
};

type PreloadStatus<T extends Record<string, { id: string | number }>> = {
  [K in keyof T]: { id: T[K]['id']; preloaded: boolean }[];
};

async function loadAudioBuffer(audioContext: AudioContext, filepath: string) {
  const response = await fetch(filepath);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return audioBuffer;
}

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

  const togglePlay = async () => {
    setIsPlaying((prev) => !prev);
  };

  const seek = async (nextTime: number) => {
    // TODO: implement seek functionality
  };

  const setVolume = (newVolume: number) => {
    setVolumeState(newVolume);
  };

  const playFx = async (fxId: ResourcesShape['fx']['id']) => {
    const buffer = await getAudioBuffer('fx', fxId);
    if (!buffer) throw new Error(`Sound effect ${fxId} not found`);

    const audioContext = getAudioContext();

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
  };

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
  };
};

const useAudioContext = () => {
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

const useSongPlayerLoading = (
  songId: number | null,
  getAudioContext: () => AudioContext
) => {
  const [bufferCache, setBufferCache] = useState<BufferCache<ResourcesShape>>({
    song: {},
    fx: {},
  });

  const songsQuery = trpc.game.getAllSongs.useQuery(undefined);
  // const playlistQuery = trpc.song.getPlaylist.useQuery();
  const startedAtQuery = trpc.game.getStartedAt.useQuery();

  const loadBuffer = useCallback(
    async <T extends keyof ResourcesShape>(
      type: T,
      id: ResourcesShape[T]['id']
    ) => {
      const cacheBuster = startedAtQuery.data
        ? `?v=${new Date(startedAtQuery.data).getTime()}`
        : '';

      try {
        const buffer = await loadAudioBuffer(
          getAudioContext(),
          `/audios/${type}/${id}.mp3${cacheBuster}`
        );
        setBufferCache((prev) => ({
          ...prev,
          [type]: {
            ...prev[type],
            [id]: buffer,
          },
        }));
        return buffer;
      } catch (error) {
        console.error(`Failed to load ${type} ${id}`, error);
      }
    },
    [getAudioContext, startedAtQuery.data]
  );

  useEffect(() => {
    songsQuery.data?.forEach(async (song) => {
      if (bufferCache.song[song.id]) return;

      await loadBuffer('song', song.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songsQuery.data]);

  useEffect(() => {
    fxOptions.forEach(async (fx) => {
      if (bufferCache.fx[fx.id]) return;

      await loadBuffer('fx', fx.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preloadStatus = useMemo<PreloadStatus<ResourcesShape>>(() => {
    const bufferedSongs = Object.keys(bufferCache.song);
    const bufferedFx = Object.keys(bufferCache.fx);
    return {
      song:
        songsQuery.data?.map((song) => ({
          id: song.id,
          preloaded: bufferedSongs.includes(song.id.toString()),
        })) ?? [],
      fx:
        fxOptions.map((fx) => ({
          id: fx.id,
          preloaded: bufferedFx.includes(fx.id),
        })) ?? [],
    };
  }, [bufferCache, songsQuery]);

  const isSongReady = useMemo(() => {
    return (
      songId !== null &&
      preloadStatus.song.some((song) => song.id === songId && song.preloaded)
    );
  }, [songId, preloadStatus.song]);

  const getAudioBuffer = async <T extends keyof ResourcesShape>(
    type: T,
    id: ResourcesShape[T]['id']
  ) => {
    const buffer = bufferCache[type][id];
    if (!buffer) return await loadBuffer(type, id);

    return buffer;
  };

  return {
    isSongReady,
    preloadStatus,
    getAudioBuffer,
  };
};

// hook to handle audio playback
// It uses Audio context and a cache of buffers to play sounds
// It uses the Media Session Api to show the song.
// Handle Media Session Api events, Arrow keys (onPrevious/onNext), Space (play/pause)
type useSongPlayer = (options?: {
  onNext?: () => void;
  onPrevious?: () => void;
  onToggleLowVolume?: () => void;
}) => {
  setSong: (
    songId: number | null, // Null, unsets the song
    timestampSelection?: number | 'main' | 'secondary' | 'any' | 'constant'
  ) => Promise<void>; // If playstte was true, it plays immediately. else it just sets the song.
  play: () => Promise<void>;
  pause: () => Promise<void>;
  togglePlay: () => Promise<void>;
  seek: (nextTime: number) => Promise<void>;
  setVolume: (volume: number) => void; // Smoothly updates the volume
  playFx: (fxId: string) => Promise<void>;

  volume: number;
  isPlaying: boolean; // When song is null, it can be true altough it is silence
  currentTime: number;
  duration: number | null;
  isSongReady: boolean; // When the set song is not ready to play.
  preloadStatus: {
    songs: {
      id: number;
      preloaded: boolean;
    }[];
    fx: {
      id: string;
      preloaded: boolean;
    }[];
  };
};
