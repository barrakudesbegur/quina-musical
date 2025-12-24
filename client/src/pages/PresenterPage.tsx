import {
  Button,
  Checkbox,
  Divider,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Slider,
} from '@heroui/react';
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
import { formatElapsedClock } from '../utils/time';
import { trpc } from '../utils/trpc';
import { IconButtonGrid } from '../components/IconButtonGrid';
import { type SongTimestamp, useSongPlayer } from '../hooks/useSongPlayer';
import { WiiMoteSection } from '../WiiMoteSection';
import { useWiiMote } from '../hooks/useWiiMote';
import { WMButtonEvent } from '../utils/WiimoteLib/WiiMote/ObjectStates';
import { WMButtons } from '../utils/WiimoteLib/WiiMote/Types';

export const AdminPage: FC = () => {
  const [isFinishRoundDialogOpen, setIsFinishRoundDialogOpen] = useState(false);
  const [isCheckCardDialogOpen, setIsCheckCardDialogOpen] = useState(false);
  const [isWiiMoteDialogOpen, setIsWiiMoteDialogOpen] = useState(false);
  const [prefilledWinnerCardId, setPrefilledWinnerCardId] = useState<
    string | undefined
  >(undefined);
  const utils = trpc.useUtils();
  const gameState = trpc.game.onStateChange.useSubscription();
  const roundQuery = trpc.game.getCurrentRound.useQuery();
  const songsQuery = trpc.game.getAllSongs.useQuery(undefined, {
    enabled: !!roundQuery.data,
  });
  const statusQuery = trpc.game.getStatusNow.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });
  const navigate = useNavigate();

  const { wiiMote, dpadFxMapping } = useWiiMote();

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

  const [timestampTypes, setTimestampTypes] = useSessionStorage<
    SongTimestamp['tag'][]
  >('admin-timestamp-type', ['main', 'best']);
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

  const {
    setSong,
    togglePlay,
    isPlaying,
    isSongReady,
    seek,
    getCurrentTime,
    duration,
    playFx,
    isLowVolumeMode,
    setIsLowVolumeMode,
    setLowVolumeSetting,
    lowVolumeSetting,
    setSongVolume,
    songVolume,
    setFxVolume,
    fxVolume,
  } = useSongPlayer({
    onNext: handlePlayNextSong,
    onPrevious: handlePlayPreviousSong,
  });

  const handleToggleLowVolume = useCallback(() => {
    setIsLowVolumeMode((prev) => !prev);
  }, [setIsLowVolumeMode]);

  const now = useSecondsStopwatch();

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
      !isSongReady ||
      playSongMutation.isPending ||
      undoLastPlayedMutation.isPending ||
      songsQuery.isFetching ||
      songsQuery.isLoading
    );
  }, [
    isSongReady,
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
      setSong(displayedSongId, timestampTypes);
    }
  }, [displayedSongId, setSong, timestampTypes]);

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

  const openFinishRoundDialog = (prefilledCardId?: string) => {
    setPrefilledWinnerCardId(prefilledCardId);
    setIsFinishRoundDialogOpen(true);
    setIsCheckCardDialogOpen(false);
  };

  useEffect(() => {
    const handlePressA = (e: WMButtonEvent) => {
      if (e.isPressed) {
        handlePlayNextSong();
        wiiMote?.setRumble(true, 100);
      }
    };
    const handlePressOneOrTwo = (e: WMButtonEvent) => {
      if (e.isPressed) {
        handlePlayPreviousSong();
        wiiMote?.setRumble(true, 100);
      }
    };
    const handlePressHome = (e: WMButtonEvent) => {
      if (e.isPressed) togglePlay();
    };
    const handlePressPlus = (e: WMButtonEvent) => {
      if (e.isPressed) {
        const currentImageId = gameState.data?.displayedImageId ?? null;
        const currentRoundImageId = gameState.data?.roundImageId ?? null;

        if (currentImageId === currentRoundImageId) {
          showImageMutation.mutate({ imageId: null });
        } else {
          showImageMutation.mutate({ imageId: currentRoundImageId });
        }
      }
    };
    const handlePressMinus = (e: WMButtonEvent) => {
      if (e.isPressed) handleToggleLowVolume();
    };
    const handlePressB = (e: WMButtonEvent) => {
      if (e.isPressed) playFx('horn');
    };
    const handlePressDpadUp = (e: WMButtonEvent) => {
      if (e.isPressed && dpadFxMapping.up) playFx(dpadFxMapping.up);
    };
    const handlePressDpadDown = (e: WMButtonEvent) => {
      if (e.isPressed && dpadFxMapping.down) playFx(dpadFxMapping.down);
    };
    const handlePressDpadLeft = (e: WMButtonEvent) => {
      if (e.isPressed && dpadFxMapping.left) playFx(dpadFxMapping.left);
    };
    const handlePressDpadRight = (e: WMButtonEvent) => {
      if (e.isPressed && dpadFxMapping.right) playFx(dpadFxMapping.right);
    };

    wiiMote?.addButtonListener(WMButtons.A, handlePressA);
    wiiMote?.addButtonListener(WMButtons.ONE, handlePressOneOrTwo);
    wiiMote?.addButtonListener(WMButtons.TWO, handlePressOneOrTwo);
    wiiMote?.addButtonListener(WMButtons.HOME, handlePressHome);
    wiiMote?.addButtonListener(WMButtons.PLUS, handlePressPlus);
    wiiMote?.addButtonListener(WMButtons.MINUS, handlePressMinus);
    wiiMote?.addButtonListener(WMButtons.B, handlePressB);
    wiiMote?.addButtonListener(WMButtons.DPAD_UP, handlePressDpadUp);
    wiiMote?.addButtonListener(WMButtons.DPAD_DOWN, handlePressDpadDown);
    wiiMote?.addButtonListener(WMButtons.DPAD_LEFT, handlePressDpadLeft);
    wiiMote?.addButtonListener(WMButtons.DPAD_RIGHT, handlePressDpadRight);
    return () => {
      wiiMote?.removeButtonListener(handlePressA);
      wiiMote?.removeButtonListener(handlePressOneOrTwo);
      wiiMote?.removeButtonListener(handlePressHome);
      wiiMote?.removeButtonListener(handlePressPlus);
      wiiMote?.removeButtonListener(handlePressMinus);
      wiiMote?.removeButtonListener(handlePressB);
      wiiMote?.removeButtonListener(handlePressDpadUp);
      wiiMote?.removeButtonListener(handlePressDpadDown);
      wiiMote?.removeButtonListener(handlePressDpadLeft);
      wiiMote?.removeButtonListener(handlePressDpadRight);
    };
  }, [
    dpadFxMapping.down,
    dpadFxMapping.left,
    dpadFxMapping.right,
    dpadFxMapping.up,
    gameState.data?.displayedImageId,
    gameState.data?.roundImageId,
    handlePlayNextSong,
    handlePlayPreviousSong,
    handleToggleLowVolume,
    playFx,
    showImageMutation,
    togglePlay,
    wiiMote,
  ]);

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

          <div className="grid xs:grid-cols-2 gap-4">
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
              color="secondary"
              variant="bordered"
              onPress={() => setIsWiiMoteDialogOpen(true)}
              className="w-full block"
            >
              Mando Wii ({wiiMote ? 'Connectat' : 'Desconnectat'})
            </Button>
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
              defaultWinnerCardIds={prefilledWinnerCardId}
              onClose={() => {
                setIsFinishRoundDialogOpen(false);
                setPrefilledWinnerCardId(undefined);
              }}
              onConfirm={(data) => finishRoundMutation.mutate(data)}
              loading={finishRoundMutation.isPending}
            />
            <Modal
              isOpen={isWiiMoteDialogOpen}
              onClose={() => setIsWiiMoteDialogOpen(false)}
              size="2xl"
              scrollBehavior="inside"
            >
              <ModalContent>
                <ModalHeader>Wii Remote</ModalHeader>
                <ModalBody>
                  <WiiMoteSection />
                </ModalBody>
              </ModalContent>
            </Modal>
            <Button
              onPress={handleLogout}
              variant="faded"
              className="w-full block"
              color="primary"
            >
              Logout
            </Button>
          </div>
        </section>

        <GameInsightsSection now={now} />
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
          getCurrentTime={getCurrentTime}
          duration={duration}
          onTogglePlay={togglePlay}
          onToggleLowVolume={handleToggleLowVolume}
          isLowVolumeMode={isLowVolumeMode}
          onNext={handlePlayNextSong}
          onPrevious={handlePlayPreviousSong}
          canPlayPrevious={canPlayPrevious}
          onSeek={seek}
          isSongReady={isSongReady}
          selectedTimestampTypes={timestampTypes}
          onTimestampTypesChange={(values) => {
            setTimestampTypes(values);
          }}
        />
        <IconButtonGrid playFx={playFx} />

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
        <ImagePicker
          displayedImageId={gameState.data?.displayedImageId ?? null}
          roundImageId={gameState.data?.roundImageId ?? null}
        />
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
