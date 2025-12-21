import { cn, Tab, Tabs } from '@heroui/react';
import { BarChart } from '@mui/x-charts/BarChart';
import { orderBy, sum } from 'lodash-es';
import { FC, PropsWithChildren, useMemo } from 'react';
import { useSessionStorage } from 'usehooks-ts';
import { trpc } from '../utils/trpc';
import { CardsForm } from './CardsForm';
import { IconCrown } from '@tabler/icons-react';

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

export const GameInsightsSection: FC<
  PropsWithChildren<{ className?: string }>
> = ({ className }) => {
  const cardsQuery = trpc.card.getAll.useQuery();
  const songsQuery = trpc.game.getAllSongs.useQuery();
  const cardsPlayingQuery = trpc.game.getCardsPlaying.useQuery();

  const [modeKey, setModeKey] = useSessionStorage<ModeKey>(
    'game-insights-mode',
    'quina'
  );

  const data = useMemo<{
    chart: ChartPoint[];
    winners: { id: number; isPlaying: boolean }[];
  }>(() => {
    const cardsPlayingSet = new Set(cardsPlayingQuery.data);
    const playedSongIds = new Set(
      songsQuery.data?.filter((song) => song.isPlayed).map((song) => song.id)
    );

    const cardsInPlay =
      cardsQuery.data?.filter((card) => cardsPlayingSet.has(Number(card.id))) ??
      [];

    const maxPossibleScore = cardsInPlay[0]
      ? getMaxScore(cardsInPlay[0], modeKey)
      : 0;

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

    const chartData = Array.from(
      { length: maxScore + 1 },
      (_, playedCount) => ({
        playedCount,
        cardCount: distribution[playedCount] ?? 0,
      })
    );

    const winners = orderBy(
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
    );

    return { chart: chartData, winners };
  }, [cardsPlayingQuery.data, cardsQuery, songsQuery.data, modeKey]);

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

      <div className="mt-10">
        {isLoading ? (
          <p className="text-center text-default-500">Carregant grafic...</p>
        ) : hasError ? (
          <p className="text-center text-danger">
            No s'han pogut carregar les dades.
          </p>
        ) : !data.chart.length ? (
          <p className="text-center text-default-500">
            {cardsPlayingQuery.data?.length
              ? 'Encara no hi ha cap cançó reproduida.'
              : 'Afegeix els cartrons en joc per veure dades.'}
          </p>
        ) : (
          <div className="w-full overflow-x-auto">
            <BarChart
              dataset={data.chart}
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

      {data.winners.length ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(calc(3ch+--spacing(2)),1fr))] gap-2">
          {data.winners.map((card) => (
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
