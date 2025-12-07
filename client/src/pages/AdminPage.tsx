import { Button, Divider, Slider, Switch, Tab, Tabs } from '@heroui/react';
import {
  IconCarambolaFilled,
  IconFlameFilled,
  IconPlayerPlay,
  IconSquareRotated,
  IconTriangleSquareCircle,
  IconVolume,
  IconVolume2,
  IconVolume3,
  TablerIcon,
} from '@tabler/icons-react';
import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStorage } from 'usehooks-ts';
import { CheckCardDialog } from '../components/CheckCardDialog';
import { FinishRoundDialog } from '../components/FinishRoundDialog';
import { GameInsightsSection } from '../components/GameInsightsSection';
import { MiniPlayer } from '../components/MiniPlayer';
import { PlaybackSection } from '../components/PlaybackSection';
import { PlaybackSectionManual } from '../components/PlaybackSectionManual';
import { RoundNameForm } from '../components/RoundNameForm';
import { SongTimestampCategory, useSongPlayer } from '../hooks/useSongPlayer';
import { trpc } from '../utils/trpc';

const songTimestampOptions = [
  { value: 'constant', label: 'Millor', icon: IconCarambolaFilled },
  { value: 'main', label: 'Principals', icon: IconFlameFilled },
  { value: 'secondary', label: 'Secundaris', icon: IconSquareRotated },
  { value: 'any', label: 'Tots', icon: IconTriangleSquareCircle },
] as const satisfies readonly {
  value: SongTimestampCategory;
  label: string;
  icon: TablerIcon;
}[];

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

  const updatePlaybackModeMutation = trpc.game.updatePlaybackMode.useMutation({
    onMutate: async ({ playbackMode }) => {
      await utils.game.getCurrentRound.cancel();

      const previousRound = utils.game.getCurrentRound.getData();

      utils.game.getCurrentRound.setData(undefined, (old) => {
        if (!old) return previousRound;
        return {
          ...old,
          playbackMode,
        };
      });

      return { previousRound };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousRound) {
        utils.game.getCurrentRound.setData(undefined, context.previousRound);
      }
    },
    onSettled: () => {
      utils.game.getCurrentRound.invalidate();
    },
  });

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

  const isManualMode = roundQuery.data?.playbackMode === 'manual';

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
  }, [lastPlayedSongId, loadSong, timestampType]);

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

  const handlePlaybackModeChange = (value: boolean) => {
    updatePlaybackModeMutation.mutate({
      playbackMode: value ? 'manual' : 'auto',
    });
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
    <main className="max-w-xl mx-auto p-4 pb-32 space-y-12">
      <section className="space-y-4">
        <h2 className="text-3xl font-brand uppercase text-center mb-8 tracking-wider">
          Gestió de la quina
        </h2>

        <RoundNameForm />
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

        <div className="text-sm mb-1">Punt d'inici de la cançó</div>
        <Tabs
          aria-label="Punt d'inici"
          selectedKey={timestampType}
          onSelectionChange={(key) =>
            setTimestampType(key as SongTimestampCategory)
          }
          className="mb-2"
          fullWidth
        >
          {songTimestampOptions.map(({ value, label, icon: Icon }) => (
            <Tab
              key={value}
              title={
                <div className="flex items-center space-x-2">
                  <Icon className="size-4" stroke={3} />
                  <span>{label}</span>
                </div>
              }
            />
          ))}
        </Tabs>

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
          startContent={
            <div className="inline-flex items-center gap-2">
              <Switch
                isSelected={isLowVolumeMode}
                onValueChange={(isLow) => {
                  setIsLowVolumeMode(isLow);
                }}
                color="primary"
                endContent={<IconVolume size={20} />}
                startContent={<IconVolume3 size={20} />}
                aria-label="Baixar volum"
              />
              <IconVolume2 size={20} className="max-xs:hidden" />
            </div>
          }
          endContent={<IconVolume size={20} className="max-xs:hidden" />}
        />

        <Divider />

        <Switch
          isSelected={isManualMode}
          onValueChange={handlePlaybackModeChange}
          color="primary"
        >
          Mode manual
        </Switch>
      </section>

      <MiniPlayer
        song={currentSong}
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
        timestampOptions={songTimestampOptions}
        selectedTimestampType={timestampType}
        onTimestampTypeChange={(value) =>
          setTimestampType(value as SongTimestampCategory)
        }
      />

      {isManualMode ? <PlaybackSectionManual /> : <PlaybackSection />}

      <GameInsightsSection />

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
