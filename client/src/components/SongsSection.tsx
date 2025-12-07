import { Card, CardBody, Chip, Tab, Tabs, cn } from '@heroui/react';
import { IconArrowBackUp, IconCircleCheckFilled } from '@tabler/icons-react';
import { FC, useMemo } from 'react';
import { sortBy } from 'lodash-es';
import { trpc } from '../utils/trpc';
import { useSessionStorage } from 'usehooks-ts';

const sortStorageKey = 'playback-manual-sort';

export const SongsSection: FC<{
  onPlaySong: (songId: number) => void;
  onUndoLastPlayed: () => void;
}> = ({ onPlaySong, onUndoLastPlayed }) => {
  const songsQuery = trpc.game.getAllSongs.useQuery();

  const sortOptions = [
    { key: 'expectedPlayedPosition', label: 'Reproducció' },
    { key: 'title', label: 'Títol' },
    { key: 'id', label: 'Playlist' },
  ] as const satisfies readonly {
    key: keyof (typeof songsWithLastPlayed)[number];
    label: string;
  }[];
  type SortKey = (typeof sortOptions)[number]['key'];
  const [sortKey, setSortKey] = useSessionStorage<SortKey>(
    sortStorageKey,
    sortOptions[0].key
  );

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

  const sortedSongs = useMemo(() => {
    return sortBy(songsWithLastPlayed, [sortKey, 'id']);
  }, [songsWithLastPlayed, sortKey]);

  const handleCardPress = (song: (typeof songsWithLastPlayed)[number]) => {
    if (song.isLastPlayed) {
      onUndoLastPlayed();
    } else if (!song.isPlayed) {
      onPlaySong(song.id);
    }
  };

  return (
    <section>
      <h2 className="text-3xl font-brand uppercase text-center mb-2 tracking-wider">
        Cançons
      </h2>
      <Tabs
        aria-label="Ordenar cançons"
        selectedKey={sortKey}
        onSelectionChange={(key) => setSortKey(key as SortKey)}
        className="mb-2"
        fullWidth
      >
        {sortOptions.map(({ key, label }) => (
          <Tab key={key} title={label} />
        ))}
      </Tabs>
      <div className="space-y-2 -mx-2">
        {sortedSongs.map((song) => (
          <Card
            key={song.id}
            isPressable
            isDisabled={song.isPlayed && !song.isLastPlayed}
            onPress={() => handleCardPress(song)}
            className={cn('relative', {
              'opacity-50': song.isPlayed && !song.isLastPlayed,
              'border-success': song.isLastPlayed,
            })}
            classNames={{
              base: 'w-full',
            }}
            radius="sm"
          >
            <CardBody className="gap-3 justify-between flex-row min-h-0 items-center">
              <img
                src={song.cover}
                alt={song.title}
                className="size-16 -m-3 mr-0 object-cover rounded-l-lg "
              />
              <div className="flex flex-col grow">
                <p className="text-lg leading-tight">
                  <span className="text-default-400  ">{song.id}.</span>{' '}
                  {song.title}
                </p>
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
                {song.isPlayed ? (
                  <Chip
                    color="success"
                    variant="flat"
                    className="font-brand tracking-widest uppercase text-2xl font-light"
                    startContent={<IconCircleCheckFilled size={24} />}
                  >
                    {song.playedPosition}
                  </Chip>
                ) : (
                  <Chip
                    color="default"
                    variant="flat"
                    className="font-brand tracking-widest uppercase text-2xl font-light opacity-20 hover:opacity-50 focus:opacity-50 transition-opacity"
                  >
                    {song.expectedPlayedPosition}
                  </Chip>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </section>
  );
};
