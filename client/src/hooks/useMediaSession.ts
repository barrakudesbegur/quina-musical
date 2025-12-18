import { useEffect, useMemo } from 'react';
import { trpc } from '../utils/trpc';

type MediaSessionConfig = {
  songId: number | null;
  isPlaying: boolean;
  songPlayedOffset: number;
  duration: number | null;

  onNext?: () => void;
  onPrevious?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onToggleLowVolume?: () => void;
};

export const useMediaSession = ({
  songId,
  isPlaying,
  songPlayedOffset,
  duration,
  onNext,
  onPrevious,
  onPlay,
  onPause,
  onToggleLowVolume,
}: MediaSessionConfig) => {
  const songsQuery = trpc.game.getAllSongs.useQuery();
  const playlistQuery = trpc.song.getPlaylist.useQuery();

  const sessionData = useMemo(() => {
    const songInfo = songsQuery.data?.find((s) => s.id === songId);

    return {
      title: songInfo?.title || playlistQuery.data?.title || 'Quina Musical',
      artist: songInfo?.artist || playlistQuery.data?.artist || 'Barrakudes',
      artwork: songInfo?.cover || playlistQuery.data?.cover || null,
    };
  }, [songId, songsQuery.data, playlistQuery.data]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = sessionData
      ? new MediaMetadata({
          title: sessionData.title,
          artist: sessionData.artist,
          artwork: sessionData.artwork ? [{ src: sessionData.artwork }] : [],
        })
      : null;
  }, [sessionData]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setPositionState(
      duration
        ? {
            duration: duration,
            playbackRate: 1,
            position: songPlayedOffset,
          }
        : {
            duration: Infinity,
            playbackRate: 0.0000001,
            position: 0,
          }
    );
  }, [songPlayedOffset, duration]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputElement =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      if (isInputElement) return;

      switch (event.key) {
        case ' ':
          if (onToggleLowVolume) {
            event.preventDefault();
            onToggleLowVolume();
          }
          break;
        case 'ArrowRight':
          if (onNext) {
            event.preventDefault();
            onNext();
          }
          break;
        case 'ArrowLeft':
          if (onPrevious) {
            event.preventDefault();
            onPrevious();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onNext, onPrevious, onToggleLowVolume]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('nexttrack', onNext || null);
    navigator.mediaSession.setActionHandler(
      // @ts-expect-error - 'nextslide' is actually a valid MediaSessionAction
      'nextslide',
      onNext || null
    );
    navigator.mediaSession.setActionHandler(
      'previoustrack',
      onPrevious || null
    );
    navigator.mediaSession.setActionHandler(
      // @ts-expect-error - 'previousslide' is actually a valid MediaSessionAction
      'previousslide',
      onPrevious || null
    );
    navigator.mediaSession.setActionHandler('play', onPlay || null);
    navigator.mediaSession.setActionHandler('pause', onPause || null);

    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('nexttrack', null);
        // @ts-expect-error - 'nextslide' is actually a valid MediaSessionAction
        navigator.mediaSession.setActionHandler('nextslide', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        // @ts-expect-error - 'previousslide' is actually a valid MediaSessionAction
        navigator.mediaSession.setActionHandler('previousslide', null);
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
      }
    };
  }, [onNext, onPrevious, onPlay, onPause]);
};
