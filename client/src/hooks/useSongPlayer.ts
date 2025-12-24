import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSessionStorage } from 'usehooks-ts';
import { trpc } from '../utils/trpc';
import { useAudioContext } from './useAudioContext';
import { useMediaSession } from './useMediaSession';

export type SongTimestamp = {
  time: number;
  tag: 'best' | 'main' | 'secondary';
  playEffect: PlayEffect;
};

export type PlayEffect =
  | { type: 'none' }
  | { type: 'crossfade'; durationSeconds: number }
  | {
      type: 'fade-out-in';
      fadeOutSeconds: number;
      silenceSeconds: number;
      fadeInSeconds: number;
    };

export type SongTimestampSelection =
  | number
  | SongTimestamp
  | SongTimestamp['tag'][];

type SongSlot = {
  el: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
};

type StartPoint = {
  time: number;
  playEffect: PlayEffect;
};

const loadAudioBuffer = async (
  audioContext: AudioContext,
  filepath: string
) => {
  const response = await fetch(filepath);
  const arrayBuffer = await response.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
};

const waitForEvent = async (el: HTMLMediaElement, event: string) => {
  await new Promise<void>((resolve, reject) => {
    const onOk = () => resolve();
    const onError = () => reject(new Error(`Media error waiting for ${event}`));
    el.addEventListener(event, onOk, { once: true });
    el.addEventListener('error', onError, { once: true });
  });
};

const clampSeek = (time: number, duration: number | null) => {
  const t = Math.max(0, Number.isFinite(time) ? time : 0);
  if (!duration || !Number.isFinite(duration) || duration <= 0) return t;
  return Math.min(t, Math.max(0, duration - 0.01));
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

  const fxBufferCacheRef = useRef<Record<string, AudioBuffer>>({});

  const slotsRef = useRef<[SongSlot, SongSlot] | null>(null);
  const activeIndexRef = useRef<0 | 1>(0);
  const setSongRequestIdRef = useRef<number>(0);
  const stopOldSlotTimeoutRef = useRef<number | null>(null);
  const delayedStartTimeoutRef = useRef<number | null>(null);

  const [mediaSessionPosition, setMediaSessionPosition] = useState<number>(0);

  const ensureSlots = useCallback(() => {
    if (slotsRef.current) return slotsRef.current;

    const audioCtx = getAudioContext();
    const master = getGainNodeSongs();

    const makeSlot = () => {
      const el = new Audio();
      el.preload = 'auto';
      el.loop = true;
      el.crossOrigin = 'anonymous';

      const source = audioCtx.createMediaElementSource(el);
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      source.connect(gain).connect(master);
      return { el, source, gain } satisfies SongSlot;
    };

    const slots: [SongSlot, SongSlot] = [makeSlot(), makeSlot()];
    slotsRef.current = slots;
    return slots;
  }, [getAudioContext, getGainNodeSongs]);

  const getActiveSlot = useCallback(() => {
    return ensureSlots()[activeIndexRef.current];
  }, [ensureSlots]);

  const stopSlot = useCallback((slot: SongSlot) => {
    slot.el.pause();
    slot.el.removeAttribute('src');
    slot.el.load();
  }, []);

  const cancelTransitions = useCallback(() => {
    if (stopOldSlotTimeoutRef.current) {
      window.clearTimeout(stopOldSlotTimeoutRef.current);
      stopOldSlotTimeoutRef.current = null;
    }
    if (delayedStartTimeoutRef.current) {
      window.clearTimeout(delayedStartTimeoutRef.current);
      delayedStartTimeoutRef.current = null;
    }
  }, []);

  const scheduleStopSlot = useCallback(
    (slot: SongSlot, afterSeconds: number) => {
      if (stopOldSlotTimeoutRef.current) {
        window.clearTimeout(stopOldSlotTimeoutRef.current);
        stopOldSlotTimeoutRef.current = null;
      }
      stopOldSlotTimeoutRef.current = window.setTimeout(
        () => {
          stopSlot(slot);
        },
        Math.max(0, Math.ceil(afterSeconds * 1000) + 50)
      );
    },
    [stopSlot]
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
  const pickStart = useCallback(
    (songId: number, target: SongTimestampSelection = ['best']): StartPoint => {
      if (typeof target === 'number') {
        return { time: target, playEffect: { type: 'none' } };
      }
      if (typeof target === 'object' && !Array.isArray(target)) {
        return { time: target.time, playEffect: target.playEffect };
      }

      const candidates = songsQuery.data
        ?.find((s) => s.id === songId)
        ?.timestamps?.filter((t) => target.includes(t.tag));

      if (!candidates?.length) return { time: 0, playEffect: { type: 'none' } };

      const index = Math.floor(Math.random() * candidates.length);
      const picked = candidates[index];
      return { time: picked.time, playEffect: picked.playEffect };
    },
    [songsQuery.data]
  );

  const getCurrentTime = useCallback(() => {
    return getActiveSlot().el.currentTime ?? 0;
  }, [getActiveSlot]);

  const transitionToSong = useCallback(
    async (nextSongId: number, start: StartPoint) => {
      const audioCtx = getAudioContext();
      const slots = ensureSlots();

      const fromIndex = activeIndexRef.current;
      const toIndex = fromIndex === 0 ? 1 : 0;
      const from = slots[fromIndex];
      const to = slots[toIndex];

      cancelTransitions();

      setIsSongReady(false);
      to.el.src = getSongUrl(nextSongId);
      to.el.load();
      await waitForEvent(to.el, 'loadedmetadata');
      const nextDuration = Number.isFinite(to.el.duration)
        ? to.el.duration
        : null;

      const effect = start.playEffect;

      switch (effect.type) {
        case 'none': {
          to.el.currentTime = clampSeek(start.time, nextDuration);
          await waitForEvent(to.el, 'canplay');
          setIsSongReady(true);

          const now = audioCtx.currentTime;
          to.gain.gain.cancelScheduledValues(now);
          from.gain.gain.cancelScheduledValues(now);
          to.gain.gain.setValueAtTime(1, now);
          from.gain.gain.setValueAtTime(0, now);

          try {
            await to.el.play();
          } catch {
            setIsPlaying(false);
            return;
          }

          stopSlot(from);
          activeIndexRef.current = toIndex;
          setSongId(nextSongId);
          setDuration(nextDuration);
          setIsPlaying(true);
          return;
        }
        case 'crossfade': {
          const fadeSeconds = Math.max(0, effect.durationSeconds);
          const startAt = clampSeek(start.time - fadeSeconds, nextDuration);
          to.el.currentTime = startAt;

          await waitForEvent(to.el, 'canplay');
          setIsSongReady(true);

          const now = audioCtx.currentTime;
          to.gain.gain.cancelScheduledValues(now);
          from.gain.gain.cancelScheduledValues(now);
          to.gain.gain.setValueAtTime(0, now);
          from.gain.gain.setValueAtTime(from.gain.gain.value, now);
          to.gain.gain.linearRampToValueAtTime(1, now + fadeSeconds);
          from.gain.gain.linearRampToValueAtTime(0, now + fadeSeconds);

          try {
            await to.el.play();
          } catch {
            setIsPlaying(false);
            return;
          }

          scheduleStopSlot(from, fadeSeconds);
          activeIndexRef.current = toIndex;
          setSongId(nextSongId);
          setDuration(nextDuration);
          setIsPlaying(true);
          return;
        }
        case 'fade-out-in': {
          const fadeOutSeconds = Math.max(0, effect.fadeOutSeconds);
          const silenceSeconds = Math.max(0, effect.silenceSeconds);
          const fadeInSeconds = Math.max(0, effect.fadeInSeconds);

          const startAt = clampSeek(start.time - fadeInSeconds, nextDuration);
          to.el.currentTime = startAt;

          await waitForEvent(to.el, 'canplay');
          setIsSongReady(true);

          const now = audioCtx.currentTime;
          from.gain.gain.cancelScheduledValues(now);
          from.gain.gain.setValueAtTime(from.gain.gain.value, now);
          from.gain.gain.linearRampToValueAtTime(0, now + fadeOutSeconds);

          to.gain.gain.cancelScheduledValues(now);
          to.gain.gain.setValueAtTime(0, now);

          scheduleStopSlot(from, fadeOutSeconds);

          delayedStartTimeoutRef.current = window.setTimeout(
            () => {
              const t0 = audioCtx.currentTime;
              to.gain.gain.cancelScheduledValues(t0);
              to.gain.gain.setValueAtTime(0, t0);
              to.gain.gain.linearRampToValueAtTime(1, t0 + fadeInSeconds);

              void to.el.play().then(
                () => {
                  activeIndexRef.current = toIndex;
                  setSongId(nextSongId);
                  setDuration(nextDuration);
                  setIsPlaying(true);
                },
                () => setIsPlaying(false)
              );
            },
            Math.ceil((fadeOutSeconds + silenceSeconds) * 1000)
          );
          return;
        }
      }
    },
    [
      cancelTransitions,
      ensureSlots,
      getAudioContext,
      getSongUrl,
      scheduleStopSlot,
      stopSlot,
    ]
  );

  const setSong = useCallback(
    async (
      nextSongId: number | null,
      timestampSelection?: SongTimestampSelection,
      shouldPlay?: boolean
    ) => {
      const requestId = ++setSongRequestIdRef.current;

      const slots = ensureSlots();

      if (!nextSongId) {
        if (stopOldSlotTimeoutRef.current) {
          window.clearTimeout(stopOldSlotTimeoutRef.current);
          stopOldSlotTimeoutRef.current = null;
        }
        if (delayedStartTimeoutRef.current) {
          window.clearTimeout(delayedStartTimeoutRef.current);
          delayedStartTimeoutRef.current = null;
        }
        stopSlot(slots[0]);
        stopSlot(slots[1]);
        const audioCtx = getAudioContext();
        const now = audioCtx.currentTime;
        slots[0].gain.gain.cancelScheduledValues(now);
        slots[1].gain.gain.cancelScheduledValues(now);
        slots[0].gain.gain.setValueAtTime(0, now);
        slots[1].gain.gain.setValueAtTime(0, now);
        setSongId(null);
        setDuration(null);
        setIsPlaying(false);
        setIsSongReady(true);
        return;
      }

      const start = pickStart(nextSongId, timestampSelection);
      const wantsPlay = shouldPlay ?? isPlaying;

      // If switching songs while playing: crossfade.
      if (wantsPlay && songId && songId !== nextSongId) {
        await transitionToSong(nextSongId, start);
        return;
      }

      const active = slots[activeIndexRef.current];
      active.el.pause();
      active.el.src = getSongUrl(nextSongId);
      active.el.load();
      setIsSongReady(false);
      await waitForEvent(active.el, 'loadedmetadata');
      if (setSongRequestIdRef.current !== requestId) return;

      const nextDuration = Number.isFinite(active.el.duration)
        ? active.el.duration
        : null;
      setDuration(nextDuration);

      const nextTime = clampSeek(start.time, nextDuration);
      active.el.currentTime = nextTime;

      // Ensure this slot is audible when not crossfading
      const audioCtx = getAudioContext();
      const now = audioCtx.currentTime;
      active.gain.gain.cancelScheduledValues(now);
      active.gain.gain.setValueAtTime(1, now);

      await waitForEvent(active.el, 'canplay');
      setIsSongReady(true);
      setSongId(nextSongId);

      if (wantsPlay) {
        try {
          await active.el.play();
          setIsPlaying(true);
        } catch {
          setIsPlaying(false);
        }
      } else {
        setIsPlaying(false);
      }
    },
    [
      transitionToSong,
      ensureSlots,
      getAudioContext,
      getSongUrl,
      isPlaying,
      pickStart,
      songId,
      stopSlot,
    ]
  );

  const play = useCallback(
    async (timestampSelection?: SongTimestampSelection) => {
      if (!songId) return;
      const active = getActiveSlot();
      if (!active.el.src) {
        await setSong(songId, timestampSelection ?? 0, true);
        return;
      }

      if (timestampSelection !== undefined) {
        const start = pickStart(songId, timestampSelection);
        active.el.currentTime = clampSeek(start.time, duration);
      }

      try {
        await active.el.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    },
    [duration, getActiveSlot, pickStart, setSong, songId]
  );

  const pause = useCallback(async () => {
    setIsPlaying(false);
    const slots = ensureSlots();
    slots[0].el.pause();
    slots[1].el.pause();
  }, [ensureSlots]);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, pause, play]);

  const seek = useCallback(
    async (time: number) => {
      if (!songId) return;
      const active = getActiveSlot();
      active.el.currentTime = clampSeek(time, duration);
    },
    [duration, getActiveSlot, songId]
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
      setMediaSessionPosition(getActiveSlot().el.currentTime ?? 0);
    }, 600);
    return () => window.clearInterval(interval);
  }, [getActiveSlot]);

  useEffect(() => {
    return () => cancelTransitions();
  }, [cancelTransitions]);

  const playerControlLoading = useMemo(() => !isSongReady, [isSongReady]);

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
    playerControlLoading,
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
