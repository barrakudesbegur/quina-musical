import { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionStorage } from 'usehooks-ts';
import { clampLoop } from '../utils/numbers';
import { trpc } from '../utils/trpc';
import { useAudioContext } from './useAudioContext';
import { useMediaSession } from './useMediaSession';
import { useSongPlayerLoading } from './useSongPlayerLoading';

export type SongTimestampCategory = 'main' | 'secondary' | 'any' | 'constant';

export const useSongPlayer = (options?: {
  onNext?: () => void;
  onPrevious?: () => void;
}) => {
  const { getAudioContext, getGainNodeSongs, getGainNodeFx } =
    useAudioContext();

  const songsQuery = trpc.game.getAllSongs.useQuery();

  const [songId, setSongId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [duration, setDuration] = useState<number | null>(null);

  const [isLowVolumeMode, setIsLowVolumeMode] = useSessionStorage<boolean>(
    'admin-low-volume-mode',
    false
  );
  const [lowVolumeSetting, setLowVolumeSetting] = useSessionStorage<number>(
    'admin-low-volume-setting',
    0.2
  );
  const [songVolume, setSongVolume] = useSessionStorage<number>(
    'admin-song-volume',
    1
  );
  const [fxVolume, setFxVolume] = useSessionStorage<number>(
    'admin-fx-volume',
    1
  );

  const sourceSongPlaying = useRef<AudioBufferSourceNode>(null);
  const songStartedTime = useRef<number | null>(null);
  const songEndedTime = useRef<number | null>(null);
  const [songPlayedOffset, setSongPlayedOffset] = useState<number>(0);

  const { isSongReady, preloadStatus, getAudioBuffer } = useSongPlayerLoading(
    songId,
    getAudioContext
  );

  const getCurrentTime = useCallback(() => {
    if (!songId) return 0;
    if (!songStartedTime.current) return songPlayedOffset;

    const audioCtx = getAudioContext();

    const totalTime =
      songPlayedOffset +
      (songEndedTime.current ?? audioCtx.currentTime) -
      songStartedTime.current;

    return clampLoop(totalTime, duration);
  }, [duration, getAudioContext, songId, songPlayedOffset]);

  const pickStartTimeMs = useCallback(
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

  const setSong = useCallback(
    async (
      songId: number | null,
      timestampSelection?: number | SongTimestampCategory,
      shouldPlay?: boolean
    ) => {
      setSongId(songId);

      sourceSongPlaying.current?.stop();
      sourceSongPlaying.current = null;

      if (!songId) {
        setSongPlayedOffset(0);
        setDuration(null);
        return;
      }

      const buffer = await getAudioBuffer('song', songId);
      if (!buffer) throw new Error(`Sound for song ${songId} not found`);
      setDuration(buffer.duration);

      const offset = pickStartTimeMs(songId, timestampSelection);
      setSongPlayedOffset(offset);

      if (shouldPlay ?? isPlaying) {
        const audioCtx = getAudioContext();

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const gainNodeSongs = getGainNodeSongs();

        source.connect(gainNodeSongs).connect(audioCtx.destination);
        source.start(0, offset);

        sourceSongPlaying.current = source;
        songStartedTime.current = audioCtx.currentTime;
        songEndedTime.current = null;
      } else {
        songStartedTime.current = null;
        songEndedTime.current = null;
      }
    },
    [
      getAudioBuffer,
      getAudioContext,
      getGainNodeSongs,
      isPlaying,
      pickStartTimeMs,
    ]
  );

  const play = useCallback(
    async (timestampSelection?: number | SongTimestampCategory) => {
      setIsPlaying(true);
      setSong(songId, timestampSelection ?? getCurrentTime(), true);
    },
    [getCurrentTime, setSong, songId]
  );

  const pause = useCallback(async () => {
    setIsPlaying(false);

    const audioCtx = getAudioContext();

    sourceSongPlaying.current?.stop();
    songEndedTime.current = audioCtx.currentTime;
    sourceSongPlaying.current = null;
  }, [getAudioContext]);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, pause, play]);

  const playFx = async (fxId: Parameters<typeof getAudioBuffer<'fx'>>[1]) => {
    const buffer = await getAudioBuffer('fx', fxId);
    if (!buffer) throw new Error(`Sound effect ${fxId} not found`);

    const audioContext = getAudioContext();

    const fxSource = audioContext.createBufferSource();
    fxSource.buffer = buffer;

    const gainNodeFx = getGainNodeFx();

    fxSource.connect(gainNodeFx).connect(audioContext.destination);
    fxSource.start();
  };

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

  useMediaSession({
    songId,
    isPlaying,
    songPlayedOffset,
    duration,
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
    playFx,
    isPlaying,
    getCurrentTime,
    duration,
    isSongReady,
    preloadStatus,
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
