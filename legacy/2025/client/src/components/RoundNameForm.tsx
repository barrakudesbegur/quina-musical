import { Input } from '@heroui/react';
import { FC } from 'react';
import { useDebounceCallback } from 'usehooks-ts';
import { trpc } from '../utils/trpc';

export const RoundNameForm: FC = () => {
  const utils = trpc.useUtils();
  const roundQuery = trpc.game.getCurrentRound.useQuery();

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

  const debouncedUpdateRoundName = useDebounceCallback((name: string) => {
    updateRoundNameMutation.mutate({ name });
  }, 500);

  const handleRoundNameChange = (value: string) => {
    utils.game.getCurrentRound.setData(undefined, (old) => {
      if (!old) return old;
      return { ...old, name: value };
    });
    debouncedUpdateRoundName(value);
  };

  return (
    <Input
      value={roundQuery.data?.name ?? ''}
      onValueChange={handleRoundNameChange}
      variant="bordered"
      label="Nom de la quina"
      labelPlacement="outside"
      className="max-w-full"
    />
  );
};
