import { Button, Card, CardBody, Chip, Input, cn } from '@heroui/react';
import {
  IconArrowBackUp,
  IconCircleCheckFilled,
  IconPlayerPlay,
} from '@tabler/icons-react';
import { FC, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebounceCallback } from 'usehooks-ts';
import { FinishRoundDialog } from '../components/FinishRoundDialog';
import { trpc } from '../utils/trpc';

export const AdminPage: FC = () => {
  const [isFinishRoundDialogOpen, setIsFinishRoundDialogOpen] = useState(false);
  const [roundName, setRoundName] = useState('');
  const utils = trpc.useUtils();
  const songsQuery = trpc.game.getAllSongs.useQuery();
  const roundQuery = trpc.game.getCurrentRound.useQuery();
  const statusQuery = trpc.game.getStatus.useSubscription();
  const navigate = useNavigate();

  useEffect(() => {
    if (roundQuery.data?.name) {
      setRoundName(roundQuery.data.name);
    }
  }, [roundQuery.data?.name]);

  const maxPosition = useMemo(() => {
    if (!songsQuery.data) return 0;
    return Math.max(0, ...songsQuery.data.map((s) => s.playedPosition || 0));
  }, [songsQuery.data]);

  const songsWithLastPlayed = useMemo(() => {
    return (
      songsQuery.data?.map((song) => ({
        ...song,
        isLastPlayed: song.playedPosition === maxPosition,
      })) ?? []
    );
  }, [songsQuery.data, maxPosition]);

  const playSongMutation = trpc.game.playSong.useMutation({
    onMutate: async ({ songId }) => {
      await utils.game.getAllSongs.cancel();

      const previousSongs = utils.game.getAllSongs.getData();

      // Calculate next position
      const currentSongs = previousSongs || [];
      const nextPosition =
        Math.max(0, ...currentSongs.map((s) => s.playedPosition || 0)) + 1;

      utils.game.getAllSongs.setData(undefined, (old) => {
        if (!old) return previousSongs;
        return old.map((song) => ({
          ...song,
          isPlayed: song.isPlayed || song.id === songId,
          playedPosition:
            song.id === songId ? nextPosition : song.playedPosition,
        }));
      });

      return { previousSongs };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousSongs) {
        utils.game.getAllSongs.setData(undefined, context.previousSongs);
      }
    },
    onSettled: () => {
      utils.game.getAllSongs.invalidate();
    },
  });

  const undoLastPlayedMutation = trpc.game.undoLastPlayed.useMutation({
    onMutate: async () => {
      await utils.game.getAllSongs.cancel();

      const previousSongs = utils.game.getAllSongs.getData();
      if (!previousSongs) return { previousSongs };

      const maxPos = Math.max(
        0,
        ...previousSongs.map((s) => s.playedPosition || 0)
      );
      const lastPlayedSong = previousSongs.find(
        (s) => s.playedPosition === maxPos
      );
      if (!lastPlayedSong) return { previousSongs };

      utils.game.getAllSongs.setData(undefined, (old) => {
        if (!old) return previousSongs;
        return old.map((song) => ({
          ...song,
          isPlayed: song.isPlayed && song.playedPosition !== maxPos,
          playedPosition:
            song.playedPosition === maxPos ? undefined : song.playedPosition,
        }));
      });

      return { previousSongs };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousSongs) {
        utils.game.getAllSongs.setData(undefined, context.previousSongs);
      }
    },
    onSettled: () => {
      utils.game.getAllSongs.invalidate();
    },
  });

  const handlePlaySong = (songId: string) => {
    playSongMutation.mutate({ songId });
  };

  const handleCardPress = (song: (typeof songsWithLastPlayed)[number]) => {
    if (song.isLastPlayed) {
      undoLastPlayedMutation.mutate();
    } else if (!song.isPlayed) {
      handlePlaySong(song.id);
    }
  };

  const updateRoundNameMutation = trpc.game.updateRoundName.useMutation({
    onMutate: async ({ name }) => {
      await utils.game.getCurrentRound.cancel();

      const previousRound = utils.game.getCurrentRound.getData();

      utils.game.getCurrentRound.setData(undefined, (old) => {
        if (!old) return previousRound;
        return {
          ...old,
          name,
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

  const debouncedUpdateRoundName = useDebounceCallback(
    (name: string) => {
      updateRoundNameMutation.mutate({ name });
    },
    1000,
    {
      leading: true,
    }
  );

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

  const handleFinishRound = (nextRoundName: string, isLastRound: boolean) => {
    finishRoundMutation.mutate({ nextRoundName, isLastRound });
  };

  const handleRoundNameChange = (value: string) => {
    setRoundName(value);
    debouncedUpdateRoundName(value);
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
    <main className="container mx-auto p-4 pb-32 space-y-12">
      <section>
        <h2 className="text-3xl font-brand uppercase text-center mb-2 tracking-wider">
          Gestió de la quina
        </h2>
        <div className="flex flex-col gap-2">
          <Input
            value={roundName}
            onValueChange={handleRoundNameChange}
            variant="bordered"
            label="Nom de la quina"
            labelPlacement="outside"
            className="max-w-full"
          />
          <Button
            color="danger"
            variant="flat"
            onPress={() => setIsFinishRoundDialogOpen(true)}
          >
            Finalitzar quina...
          </Button>
        </div>
      </section>

      <section>
        <h2 className="text-3xl font-brand uppercase text-center mb-2 tracking-wider">
          Cançons
        </h2>
        <div className="flex flex-col gap-2 -mx-2">
          {songsWithLastPlayed?.map((song) => (
            <Card
              key={song.id}
              isPressable
              isDisabled={song.isPlayed && !song.isLastPlayed}
              onPress={() => handleCardPress(song)}
              className={cn('flex items-center relative', {
                'opacity-50': song.isPlayed && !song.isLastPlayed,
                'border-success': song.isLastPlayed,
              })}
              radius="sm"
            >
              <CardBody className="gap-3 justify-between flex-row items-center">
                <div className="flex flex-col flex-grow">
                  <p className="text-lg leading-tight">{song.title}</p>
                  <p className="text-xs text-default-500 leading-tight">
                    {song.artist}
                  </p>
                </div>
                <div className="flex gap-1">
                  {song.isLastPlayed && (
                    <Chip
                      color="warning"
                      variant="flat"
                      className="font-brand tracking-widest text-lg uppercase"
                      classNames={{
                        base: 'p-0',
                      }}
                    >
                      <IconArrowBackUp size={20} />
                    </Chip>
                  )}
                  {song.isPlayed && (
                    <Chip
                      color="success"
                      variant="flat"
                      className="font-brand tracking-widest uppercase text-2xl font-light"
                      startContent={<IconCircleCheckFilled size={24} />}
                    >
                      {song.playedPosition}
                    </Chip>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

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
        className="mx-auto block"
        color="primary"
      >
        Logout
      </Button>
    </main>
  );
};
