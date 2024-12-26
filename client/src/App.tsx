import { FC } from 'react'
import { GameStatusScreen } from './components/GameStatusScreen'
import { Main } from './components/Main'
import { trpc } from './utils/trpc'

export const App: FC = () => {
  const gameStatus = trpc.game.getStatus.useQuery()

  return gameStatus.data?.status === 'ongoing' ||
    gameStatus.data?.status === 'paused' ? (
    <Main />
  ) : (
    <GameStatusScreen status={gameStatus.data?.status ?? 'not-avilable'} />
  )
}
