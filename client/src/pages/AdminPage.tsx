import { Button, Checkbox, Divider, Slider } from '@heroui/react';
import { IconPlayerPlay, IconVolume, IconVolume2 } from '@tabler/icons-react';
import { differenceInMilliseconds, isValid, parseISO } from 'date-fns';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStorage } from 'usehooks-ts';
import { CheckCardDialog } from '../components/CheckCardDialog';
import { FinishRoundDialog } from '../components/FinishRoundDialog';
import { GameInsightsSection } from '../components/GameInsightsSection';
import { ImagePicker } from '../components/ImagePicker';
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
    onMutate: async (input) => {
      await utils.game.getAllSongs.cancel();

      const previousSongs = utils.game.getAllSongs.getData();
      const songId =
        input.songId ?? previousSongs?.find((s) => s.positionInQueue === 1)?.id;

      utils.game.getAllSongs.setData(undefined, (old) => {
        if (!old) return old;
        return old.map((song) => ({
          ...song,
          isLastPlayed: song.id === songId,
          isPlayed: song.id === songId ? true : song.isPlayed,
          playedAt:
            song.id === songId ? new Date().toISOString() : song.playedAt,
          positionInQueue:
            song.id === songId
              ? null
              : song.positionInQueue
                ? song.positionInQueue - 1
                : null,
        }));
      });

      return { previousSongs };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousSongs) {
        utils.game.getAllSongs.setData(undefined, context.previousSongs);
      }
    },
    onSettled: () => {
      utils.game.invalidate();
    },
  });

  const undoLastPlayedMutation = trpc.game.undoLastPlayed.useMutation({
    onMutate: async () => {
      await utils.game.getAllSongs.cancel();

      const previousSongs = utils.game.getAllSongs.getData();
      const currentLastPlayed = previousSongs?.find((s) => s.isLastPlayed);
      const newLastPlayed = previousSongs
        ?.filter((s) => s.isPlayed && !s.isLastPlayed)
        .sort((a, b) => (b.playedAt ?? '').localeCompare(a.playedAt ?? ''))[0];

      utils.game.getAllSongs.setData(undefined, (old) => {
        if (!old) return old;
        return old.map((song) => ({
          ...song,
          isLastPlayed: song.id === newLastPlayed?.id,
          isPlayed: song.id === currentLastPlayed?.id ? false : song.isPlayed,
          playedAt: song.id === currentLastPlayed?.id ? null : song.playedAt,
          positionInQueue:
            song.id === currentLastPlayed?.id
              ? 1
              : song.positionInQueue
                ? song.positionInQueue + 1
                : null,
        }));
      });

      return { previousSongs };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousSongs) {
        utils.game.getAllSongs.setData(undefined, context.previousSongs);
      }
    },
    onSettled: () => {
      utils.game.invalidate();
    },
  });

  const showImageMutation = trpc.game.showImage.useMutation();

  const defaultNextRoundName = useMemo(() => {
    if (!roundQuery.data) return '1';
    return String(roundQuery.data.position + 1);
  }, [roundQuery.data]);

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
  const [hideImageOnFirstSong, setHideImageOnFirstSong] =
    useSessionStorage<boolean>('admin-hide-image-on-first-song', false);

  const handlePlayNextSong = useCallback(() => {
    playSongMutation.mutate({ songId: undefined });
  }, [playSongMutation]);

  const canPlayPrevious = useMemo(() => {
    return (songsQuery.data?.filter((s) => s.isPlayed).length ?? 0) > 0;
  }, [songsQuery.data]);

  const handlePlayPreviousSong = useCallback(() => {
    if (!canPlayPrevious) return;
    undoLastPlayedMutation.mutate();
  }, [canPlayPrevious, undoLastPlayedMutation]);

  const handleToggleLowVolume = useCallback(() => {
    setIsLowVolumeMode((prev) => !prev);
  }, [setIsLowVolumeMode]);

  const {
    initialize: initializeSongPlayer,
    setSong,
    togglePlayState,
    isPlaying,
    isLoading: isPlayerLoading,
    preloadStatuses: playerSongs,
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
    void initializeSongPlayer();
  }, [initializeSongPlayer]);

  useEffect(() => {
    setVolume(isLowVolumeMode ? lowVolumeSetting : songVolume);
  }, [isLowVolumeMode, lowVolumeSetting, setVolume, songVolume]);

  const displayedSongId = useMemo(() => {
    const lastPlayed = songsQuery.data?.find((s) => s.isLastPlayed);
    if (lastPlayed) return lastPlayed.id;
    const hasAnyPlayed = songsQuery.data?.some((s) => s.isPlayed);
    if (hasAnyPlayed === false) return 'silence' as const;
    return null;
  }, [songsQuery.data]);

  const roundElapsedMs = useMemo(() => {
    const roundStartedAt = roundQuery.data?.startedAt ?? null;

    if (!roundStartedAt) return null;
    const startDate = parseISO(roundStartedAt);
    if (!isValid(startDate)) return null;
    return Math.max(0, differenceInMilliseconds(new Date(now), startDate));
  }, [now, roundQuery.data?.startedAt]);

  const currentSong = useMemo(
    () => songsQuery.data?.find((song) => song.id === displayedSongId) ?? null,
    [displayedSongId, songsQuery.data]
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

  const lastPlayedRef = useRef<number | 'silence' | null>(null);
  useEffect(() => {
    if (displayedSongId === null) return;
    if (lastPlayedRef.current === displayedSongId) return;

    lastPlayedRef.current = displayedSongId;

    if (displayedSongId === 'silence') {
      setSong(null);
    } else {
      setSong(displayedSongId, timestampType, { autoplay: isPlaying });
    }
  }, [displayedSongId, setSong, timestampType, isPlaying]);

  const playerPreloadProgress = useMemo(() => {
    if (!playerSongs.length) return 0;
    return (
      playerSongs.filter((song) => song.preloaded).length / playerSongs.length
    );
  }, [playerSongs]);

  useEffect(() => {
    if (
      hideImageOnFirstSong &&
      songsQuery.data?.filter((s) => s.isPlayed).length === 1
    ) {
      showImageMutation.mutate({ imageId: null });
    }
  }, [hideImageOnFirstSong, songsQuery.data, showImageMutation]);

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
            <div>
              <div className="text-sm text-foreground">Duració</div>
              <div className=" text-xl text-foreground font-medium min-h-10   inline-flex items-center  ">
                <span>{formatElapsedClock(roundElapsedMs)}</span>
              </div>
            </div>
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
            onConfirm={(data) => finishRoundMutation.mutate(data)}
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
          canPlayPrevious={canPlayPrevious}
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

        <h2 className="text-3xl mt-8 font-brand uppercase text-center  tracking-wider">
          Imatges
        </h2>

        <div className="flex items-center flex-col gap-2">
          <Checkbox
            isSelected={hideImageOnFirstSong}
            onValueChange={setHideImageOnFirstSong}
            size="sm"
          >
            Amagar imatge quan soni la primera cançó
          </Checkbox>
        </div>
        <ImagePicker />
      </div>
      <div className="flex flex-col min-h-0 min-w-0">
        <SongsSection
          onPlaySong={(songId) => playSongMutation.mutate({ songId })}
          onUndoLastPlayed={handlePlayPreviousSong}
        />
      </div>
    </main>
  );
};
