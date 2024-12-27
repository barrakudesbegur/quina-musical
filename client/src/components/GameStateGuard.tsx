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
  const utils = trpc.useUtils()

  const gameStatusApi = useMemo(() => {
    if (gameStatusQuery.failureCount >= 1) return 'not-avilable'
    if (gameStatusQuery.status === 'success') return gameStatusQuery.data.status
    if (gameStatusQuery.status === 'pending') return 'loading'
    return 'not-avilable'
  }, [gameStatusQuery])

  const gameStatusSub = trpc.game.getStatus.useSubscription(undefined, {
    onData: async () => {
      await utils.game.getStatusApi.reset()
    },
    onError: async () => {
      await utils.game.getStatusApi.reset()
    },
  })

  const gameStatusFromSub = useMemo(() => {
    if (!gameStatusSub.data) return 'not-avilable'
    return gameStatusSub.data.status
  }, [gameStatusSub.data])

  const gameStatus = useMemo(() => {
    if (!gameStatusQuery.isSuccess) return gameStatusApi

    return gameStatusFromSub
  }, [gameStatusApi, gameStatusFromSub, gameStatusQuery.isSuccess])

  return allowedStatuses.includes(gameStatus) ? (
    <Outlet />
  ) : (
    <GameStatusScreen status={gameStatus} />
  )
}
