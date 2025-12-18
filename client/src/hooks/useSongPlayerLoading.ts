import { useState, useCallback, useEffect, useMemo } from 'react';
import { trpc } from '../utils/trpc';
import { fxList } from '../config/fx';

type BufferCache<T extends Record<string, { id: string | number }>> = {
  [K in keyof T]: {
    [key in T[K]['id']]: AudioBuffer;
  };
};

type PreloadStatus<T extends Record<string, { id: string | number }>> = {
  [K in keyof T]: { id: T[K]['id']; preloaded: boolean }[];
};

type ResourcesShape = {
  song: { id: number };
  fx: { id: (typeof fxList)[number]['id'] };
};

async function loadAudioBuffer(audioContext: AudioContext, filepath: string) {
  const response = await fetch(filepath);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return audioBuffer;
}

export const useSongPlayerLoading = (
  songId: number | null,
  getAudioContext: () => AudioContext
) => {
  const [bufferCache, setBufferCache] = useState<BufferCache<ResourcesShape>>({
    song: {},
    fx: {},
  });

  const songsQuery = trpc.game.getAllSongs.useQuery();
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
    const sortedByPriority =
      songsQuery.data?.toSorted((a, b) => {
        if (a.positionInQueue === null && b.positionInQueue === null) {
          return b.position - a.position;
        }
        if (a.positionInQueue === null) return 1;
        if (b.positionInQueue === null) return -1;

        return a.positionInQueue - b.positionInQueue;
      }) ?? [];

    const loadSong = async (song: (typeof sortedByPriority)[number]) => {
      if (bufferCache.song[song.id]) return;

      await loadBuffer('song', song.id);
    };

    void (async () => {
      const [first, second, ...rest] = sortedByPriority;
      if (first) await loadSong(first);
      if (second) await loadSong(first);
      if (rest) await Promise.all(rest.map(loadSong));
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songsQuery.data]);

  useEffect(() => {
    fxList.forEach(async (fx) => {
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
        fxList.map((fx) => ({
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
