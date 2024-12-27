import { FC, useMemo } from 'react'
import { Outlet } from 'react-router-dom'
import { trpc } from '../utils/trpc'
import { GameStatus, GameStatusScreen } from './GameStatusScreen'

export const GameStateGuard: FC<{
  allowedStatuses?: GameStatus[]
}> = ({ allowedStatuses = ['ongoing'] }) => {
  const gameStatusSub = trpc.game.getStatus.useSubscription()

  const gameStatus = useMemo(() => {
    if (!gameStatusSub.data) return 'not-avilable'
    return gameStatusSub.data.status
  }, [gameStatusSub.data])

  return allowedStatuses.includes(gameStatus) ? (
    <Outlet />
  ) : (
    <GameStatusScreen status={gameStatus} />
  )
}
