import { FC, useMemo } from 'react'
import { GameStatusScreen } from './components/GameStatusScreen'
import { Main } from './components/Main'
import { trpc } from './utils/trpc'

export const App: FC = () => {
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
    <Main />
  ) : (
    <GameStatusScreen status={gameStatus} />
  )
}
