import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { trpc } from '../utils/trpc';
import { usePreloadResourcesOld } from './usePreloadResourcesOld';

// TODO: Remove this file when useSongPlayer is implemented

type SongId = number;
type VolumeAutomation = {
  from: number;
  to: number;
  startTime: number;
  duration: number;
};

export type SongTimestampCategory = 'main' | 'secondary' | 'any' | 'constant';

type PlayerHandlers = {
  onNext?: () => void;
  onPrevious?: () => void;
  onToggleLowVolume?: () => void;
};

const defaultPlaylist = {
  title: 'Quina Musical',
  artist: 'Barrakudes',
} as const;

export const useSongPlayerOld = (options?: PlayerHandlers) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const startPromiseRef = useRef<Promise<void> | null>(null);
  const startedRef = useRef(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [isSilence, setIsSilence] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const volumeRef = useRef(1);
  const volumeAutomationRef = useRef<VolumeAutomation | null>(null);
  const pausedTimeRef = useRef<number | null>(null);

  const songsQuery = trpc.game.getAllSongs.useQuery(undefined);
  const playlistQuery = trpc.song.getPlaylist.useQuery();
  const startedAtQuery = trpc.game.getStartedAt.useQuery();

  const songResources = useMemo(() => {
    const cacheBuster = startedAtQuery.data
      ? `?v=${new Date(startedAtQuery.data).getTime()}`
      : '';
    return (
      songsQuery.data?.map((song) => ({
        id: song.id,
        url: `/songs/${song.id}.mp3${cacheBuster}`,
      })) ?? []
    );
  }, [songsQuery.data, startedAtQuery.data]);

  const {
    isPreloading: isPreloading,
    preloadStatuses: songPreloadStatuses,
    preloadAll: preloadAllSongs,
    getPreloadedUrl,
  } = usePreloadResourcesOld(songResources, { autoStart: false });

  const getSongSrc = useCallback(
    (songId: SongId) => {
      const preloaded = getPreloadedUrl(songId);
      if (preloaded) return preloaded;
      const cacheBuster = startedAtQuery.data
        ? `?v=${new Date(startedAtQuery.data).getTime()}`
        : '';
      return `/songs/${songId}.mp3${cacheBuster}`;
    },
    [getPreloadedUrl, startedAtQuery.data]
  );

  const audioListenersCleanupRef = useRef<(() => void) | null>(null);

  const attachAudioListeners = useCallback((audioEl: HTMLAudioElement) => {
    audioListenersCleanupRef.current?.();

    const handleTimeUpdate = () => {
      setCurrentTime(audioEl.currentTime);
    };

    const handleDurationChange = () => {
      setDuration(Number.isFinite(audioEl.duration) ? audioEl.duration : null);
    };

    const handleEmptied = () => {
      setCurrentTime(0);
      setDuration(null);
    };

    audioEl.addEventListener('timeupdate', handleTimeUpdate);
    audioEl.addEventListener('loadedmetadata', handleDurationChange);
    audioEl.addEventListener('durationchange', handleDurationChange);
    audioEl.addEventListener('emptied', handleEmptied);

    audioListenersCleanupRef.current = () => {
      audioEl.removeEventListener('timeupdate', handleTimeUpdate);
      audioEl.removeEventListener('loadedmetadata', handleDurationChange);
      audioEl.removeEventListener('durationchange', handleDurationChange);
      audioEl.removeEventListener('emptied', handleEmptied);
    };
  }, []);

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

      attachAudioListeners(audioEl);
      setCurrentTime(audioEl.currentTime);
      setDuration(Number.isFinite(audioEl.duration) ? audioEl.duration : null);
    }

    const ctx = audioContextRef.current!;

    return ctx;
  }, [attachAudioListeners]);

  const initialize = useCallback(async () => {
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

  const playSilence = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
    }
    setIsSilence(true);
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(null);
    pausedTimeRef.current = null;
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: playlistQuery.data?.title || defaultPlaylist.title,
        artist: playlistQuery.data?.artist || defaultPlaylist.artist,
        artwork: playlistQuery.data?.cover
          ? [{ src: playlistQuery.data.cover }]
          : [],
      });
      navigator.mediaSession.playbackState = 'playing';
      navigator.mediaSession.setPositionState({
        duration: Infinity,
        playbackRate: 0.0000001,
        position: 0,
      });
    }
  }, [playlistQuery.data]);

  const setSongId = useCallback(
    async (
      songId: SongId | null,
      timestampSelection?: SongTimestampCategory | number,
      options?: { autoplay?: boolean }
    ) => {
      if (!songId) {
        playSilence();
        return;
      }

      await initialize();

      const ctx = await ensureAudioContext();
      const audioEl = audioElRef.current;
      if (!audioEl) {
        const error = new Error('Audio element is not available.');
        setLastError(error);
        throw error;
      }

      setIsSilence(false);

      audioEl.loop = true;
      const src = getSongSrc(songId);
      if (audioEl.src !== src) {
        audioEl.src = src;
      }

      const startSeconds = pickStartTimeMs(songId, timestampSelection);
      const applyStart = () => {
        try {
          audioEl.currentTime = startSeconds;
        } catch {
          // Ignore seek failures; playback will start from current time.
        }
        setCurrentTime(audioEl.currentTime);
        pausedTimeRef.current = audioEl.currentTime;
      };

      const handleMetadata = () => {
        setDuration(
          Number.isFinite(audioEl.duration) ? audioEl.duration : null
        );
        applyStart();
      };

      audioEl.preload = 'auto';
      if (audioEl.readyState >= HTMLMediaElement.HAVE_METADATA) {
        handleMetadata();
      } else {
        audioEl.addEventListener('loadedmetadata', handleMetadata, {
          once: true,
        });
      }

      const song = songsQuery.data?.find((s) => s.id === songId);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title:
            song?.title || playlistQuery.data?.title || defaultPlaylist.title,
          artist:
            song?.artist ||
            playlistQuery.data?.artist ||
            defaultPlaylist.artist,
          artwork: song?.cover
            ? [{ src: song.cover }]
            : playlistQuery.data?.cover
              ? [{ src: playlistQuery.data.cover }]
              : [],
        });
      }

      if (!options?.autoplay) {
        setIsPlaying(false);
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        return;
      }

      setDuration(Number.isFinite(audioEl.duration) ? audioEl.duration : null);
      pausedTimeRef.current = null;

      try {
        await audioEl.play();
        setIsPlaying(true);
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
          navigator.mediaSession.setPositionState({
            duration: Number.isFinite(audioEl.duration)
              ? audioEl.duration
              : Infinity,
            playbackRate: 1,
            position: audioEl.currentTime,
          });
        }
      } catch (err) {
        const error =
          err instanceof Error
            ? err
            : new Error('Playback was prevented by the browser.');
        setLastError(error);
        setIsPlaying(false);
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
          navigator.mediaSession.setPositionState({
            duration: Number.isFinite(audioEl.duration)
              ? audioEl.duration
              : Infinity,
            playbackRate: 1,
            position: audioEl.currentTime,
          });
        }
        throw error;
      }
    },
    [
      initialize,
      ensureAudioContext,
      getSongSrc,
      pickStartTimeMs,
      songsQuery.data,
      playSilence,
      playlistQuery.data,
    ]
  );

  const pause = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      pausedTimeRef.current = audioElRef.current.currentTime;
      setCurrentTime(audioElRef.current.currentTime);
    } else {
      setCurrentTime(0);
    }
    setIsPlaying(false);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
      navigator.mediaSession.setPositionState({
        duration: Number.isFinite(audioElRef.current?.duration)
          ? audioElRef.current?.duration
          : Infinity,
        playbackRate: 1,
        position: audioElRef.current?.currentTime ?? 0,
      });
    }
  }, []);

  const seek = useCallback(async (nextTime: number) => {
    const audioEl = audioElRef.current;
    if (!audioEl) return;

    const maxTime = Number.isFinite(audioEl.duration)
      ? audioEl.duration
      : Number.POSITIVE_INFINITY;
    const clampedTime = Math.max(0, Math.min(maxTime, nextTime));

    try {
      audioEl.currentTime = clampedTime;
      setCurrentTime(clampedTime);
      pausedTimeRef.current = clampedTime;
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setPositionState({
          duration: Number.isFinite(audioEl.duration)
            ? audioEl.duration
            : Infinity,
          playbackRate: 1,
          position: clampedTime,
        });
      }
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    } catch {
      // Ignore seek failures; player will keep current time.
    }
  }, []);

  const play = useCallback(async () => {
    await initialize();
    const audioEl = audioElRef.current;
    if (!audioEl || !audioEl.src) return;

    const ctx = await ensureAudioContext();

    if (isSilence) {
      setIsPlaying(true);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
        navigator.mediaSession.setPositionState({
          duration: Infinity,
          playbackRate: 0.0000001,
          position: 0,
        });
      }
      return;
    }

    if (pausedTimeRef.current !== null) {
      const maxTime = Number.isFinite(audioEl.duration)
        ? audioEl.duration
        : Number.POSITIVE_INFINITY;
      const clamped = Math.max(0, Math.min(maxTime, pausedTimeRef.current));
      try {
        audioEl.currentTime = clamped;
      } catch {
        // Ignore seek failures when resuming.
      }
    }

    try {
      await audioEl.play();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      setIsPlaying(true);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
        navigator.mediaSession.setPositionState({
          duration: Number.isFinite(audioEl.duration)
            ? audioEl.duration
            : Infinity,
          playbackRate: 1,
          position: audioEl.currentTime,
        });
      }
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error('Playback was prevented by the browser.');
      setLastError(error);
      setIsPlaying(false);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
        navigator.mediaSession.setPositionState({
          duration: Number.isFinite(audioEl.duration)
            ? audioEl.duration
            : Infinity,
          playbackRate: 1,
          position: audioEl.currentTime,
        });
      }
      throw error;
    }
  }, [ensureAudioContext, isSilence, initialize]);

  const toggleIsPlaying = useCallback(async () => {
    if (isPlaying) {
      pause();
    } else {
      await play();
    }
  }, [isPlaying, pause, play]);

  const setPlayingState = useCallback(
    async (newValue: boolean) => {
      if (newValue) {
        pause();
      } else {
        await play();
      }
    },
    [pause, play]
  );

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
    if (!('mediaSession' in navigator)) return;

    if (
      !navigator.mediaSession.metadata ||
      Object.entries(defaultPlaylist).every(
        ([key, value]) =>
          !navigator.mediaSession.metadata ||
          value ===
            navigator.mediaSession.metadata[key as keyof typeof defaultPlaylist]
      )
    ) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: playlistQuery.data?.title || defaultPlaylist.title,
        artist: playlistQuery.data?.artist || defaultPlaylist.artist,
        artwork: playlistQuery.data?.cover
          ? [{ src: playlistQuery.data.cover }]
          : [],
      });
      if (!navigator.mediaSession.metadata) {
        navigator.mediaSession.playbackState = 'paused';
        navigator.mediaSession.setPositionState({
          duration: Infinity,
          playbackRate: 0.0000001,
          position: 0,
        });
      }
    }
  }, [playlistQuery.data]);

  useEffect(() => {
    if (!options) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputElement =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isInputElement) {
        return;
      }

      switch (event.key) {
        case ' ':
          if (options.onToggleLowVolume) {
            event.preventDefault();
            options.onToggleLowVolume();
          }
          break;
        case 'ArrowRight':
          if (options.onNext) {
            event.preventDefault();
            options.onNext();
          }
          break;
        case 'ArrowLeft':
          if (options.onPrevious) {
            event.preventDefault();
            options.onPrevious();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler(
        'nexttrack',
        options.onNext || null
      );
      navigator.mediaSession.setActionHandler(
        // @ts-expect-error - 'nextslide' is actually a valid MediaSessionAction
        'nextslide',
        options.onNext || null
      );
      navigator.mediaSession.setActionHandler(
        'previoustrack',
        options.onPrevious || null
      );
      navigator.mediaSession.setActionHandler(
        // @ts-expect-error - 'previousslide' is actually a valid MediaSessionAction
        'previousslide',
        options.onPrevious || null
      );
      navigator.mediaSession.setActionHandler('play', toggleIsPlaying);
      navigator.mediaSession.setActionHandler('pause', toggleIsPlaying);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);

      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
      }
    };
  }, [options, toggleIsPlaying]);

  useEffect(() => {
    return () => {
      audioListenersCleanupRef.current?.();
      audioListenersCleanupRef.current = null;

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
      volumeAutomationRef.current = null;
      setCurrentTime(0);
      setDuration(null);
    };
  }, []);

  return {
    initialize,
    setSongId,
    setIsPlaying: setPlayingState,
    toggleIsPlaying,
    seek,
    setVolume,
    volume,
    isLoading,
    isPreloading,
    isPlaying,
    currentTime,
    duration,
    preloadStatus: songPreloadStatuses,
    lastError,
  };
};
