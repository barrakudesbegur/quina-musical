import { Tab, Tabs } from '@heroui/react';
import { differenceInMilliseconds, isValid, parseISO } from 'date-fns';
import { Reorder, useDragControls, useMotionValue } from 'framer-motion';
import { sortBy } from 'lodash-es';
import { ComponentProps, FC, useCallback, useMemo } from 'react';
import { useSessionStorage } from 'usehooks-ts';
import { trpc } from '../utils/trpc';
import { SongCard } from './SongCard';

const sortStorageKey = 'playback-manual-sort';
const filterStorageKey = 'playback-filter';

const filterOptions = [
  { key: 'all', label: 'Totes' },
  { key: 'not-played', label: 'No reproduïdes' },
  { key: 'played', label: 'Reproduïdes' },
] as const;

type FilterKey = (typeof filterOptions)[number]['key'];

export const SongsSection: FC<{
  onPlaySong: (songId: number) => void;
  onUndoLastPlayed: () => void;
}> = ({ onPlaySong, onUndoLastPlayed }) => {
  const utils = trpc.useUtils();
  const songsQuery = trpc.game.getAllSongs.useQuery();

  const setQueueOrderMutation = trpc.game.setQueueOrder.useMutation({
    onMutate: async ({ songIds }) => {
      await utils.game.getAllSongs.cancel();

      const previousSongs = utils.game.getAllSongs.getData();

      utils.game.getAllSongs.setData(undefined, (old) => {
        if (!old) return previousSongs;

        const totalPlayed = old.filter((song) => song.isPlayed).length;

        const queueSongsPositions = songIds.map((id, index) => ({
          id,
          position: totalPlayed + index + 1,
          positionInQueue: index + 1,
        }));

        return old.map((song) => {
          const songPositions = queueSongsPositions.find(
            (s) => s.id === song.id
          );
          if (!songPositions) return song;

          return {
            ...song,
            position: songPositions.position,
            positionInQueue: songPositions.positionInQueue,
          };
        });
      });

      return { previousSongs };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousSongs) {
        utils.game.getAllSongs.setData(undefined, context.previousSongs);
      }
    },
    onSettled: () => {
      void utils.game.invalidate();
    },
  });

  const [filterKey, setFilterKey] = useSessionStorage<FilterKey>(
    filterStorageKey,
    'not-played'
  );

  const sortOptions = [
    { key: 'position', label: 'Reproducció' },
    { key: 'title', label: 'Títol' },
    { key: 'id', label: 'Playlist' },
  ] as const satisfies readonly {
    key: keyof NonNullable<typeof songsQuery.data>[number];
    label: string;
  }[];

  type SortKey = (typeof sortOptions)[number]['key'];
  const [sortKey, setSortKey] = useSessionStorage<SortKey>(
    sortStorageKey,
    sortOptions[0].key
  );

  const durationMap = useMemo(() => {
    const playedSongsChronological =
      songsQuery.data
        ?.filter((song) => song.isPlayed && song.playedAt)
        .map((song) => ({
          id: song.id,
          playedAt: parseISO(song.playedAt!),
        }))
        .filter((song) => isValid(song.playedAt))
        .sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime()) ?? [];

    const durationMap = new Map<number, number>();
    for (let i = 0; i < playedSongsChronological.length - 1; i++) {
      const current = playedSongsChronological[i];
      const next = playedSongsChronological[i + 1];
      const ms = differenceInMilliseconds(next.playedAt, current.playedAt);
      if (ms > 0) {
        durationMap.set(current.id, ms);
      }
    }
    return durationMap;
  }, [songsQuery.data]);

  const songsWithPlayedDurationMs = useMemo(() => {
    if (!songsQuery.data) return [];

    return songsQuery.data.map((song) => ({
      ...song,
      playedDurationMs: durationMap.get(song.id) ?? null,
    }));
  }, [durationMap, songsQuery.data]);

  const filteredSongs = useMemo(() => {
    if (filterKey === 'played') {
      return songsWithPlayedDurationMs.filter((song) => song.isPlayed);
    }
    if (filterKey === 'not-played') {
      return songsWithPlayedDurationMs.filter((song) => !song.isPlayed);
    }
    return songsWithPlayedDurationMs;
  }, [songsWithPlayedDurationMs, filterKey]);

  const sortedSongs = useMemo(() => {
    return sortBy(filteredSongs, [sortKey, 'id']);
  }, [filteredSongs, sortKey]);

  const songsInQueue = useMemo(
    () =>
      sortBy(filteredSongs.filter((song) => !song.isPlayed) ?? [], [
        'position',
        'id',
      ]),
    [filteredSongs]
  );

  const handleCardPress = useCallback(
    (song: { id: number; isPlayed: boolean; isLastPlayed: boolean | null }) => {
      if (song.isLastPlayed) {
        onUndoLastPlayed();
      } else if (!song.isPlayed) {
        onPlaySong(song.id);
      }
    },
    [onUndoLastPlayed, onPlaySong]
  );

  return (
    <section className="flex flex-1 min-h-0 flex-col">
      <h2 className="text-3xl font-brand uppercase text-center mb-2 tracking-wider">
        Cançons
      </h2>
      <Tabs
        aria-label="Filtrar cançons"
        selectedKey={filterKey}
        onSelectionChange={(key) => setFilterKey(key as FilterKey)}
        className="mb-2 shrink-0"
        fullWidth
      >
        {filterOptions.map(({ key, label }) => (
          <Tab key={key} title={label} />
        ))}
      </Tabs>
      <Tabs
        aria-label="Ordenar cançons"
        selectedKey={sortKey}
        onSelectionChange={(key) => setSortKey(key as SortKey)}
        className="mb-4 shrink-0"
        fullWidth
      >
        {sortOptions.map(({ key, label }) => (
          <Tab key={key} title={label} />
        ))}
      </Tabs>
      <div className="space-y-2 -m-4 flex-1 overflow-y-auto p-4">
        {sortKey === 'position' ? (
          <>
            {(filterKey === 'played'
              ? sortedSongs.filter((song) => song.isPlayed).reverse()
              : sortedSongs.filter((song) => song.isPlayed)
            ).map((song) => (
              <SongCard
                key={song.id}
                song={song}
                onPress={() => handleCardPress(song)}
                disablePress={setQueueOrderMutation.isPending}
                dimPlayed={filterKey === 'all'}
              />
            ))}
            {!!songsInQueue.length && (
              <Reorder.Group
                axis="y"
                values={songsInQueue.map((song) => song.id)}
                onReorder={(newOrder) =>
                  setQueueOrderMutation.mutate({ songIds: newOrder })
                }
                className="space-y-2 list-none"
              >
                {songsInQueue.map((song) => (
                  <ReorderSongCard
                    key={song.id}
                    song={song}
                    onPress={() => handleCardPress(song)}
                    disablePress={setQueueOrderMutation.isPending}
                    dimPlayed={filterKey === 'all'}
                  />
                ))}
              </Reorder.Group>
            )}
          </>
        ) : (
          sortedSongs.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              onPress={() => handleCardPress(song)}
              dimPlayed={filterKey === 'all'}
            />
          ))
        )}
      </div>
    </section>
  );
};

export const ReorderSongCard = ({
  ...cardProps
}: ComponentProps<typeof SongCard>) => {
  const y = useMotionValue(0);
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={cardProps.song.id}
      id={cardProps.song.id.toString()}
      style={{ y }}
      dragListener={false}
      dragControls={dragControls}
      className="relative"
    >
      <SongCard {...cardProps} dragControls={dragControls} />
    </Reorder.Item>
  );
};
