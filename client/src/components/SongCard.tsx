import { Card, CardBody, Chip, cn, Image } from '@heroui/react';
import {
  IconArrowBackUp,
  IconCircleCheckFilled,
  IconGripVertical,
} from '@tabler/icons-react';
import { DragControls } from 'framer-motion';
import { FC } from 'react';
import { formatCompactDuration } from '../utils/time';

type Song = {
  id: number;
  isPlayed: boolean;
  isLastPlayed: boolean | null;
  cover: string;
  title: string;
  artist: string;
  position: number;
  positionInQueue: number | null;
  playedDurationMs: number | null;
};

export const SongCard: FC<{
  song: Song;
  onPress?: () => void;
  disablePress?: boolean;
  className?: string;
  dragControls?: DragControls;
  dimPlayed?: boolean;
}> = ({
  song,
  onPress,
  disablePress,
  className,
  dragControls,
  dimPlayed = true,
}) => {
  return (
    <Card
      isPressable={!!onPress && !disablePress}
      isDisabled={song.isPlayed && !song.isLastPlayed}
      onPress={disablePress ? undefined : onPress}
      className={cn('relative', className, {
        'opacity-50': dimPlayed && song.isPlayed && !song.isLastPlayed,
        'opacity-100!': !dimPlayed,
        'border-success': song.isLastPlayed,
      })}
      classNames={{
        base: 'w-full ',
        body: 'p-0',
      }}
      radius="sm"
    >
      <CardBody className="gap-3 justify-between flex-row min-h-0 items-stretch">
        <Image
          src={song.cover}
          alt={song.title}
          radius="none"
          className="size-16 max-w-none object-cover"
        />
        <div className="flex flex-col justify-center grow py-2 min-w-16">
          <p className="text-lg leading-tight truncate">
            <span className="text-default-400">{song.id}.</span> {song.title}
          </p>
          <p className="text-xs text-default-500 leading-tight truncate">
            {song.artist}
          </p>
        </div>
        <div className="flex items-center gap-2 mr-4">
          {song.isPlayed && !song.isLastPlayed && (
            <div className="font-brand max-xs:hidden text-right tracking-wide text-sm text-default-600">
              {formatCompactDuration(song.playedDurationMs)}
            </div>
          )}
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
          {song.isPlayed ? (
            <Chip
              color="success"
              variant="flat"
              className="font-brand tracking-widest uppercase text-2xl font-light"
              startContent={<IconCircleCheckFilled size={24} />}
            >
              {song.position}
            </Chip>
          ) : (
            <Chip
              color="default"
              variant="flat"
              className="font-brand tracking-widest uppercase text-2xl font-light opacity-20 hover:opacity-50 focus:opacity-50 transition-opacity"
            >
              {song.position}
            </Chip>
          )}
        </div>
        {dragControls && (
          <div
            aria-label="Reordenar cançó"
            onPointerDown={(event) => {
              event.stopPropagation();
              dragControls.start(event);
            }}
            className="w-12 flex items-center justify-center cursor-grab -ml-7 text-default-400 hover:text-default-900 active:text-default-900 transition-colors"
          >
            <IconGripVertical size={22} />
          </div>
        )}
      </CardBody>
    </Card>
  );
};
