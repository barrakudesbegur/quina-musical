import { FC, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import { trpc } from '../utils/trpc';
import { GameStatus, GameStatusScreen } from './GameStatusScreen';

export const GameStateGuard: FC<{
  allowedStatuses?: GameStatus[];
}> = ({ allowedStatuses = ['ongoing'] }) => {
  const gameStatusQuery = trpc.game.getStatusNow.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });

  const gameStatus = useMemo(() => {
    if (!gameStatusQuery.data) return 'not-avilable';
    return gameStatusQuery.data.status;
  }, [gameStatusQuery.data]);

  return allowedStatuses.includes(gameStatus) ? (
    <Outlet />
  ) : (
    <GameStatusScreen status={gameStatus} />
  );
};
