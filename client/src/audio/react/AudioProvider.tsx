import {
  createContext,
  FC,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AudioEngine,
  EffectsPlayer,
  SongPlayer,
  SongPlayerState,
  VolumeChannel,
} from '../engine';

type AudioContextValue = {
  engine: AudioEngine;
  songPlayer: SongPlayer;
  effectsPlayer: EffectsPlayer;
  isInitialized: boolean;
  init: () => Promise<void>;
  setVolume: (
    channel: VolumeChannel,
    volume: number,
    durationMs?: number
  ) => void;
  getVolume: (channel: VolumeChannel) => number;
};

const AudioCtx = createContext<AudioContextValue | null>(null);

export const AudioProvider: FC<PropsWithChildren> = ({ children }) => {
  const engineRef = useRef(new AudioEngine());
  const songPlayerRef = useRef(new SongPlayer(engineRef.current));
  const effectsPlayerRef = useRef(new EffectsPlayer(engineRef.current));
  const [isInitialized, setIsInitialized] = useState(false);

  const init = useCallback(async () => {
    if (isInitialized) return;
    await engineRef.current.init();
    await songPlayerRef.current.init();
    await effectsPlayerRef.current.init();
    setIsInitialized(true);
  }, [isInitialized]);

  useEffect(
    () => () => {
      songPlayerRef.current.destroy();
      effectsPlayerRef.current.destroy();
      engineRef.current.destroy();
    },
    []
  );

  const value = useMemo<AudioContextValue>(
    () => ({
      engine: engineRef.current,
      songPlayer: songPlayerRef.current,
      effectsPlayer: effectsPlayerRef.current,
      isInitialized,
      init,
      setVolume: (ch, v, d) => engineRef.current.setVolume(ch, v, d),
      getVolume: (ch) => engineRef.current.getVolume(ch),
    }),
    [isInitialized, init]
  );

  return <AudioCtx.Provider value={value}>{children}</AudioCtx.Provider>;
};

export const useAudioContext = () => {
  const ctx = useContext(AudioCtx);
  if (!ctx)
    throw new Error('useAudioContext must be used within AudioProvider');
  return ctx;
};

type Handlers = {
  onNext?: () => void;
  onPrevious?: () => void;
  onToggleLowVolume?: () => void;
};

export const useAudioPlayer = (handlers?: Handlers) => {
  const { songPlayer, isInitialized, init } = useAudioContext();
  const [state, setState] = useState<SongPlayerState>(songPlayer.state);
  const [isLoading, setIsLoading] = useState(false);
  const [preloadProgress, setPreloadProgress] = useState({
    loaded: 0,
    total: 0,
  });

  useEffect(() => {
    const unsubs = [
      songPlayer.on('statechange', setState),
      songPlayer.on('loadstart', () => setIsLoading(true)),
      songPlayer.on('loadend', () => setIsLoading(false)),
      songPlayer.loader.on('progress', setPreloadProgress),
    ];
    return () => unsubs.forEach((u) => u());
  }, [songPlayer]);

  useEffect(() => {
    if (!handlers) return;

    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        t.tagName === 'INPUT' ||
        t.tagName === 'TEXTAREA' ||
        t.isContentEditable
      )
        return;

      if (e.key === ' ' && handlers.onToggleLowVolume) {
        e.preventDefault();
        handlers.onToggleLowVolume();
      }
      if (e.key === 'ArrowRight' && handlers.onNext) {
        e.preventDefault();
        handlers.onNext();
      }
      if (e.key === 'ArrowLeft' && handlers.onPrevious) {
        e.preventDefault();
        handlers.onPrevious();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !handlers) return;

    navigator.mediaSession.setActionHandler(
      'nexttrack',
      handlers.onNext ?? null
    );
    navigator.mediaSession.setActionHandler(
      'previoustrack',
      handlers.onPrevious ?? null
    );
    navigator.mediaSession.setActionHandler('play', () => songPlayer.play());
    navigator.mediaSession.setActionHandler('pause', () => songPlayer.pause());

    return () => {
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
    };
  }, [handlers, songPlayer]);

  return { state, isLoading, isInitialized, preloadProgress, init, songPlayer };
};
