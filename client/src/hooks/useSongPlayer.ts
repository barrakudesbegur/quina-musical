import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { trpc } from '../utils/trpc';

type SongId = number;
type VolumeAutomation = {
  from: number;
  to: number;
  startTime: number;
  duration: number;
};

export type SongTimestampCategory = 'main' | 'secondary' | 'any' | 'constant';

export const useSongPlayer = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const startPromiseRef = useRef<Promise<void> | null>(null);
  const preloadPromiseRef = useRef<Promise<void> | null>(null);
  const preloadAbortControllerRef = useRef<AbortController | null>(null);
  const preloadedUrlsRef = useRef<Map<SongId, string>>(new Map());
  const preloadingIdsRef = useRef<Set<SongId>>(new Set());
  const startedRef = useRef(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [failedSongIds, setFailedSongIds] = useState<SongId[]>([]);
  const [currentSongId, setCurrentSongId] = useState<SongId | null>(null);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [isPreloadingSongs, setIsPreloadingSongs] = useState(false);
  const [preloadedSongIds, setPreloadedSongIds] = useState<Set<SongId>>(
    new Set()
  );
  const volumeRef = useRef(1);
  const volumeAutomationRef = useRef<VolumeAutomation | null>(null);

  const songsQuery = trpc.game.getAllSongs.useQuery(undefined);
  const startedAtQuery = trpc.game.getStartedAt.useQuery();

  const songIdsToPreload = useMemo(() => {
    return songsQuery.data?.map((song) => song.id) ?? [];
  }, [songsQuery.data]);

  const getSongSrc = useCallback(
    (songId: SongId) =>
      preloadedUrlsRef.current.get(songId) ??
      `/songs/${songId}.mp3${startedAtQuery.data ? `?v=${new Date(startedAtQuery.data).getTime()}` : ''}`,
    [startedAtQuery.data]
  );

  const preloadSong = useCallback(
    async (songId: SongId, signal?: AbortSignal) => {
      if (preloadedUrlsRef.current.has(songId)) return;
      if (preloadingIdsRef.current.has(songId)) return;
      preloadingIdsRef.current.add(songId);

      try {
        const response = await fetch(
          `/songs/${songId}.mp3?v=${startedAtQuery.data}`,
          {
            cache: 'force-cache',
            signal,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to preload song ${songId}.`);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        preloadedUrlsRef.current.set(songId, objectUrl);
        setPreloadedSongIds((prev) => {
          const next = new Set(prev);
          next.add(songId);
          return next;
        });
      } catch (err) {
        const isAbort =
          err instanceof DOMException && err.name === 'AbortError';
        if (!isAbort) {
          console.error('Failed to preload song', songId, err);
        }
      } finally {
        preloadingIdsRef.current.delete(songId);
      }
    },
    [startedAtQuery.data]
  );

  const preloadAllSongs = useCallback(() => {
    if (!songIdsToPreload.length) return;
    if (preloadPromiseRef.current) return;

    const controller = new AbortController();
    preloadAbortControllerRef.current?.abort();
    preloadAbortControllerRef.current = controller;

    const idsToPreload = songIdsToPreload.filter(
      (id) => !preloadedUrlsRef.current.has(id)
    );
    if (!idsToPreload.length) {
      preloadAbortControllerRef.current = null;
      setIsPreloadingSongs(false);
      return;
    }

    const uniqueQueue = [...new Set(idsToPreload)];
    const concurrency = 4;

    const promise = (async () => {
      setIsPreloadingSongs(true);

      const workers = Array.from({ length: concurrency }, async () => {
        while (uniqueQueue.length) {
          const nextSongId = uniqueQueue.shift();
          if (nextSongId === undefined) break;
          await preloadSong(nextSongId, controller.signal);
        }
      });

      await Promise.allSettled(workers);
    })();

    preloadPromiseRef.current = promise.finally(() => {
      if (preloadAbortControllerRef.current === controller) {
        preloadAbortControllerRef.current = null;
      }
      preloadPromiseRef.current = null;
      setIsPreloadingSongs(false);
    });
  }, [preloadSong, songIdsToPreload]);

  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      gain.gain.value = volumeRef.current;
      gain.connect(ctx.destination);

      const audioEl = new Audio();
      audioEl.preload = 'metadata';
      audioEl.loop = true;

      const mediaSource = ctx.createMediaElementSource(audioEl);
      mediaSource.connect(gain);

      audioContextRef.current = ctx;
      gainNodeRef.current = gain;
      mediaSourceRef.current = mediaSource;
      audioElRef.current = audioEl;
    }

    const ctx = audioContextRef.current!;

    return ctx;
  }, []);

  const start = useCallback(async () => {
    if (startedRef.current && !startPromiseRef.current) {
      preloadAllSongs();
      return;
    }
    if (startPromiseRef.current) {
      await startPromiseRef.current;
      return;
    }

    setIsLoading(true);
    setLastError(null);
    setFailedSongIds([]);

    const promise = (async () => {
      await ensureAudioContext();
    })();

    startPromiseRef.current = promise;

    try {
      await promise;
      startedRef.current = true;
      preloadAllSongs();
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error('Failed to initialize audio context.');
      setLastError(error);
      throw error;
    } finally {
      startPromiseRef.current = null;
      setIsLoading(false);
    }
  }, [ensureAudioContext, preloadAllSongs]);

  const pickStartTimeMs = useCallback(
    (songId: SongId, category: SongTimestampCategory | number = 'constant') => {
      if (typeof category === 'number') {
        return Math.max(0, category);
      }

      const song = songsQuery.data?.find((s) => s.id === songId);
      const timestamps = song?.timestamps;
      if (!timestamps) return 0;

      const list =
        (category === 'any'
          ? Object.values(timestamps).flat()
          : category === 'constant'
            ? timestamps.main.slice(0, 1)
            : timestamps[category]
        )
          ?.filter((t) => Number.isFinite(t))
          .map((t) => Math.max(0, t)) ?? [];
      if (!list.length) return 0;

      const index = Math.floor(Math.random() * list.length);
      return list[index];
    },
    [songsQuery.data]
  );

  const playById = useCallback(
    async (
      songId: SongId,
      timestampSelection?: SongTimestampCategory | number
    ) => {
      await start();

      const ctx = await ensureAudioContext();
      const audioEl = audioElRef.current;
      if (!audioEl) {
        const error = new Error('Audio element is not available.');
        setLastError(error);
        throw error;
      }

      audioEl.loop = true;
      const src = getSongSrc(songId);
      audioEl.src = src;
      audioEl.currentTime = 0;
      const startSeconds = pickStartTimeMs(songId, timestampSelection);
      const applyStart = () => {
        try {
          audioEl.currentTime = startSeconds;
        } catch {
          // Ignore seek failures; playback will start from current time.
        }
      };
      applyStart();
      if (audioEl.readyState < HTMLMediaElement.HAVE_METADATA) {
        audioEl.addEventListener('loadedmetadata', applyStart, { once: true });
      }

      try {
        await audioEl.play();
        void preloadSong(songId);
        setCurrentSongId(songId);
        setIsPlaying(true);
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
      } catch (err) {
        const error =
          err instanceof Error
            ? err
            : new Error('Playback was prevented by the browser.');
        setLastError(error);
        setFailedSongIds((prev) =>
          prev.includes(songId) ? prev : [...prev, songId]
        );
        setIsPlaying(false);
        throw error;
      }
    },
    [ensureAudioContext, getSongSrc, pickStartTimeMs, preloadSong, start]
  );

  const playSilence = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
    }
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    if (!audioElRef.current) return;
    audioElRef.current.pause();
    audioElRef.current.currentTime = 0;
    setIsPlaying(false);
  }, []);

  const getCurrentGainValue = useCallback((gainNode: GainNode, now: number) => {
    const automation = volumeAutomationRef.current;
    if (!automation) return gainNode.gain.value;

    const { from, to, startTime, duration } = automation;
    const elapsed = now - startTime;

    if (elapsed <= 0) return from;
    if (elapsed >= duration) {
      volumeAutomationRef.current = null;
      return to;
    }

    const progress = elapsed / duration;
    return from + (to - from) * progress;
  }, []);

  const applyVolumeTransition = useCallback(
    (targetVolume: number, durationMs = 250) => {
      const gainNode = gainNodeRef.current;
      const ctx = audioContextRef.current;

      if (!gainNode || !ctx) {
        volumeAutomationRef.current = null;
        return;
      }

      const now = ctx.currentTime;
      const startValue = getCurrentGainValue(gainNode, now);
      const durationSeconds = Math.max(durationMs, 0) / 1000;

      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(startValue, now);

      if (durationSeconds === 0 || Math.abs(targetVolume - startValue) < 1e-4) {
        gainNode.gain.setValueAtTime(targetVolume, now);
        volumeAutomationRef.current = null;
        return;
      }

      const endTime = now + durationSeconds;
      gainNode.gain.linearRampToValueAtTime(targetVolume, endTime);
      volumeAutomationRef.current = {
        from: startValue,
        to: targetVolume,
        startTime: now,
        duration: durationSeconds,
      };
    },
    [getCurrentGainValue]
  );

  const setVolume = useCallback(
    (nextVolume: number, options?: { durationMs?: number }) => {
      const clamped = Math.min(1, Math.max(0, nextVolume));
      volumeRef.current = clamped;
      setVolumeState(clamped);
      applyVolumeTransition(clamped, options?.durationMs);
    },
    [applyVolumeTransition]
  );

  useEffect(() => {
    const preloadingIds = preloadingIdsRef.current;
    const preloadedUrls = preloadedUrlsRef.current;

    return () => {
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current.src = '';
        audioElRef.current = null;
      }

      setIsPlaying(false);

      if (mediaSourceRef.current) {
        mediaSourceRef.current.disconnect();
        mediaSourceRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      gainNodeRef.current = null;
      preloadAbortControllerRef.current?.abort();
      preloadingIds.clear();
      preloadedUrls.forEach((url) => URL.revokeObjectURL(url));
      preloadedUrls.clear();
      setPreloadedSongIds(new Set());
      volumeAutomationRef.current = null;
    };
  }, []);

  const preloadStatuses = useMemo(
    () =>
      songIdsToPreload.map((id) => ({
        id,
        preloaded: preloadedSongIds.has(id),
      })),
    [preloadedSongIds, songIdsToPreload]
  );

  return {
    start,
    playById,
    playSilence,
    pause,
    setVolume,
    volume,
    isLoading,
    isPreloadingSongs,
    isPlaying,
    preloadStatuses,
    currentSongId,
    failedSongIds,
    lastError,
  };
};
