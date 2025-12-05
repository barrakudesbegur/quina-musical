import { BarChart } from '@mui/x-charts/BarChart';
import { cn } from '@heroui/react';
import { FC, PropsWithChildren, useMemo } from 'react';
import { trpc } from '../utils/trpc';
import { CardsForm } from './CardsForm';

type ChartPoint = {
  playedCount: number;
  cardCount: number;
};

export const GameInsightsSection: FC<
  PropsWithChildren<{ className?: string }>
> = ({ className }) => {
  const cardsQuery = trpc.card.getAll.useQuery();
  const songsQuery = trpc.game.getAllSongs.useQuery();
  const cardsPlayingQuery = trpc.game.getCardsPlaying.useQuery();

  const chartData = useMemo<ChartPoint[]>(() => {
    if (!cardsQuery.data || !songsQuery.data || !cardsPlayingQuery.data) {
      return [];
    }

    if (!cardsPlayingQuery.data.length) {
      return [];
    }

    const cardsPlayingSet = new Set(cardsPlayingQuery.data);
    const playedSongIds = new Set(
      songsQuery.data.filter((song) => song.isPlayed).map((song) => song.id)
    );

    const cardsInPlay = cardsQuery.data.filter((card) =>
      cardsPlayingSet.has(Number(card.id))
    );

    if (!cardsInPlay.length) {
      return [];
    }

    const songsPerCard =
      cardsInPlay[0]?.lines.reduce((total, line) => total + line.length, 0) ??
      0;

    const distribution = cardsInPlay.reduce<Record<number, number>>(
      (acc, card) => {
        const playedCount = card.lines
          .flat()
          .filter((song) => playedSongIds.has(song.id)).length;

        acc[playedCount] = (acc[playedCount] ?? 0) + 1;
        return acc;
      },
      {}
    );

    const maxPlayed = Math.max(
      songsPerCard,
      ...Object.keys(distribution).map((key) => Number.parseInt(key, 10)),
      0
    );

    return Array.from({ length: maxPlayed + 1 }, (_, playedCount) => ({
      playedCount,
      cardCount: distribution[playedCount] ?? 0,
    }));
  }, [cardsPlayingQuery.data, cardsQuery.data, songsQuery.data]);

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
    </section>
  );
};
