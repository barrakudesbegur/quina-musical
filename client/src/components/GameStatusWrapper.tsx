import { FC, PropsWithChildren, useMemo } from 'react'
import { trpc } from '../utils/trpc'
import { GameStatusScreen } from './GameStatusScreen'

export const GameStatusWrapper: FC<PropsWithChildren> = ({ children }) => {
  const gameStatusQuery = trpc.game.getStatus.useQuery(undefined, {
    retryDelay: 5_000,
    retry: Infinity,
    refetchInterval: 60 * 1_000,
  })

  const gameStatus = useMemo(() => {
    if (gameStatusQuery.failureCount >= 1) return 'not-avilable'
    if (gameStatusQuery.status === 'success') return gameStatusQuery.data.status
    if (gameStatusQuery.status === 'pending') return 'loading'
    return 'not-avilable'
  }, [gameStatusQuery])

  return gameStatus === 'ongoing' || gameStatus === 'paused' ? (
    children
  ) : (
    <GameStatusScreen status={gameStatus} />
  )
}
