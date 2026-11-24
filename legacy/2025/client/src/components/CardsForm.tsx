import { Button, cn, Input } from '@heroui/react';
import { FC, useState } from 'react';
import { trpc } from '../utils/trpc';
import { IconDeviceFloppy } from '@tabler/icons-react';

const formatCardRanges = (cards: number[]) => {
  if (!cards.length) return '';
  const sorted = [...new Set(cards)].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const isContiguous = current === prev + 1;
    if (!isContiguous) {
      ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = current;
    }
    prev = current;
  }

  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return ranges.join(', ');
};

function parseCardRanges(ranges: string) {
  const values = ranges
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const [start, end] = part.split('-').map((v) => v.trim());
      const startNum = Number.parseInt(start, 10);
      const endNum = end ? Number.parseInt(end, 10) : startNum;
      if (!Number.isFinite(startNum) || !Number.isFinite(endNum)) return [];
      const from = Math.min(startNum, endNum);
      const to = Math.max(startNum, endNum);
      return Array.from({ length: to - from + 1 }, (_, idx) => from + idx);
    });

  return Array.from(new Set(values)).sort((a, b) => a - b);
}

export const CardsForm: FC<{ className?: string }> = ({ className }) => {
  const utils = trpc.useUtils();
  const [rangesValue, setRangesValue] = useState('');
  const [hasTouched, setHasTouched] = useState(false);
  const cardsPlayingQuery = trpc.game.getCardsPlaying.useQuery();
  const updateCardsPlayingMutation = trpc.game.updateCardsPlaying.useMutation({
    onSettled: () => {
      utils.game.getCardsPlaying.invalidate();
    },
  });

  const handleSubmit = () => {
    updateCardsPlayingMutation.mutate(
      {
        cardIds: parseCardRanges(rangesValue),
      },
      {
        onSuccess: () => {
          setHasTouched(false);
        },
      }
    );
  };

  return (
    <form
      className={cn(`flex flex-row items-end gap-2`, className)}
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <Input
        label="Cartrons en joc"
        value={
          hasTouched
            ? rangesValue
            : formatCardRanges(cardsPlayingQuery.data ?? [])
        }
        onValueChange={(value) => {
          setHasTouched(true);
          setRangesValue(value);
        }}
        variant="bordered"
        labelPlacement="outside"
        description="Ex: 0-100, 200-300, 500"
        isDisabled={cardsPlayingQuery.isLoading}
      />
      <Button
        color="primary"
        type="submit"
        variant="flat"
        isLoading={updateCardsPlayingMutation.isPending}
        isDisabled={cardsPlayingQuery.isLoading}
        isIconOnly
        className="mb-6"
      >
        <IconDeviceFloppy />
      </Button>
    </form>
  );
};
