import { Button, Divider, Slider } from '@heroui/react';
import { IconPlayerPlay, IconVolume, IconVolume2 } from '@tabler/icons-react';
import { differenceInMilliseconds, isValid, parseISO } from 'date-fns';
import { FC, useEffect, useMemo, useRef, useState } from 'react';
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

  const {
    start: startSongPlayer,
    loadSong,
    pause,
    resume,
    isPlaying,
    isLoading: isPlayerLoading,
    preloadStatuses: playerSongs,
    playSilence,
    setVolume,
    seek,
    currentTime,
    duration,
    currentSongId,
    canResume,
  } = useSongPlayer();

  const now = useSecondsStopwatch();

  useEffect(() => {
    void startSongPlayer();
  });

  const lastPlayedKeyRef = useRef<number | null>(null);
  const [isLowVolumeMode, setIsLowVolumeMode] = useSessionStorage<boolean>(
    'admin-low-volume-mode',
    false
  );
  const [lowVolumeSetting, setLowVolumeSetting] = useSessionStorage<number>(
    'admin-low-volume-setting',
    0.2
  );
  const [timestampType, setTimestampType] =
    useSessionStorage<SongTimestampCategory>('admin-timestamp-type', 'main');

  useEffect(() => {
    setVolume(isLowVolumeMode ? lowVolumeSetting : 1);
  }, [isLowVolumeMode, lowVolumeSetting, setVolume]);

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

  const canPlayPrevious = (roundQuery.data?.playedSongs.length ?? 0) > 0;
  const playerControlLoading =
    isPlayerLoading ||
    playSongMutation.isPending ||
    undoLastPlayedMutation.isPending ||
    songsQuery.isFetching ||
    songsQuery.isLoading;

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

  const handleTogglePlayback = async () => {
    if (isPlaying) {
      pause();
      return;
    }

    try {
      if (lastPlayedSongId) {
        if (canResume && currentSongId && currentSongId === lastPlayedSongId) {
          await resume();
        } else {
          await loadSong(lastPlayedSongId, timestampType, { autoplay: true });
        }
      } else {
        playSilence();
      }
    } catch (err) {
      console.error('Failed to toggle playback', err);
    }
  };

  const playerPreloadProgress = useMemo(() => {
    if (!playerSongs.length) return 0;
    return (
      playerSongs.filter((song) => song.preloaded).length / playerSongs.length
    );
  }, [playerSongs]);

  const handleFinishRound = (nextRoundName: string, isLastRound: boolean) => {
    finishRoundMutation.mutate({ nextRoundName, isLastRound });
  };

  const handlePlayNextSong = () => {
    playSongMutation.mutate({ songId: undefined });
  };

  const handlePlayPreviousSong = () => {
    if (!canPlayPrevious) return;
    undoLastPlayedMutation.mutate();
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
      <main className="container mx-auto p-4 pb-32 space-y-12">
        <div className="flex flex-col items-center justify-center min-h-[50dvh] gap-4">
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
    <main className="max-w-[1800px] mx-auto p-4 pb-32 space-y-12">
      <div className="grid gap-8 max-w-xl lg:max-w-none mx-auto lg:grid-cols-3">
        <div className="space-y-4">
          <section className="space-y-4">
            <h2 className="text-3xl font-brand uppercase text-center mb-8 tracking-wider">
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

            <Divider />

            <Slider
              label="Mode volum baix"
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
          </section>

          <GameInsightsSection />
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-brand uppercase text-center mb-8 tracking-wider">
            Só
          </h2>
          <MiniPlayer
            song={currentSong}
            now={now}
            isPlaying={isPlaying}
            isLoading={playerControlLoading}
            currentTime={currentTime}
            duration={duration}
            onTogglePlay={handleTogglePlayback}
            onToggleLowVolume={() => setIsLowVolumeMode(!isLowVolumeMode)}
            isLowVolumeMode={isLowVolumeMode}
            onNext={handlePlayNextSong}
            onPrevious={canPlayPrevious ? handlePlayPreviousSong : undefined}
            onSeek={seek}
            playerPreloadProgress={playerPreloadProgress}
            selectedTimestampType={timestampType}
            onTimestampTypeChange={(value) =>
              setTimestampType(value as SongTimestampCategory)
            }
          />
        </div>
        <div className="space-y-4">
          <SongsSection
            onPlaySong={(songId) => playSongMutation.mutate({ songId })}
            onUndoLastPlayed={() => undoLastPlayedMutation.mutate()}
          />
        </div>
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
};
