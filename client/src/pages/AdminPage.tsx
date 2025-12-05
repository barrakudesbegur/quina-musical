import { Button, Input, Switch } from '@heroui/react';
import { IconPlayerPlay } from '@tabler/icons-react';
import { FC, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebounceCallback } from 'usehooks-ts';
import { FinishRoundDialog } from '../components/FinishRoundDialog';
import { PlaybackSection } from '../components/PlaybackSection';
import { PlaybackSectionManual } from '../components/PlaybackSectionManual';
import { trpc } from '../utils/trpc';

export const AdminPage: FC = () => {
  const [isFinishRoundDialogOpen, setIsFinishRoundDialogOpen] = useState(false);
  const utils = trpc.useUtils();
  const roundQuery = trpc.game.getCurrentRound.useQuery();
  const statusQuery = trpc.game.getStatus.useSubscription();
  const navigate = useNavigate();

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

  const debouncedUpdateRoundName = useDebounceCallback((name: string) => {
    updateRoundNameMutation.mutate({ name });
  }, 500);

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

  const handleFinishRound = (nextRoundName: string, isLastRound: boolean) => {
    finishRoundMutation.mutate({ nextRoundName, isLastRound });
  };

  const handleRoundNameChange = (value: string) => {
    utils.game.getCurrentRound.setData(undefined, (old) => {
      if (!old) return old;
      return { ...old, name: value };
    });
    debouncedUpdateRoundName(value);
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
            value={roundQuery.data?.name ?? ''}
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

      <FinishRoundDialog
        isOpen={isFinishRoundDialogOpen}
        defaultValue={defaultNextRoundName}
        onClose={() => setIsFinishRoundDialogOpen(false)}
        onConfirm={handleFinishRound}
        loading={finishRoundMutation.isPending}
      />

      <div className="flex items-center gap-3 mt-8">
        <span className="font-semibold">Mode manual</span>
        <Switch
          isSelected={isManualMode}
          onValueChange={handlePlaybackModeChange}
          color="primary"
        />
      </div>
      {isManualMode ? <PlaybackSectionManual /> : <PlaybackSection />}

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
