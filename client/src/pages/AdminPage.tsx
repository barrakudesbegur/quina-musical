import { Button, Divider, Slider } from '@heroui/react';
import { IconPlayerPlay, IconVolume, IconVolume2 } from '@tabler/icons-react';
import { differenceInMilliseconds, isValid, parseISO } from 'date-fns';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStorage } from 'usehooks-ts';
import { CheckCardDialog } from '../components/CheckCardDialog';
import { FinishRoundDialog } from '../components/FinishRoundDialog';
import { GameInsightsSection } from '../components/GameInsightsSection';
import { MiniPlayer } from '../components/MiniPlayer';
import { RoundNameForm } from '../components/RoundNameForm';
import { SongsSection } from '../components/SongsSection';
import { useSecondsStopwatch } from '../hooks/useSecondsStopwatch';
import { SongTimestampCategory, useSongPlayer } from '../hooks/useSongPlayer';
import { formatElapsedClock } from '../utils/time';
import { trpc } from '../utils/trpc';
import { IconButtonGrid } from '../components/IconButtonGrid';

export const AdminPage: FC = () => {
  const [isFinishRoundDialogOpen, setIsFinishRoundDialogOpen] = useState(false);
  const [isCheckCardDialogOpen, setIsCheckCardDialogOpen] = useState(false);
  const utils = trpc.useUtils();
  const roundQuery = trpc.game.getCurrentRound.useQuery();
  const songsQuery = trpc.game.getAllSongs.useQuery(undefined, {
    enabled: !!roundQuery.data,
  });
  const statusQuery = trpc.game.getStatus.useSubscription();
  const navigate = useNavigate();

  const finishRoundMutation = trpc.game.finishRound.useMutation({
    onSettled: () => {
      utils.game.invalidate();
      setIsFinishRoundDialogOpen(false);
    },
  });

  const resumeGameMutation = trpc.game.resumeGame.useMutation({
    onSettled: () => {
      utils.game.invalidate();
    },
  });

  const playSongMutation = trpc.game.playSong.useMutation({
    onSettled: () => {
      utils.game.invalidate();
    },
  });

  const undoLastPlayedMutation = trpc.game.undoLastPlayed.useMutation({
    onSettled: () => {
      utils.game.invalidate();
    },
  });

  const defaultNextRoundName = useMemo(() => {
    if (!roundQuery.data) return '1';
    return String(roundQuery.data.position + 1);
  }, [roundQuery.data]);

  const lastPlayedKeyRef = useRef<number | null>(null);
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
  const [timestampType, setTimestampType] =
    useSessionStorage<SongTimestampCategory>('admin-timestamp-type', 'main');

  const handlePlayNextSong = useCallback(() => {
    playSongMutation.mutate({ songId: undefined });
  }, [playSongMutation]);

  const canPlayPrevious = useMemo(
    () => (roundQuery.data?.playedSongs.length ?? 0) > 0,
    [roundQuery.data?.playedSongs]
  );

  const handlePlayPreviousSong = useCallback(() => {
    if (!canPlayPrevious) return;
    undoLastPlayedMutation.mutate();
  }, [canPlayPrevious, undoLastPlayedMutation]);

  const handleToggleLowVolume = useCallback(() => {
    setIsLowVolumeMode((prev) => !prev);
  }, [setIsLowVolumeMode]);

  const {
    start: startSongPlayer,
    loadSong,
    togglePlayState,
    isPlaying,
    isLoading: isPlayerLoading,
    preloadStatuses: playerSongs,
    playSilence,
    setVolume,
    seek,
    currentTime,
    duration,
  } = useSongPlayer({
    onNext: handlePlayNextSong,
    onPrevious: handlePlayPreviousSong,
    onToggleLowVolume: handleToggleLowVolume,
  });

  const now = useSecondsStopwatch();

  useEffect(() => {
    void startSongPlayer();
  });

  useEffect(() => {
    setVolume(isLowVolumeMode ? lowVolumeSetting : songVolume);
  }, [isLowVolumeMode, lowVolumeSetting, setVolume, songVolume]);

  const lastPlayedSongId = useMemo(
    () =>
      roundQuery.data?.playedSongs[roundQuery.data.playedSongs.length - 1]
        ?.id ?? null,
    [roundQuery.data?.playedSongs]
  );

  const roundElapsedMs = useMemo(() => {
    const roundStartedAt = roundQuery.data?.startedAt ?? null;

    if (!roundStartedAt) return null;
    const startDate = parseISO(roundStartedAt);
    if (!isValid(startDate)) return null;
    return Math.max(0, differenceInMilliseconds(new Date(now), startDate));
  }, [now, roundQuery.data?.startedAt]);

  const currentSong = useMemo(
    () => songsQuery.data?.find((song) => song.id === lastPlayedSongId) ?? null,
    [lastPlayedSongId, songsQuery.data]
  );

  const playerControlLoading = useMemo(() => {
    return (
      isPlayerLoading ||
      playSongMutation.isPending ||
      undoLastPlayedMutation.isPending ||
      songsQuery.isFetching ||
      songsQuery.isLoading
    );
  }, [
    isPlayerLoading,
    playSongMutation.isPending,
    songsQuery.isFetching,
    songsQuery.isLoading,
    undoLastPlayedMutation.isPending,
  ]);

  useEffect(() => {
    if (!isPlaying) {
      if (lastPlayedSongId) {
        loadSong(lastPlayedSongId, timestampType, { autoplay: false });
      }
      return;
    }

    if (lastPlayedKeyRef.current === lastPlayedSongId) return;
    lastPlayedKeyRef.current = lastPlayedSongId;

    if (lastPlayedSongId) {
      void loadSong(lastPlayedSongId, timestampType, { autoplay: true });
    } else {
      playSilence();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPlayedSongId, loadSong, playSilence]);

  const playerPreloadProgress = useMemo(() => {
    if (!playerSongs.length) return 0;
    return (
      playerSongs.filter((song) => song.preloaded).length / playerSongs.length
    );
  }, [playerSongs]);

  const handleFinishRound = (nextRoundName: string, isLastRound: boolean) => {
    finishRoundMutation.mutate({ nextRoundName, isLastRound });
  };

  const startGameMutation = trpc.game.startGame.useMutation({
    onSettled: () => {
      utils.game.invalidate();
    },
  });

  const handleLogout = () => {
    sessionStorage.removeItem('adminAuth');
    navigate('/login');
  };

  const openFinishRoundDialog = () => {
    setIsFinishRoundDialogOpen(true);
    setIsCheckCardDialogOpen(false);
  };

  if (!roundQuery.data) {
    return (
      <main className="container mx-auto min-h-dvh p-4 flex flex-col items-center justify-center gap-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <h1 className="text-4xl font-brand uppercase text-center tracking-widest">
            {statusQuery.data?.status === 'finished'
              ? 'Quina finalitzada'
              : 'Començar quina'}
          </h1>
          <Button
            size="lg"
            color="success"
            variant="shadow"
            onPress={() => {
              if (statusQuery.data?.status === 'finished') {
                resumeGameMutation.mutate();
              } else {
                startGameMutation.mutate();
              }
            }}
            className="font-brand uppercase tracking-widest text-xl"
            startContent={<IconPlayerPlay size={24} />}
          >
            {statusQuery.data?.status === 'finished' ? 'Reprendre' : 'Començar'}
          </Button>
        </div>
        <Button
          onPress={handleLogout}
          variant="faded"
          className="mx-auto block"
          color="primary"
        >
          Logout
        </Button>
      </main>
    );
  }

  return (
    <main className="max-w-xl mx-auto lg:h-dvh overflow-hidden grid lg:auto-rows-fr *:p-4 lg:*:py-4 lg:*:px-3 lg:*:first:pl-4 lg:*:last:pr-4  lg:max-w-none   lg:grid-cols-3">
      <div className="flex flex-col gap-4 min-h-0 overflow-y-auto min-w-0">
        <section className="space-y-4">
          <h2 className="text-3xl font-brand uppercase text-center   tracking-wider">
            Gestió de la quina
          </h2>

          <div className="grid 2xs:grid-cols-[2fr_1fr] gap-4">
            <RoundNameForm />
            {roundElapsedMs !== null && (
              <div className="   ">
                <div className="text-sm text-foreground">Duració</div>
                <div className=" text-xl text-foreground font-medium min-h-10   inline-flex items-center  ">
                  <span>{formatElapsedClock(roundElapsedMs)}</span>
                </div>
              </div>
            )}
          </div>
          <Divider />

          <Button
            color="primary"
            onPress={() => setIsCheckCardDialogOpen(true)}
            className="w-full block"
          >
            Comprovar cartó
          </Button>
          <CheckCardDialog
            isOpen={isCheckCardDialogOpen}
            onClose={() => setIsCheckCardDialogOpen(false)}
            onFinishRound={openFinishRoundDialog}
          />
          <Button
            color="danger"
            variant="bordered"
            onPress={() => setIsFinishRoundDialogOpen(true)}
            className="w-full block"
          >
            Finalitzar quina
          </Button>
          <FinishRoundDialog
            isOpen={isFinishRoundDialogOpen}
            defaultValue={defaultNextRoundName}
            onClose={() => setIsFinishRoundDialogOpen(false)}
            onConfirm={handleFinishRound}
            loading={finishRoundMutation.isPending}
          />
          <Button
            onPress={handleLogout}
            variant="faded"
            className="w-full block"
            color="primary"
          >
            Logout
          </Button>
        </section>

        <GameInsightsSection />
      </div>
      <div className="flex flex-col gap-4 min-h-0 lg:overflow-y-auto min-w-0">
        <h2 className="text-3xl font-brand uppercase text-center  tracking-wider">
          Só
        </h2>
        <MiniPlayer
          song={currentSong}
          now={now}
          isPlaying={isPlaying}
          isLoading={playerControlLoading}
          currentTime={currentTime}
          duration={duration}
          onTogglePlay={togglePlayState}
          onToggleLowVolume={handleToggleLowVolume}
          isLowVolumeMode={isLowVolumeMode}
          onNext={handlePlayNextSong}
          onPrevious={handlePlayPreviousSong}
          onSeek={seek}
          playerPreloadProgress={playerPreloadProgress}
          selectedTimestampType={timestampType}
          onTimestampTypeChange={(value) =>
            setTimestampType(value as SongTimestampCategory)
          }
        />
        <IconButtonGrid fxVolume={fxVolume} />

        <Divider />

        <Slider
          label="Cançons: Volum baix"
          minValue={0}
          maxValue={1}
          step={0.001}
          value={lowVolumeSetting}
          formatOptions={{ style: 'percent' }}
          onChange={(value) => {
            if (typeof value === 'number') {
              setLowVolumeSetting(value);
            }
          }}
          showSteps={false}
          startContent={<IconVolume2 size={20} className="max-xs:hidden" />}
          endContent={<IconVolume size={20} className="max-xs:hidden" />}
        />

        <Slider
          label="Cançons: Volum normal"
          minValue={0}
          maxValue={1}
          step={0.001}
          value={songVolume}
          formatOptions={{ style: 'percent' }}
          onChange={(value) => {
            if (typeof value === 'number') {
              setSongVolume(value);
            }
          }}
          showSteps={false}
          startContent={<IconVolume2 size={20} className="max-xs:hidden" />}
          endContent={<IconVolume size={20} className="max-xs:hidden" />}
        />
        <Slider
          label="Efectes"
          minValue={0}
          maxValue={1}
          step={0.001}
          value={fxVolume}
          formatOptions={{ style: 'percent' }}
          onChange={(value) => {
            if (typeof value === 'number') {
              setFxVolume(value);
            }
          }}
          showSteps={false}
          startContent={<IconVolume2 size={20} className="max-xs:hidden" />}
          endContent={<IconVolume size={20} className="max-xs:hidden" />}
        />
      </div>
      <div className="flex flex-col min-h-0 min-w-0">
        <SongsSection
          onPlaySong={(songId) => playSongMutation.mutate({ songId })}
          onUndoLastPlayed={() => undoLastPlayedMutation.mutate()}
        />
      </div>
    </main>
  );
};
