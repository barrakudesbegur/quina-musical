import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSessionStorage } from 'usehooks-ts';
import { trpc } from '../utils/trpc';
import { useAudioContext } from './useAudioContext';
import { useMediaSession } from './useMediaSession';

const SONGS_BUCKET_URL = 'https://f000.backblazeb2.com/file/quina-songs/';

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
      fadeInOffset: number;
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

const TRANSPORT_FADE_IN_SECONDS = 0.6;
const TRANSPORT_FADE_OUT_SECONDS = 1.2;
const VOLUME_MODE_RAMP_SECONDS = 0.5;

const PRELOAD_BATCH_1_COUNT = 1;
const PRELOAD_BATCH_2_COUNT = 3;

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
  const fxOptionsQuery = trpc.game.getFxOptions.useQuery();

  const [songId, setSongId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [isSongReady, setIsSongReady] = useState<boolean>(true);
  const isPlayingRef = useRef<boolean>(false);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

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

  const getPerSongVolume = useCallback(
    (id: number) => {
      const song = songsQuery.data?.find((s) => s.id === id);
      return song?.volume ?? 1;
    },
    [songsQuery.data]
  );

  const getFxOptions = useCallback(
    (fxId: string) => {
      const opts = fxOptionsQuery.data?.[fxId];
      return {
        volume: opts?.volume ?? 1,
      };
    },
    [fxOptionsQuery.data]
  );

  const slotsRef = useRef<[SongSlot, SongSlot] | null>(null);
  const activeIndexRef = useRef<0 | 1>(0);
  const setSongRequestIdRef = useRef<number>(0);
  const stopOldSlotTimeoutRef = useRef<number | null>(null);
  const delayedStartTimeoutRef = useRef<number | null>(null);
  const pauseAfterFadeTimeoutRef = useRef<number | null>(null);

  const [mediaSessionPosition, setMediaSessionPosition] = useState<number>(0);

  const preloadedSongsRef = useRef<Set<number>>(new Set());

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
    if (pauseAfterFadeTimeoutRef.current) {
      window.clearTimeout(pauseAfterFadeTimeoutRef.current);
      pauseAfterFadeTimeoutRef.current = null;
    }
  }, []);

  const getTargetSongGain = useCallback(() => {
    return isLowVolumeMode ? lowVolumeSetting : songVolume;
  }, [isLowVolumeMode, lowVolumeSetting, songVolume]);

  const rampSongMasterGain = useCallback(
    (to: number, seconds: number) => {
      const audioCtx = getAudioContext();
      const gainNodeSongs = getGainNodeSongs();
      const now = audioCtx.currentTime;
      const next = Math.max(0, to);
      const duration = Math.max(0, seconds);

      gainNodeSongs.gain.cancelScheduledValues(now);
      gainNodeSongs.gain.setValueAtTime(gainNodeSongs.gain.value, now);
      gainNodeSongs.gain.linearRampToValueAtTime(next, now + duration);
    },
    [getAudioContext, getGainNodeSongs]
  );

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
      return `${SONGS_BUCKET_URL}${id}.mp3${cacheBuster}`;
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

      const perSongVol = getPerSongVolume(nextSongId);

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
          to.gain.gain.setValueAtTime(perSongVol, now);
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
          to.gain.gain.linearRampToValueAtTime(perSongVol, now + fadeSeconds);
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
          const fadeInOffset = effect.fadeInOffset;
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

          scheduleStopSlot(
            from,
            Math.max(
              fadeOutSeconds,
              fadeOutSeconds + fadeInOffset + fadeInSeconds
            )
          );

          delayedStartTimeoutRef.current = window.setTimeout(
            () => {
              const t0 = audioCtx.currentTime;
              to.gain.gain.cancelScheduledValues(t0);
              to.gain.gain.setValueAtTime(0, t0);
              to.gain.gain.linearRampToValueAtTime(
                perSongVol,
                t0 + fadeInSeconds
              );

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
            Math.ceil(Math.max(0, fadeOutSeconds + fadeInOffset) * 1000)
          );
          return;
        }
      }
    },
    [
      cancelTransitions,
      ensureSlots,
      getAudioContext,
      getPerSongVolume,
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

      const perSongVol = getPerSongVolume(nextSongId);
      const audioCtx = getAudioContext();
      const now = audioCtx.currentTime;
      active.gain.gain.cancelScheduledValues(now);
      active.gain.gain.setValueAtTime(perSongVol, now);

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
      getPerSongVolume,
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

      cancelTransitions();
      rampSongMasterGain(getTargetSongGain(), TRANSPORT_FADE_IN_SECONDS);
      try {
        await active.el.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    },
    [
      cancelTransitions,
      duration,
      getActiveSlot,
      getTargetSongGain,
      pickStart,
      rampSongMasterGain,
      setSong,
      songId,
    ]
  );

  const pause = useCallback(async () => {
    cancelTransitions();
    setIsPlaying(false);

    rampSongMasterGain(0, TRANSPORT_FADE_OUT_SECONDS);

    const slots = ensureSlots();
    pauseAfterFadeTimeoutRef.current = window.setTimeout(
      () => {
        slots[0].el.pause();
        slots[1].el.pause();
      },
      Math.ceil(TRANSPORT_FADE_OUT_SECONDS * 1000)
    );
  }, [cancelTransitions, ensureSlots, rampSongMasterGain]);

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

      const opts = getFxOptions(fxId);
      const fxGain = audioContext.createGain();
      fxGain.gain.setValueAtTime(opts.volume, audioContext.currentTime);
      fxSource.connect(fxGain).connect(getGainNodeFx());
      fxSource.start(0);
    },
    [getAudioContext, getGainNodeFx, getFxOptions]
  );

  const toggleLowVolume = useCallback(() => {
    setIsLowVolumeMode((prev) => !prev);
  }, [setIsLowVolumeMode]);

  useEffect(() => {
    const audioCtx = getAudioContext();
    const gainNodeSongs = getGainNodeSongs();
    const now = audioCtx.currentTime;
    const duration = VOLUME_MODE_RAMP_SECONDS;

    // Only react to volume setting changes while actively playing.
    // Important: do NOT cancel scheduled automation on pause, otherwise it cuts
    // off the fade-out abruptly.
    if (!isPlayingRef.current) return;

    const target = isLowVolumeMode ? lowVolumeSetting : songVolume;
    gainNodeSongs.gain.cancelScheduledValues(now);
    gainNodeSongs.gain.setValueAtTime(gainNodeSongs.gain.value, now);
    gainNodeSongs.gain.linearRampToValueAtTime(target, now + duration);
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

  const preloadSongs = useCallback(
    async (songIds: number[]) => {
      await Promise.all(
        songIds.map(async (songId) => {
          if (preloadedSongsRef.current.has(songId)) return;
          preloadedSongsRef.current.add(songId);

          try {
            await fetch(getSongUrl(songId), { mode: 'cors' });
          } catch {
            preloadedSongsRef.current.delete(songId);
          }
        })
      );
    },
    [getSongUrl]
  );

  useEffect(() => {
    if (!songsQuery.data) return;

    void (async () => {
      const unplayedSongIds = songsQuery.data
        .filter(
          (s) =>
            !s.isPlayed && s.positionInQueue !== null && s.positionInQueue > 0
        )
        .sort((a, b) => (a.positionInQueue ?? 0) - (b.positionInQueue ?? 0))
        .map((s) => s.id);

      if (unplayedSongIds.length === 0) return;

      await preloadSongs(unplayedSongIds.slice(0, PRELOAD_BATCH_1_COUNT));

      await preloadSongs(
        unplayedSongIds.slice(
          PRELOAD_BATCH_1_COUNT,
          PRELOAD_BATCH_1_COUNT + PRELOAD_BATCH_2_COUNT
        )
      );

      await preloadSongs(
        unplayedSongIds.slice(PRELOAD_BATCH_1_COUNT + PRELOAD_BATCH_2_COUNT)
      );
    })();
  }, [preloadSongs, songsQuery.data]);

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
    getSongUrl,
  };
};
