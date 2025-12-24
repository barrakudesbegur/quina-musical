import { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionStorage } from 'usehooks-ts';
import { trpc } from '../utils/trpc';
import { useAudioContext } from './useAudioContext';
import { useMediaSession } from './useMediaSession';

export type SongTimestampCategory = 'main' | 'secondary' | 'any' | 'constant';

const loadAudioBuffer = async (
  audioContext: AudioContext,
  filepath: string
) => {
  const response = await fetch(filepath);
  const arrayBuffer = await response.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
};

export const useSongPlayer = (options?: {
  onNext?: () => void;
  onPrevious?: () => void;
}) => {
  const { getAudioContext, getGainNodeSongs, getGainNodeFx } =
    useAudioContext();

  const songsQuery = trpc.game.getAllSongs.useQuery();
  const startedAtQuery = trpc.game.getStartedAt.useQuery();

  const [songId, setSongId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [isSongReady, setIsSongReady] = useState<boolean>(true);

  const [isLowVolumeMode, setIsLowVolumeMode] = useSessionStorage(
    'admin-low-volume-mode',
    false
  );
  const [lowVolumeSetting, setLowVolumeSetting] = useSessionStorage(
    'admin-low-volume-setting',
    0.2
  );
  const [songVolume, setSongVolume] = useSessionStorage('admin-song-volume', 1);
  const [fxVolume, setFxVolume] = useSessionStorage('admin-fx-volume', 1);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const songSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const setSongRequestIdRef = useRef<number>(0);

  const fxBufferCacheRef = useRef<Record<string, AudioBuffer>>({});

  const [mediaSessionPosition, setMediaSessionPosition] = useState<number>(0);

  const getCurrentTime = useCallback(() => {
    return audioElRef.current?.currentTime ?? 0;
  }, []);

  const pickStartTimeSeconds = useCallback(
    (songId: number, category: SongTimestampCategory | number = 'constant') => {
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

  const getSongUrl = useCallback(
    (id: number) => {
      const cacheBuster = startedAtQuery.data
        ? `?v=${new Date(startedAtQuery.data).getTime()}`
        : '';
      return `/audios/song/${id}.mp3${cacheBuster}`;
    },
    [startedAtQuery.data]
  );

  const ensureSongElement = useCallback(() => {
    if (!audioElRef.current) {
      const el = new Audio();
      el.preload = 'auto';
      el.loop = true;
      el.crossOrigin = 'anonymous';
      audioElRef.current = el;
    }
    return audioElRef.current;
  }, []);

  const ensureSongGraph = useCallback(() => {
    const audioCtx = getAudioContext();
    const el = ensureSongElement();
    if (!songSourceRef.current) {
      songSourceRef.current = audioCtx.createMediaElementSource(el);
      songSourceRef.current.connect(getGainNodeSongs());
    }
  }, [ensureSongElement, getAudioContext, getGainNodeSongs]);

  const setSong = useCallback(
    async (
      nextSongId: number | null,
      timestampSelection?: number | SongTimestampCategory,
      shouldPlay?: boolean
    ) => {
      const requestId = ++setSongRequestIdRef.current;
      setSongId(nextSongId);

      const el = ensureSongElement();
      el.pause();

      if (!nextSongId) {
        setIsPlaying(false);
        setIsSongReady(true);
        setDuration(null);
        el.removeAttribute('src');
        el.load();
        return;
      }

      const url = getSongUrl(nextSongId);
      setIsSongReady(false);
      el.src = url;
      el.load();

      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => resolve();
        const onError = () =>
          reject(new Error(`Failed to load song ${nextSongId}`));
        el.addEventListener('loadedmetadata', onLoaded, { once: true });
        el.addEventListener('error', onError, { once: true });
      });

      if (setSongRequestIdRef.current !== requestId) return;

      const nextDuration = Number.isFinite(el.duration) ? el.duration : null;
      setDuration(nextDuration);

      const offset = pickStartTimeSeconds(nextSongId, timestampSelection);
      if (Number.isFinite(offset)) {
        el.currentTime =
          nextDuration && nextDuration > 0
            ? Math.min(Math.max(0, offset), Math.max(0, nextDuration - 0.01))
            : Math.max(0, offset);
      }

      const markReady = () => setIsSongReady(true);
      el.addEventListener('canplay', markReady, { once: true });
      if (el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        setIsSongReady(true);
      }

      if (shouldPlay ?? isPlaying) {
        try {
          ensureSongGraph();
          await el.play();
          setIsPlaying(true);
        } catch {
          setIsPlaying(false);
        }
      }
    },
    [
      ensureSongElement,
      ensureSongGraph,
      getSongUrl,
      isPlaying,
      pickStartTimeSeconds,
    ]
  );

  const play = useCallback(
    async (timestampSelection?: number | SongTimestampCategory) => {
      if (!songId) return;

      const el = ensureSongElement();

      if (!el.src) {
        await setSong(songId, timestampSelection ?? 0, true);
        return;
      }

      if (timestampSelection !== undefined) {
        if (typeof timestampSelection === 'number') {
          el.currentTime = Math.max(0, timestampSelection);
        } else {
          el.currentTime = pickStartTimeSeconds(songId, timestampSelection);
        }
      }

      try {
        ensureSongGraph();
        await el.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    },
    [ensureSongElement, ensureSongGraph, pickStartTimeSeconds, setSong, songId]
  );

  const pause = useCallback(async () => {
    setIsPlaying(false);
    audioElRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, pause, play]);

  const seek = useCallback(
    async (time: number | SongTimestampCategory) => {
      if (!songId) return;

      const el = ensureSongElement();
      if (typeof time === 'number') {
        el.currentTime = Math.max(0, time);
      } else {
        el.currentTime = pickStartTimeSeconds(songId, time);
      }
    },
    [ensureSongElement, pickStartTimeSeconds, songId]
  );

  const playFx = useCallback(
    async (fxId: string) => {
      const cached = fxBufferCacheRef.current[fxId];
      const buffer =
        cached ??
        (await (async () => {
          const audioContext = getAudioContext();
          const next = await loadAudioBuffer(
            audioContext,
            `/audios/fx/${fxId}.mp3`
          );
          fxBufferCacheRef.current[fxId] = next;
          return next;
        })());

      const audioContext = getAudioContext();
      const fxSource = audioContext.createBufferSource();
      fxSource.buffer = buffer;
      fxSource.connect(getGainNodeFx());
      fxSource.start();
    },
    [getAudioContext, getGainNodeFx]
  );

  const toggleLowVolume = useCallback(() => {
    setIsLowVolumeMode((prev) => !prev);
  }, [setIsLowVolumeMode]);

  useEffect(() => {
    const audioCtx = getAudioContext();
    const gainNodeSongs = getGainNodeSongs();
    const now = audioCtx.currentTime;
    const duration = 0.5;

    gainNodeSongs.gain.linearRampToValueAtTime(
      isLowVolumeMode ? lowVolumeSetting : songVolume,
      now + duration
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLowVolumeMode, lowVolumeSetting, songVolume]);

  useEffect(() => {
    const audioCtx = getAudioContext();
    const gainNodeFx = getGainNodeFx();
    const now = audioCtx.currentTime;

    gainNodeFx.gain.setValueAtTime(fxVolume, now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fxVolume]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMediaSessionPosition(audioElRef.current?.currentTime ?? 0);
    }, 600);
    return () => window.clearInterval(interval);
  }, []);

  useMediaSession({
    songId,
    isPlaying,
    position: mediaSessionPosition,
    duration,
    onNext: options?.onNext,
    onPrevious: options?.onPrevious,
    onPlay: play,
    onPause: pause,
    onSeek: seek,
    onToggleLowVolume: toggleLowVolume,
  });

  return {
    setSong,
    play,
    pause,
    togglePlay,
    seek,
    playFx,
    isPlaying,
    getCurrentTime,
    duration,
    isSongReady,
    isLowVolumeMode,
    setIsLowVolumeMode,
    setLowVolumeSetting,
    lowVolumeSetting,
    setSongVolume,
    songVolume,
    setFxVolume,
    fxVolume,
  };
};
