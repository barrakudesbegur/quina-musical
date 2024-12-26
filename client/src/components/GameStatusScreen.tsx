import { inferProcedureOutput } from '@trpc/server'
import { FC } from 'react'
import { AppRouter } from '../../../server/src/api'
import { makeHelpersForOptions } from '../utils/makeHelpersForOptions'
import { transformCase } from '../utils/strings'
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconPower,
  IconGift,
  TablerIcon,
} from '@tabler/icons-react'

type GameStatusInfo<T extends string | null | undefined = string> = {
  id: T
  label: string
  description: string | null
  icon: TablerIcon
}

const {
  // dataArray: gameStatusInfo,
  // dataObject: gameStatusInfoById,
  // getFn: getGameStatusInfo,
  useGetHook: useGameStatusInfo,
} = makeHelpersForOptions(
  'id',
  (id): GameStatusInfo<typeof id> => ({
    id,
    label: id ? transformCase(id, 'title') : String(id),
    description: null,
    icon: IconPlayerPause,
  }),
  [
    {
      id: 'not-avilable',
      label: 'Sistema apagat',
      description: "Espera't a que iniciem la app",
      icon: IconPower,
    },
    {
      id: 'not-started',
      label: 'Encara no hem començat',
      description:
        "Espera't una estona. Aprofita per comprar el cartró i prepara't.",
      icon: IconPlayerPause,
    },
    {
      id: 'ongoing',
      label: 'Ja estem jugant!',
      description: 'Recarrega la pàgina',
      icon: IconPlayerPlay,
    },
    {
      id: 'paused',
      label: 'Hem fet una pausa',
      description: 'Recarrega la pàgina',
      icon: IconPlayerPause,
    },
    {
      id: 'finished',
      label: 'Ja hem acavat',
      description: 'Gràcies per participar',
      icon: IconGift,
    },
  ] as const
)

type GameStatus =
  | inferProcedureOutput<AppRouter['game']['getStatus']>['status']
  | 'not-avilable'

export const GameStatusScreen: FC<{
  status: GameStatus
}> = ({ status }) => {
  const { label, description, icon: Icon } = useGameStatusInfo(status)
  return (
    <main className="min-h-dvh w-dvw flex items-center justify-center flex-col text-center text-balance gap-4 px-4">
      <Icon size={48} stroke={1.5} />
      <h1 className="text-3xl font-bold uppercase tracking-wide">{label}</h1>
      {description && <p className="text-lg">{description}</p>}
    </main>
  )
}
