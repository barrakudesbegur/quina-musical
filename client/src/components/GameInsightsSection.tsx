import { cn, Tab, Tabs } from '@heroui/react';
import { BarChart } from '@mui/x-charts/BarChart';
import { orderBy, sortBy, sum } from 'lodash-es';
import { FC, PropsWithChildren, useMemo } from 'react';
import { useSessionStorage } from 'usehooks-ts';
import { trpc } from '../utils/trpc';
import { CardsForm } from './CardsForm';
import { IconCrown } from '@tabler/icons-react';
import { format } from 'date-fns';

type ChartPoint = {
  playedCount: number;
  cardCount: number;
};

const modeOptions = [
  { key: 'quina', label: 'Quina' },
  { key: 'linea', label: 'Línia' },
] as const satisfies readonly {
  key: string;
  label: string;
}[];

type ModeKey = (typeof modeOptions)[number]['key'];

type Card = {
  id: number;
  lines: { id: number }[][];
};

const getCardScore = (
  card: Card,
  playedSongIds: Set<number>,
  mode: ModeKey
) => {
  if (mode === 'quina') {
    return card.lines.flat().filter((song) => playedSongIds.has(song.id))
      .length;
  } else {
    return Math.max(
      ...card.lines.map(
        (line) => line.filter((song) => playedSongIds.has(song.id)).length
      )
    );
  }
};

const getMaxScore = (card: Card, mode: ModeKey) => {
  if (mode === 'quina') {
    return sum(card.lines.map((line) => line.length));
  } else {
    return Math.max(...card.lines.map((line) => line.length));
  }
};

const DEFAULT_SONG_PLAY_DURATION_MS = 15_000;

export const GameInsightsSection: FC<
  PropsWithChildren<{ className?: string; now: number }>
> = ({ className, now }) => {
  const cardsQuery = trpc.card.getAll.useQuery();
  const songsQuery = trpc.game.getAllSongs.useQuery();
  const cardsPlayingQuery = trpc.game.getCardsPlaying.useQuery();

  const [modeKey, setModeKey] = useSessionStorage<ModeKey>(
    'game-insights-mode',
    'quina'
  );

  const cardsPlayingSet = useMemo(
    () => new Set(cardsPlayingQuery.data),
    [cardsPlayingQuery.data]
  );

  const playedSongIds = useMemo(
    () =>
      new Set(
        songsQuery.data?.filter((song) => song.isPlayed).map((song) => song.id)
      ),
    [songsQuery.data]
  );

  const cardsInPlay = useMemo(
    () =>
      cardsQuery.data?.filter((card) => cardsPlayingSet.has(Number(card.id))) ??
      [],
    [cardsQuery.data, cardsPlayingSet]
  );

  const maxPossibleScore = useMemo(
    () => (cardsInPlay[0] ? getMaxScore(cardsInPlay[0], modeKey) : 0),
    [cardsInPlay, modeKey]
  );

  const chartData = useMemo<ChartPoint[]>(() => {
    const distribution = cardsInPlay.reduce<Record<number, number>>(
      (acc, card) => {
        const score = getCardScore(card, playedSongIds, modeKey);
        acc[score] ??= 0;
        acc[score] += 1;
        return acc;
      },
      {}
    );

    const maxScore = Math.max(
      maxPossibleScore,
      ...Object.keys(distribution).map((key) => Number.parseInt(key, 10)),
      0
    );

    return Array.from({ length: maxScore + 1 }, (_, playedCount) => ({
      playedCount,
      cardCount: distribution[playedCount] ?? 0,
    }));
  }, [cardsInPlay, playedSongIds, modeKey, maxPossibleScore]);

  const winners = useMemo(
    () =>
      orderBy(
        cardsQuery.data
          ?.filter(
            (card) =>
              getCardScore(card, playedSongIds, modeKey) >= maxPossibleScore
          )
          .map((card) => ({
            ...card,
            isPlaying: cardsPlayingSet.has(Number(card.id)),
          })),
        ['isPlaying', 'id'],
        ['desc', 'asc']
      ),
    [cardsQuery.data, playedSongIds, modeKey, maxPossibleScore, cardsPlayingSet]
  );

  const songsInQueueUntilFinish = useMemo(() => {
    if (cardsInPlay.length === 0 || !songsQuery.data) return null;

    const songsInQueue = sortBy(
      songsQuery.data.filter(
        (song) => !song.isPlayed && song.positionInQueue !== null
      ),
      'positionInQueue'
    );

    const songsNeeded = Array.from(
      { length: songsInQueue.length + 1 },
      (_, count) => count
    ).find((count) => {
      const simulatedPlayedIds = new Set([
        ...playedSongIds,
        ...songsInQueue.slice(0, count).map((song) => song.id),
      ]);

      return cardsInPlay.some(
        (card) =>
          getCardScore(card, simulatedPlayedIds, modeKey) >= maxPossibleScore
      );
    });

    return songsNeeded ?? null;
  }, [cardsInPlay, songsQuery.data, playedSongIds, modeKey, maxPossibleScore]);

  const avgTimeBetweenSongs = useMemo(() => {
    if (songsInQueueUntilFinish === null || !songsQuery.data)
      return DEFAULT_SONG_PLAY_DURATION_MS;

    const playedSongs = songsQuery.data
      .filter((song) => song.isPlayed && song.playedAt)
      .sort(
        (a, b) =>
          new Date(a.playedAt!).getTime() - new Date(b.playedAt!).getTime()
      );

    if (playedSongs.length === 0) return DEFAULT_SONG_PLAY_DURATION_MS;

    const last5Songs = playedSongs.slice(-5);

    const timeDifferences = last5Songs
      .slice(1)
      .map(
        (song, i) =>
          new Date(song.playedAt!).getTime() -
          new Date(last5Songs[i].playedAt!).getTime()
      );

    const currentSongDuration =
      now - new Date(last5Songs[last5Songs.length - 1].playedAt!).getTime();

    const durations = [...timeDifferences, currentSongDuration];

    return sum(durations) / durations.length;
  }, [songsInQueueUntilFinish, songsQuery.data, now]);

  const estimatedFinishTime = useMemo(() => {
    return new Date(now + avgTimeBetweenSongs * (songsInQueueUntilFinish ?? 0));
  }, [songsInQueueUntilFinish, avgTimeBetweenSongs, now]);

  const estimatedFinishTimeFormatted = useMemo(() => {
    return format(estimatedFinishTime, 'K:mm aaa');
  }, [estimatedFinishTime]);

  const isLoading =
    cardsQuery.isLoading || songsQuery.isLoading || cardsPlayingQuery.isLoading;
  const hasError =
    cardsQuery.isError || songsQuery.isError || cardsPlayingQuery.isError;

  return (
    <section className={cn('space-y-6', className)}>
      <h2 className="text-3xl font-brand uppercase text-center mb-2 tracking-wider">
        Dades
      </h2>
      <CardsForm className="mt-4" />
      <Tabs
        aria-label="Mode de visualització"
        selectedKey={modeKey}
        onSelectionChange={(key) => setModeKey(key as ModeKey)}
        className="shrink-0"
        fullWidth
      >
        {modeOptions.map(({ key, label }) => (
          <Tab key={key} title={label} />
        ))}
      </Tabs>

      <p className="text-center">
        <span className="font-medium">Fi:</span>{' '}
        <span>{estimatedFinishTimeFormatted}</span>{' '}
        {songsInQueueUntilFinish !== null && (
          <span>({songsInQueueUntilFinish} cançons)</span>
        )}
      </p>

      <div className="mt-10">
        {isLoading ? (
          <p className="text-center text-default-500">Carregant grafic...</p>
        ) : hasError ? (
          <p className="text-center text-danger">
            No s'han pogut carregar les dades.
          </p>
        ) : !chartData.length ? (
          <p className="text-center text-default-500">
            {cardsPlayingQuery.data?.length
              ? 'Encara no hi ha cap cançó reproduida.'
              : 'Afegeix els cartrons en joc per veure dades.'}
          </p>
        ) : (
          <div className="w-full overflow-x-auto">
            <BarChart
              dataset={chartData}
              height={320}
              xAxis={[
                {
                  dataKey: 'playedCount',
                  label: 'Encerts',
                  scaleType: 'band',
                },
              ]}
              yAxis={[
                {
                  label: 'Nº cartrons',
                },
              ]}
              series={[
                {
                  dataKey: 'cardCount',
                  label: 'Cartrons',
                },
              ]}
              hideLegend
              barLabel="value"
              margin={{ left: 0, right: 32, top: 0, bottom: 0 }}
            />
          </div>
        )}
      </div>

      {winners.length ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(calc(3ch+--spacing(2)),1fr))] gap-2">
          {winners.map((card) => (
            <li
              className={cn(
                'min-w-[3ch] text-center font-mono py-1 leading-none bg-gray-200/80 rounded-md',
                !card.isPlaying && 'opacity-50 hover:opacity-100'
              )}
            >
              {card.id}
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-center italic text-sm text-gray-600 border border-gray-200 rounded-xl">
          <IconCrown className="size-16 stroke-[0.75] block mx-auto -my-2 text-gray-400" />
          <p className="mb-2">Els guanyadors sortiran aquí</p>
        </div>
      )}
    </section>
  );
};
