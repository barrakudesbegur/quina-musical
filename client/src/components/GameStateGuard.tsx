import { FC, useMemo } from 'react'
import { Outlet } from 'react-router-dom'
import { trpc } from '../utils/trpc'
import { GameStatus, GameStatusScreen } from './GameStatusScreen'

export const GameStateGuard: FC<{
  allowedStatuses?: GameStatus[]
}> = ({ allowedStatuses = ['ongoing'] }) => {
  const gameStatusQuery = trpc.game.getStatusApi.useQuery(undefined, {
    retryDelay: 5_000,
    retry: Infinity,
    refetchInterval: 60 * 1_000,
  })

  const gameStatusSub = trpc.game.getStatus.useSubscription()

  const gameStatus = useMemo(() => {
    if (gameStatusQuery.failureCount >= 1) return 'not-avilable'
    return gameStatusSub.data?.status ?? 'not-avilable'
  }, [gameStatusQuery.failureCount, gameStatusSub.data?.status])

  return allowedStatuses.includes(gameStatus) ? (
    <Outlet />
  ) : (
    <GameStatusScreen status={gameStatus} />
  )
}
