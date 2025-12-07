import { Button, Divider, Slider, Switch, Tab, Tabs } from '@heroui/react';
import {
  IconLoader2,
  IconPlayerPause,
  IconPlayerPlay,
  IconVolume,
  IconVolume2,
  IconVolume3,
} from '@tabler/icons-react';
import { CSSProperties, FC, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStorage } from 'usehooks-ts';
import { CheckCardDialog } from '../components/CheckCardDialog';
import { FinishRoundDialog } from '../components/FinishRoundDialog';
import { GameInsightsSection } from '../components/GameInsightsSection';
import { PlaybackSection } from '../components/PlaybackSection';
import { PlaybackSectionManual } from '../components/PlaybackSectionManual';
import { RoundNameForm } from '../components/RoundNameForm';
import { SongTimestampCategory, useSongPlayer } from '../hooks/useSongPlayer';
import { trpc } from '../utils/trpc';

const songTimestampOptions = [
  { value: 'main', label: 'Principals' },
  { value: 'secondary', label: 'Secundaris' },
  { value: 'any', label: 'Tots' },
  { value: 'constant', label: 'Igual' },
] as const satisfies readonly {
  value: SongTimestampCategory;
  label: string;
}[];

export const AdminPage: FC = () => {
  const [isFinishRoundDialogOpen, setIsFinishRoundDialogOpen] = useState(false);
  const [isCheckCardDialogOpen, setIsCheckCardDialogOpen] = useState(false);
  const utils = trpc.useUtils();
  const roundQuery = trpc.game.getCurrentRound.useQuery();
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

  const defaultNextRoundName = useMemo(() => {
    if (!roundQuery.data) return '1';
    return String(roundQuery.data.position + 1);
  }, [roundQuery.data]);

  const isManualMode = roundQuery.data?.playbackMode === 'manual';

  const {
    start: startSongPlayer,
    playById,
    pause,
    isPlaying,
    isLoading: isPlayerLoading,
    preloadStatuses: playerSongs,
    playSilence,
    setVolume,
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

  useEffect(() => {
    if (!isPlaying) return;

    if (lastPlayedKeyRef.current === lastPlayedSongId) return;
    lastPlayedKeyRef.current = lastPlayedSongId;

    if (lastPlayedSongId) {
      void playById(lastPlayedSongId, timestampType);
    } else {
      playSilence();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPlayedSongId, playById, timestampType]);

  const handleTogglePlayback = async () => {
    if (isPlaying) {
      pause();
      return;
    }

    try {
      if (lastPlayedSongId) {
        await playById(lastPlayedSongId, timestampType);
      } else {
        playSilence();
      }
    } catch (err) {
      console.error('Failed to toggle playback', err);
    }
  };

  const playerPreloadProgress = useMemo(() => {
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

        <div className="relative rounded-xl overflow-hidden">
          <Button
            onPress={handleTogglePlayback}
            color={isPlaying ? 'warning' : 'success'}
            className="w-full "
            variant="flat"
            isLoading={isPlayerLoading}
            startContent={
              playerPreloadProgress < 1 ? (
                <IconLoader2 className="animate-spin" size={20} />
              ) : isPlaying ? (
                <IconPlayerPause size={20} />
              ) : (
                <IconPlayerPlay size={20} />
              )
            }
          >
            {isPlaying ? 'Desactivar so' : 'Activar so'}
          </Button>

          {playerPreloadProgress < 1 && (
            <div
              style={
                {
                  '--progress': playerPreloadProgress,
                } as CSSProperties
              }
              className="absolute inset-0 pointer-events-none  scale-x-(--progress) origin-left   bg-black/10 mix-blend-multiply"
            />
          )}
        </div>

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
          {songTimestampOptions.map(({ value, label }) => (
            <Tab key={value} title={label} />
          ))}
        </Tabs>

        <Divider />

        <Switch
          isSelected={isManualMode}
          onValueChange={handlePlaybackModeChange}
          color="primary"
        >
          Mode manual
        </Switch>
      </section>

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
