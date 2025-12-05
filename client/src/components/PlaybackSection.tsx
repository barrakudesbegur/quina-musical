import { Button } from '@heroui/react';
import { IconPlayerSkipForward } from '@tabler/icons-react';
import { IconPlayerSkipBack } from '@tabler/icons-react';
import { FC } from 'react';
import { trpc } from '../utils/trpc';

export const PlaybackSection: FC = () => {
  const utils = trpc.useUtils();

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

  const handlePlayPrevious = () => {
    undoLastPlayedMutation.mutate();
  };

  const handlePlay = () => {
    playSongMutation.mutate({ songId: undefined });
  };

  return (
    <section>
      <h2 className="text-3xl font-brand uppercase text-center mb-2 tracking-wider">
        Cançons
      </h2>
      <div className="grid grid-cols-2 gap-2 mt-4">
        <Button
          isIconOnly
          aria-label="Següent"
          className="w-full aspect-square h-auto max-w-3xs ml-auto"
          onPress={handlePlayPrevious}
          isLoading={undoLastPlayedMutation.isPending}
        >
          <IconPlayerSkipBack className="size-16 stroke-1" />
        </Button>
        <Button
          isIconOnly
          aria-label="Següent"
          className="w-full aspect-square h-auto max-w-3xs mr-auto"
          onPress={handlePlay}
          isLoading={playSongMutation.isPending}
        >
          <IconPlayerSkipForward className="size-16 stroke-1" />
        </Button>
      </div>
    </section>
  );
};
